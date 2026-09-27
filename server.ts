import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  ALL_ROOMS,
  ALL_SUSPECTS,
  ALL_WEAPONS,
  AccusationResultPayload,
  DisprovedCardPayload,
  GameState,
  MaskedGameState,
  Player,
  Room,
  SECRET_PASSAGES,
  Suspect,
  SUSPECT_STARTING_POSITIONS,
  Weapon,
} from './src/types/cluedo';
import {
  disproveCard,
  endTurn,
  initializeGame,
  makeAccusation,
  makeSuggestion,
  maskStateForPeer,
  moveToken,
  rollDice,
  useSecretPassage,
} from './src/engine/cluedoEngine';

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Enable JSON body parsing and permissive CORS for browser/iframe previews
app.use(express.json({ limit: '4mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper to sanitize 6-character room codes
function cleanCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim().slice(0, 6);
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ----------------------------------------------------
// Server-Authoritative Game Room State
// ----------------------------------------------------
interface ConnectedClient {
  peerId: string;
  name: string;
  character: Suspect;
  isHost: boolean;
  ws: WebSocket | null;
  lastSeen: number;
  pendingDisproved: DisprovedCardPayload | null;
  pendingAccusation: AccusationResultPayload | null;
}

interface ServerRoom {
  roomCode: string;
  hostPeerId: string;
  masterState: GameState;
  clients: Map<string, ConnectedClient>;
  aiTimeout: NodeJS.Timeout | null;
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, ServerRoom>();
const CACHE_FILE = path.join(process.cwd(), '.rooms_cache.json');

function persistRoomsToDisk() {
  try {
    const serializable: Record<string, any> = {};
    for (const [code, room] of rooms.entries()) {
      if (Date.now() - room.lastActivity < 4 * 3600 * 1000) {
        serializable[code] = {
          roomCode: room.roomCode,
          hostPeerId: room.hostPeerId,
          masterState: room.masterState,
          createdAt: room.createdAt,
          lastActivity: room.lastActivity,
          clients: Array.from(room.clients.entries()).map(([peerId, c]) => ({
            peerId: c.peerId,
            name: c.name,
            character: c.character,
            isHost: c.isHost,
            lastSeen: c.lastSeen,
          })),
        };
      }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(serializable), 'utf8');
  } catch {
    // Ignore in environments where filesystem write is restricted
  }
}

function restoreRoomsFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      for (const [code, r] of Object.entries<any>(data)) {
        if (Date.now() - r.lastActivity < 4 * 3600 * 1000) {
          const clientsMap = new Map<string, ConnectedClient>();
          for (const c of r.clients || []) {
            clientsMap.set(c.peerId, {
              peerId: c.peerId,
              name: c.name,
              character: c.character,
              isHost: c.isHost,
              ws: null,
              lastSeen: c.lastSeen,
              pendingDisproved: null,
              pendingAccusation: null,
            });
          }
          rooms.set(code, {
            roomCode: r.roomCode,
            hostPeerId: r.hostPeerId,
            masterState: r.masterState,
            clients: clientsMap,
            aiTimeout: null,
            createdAt: r.createdAt,
            lastActivity: r.lastActivity,
          });
        }
      }
      console.log(`[Server] Restored ${rooms.size} cached active rooms from disk.`);
    }
  } catch (err) {
    console.warn('[Server] Could not restore room cache from disk:', err);
  }
}

// ----------------------------------------------------
// Room Broadcasting & State Distribution
// ----------------------------------------------------
function broadcastRoomState(room: ServerRoom) {
  room.lastActivity = Date.now();
  persistRoomsToDisk();

  for (const client of room.clients.values()) {
    const masked = maskStateForPeer(room.masterState, client.peerId);

    if (client.ws && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(
          JSON.stringify({
            type: 'STATE_UPDATE',
            state: masked,
            disprovedCard: client.pendingDisproved,
            accusationResult: client.pendingAccusation,
          })
        );
      } catch (err) {
        console.warn(`[WS Broadcast] Failed to send to ${client.name} (${client.peerId}):`, err);
      }
    }

    // Reset pending confidential revelations after transmission so they don't persist
    client.pendingDisproved = null;
    client.pendingAccusation = null;
  }

  // Check if AI needs to take action
  triggerAiIfNeeded(room);
}

// ----------------------------------------------------
// Server-Side AI Automation
// ----------------------------------------------------
function triggerAiIfNeeded(room: ServerRoom) {
  if (room.masterState.phase === 'LOBBY' || room.masterState.phase === 'GAME_OVER') {
    if (room.aiTimeout) {
      clearTimeout(room.aiTimeout);
      room.aiTimeout = null;
    }
    return;
  }

  if (room.aiTimeout) {
    clearTimeout(room.aiTimeout);
    room.aiTimeout = null;
  }

  // Case 1: Active player is AI
  const activePlayer = room.masterState.players[room.masterState.activePlayerIndex];
  const isAiTurn = activePlayer && activePlayer.isAi && !activePlayer.hasAccusedWrongly;

  // Case 2: Disprover is AI
  const isAiDisprove =
    room.masterState.phase === 'DISPROVE' &&
    room.masterState.pendingDisproverIndex !== null &&
    room.masterState.players[room.masterState.pendingDisproverIndex]?.isAi;

  if (isAiTurn || isAiDisprove) {
    room.aiTimeout = setTimeout(() => {
      executeAiStep(room);
    }, 850);
  }
}

function executeAiStep(room: ServerRoom) {
  if (!room.masterState || room.masterState.phase === 'LOBBY' || room.masterState.phase === 'GAME_OVER') return;

  // 1. AI Disproving
  if (room.masterState.phase === 'DISPROVE' && room.masterState.pendingDisproverIndex !== null) {
    const disprover = room.masterState.players[room.masterState.pendingDisproverIndex];
    if (disprover && disprover.isAi && room.masterState.currentSuggestion) {
      const sugg = room.masterState.currentSuggestion;
      const matchingCards = disprover.hand.filter(
        (c) => c.name === sugg.suspect || c.name === sugg.weapon || c.name === sugg.room
      );

      if (matchingCards.length > 0) {
        const chosenCard = matchingCards[Math.floor(Math.random() * matchingCards.length)];
        executeRoomAction(room, disprover.peerId, {
          type: 'DISPROVE_CARD',
          payload: { cardId: chosenCard.id },
        });
      }
      return;
    }
  }

  // 2. AI Active Turn Actions
  const activePlayer = room.masterState.players[room.masterState.activePlayerIndex];
  if (!activePlayer || !activePlayer.isAi) return;

  if (room.masterState.phase === 'ROLL') {
    // Maybe take secret passage if in room
    if (activePlayer.position.room) {
      const passage = SECRET_PASSAGES[activePlayer.position.room];
      if (passage && Math.random() < 0.45) {
        executeRoomAction(room, activePlayer.peerId, {
          type: 'USE_SECRET_PASSAGE',
          payload: { targetRoom: passage },
        });
        return;
      }
    }
    // Roll dice
    executeRoomAction(room, activePlayer.peerId, { type: 'ROLL_DICE' });
  } else if (room.masterState.phase === 'MOVE') {
    const validMoves = room.masterState.validMoves || [];
    if (validMoves.length === 0) {
      executeRoomAction(room, activePlayer.peerId, { type: 'END_TURN' });
      return;
    }
    // Prioritize stepping into a room doorway
    const doorwayMove = validMoves.find((m) => m.isDoorway);
    const chosenMove = doorwayMove || validMoves[Math.floor(Math.random() * validMoves.length)];

    executeRoomAction(room, activePlayer.peerId, {
      type: 'MOVE_TOKEN',
      payload: { x: chosenMove.x, y: chosenMove.y },
    });
  } else if (room.masterState.phase === 'SUGGEST') {
    if (activePlayer.position.room) {
      const myHandNames = new Set(activePlayer.hand.map((c) => c.name));
      const candidateSuspects = ALL_SUSPECTS.filter((s) => !myHandNames.has(s));
      const candidateWeapons = ALL_WEAPONS.filter((w) => !myHandNames.has(w));

      const suspect = candidateSuspects[Math.floor(Math.random() * candidateSuspects.length)] || ALL_SUSPECTS[0];
      const weapon = candidateWeapons[Math.floor(Math.random() * candidateWeapons.length)] || ALL_WEAPONS[0];

      executeRoomAction(room, activePlayer.peerId, {
        type: 'MAKE_SUGGESTION',
        payload: { suspect, weapon },
      });
    } else {
      executeRoomAction(room, activePlayer.peerId, { type: 'END_TURN' });
    }
  } else if (room.masterState.phase === 'ACCUSE') {
    executeRoomAction(room, activePlayer.peerId, { type: 'END_TURN' });
  }
}

// ----------------------------------------------------
// Central Action Dispatcher (Server-Authoritative)
// ----------------------------------------------------
function executeRoomAction(
  room: ServerRoom,
  senderPeerId: string,
  action: { type: string; payload?: any }
): { success: boolean; error?: string } {
  const { type, payload } = action;
  room.lastActivity = Date.now();

  try {
    switch (type) {
      case 'SELECT_CHARACTER': {
        if (room.masterState.phase !== 'LOBBY') return { success: false, error: 'Match already in progress' };
        const targetChar = payload?.character as Suspect;
        if (!targetChar) return { success: false, error: 'Missing character' };

        const isTaken = room.masterState.players.some(
          (p) => p.character === targetChar && p.peerId !== senderPeerId
        );
        if (isTaken) return { success: false, error: `${targetChar} is already chosen by another detective.` };

        const player = room.masterState.players.find((p) => p.peerId === senderPeerId);
        if (player) {
          player.character = targetChar;
          player.position = {
            x: SUSPECT_STARTING_POSITIONS[targetChar].x,
            y: SUSPECT_STARTING_POSITIONS[targetChar].y,
            room: null,
          };
          player.startingPosition = SUSPECT_STARTING_POSITIONS[targetChar];

          const client = room.clients.get(senderPeerId);
          if (client) client.character = targetChar;

          broadcastRoomState(room);
          return { success: true };
        }
        return { success: false, error: 'Player not found in room' };
      }

      case 'ADD_BOT': {
        if (room.masterState.phase !== 'LOBBY') return { success: false, error: 'Match already in progress' };
        if (room.masterState.players.length >= 6) return { success: false, error: 'Room is full (max 6 players)' };

        const targetChar = payload?.character as Suspect;
        if (!targetChar) return { success: false, error: 'Missing character' };

        const isTaken = room.masterState.players.some((p) => p.character === targetChar);
        if (isTaken) return { success: false, error: `${targetChar} is already in the game.` };

        const botId = `bot_${targetChar.toLowerCase().replace(/[\s.]+/g, '_')}_${Date.now()}`;
        const botPlayer: Player = {
          peerId: botId,
          character: targetChar,
          name: `AI Detective (${targetChar})`,
          isHost: false,
          isAi: true,
          position: {
            x: SUSPECT_STARTING_POSITIONS[targetChar].x,
            y: SUSPECT_STARTING_POSITIONS[targetChar].y,
            room: null,
          },
          hand: [],
          hasAccusedWrongly: false,
          isConnected: true,
          startingPosition: SUSPECT_STARTING_POSITIONS[targetChar],
        };

        room.masterState.players.push(botPlayer);
        room.masterState.logs.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          type: 'SYSTEM',
          message: `AI Detective assigned to ${targetChar}.`,
        });

        broadcastRoomState(room);
        return { success: true };
      }

      case 'REMOVE_PLAYER': {
        if (room.masterState.phase !== 'LOBBY') return { success: false, error: 'Match already in progress' };
        const peerIdToRemove = payload?.peerId;
        if (!peerIdToRemove) return { success: false, error: 'Missing peerId' };

        room.masterState.players = room.masterState.players.filter((p) => p.peerId !== peerIdToRemove);
        room.clients.delete(peerIdToRemove);

        broadcastRoomState(room);
        return { success: true };
      }

      case 'START_MATCH': {
        if (room.masterState.phase !== 'LOBBY') return { success: false, error: 'Game already started' };
        if (senderPeerId !== room.hostPeerId) return { success: false, error: 'Only the Host can start the match' };
        if (room.masterState.players.length < 2) {
          return { success: false, error: 'At least 2 players or AI bots are required to begin.' };
        }

        const playerConfigs = room.masterState.players.map((p) => ({
          peerId: p.peerId,
          character: p.character,
          name: p.name,
          isHost: p.isHost,
          isAi: p.isAi,
        }));

        room.masterState = initializeGame(playerConfigs, room.roomCode);
        broadcastRoomState(room);
        return { success: true };
      }

      case 'ROLL_DICE': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn to roll' };
        room.masterState = rollDice(room.masterState);
        broadcastRoomState(room);
        return { success: true };
      }

      case 'MOVE_TOKEN': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn to move' };
        room.masterState = moveToken(room.masterState, payload.x, payload.y);
        broadcastRoomState(room);
        return { success: true };
      }

      case 'USE_SECRET_PASSAGE': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn' };
        room.masterState = useSecretPassage(room.masterState, payload.targetRoom);
        broadcastRoomState(room);
        return { success: true };
      }

      case 'MAKE_SUGGESTION': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn to suggest' };
        const result = makeSuggestion(room.masterState, payload.suspect, payload.weapon);
        room.masterState = result.state;
        broadcastRoomState(room);
        return { success: true };
      }

      case 'DISPROVE_CARD': {
        if (room.masterState.phase !== 'DISPROVE') return { success: false, error: 'Not in disprove phase' };
        const disprover = room.masterState.players[room.masterState.pendingDisproverIndex ?? -1];
        if (!disprover || disprover.peerId !== senderPeerId) {
          return { success: false, error: 'Not your turn to disprove' };
        }

        const { state: nextState } = disproveCard(room.masterState, senderPeerId, payload.cardId);
        room.masterState = nextState;

        // Queue private disproved notification for suggester
        const suggesterPeerId = nextState.lastDisprovedCardForSuggester?.suggesterPeerId;
        if (suggesterPeerId) {
          const suggesterClient = room.clients.get(suggesterPeerId);
          if (suggesterClient) {
            suggesterClient.pendingDisproved = nextState.lastDisprovedCardForSuggester;
          }
        }

        broadcastRoomState(room);
        return { success: true };
      }

      case 'MAKE_ACCUSATION': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn to accuse' };
        const { state: nextState, result } = makeAccusation(
          room.masterState,
          payload.suspect,
          payload.weapon,
          payload.room
        );
        room.masterState = nextState;

        // Queue private accusation envelope revelation for accuser
        const accuserClient = room.clients.get(senderPeerId);
        if (accuserClient) {
          accuserClient.pendingAccusation = result;
        }

        broadcastRoomState(room);
        return { success: true };
      }

      case 'END_TURN': {
        if (!isActivePlayer(room, senderPeerId)) return { success: false, error: 'Not your turn to pass' };
        room.masterState = endTurn(room.masterState);
        broadcastRoomState(room);
        return { success: true };
      }

      case 'CHAT_MESSAGE': {
        const sender = room.masterState.players.find((p) => p.peerId === senderPeerId);
        if (sender && payload?.text?.trim()) {
          room.masterState.logs.push({
            id: `chat_${Date.now()}`,
            timestamp: Date.now(),
            type: 'CHAT',
            message: payload.text.trim(),
            playerPeerId: sender.peerId,
            playerName: sender.name,
            playerCharacter: sender.character,
          });
          broadcastRoomState(room);
          return { success: true };
        }
        return { success: false, error: 'Empty message' };
      }

      default:
        return { success: false, error: `Unknown action: ${type}` };
    }
  } catch (err: any) {
    console.error(`[Server Action Error] ${type}:`, err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

function isActivePlayer(room: ServerRoom, peerId: string): boolean {
  if (room.masterState.phase === 'LOBBY' || room.masterState.phase === 'GAME_OVER') return false;
  const active = room.masterState.players[room.masterState.activePlayerIndex];
  return active?.peerId === peerId;
}

// ----------------------------------------------------
// REST APIs (100% Failsafe Cross-Network Reliability)
// ----------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    activeRooms: rooms.size,
  });
});

// Create Room
app.post('/api/rooms/create', (req, res) => {
  const { character, name, roomCode: customCode } = req.body || {};
  let code = customCode ? cleanCode(customCode) : generateRandomCode();

  // Ensure unique code
  while (rooms.has(code)) {
    code = generateRandomCode();
  }

  const hostName = (name || 'Host Detective').trim().slice(0, 24);
  const hostChar: Suspect = ALL_SUSPECTS.includes(character) ? character : 'Miss Scarlet';
  const hostPeerId = `host_${code}_${Date.now()}`;

  const hostPlayer: Player = {
    peerId: hostPeerId,
    character: hostChar,
    name: hostName,
    isHost: true,
    isAi: false,
    position: {
      x: SUSPECT_STARTING_POSITIONS[hostChar].x,
      y: SUSPECT_STARTING_POSITIONS[hostChar].y,
      room: null,
    },
    hand: [],
    hasAccusedWrongly: false,
    isConnected: true,
    startingPosition: SUSPECT_STARTING_POSITIONS[hostChar],
  };

  const initialMasterState: GameState = {
    roomCode: code,
    phase: 'LOBBY',
    envelope: { suspect: 'Miss Scarlet', weapon: 'Candlestick', room: 'Hall' },
    players: [hostPlayer],
    activePlayerIndex: 0,
    diceRoll: null,
    remainingSteps: 0,
    currentSuggestion: null,
    pendingDisproverIndex: null,
    winner: null,
    weaponPositions: {
      Candlestick: 'Kitchen',
      Dagger: 'Ballroom',
      'Lead Pipe': 'Conservatory',
      Revolver: 'Dining Room',
      Rope: 'Billiard Room',
      Wrench: 'Library',
    },
    turnNumber: 1,
    logs: [
      {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        type: 'SYSTEM',
        message: `Investigation room created by ${hostName} (${hostChar}). Room Code: ${code}`,
      },
    ],
    validMoves: [],
  };

  const newRoom: ServerRoom = {
    roomCode: code,
    hostPeerId,
    masterState: initialMasterState,
    clients: new Map(),
    aiTimeout: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  newRoom.clients.set(hostPeerId, {
    peerId: hostPeerId,
    name: hostName,
    character: hostChar,
    isHost: true,
    ws: null,
    lastSeen: Date.now(),
    pendingDisproved: null,
    pendingAccusation: null,
  });

  rooms.set(code, newRoom);
  console.log(`[Server] Created room ${code} by ${hostName}`);

  const masked = maskStateForPeer(initialMasterState, hostPeerId);
  return res.json({
    success: true,
    roomCode: code,
    peerId: hostPeerId,
    isHost: true,
    state: masked,
  });
});

// Join Room (Guest or Reconnection)
app.post('/api/rooms/:roomCode/join', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: `Room "${code}" not found. Please double-check the 6-letter room code with the host.`,
    });
  }

  const { name, character, peerId: existingPeerId } = req.body || {};
  const guestName = (name || 'Guest Detective').trim().slice(0, 24);

  // Check if player is reconnecting with existing peerId or name
  let targetPlayer = existingPeerId
    ? room.masterState.players.find((p) => p.peerId === existingPeerId)
    : room.masterState.players.find((p) => p.name.toLowerCase() === guestName.toLowerCase());

  if (targetPlayer) {
    // Reconnecting player
    targetPlayer.isConnected = true;
    let client = room.clients.get(targetPlayer.peerId);
    if (!client) {
      client = {
        peerId: targetPlayer.peerId,
        name: targetPlayer.name,
        character: targetPlayer.character,
        isHost: targetPlayer.isHost,
        ws: null,
        lastSeen: Date.now(),
        pendingDisproved: null,
        pendingAccusation: null,
      };
      room.clients.set(targetPlayer.peerId, client);
    }
    client.lastSeen = Date.now();

    broadcastRoomState(room);
    const masked = maskStateForPeer(room.masterState, targetPlayer.peerId);
    return res.json({
      success: true,
      roomCode: code,
      peerId: targetPlayer.peerId,
      isHost: targetPlayer.isHost,
      state: masked,
    });
  }

  // New Player Joining Lobby
  if (room.masterState.phase !== 'LOBBY') {
    return res.status(400).json({
      success: false,
      error: `Match has already started in room "${code}". Cannot join ongoing investigation.`,
    });
  }

  if (room.masterState.players.length >= 6) {
    return res.status(400).json({
      success: false,
      error: `Room "${code}" is full (maximum 6 detectives).`,
    });
  }

  // Determine character: requested or next available
  const takenChars = new Set(room.masterState.players.map((p) => p.character));
  let assignedChar: Suspect = ALL_SUSPECTS.includes(character) && !takenChars.has(character)
    ? character
    : ALL_SUSPECTS.find((s) => !takenChars.has(s)) || 'Colonel Mustard';

  const guestPeerId = `guest_${code}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newPlayer: Player = {
    peerId: guestPeerId,
    character: assignedChar,
    name: guestName,
    isHost: false,
    isAi: false,
    position: {
      x: SUSPECT_STARTING_POSITIONS[assignedChar].x,
      y: SUSPECT_STARTING_POSITIONS[assignedChar].y,
      room: null,
    },
    hand: [],
    hasAccusedWrongly: false,
    isConnected: true,
    startingPosition: SUSPECT_STARTING_POSITIONS[assignedChar],
  };

  room.masterState.players.push(newPlayer);
  room.masterState.logs.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'SYSTEM',
    message: `${guestName} joined the investigation as ${assignedChar}.`,
    playerPeerId: guestPeerId,
    playerName: guestName,
    playerCharacter: assignedChar,
  });

  room.clients.set(guestPeerId, {
    peerId: guestPeerId,
    name: guestName,
    character: assignedChar,
    isHost: false,
    ws: null,
    lastSeen: Date.now(),
    pendingDisproved: null,
    pendingAccusation: null,
  });

  console.log(`[Server] ${guestName} (${guestPeerId}) joined room ${code} as ${assignedChar}`);

  broadcastRoomState(room);

  const masked = maskStateForPeer(room.masterState, guestPeerId);
  return res.json({
    success: true,
    roomCode: code,
    peerId: guestPeerId,
    isHost: false,
    state: masked,
  });
});

// Query Room Status
app.get('/api/rooms/:roomCode', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const room = rooms.get(code);

  if (!room) {
    return res.json({ exists: false });
  }

  return res.json({
    exists: true,
    roomCode: code,
    playerCount: room.masterState.players.length,
    phase: room.masterState.phase,
    createdAt: room.createdAt,
  });
});

// Poll State via HTTP (Fail-safe for any network environment)
app.get('/api/rooms/:roomCode/state', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const peerId = (req.query.peerId as string) || '';
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ success: false, error: `Room "${code}" not found.` });
  }

  const client = room.clients.get(peerId);
  if (client) client.lastSeen = Date.now();

  const masked = maskStateForPeer(room.masterState, peerId);
  const disproved = client?.pendingDisproved || null;
  const accusation = client?.pendingAccusation || null;

  if (client) {
    client.pendingDisproved = null;
    client.pendingAccusation = null;
  }

  return res.json({
    success: true,
    state: masked,
    disprovedCard: disproved,
    accusationResult: accusation,
  });
});

// Dispatch Action via HTTP
app.post('/api/rooms/:roomCode/action', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const { peerId, action } = req.body || {};
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ success: false, error: `Room "${code}" not found.` });
  }

  if (!peerId || !action) {
    return res.status(400).json({ success: false, error: 'Missing peerId or action payload' });
  }

  const result = executeRoomAction(room, peerId, action);
  if (!result.success) {
    return res.status(400).json(result);
  }

  const client = room.clients.get(peerId);
  const masked = maskStateForPeer(room.masterState, peerId);
  return res.json({
    success: true,
    state: masked,
    disprovedCard: client?.pendingDisproved || null,
    accusationResult: client?.pendingAccusation || null,
  });
});

// Leave / Disconnect Player
app.post('/api/rooms/:roomCode/leave', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const { peerId } = req.body || {};
  const room = rooms.get(code);

  if (!room) return res.json({ success: true });

  if (room.masterState.phase === 'LOBBY') {
    room.masterState.players = room.masterState.players.filter((p) => p.peerId !== peerId);
    room.clients.delete(peerId);
  } else {
    const player = room.masterState.players.find((p) => p.peerId === peerId);
    if (player) player.isConnected = false;
  }

  broadcastRoomState(room);
  return res.json({ success: true });
});

// ----------------------------------------------------
// Global Multi-Room Real-Time Relay Broker
// Seamless global connectivity across different Wi-Fi networks, cellular, and long distances
// ----------------------------------------------------
interface RelayClient {
  peerId: string;
  roomCode: string;
  isHost: boolean;
  ws: WebSocket | null;
  sseRes: express.Response | null;
  lastSeen: number;
}

interface RelayRoom {
  roomCode: string;
  clients: Map<string, RelayClient>;
  recentPackets: any[];
  pendingTargetedPackets: Map<string, any[]>;
  latestSyncState: any | null;
  lastActivity: number;
}

const relayRooms = new Map<string, RelayRoom>();

function getOrCreateRelayRoom(code: string): RelayRoom {
  const clean = cleanCode(code);
  let room = relayRooms.get(clean);
  if (!room) {
    room = {
      roomCode: clean,
      clients: new Map(),
      recentPackets: [],
      pendingTargetedPackets: new Map(),
      latestSyncState: null,
      lastActivity: Date.now(),
    };
    relayRooms.set(clean, room);
  }
  room.lastActivity = Date.now();
  return room;
}

function flushPendingPacketsForClient(
  room: RelayRoom,
  peerId: string,
  ws?: WebSocket | null,
  sseRes?: express.Response | null
) {
  const queue = room.pendingTargetedPackets.get(peerId);
  if (!queue || queue.length === 0) return;

  const packets = [...queue];
  queue.length = 0;

  for (const pkt of packets) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'RELAY_PACKET', roomCode: room.roomCode, packet: pkt }));
      } catch (err) {
        console.warn(`[Relay WS Flush] Error sending to ${peerId}:`, err);
      }
    } else if (sseRes && !sseRes.writableEnded) {
      try {
        sseRes.write(`data: ${JSON.stringify(pkt)}\n\n`);
      } catch (err) {
        console.warn(`[Relay SSE Flush] Error sending to ${peerId}:`, err);
      }
    }
  }
}

function broadcastRelayPacket(roomCode: string, packet: any, excludeSenderId?: string) {
  const clean = cleanCode(roomCode);
  const room = getOrCreateRelayRoom(clean);
  room.lastActivity = Date.now();

  // Keep a ring buffer of recent packets
  room.recentPackets.push(packet);
  if (room.recentPackets.length > 100) {
    room.recentPackets.shift();
  }

  // Cache latest SYNC_STATE for instant state delivery to newly connected or reconnecting detectives
  if (packet?.payload?.type === 'SYNC_STATE' && packet.payload.state) {
    room.latestSyncState = packet;
  }

  const targetPeerId = packet.payload?.targetPeerId;
  const wsMessage = JSON.stringify({ type: 'RELAY_PACKET', roomCode: clean, packet });
  const sseMessage = `data: ${JSON.stringify(packet)}\n\n`;

  let deliveredToTarget = false;

  for (const client of room.clients.values()) {
    if (excludeSenderId && client.peerId === excludeSenderId) {
      continue;
    }

    // Confidential Targeted Packet Routing (never leak direct payloads to third parties)
    if (targetPeerId && client.peerId !== targetPeerId) {
      continue;
    }

    // Deliver via WebSocket
    if (client.ws && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(wsMessage);
        if (targetPeerId && client.peerId === targetPeerId) deliveredToTarget = true;
      } catch (err) {
        console.warn(`[Relay WS] Error sending to ${client.peerId}:`, err);
      }
    }

    // Deliver via Server-Sent Events (SSE)
    if (client.sseRes && !client.sseRes.writableEnded) {
      try {
        client.sseRes.write(sseMessage);
        if (targetPeerId && client.peerId === targetPeerId) deliveredToTarget = true;
      } catch (err) {
        console.warn(`[Relay SSE] Error sending to ${client.peerId}:`, err);
      }
    }
  }

  // If this packet was targeted to a peer who is still in the middle of connecting, buffer it
  if (targetPeerId && !deliveredToTarget) {
    let queue = room.pendingTargetedPackets.get(targetPeerId);
    if (!queue) {
      queue = [];
      room.pendingTargetedPackets.set(targetPeerId, queue);
    }
    queue.push(packet);
    if (queue.length > 50) queue.shift();
  }
}

// REST Relay Send (Fail-safe HTTP delivery for any network environment)
app.post('/api/relay/send', (req, res) => {
  const { roomCode, packet } = req.body || {};
  if (!roomCode || !packet || !packet.id) {
    return res.status(400).json({ success: false, error: 'Missing roomCode or packet' });
  }

  const clean = cleanCode(roomCode);
  broadcastRelayPacket(clean, packet, packet.senderId);
  return res.json({ success: true, timestamp: Date.now() });
});

// REST Relay SSE (Server-Sent Events streaming pipeline for firewalled networks)
app.get('/api/relay/sse', (req, res) => {
  const roomCode = cleanCode(req.query.roomCode as string);
  const peerId = (req.query.peerId as string) || `anon_${Date.now()}`;
  if (!roomCode) {
    return res.status(400).send('Missing roomCode');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');

  const room = getOrCreateRelayRoom(roomCode);
  let client = room.clients.get(peerId);
  if (!client) {
    client = {
      peerId,
      roomCode,
      isHost: false,
      ws: null,
      sseRes: res,
      lastSeen: Date.now(),
    };
    room.clients.set(peerId, client);
  } else {
    client.sseRes = res;
    client.lastSeen = Date.now();
  }

  // If there is an active sync state, send immediately to fast-sync this detective
  if (room.latestSyncState) {
    res.write(`data: ${JSON.stringify(room.latestSyncState)}\n\n`);
  }

  // Deliver any targeted packets queued for this detective
  flushPendingPacketsForClient(room, peerId, null, res);

  const ssePing = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n');
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(ssePing);
    if (client) {
      client.sseRes = null;
    }
  });
});

// REST Relay Poll (Fail-safe polling for restricted mobile networks)
app.get('/api/relay/poll', (req, res) => {
  const roomCode = cleanCode(req.query.roomCode as string);
  const peerId = (req.query.peerId as string) || '';
  const since = Number(req.query.since) || 0;

  if (!roomCode) {
    return res.status(400).json({ success: false, error: 'Missing roomCode' });
  }

  const room = getOrCreateRelayRoom(roomCode);
  let client = room.clients.get(peerId);
  if (!client) {
    client = {
      peerId,
      roomCode,
      isHost: false,
      ws: null,
      sseRes: null,
      lastSeen: Date.now(),
    };
    room.clients.set(peerId, client);
  } else {
    client.lastSeen = Date.now();
  }

  // Extract any queued packets targeted specifically to this client
  const pendingQueue = room.pendingTargetedPackets.get(peerId) || [];
  const flushedPending: any[] = [];
  if (pendingQueue.length > 0) {
    flushedPending.push(...pendingQueue);
    pendingQueue.length = 0;
  }

  const freshPackets = room.recentPackets.filter(
    (p) =>
      p.timestamp > since &&
      p.senderId !== peerId &&
      (!p.payload?.targetPeerId || p.payload.targetPeerId === peerId)
  );

  const combinedMap = new Map<string, any>();
  for (const p of freshPackets) combinedMap.set(p.id, p);
  for (const p of flushedPending) combinedMap.set(p.id, p);

  return res.json({
    success: true,
    packets: Array.from(combinedMap.values()),
    latestSyncState: room.latestSyncState,
    now: Date.now(),
  });
});

// ----------------------------------------------------
// WebSocket Server on Port 3000 (`/ws`)
// ----------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const urlObj = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    if (pathname === '/ws' || pathname === '/ws/' || pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.warn('[WS Server] Upgrade error:', err);
  }
});

wss.on('connection', (ws: WebSocket) => {
  let boundRoomCode: string | null = null;
  let boundPeerId: string | null = null;

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 15000);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, roomCode, peerId, isHost, packet, action } = data;

      if (type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }

      // Universal Relay Channel Join (Global seamless connection across networks)
      if (type === 'RELAY_JOIN') {
        const code = cleanCode(roomCode);
        boundRoomCode = code;
        boundPeerId = peerId;

        const relayRoom = getOrCreateRelayRoom(code);
        let client = relayRoom.clients.get(peerId);
        if (!client) {
          client = {
            peerId,
            roomCode: code,
            isHost: !!isHost,
            ws,
            sseRes: null,
            lastSeen: Date.now(),
          };
          relayRoom.clients.set(peerId, client);
        } else {
          client.ws = ws;
          client.isHost = !!isHost;
          client.lastSeen = Date.now();
        }

        ws.send(JSON.stringify({ type: 'RELAY_JOINED', roomCode: code, peerId }));

        // Send cached latest SYNC_STATE immediately so guest gets board instantly
        if (relayRoom.latestSyncState) {
          ws.send(
            JSON.stringify({
              type: 'RELAY_PACKET',
              roomCode: code,
              packet: relayRoom.latestSyncState,
            })
          );
        }

        // Deliver any targeted packets queued for this client
        flushPendingPacketsForClient(relayRoom, peerId, ws);
        return;
      }

      // Universal Relay Packet Broadcast
      if (type === 'RELAY_PACKET') {
        const code = cleanCode(roomCode || boundRoomCode || '');
        if (code && packet) {
          broadcastRelayPacket(code, packet, boundPeerId || packet.senderId);
        }
        return;
      }

      if (type === 'JOIN_CHANNEL') {
        const code = cleanCode(roomCode);
        boundRoomCode = code;
        boundPeerId = peerId;

        const room = rooms.get(code);
        if (room && peerId) {
          const client = room.clients.get(peerId);
          if (client) {
            client.ws = ws;
            client.lastSeen = Date.now();
          }

          const masked = maskStateForPeer(room.masterState, peerId);
          ws.send(
            JSON.stringify({
              type: 'STATE_UPDATE',
              state: masked,
              disprovedCard: client?.pendingDisproved || null,
              accusationResult: client?.pendingAccusation || null,
            })
          );
        }
        return;
      }

      if (type === 'ACTION') {
        const code = cleanCode(roomCode || boundRoomCode || '');
        const sender = peerId || boundPeerId;
        const room = rooms.get(code);

        if (room && sender && action) {
          executeRoomAction(room, sender, action);
        }
        return;
      }
    } catch (err) {
      console.error('[WS Server] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (boundRoomCode && boundPeerId) {
      // Clean from server rooms
      const room = rooms.get(boundRoomCode);
      if (room) {
        const client = room.clients.get(boundPeerId);
        if (client) {
          client.ws = null;
          client.lastSeen = Date.now();
        }
      }
      // Clean from relay rooms
      const relayRoom = relayRooms.get(boundRoomCode);
      if (relayRoom) {
        const client = relayRoom.clients.get(boundPeerId);
        if (client) {
          client.ws = null;
          client.lastSeen = Date.now();
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('[WS Server] Socket error:', err);
  });
});

// Periodic cleanup of stale rooms & relay rooms (no activity for 4 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 4 * 60 * 60 * 1000) {
      if (room.aiTimeout) clearTimeout(room.aiTimeout);
      rooms.delete(code);
      console.log(`[Server] Pruned stale game room ${code}`);
    }
  }
  for (const [code, room] of relayRooms.entries()) {
    if (now - room.lastActivity > 4 * 60 * 60 * 1000) {
      relayRooms.delete(code);
      console.log(`[Server] Pruned stale relay room ${code}`);
    }
  }
}, 5 * 60 * 1000);

// Sync room state (for fast sync / reconnection on Vercel)
app.get('/api/rooms/:roomCode/sync', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({
      success: false,
      error: `Room "${code}" not found.`,
    });
  }
  const peerId = (req.query.peerId as string) || '__SPECTATOR__';
  const masked = maskStateForPeer(room.masterState, peerId);
  return res.json({
    success: true,
    roomCode: code,
    state: masked,
    phase: room.masterState.phase,
  });
});

// ----------------------------------------------------
// Vite Middleware / Static Asset Serving
// ----------------------------------------------------
async function bootstrapServer() {
  restoreRoomsFromDisk();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cluedo Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error('Fatal error bootstrapping server:', err);
  process.exit(1);
});
