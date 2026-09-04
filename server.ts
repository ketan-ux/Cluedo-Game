import express from 'express';
import http from 'http';
import path from 'path';
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

// ----------------------------------------------------
// Room Broadcasting & State Distribution
// ----------------------------------------------------
function broadcastRoomState(room: ServerRoom) {
  room.lastActivity = Date.now();

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
      const { type, roomCode, peerId, action } = data;

      if (type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
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
      const room = rooms.get(boundRoomCode);
      if (room) {
        const client = room.clients.get(boundPeerId);
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

// Periodic cleanup of stale rooms (no activity for 4 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 4 * 60 * 60 * 1000) {
      if (room.aiTimeout) clearTimeout(room.aiTimeout);
      rooms.delete(code);
      console.log(`[Server] Pruned stale room ${code}`);
    }
  }
}, 5 * 60 * 1000);

// ----------------------------------------------------
// Vite Middleware / Static Asset Serving
// ----------------------------------------------------
async function bootstrapServer() {
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
