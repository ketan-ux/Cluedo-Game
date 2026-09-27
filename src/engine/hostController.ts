import {
  ALL_ROOMS,
  ALL_SUSPECTS,
  ALL_WEAPONS,
  AccusationResultPayload,
  Card,
  DisprovedCardPayload,
  GameState,
  MaskedGameState,
  NetworkPacket,
  Player,
  Room,
  SECRET_PASSAGES,
  SUSPECT_STARTING_POSITIONS,
  Suspect,
  Weapon,
} from '../types/cluedo';
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
} from './cluedoEngine';
import { clientTransport } from '../network/clientTransport';
import { gameCache } from '../utils/gameCache';

export class HostController {
  private roomCode: string;
  private hostPeerId: string;
  private masterState: GameState;
  private onStateUpdated: (
    state: MaskedGameState,
    disproved?: DisprovedCardPayload | null,
    accusation?: AccusationResultPayload | null
  ) => void;
  private aiTimer: NodeJS.Timeout | null = null;
  private syncHeartbeatTimer: NodeJS.Timeout | null = null;
  private pendingDisproved: Map<string, DisprovedCardPayload | null> = new Map();
  private pendingAccusation: Map<string, AccusationResultPayload | null> = new Map();

  constructor(
    roomCode: string,
    hostPeerId: string,
    hostName: string,
    hostChar: Suspect,
    onStateUpdated: (
      state: MaskedGameState,
      disproved?: DisprovedCardPayload | null,
      accusation?: AccusationResultPayload | null
    ) => void,
    cachedMasterState?: GameState
  ) {
    this.roomCode = roomCode;
    this.hostPeerId = hostPeerId;
    this.onStateUpdated = onStateUpdated;

    if (cachedMasterState && cachedMasterState.roomCode === roomCode) {
      // Rehydrate master state from persistent cache
      this.masterState = cachedMasterState;
      const hostPlayer = this.masterState.players.find((p) => p.isHost || p.peerId === hostPeerId);
      if (hostPlayer) {
        hostPlayer.peerId = hostPeerId;
        hostPlayer.isConnected = true;
      }
    } else {
      const hostPlayer: Player = {
        peerId: hostPeerId,
        name: hostName,
        character: hostChar,
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

      this.masterState = {
        roomCode,
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
            message: `Investigation room created by ${hostName} (${hostChar}). Room Code: ${roomCode}`,
          },
        ],
        validMoves: [],
      };
    }

    // Persist to cache
    gameCache.saveMasterState(this.roomCode, this.masterState);

    // Initial state update to host
    this.broadcastState();

    // Start background sync heartbeat (ensures all 5-6 players stay 100% in sync on Vercel)
    this.startSyncHeartbeat();
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  getMasterState(): GameState {
    return this.masterState;
  }

  // ----------------------------------------------------
  // Guest Join & Disconnect
  // ----------------------------------------------------

  handleJoinRequest(guestPeerId: string, guestName: string, preferredCharacter?: Suspect) {
    if (this.masterState.phase !== 'LOBBY') {
      // Reconnection check for ongoing investigation (e.g. tab reload or Vercel network switch)
      const existing = this.masterState.players.find(
        (p) => p.peerId === guestPeerId || (guestName && p.name.trim().toLowerCase() === guestName.trim().toLowerCase())
      );
      if (existing) {
        existing.isConnected = true;
        existing.peerId = guestPeerId; // Re-bind new peerId if changed
        // Acknowledge reconnect with current game state
        const reconnectState = maskStateForPeer(this.masterState, guestPeerId);
        clientTransport.send({
          type: 'JOIN_ACCEPTED',
          targetPeerId: guestPeerId,
          roomCode: this.roomCode,
          state: reconnectState,
        });
        this.broadcastState();
      } else {
        clientTransport.send({
          type: 'JOIN_REJECTED',
          targetPeerId: guestPeerId,
          reason: 'Investigation already underway and no matching detective was found to resume.',
        });
      }
      return;
    }

    // Check if player is already added
    const existing = this.masterState.players.find((p) => p.peerId === guestPeerId);
    if (existing) {
      this.broadcastState();
      return;
    }

    if (this.masterState.players.length >= 6) {
      clientTransport.send({
        type: 'JOIN_REJECTED',
        targetPeerId: guestPeerId,
        reason: 'Investigation room is at maximum capacity (6 detectives).',
      });
      return;
    }

    // Pick character
    const taken = new Set(this.masterState.players.map((p) => p.character));
    let character = preferredCharacter && !taken.has(preferredCharacter) ? preferredCharacter : undefined;
    if (!character) {
      character = ALL_SUSPECTS.find((s) => !taken.has(s));
    }
    if (!character) return;

    const newPlayer: Player = {
      peerId: guestPeerId,
      name: guestName || character,
      character,
      isHost: false,
      isAi: false,
      position: {
        x: SUSPECT_STARTING_POSITIONS[character].x,
        y: SUSPECT_STARTING_POSITIONS[character].y,
        room: null,
      },
      hand: [],
      hasAccusedWrongly: false,
      isConnected: true,
      startingPosition: SUSPECT_STARTING_POSITIONS[character],
    };

    this.masterState.players.push(newPlayer);
    this.masterState.logs.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      message: `${newPlayer.name} joined the investigation as ${character}.`,
      playerPeerId: newPlayer.peerId,
      playerName: newPlayer.name,
      playerCharacter: character,
    });

    this.broadcastState();

    // Direct ACK to guest with immediate masked game state
    const guestState = maskStateForPeer(this.masterState, guestPeerId);
    clientTransport.send({
      type: 'JOIN_ACCEPTED',
      targetPeerId: guestPeerId,
      roomCode: this.roomCode,
      assignedCharacter: character,
      state: guestState,
    });
  }

  // ----------------------------------------------------
  // Action Handler (Invoked for both Host and Guests)
  // ----------------------------------------------------

  handlePlayerAction(senderPeerId: string, action: NetworkPacket | { type: string; payload?: any }) {
    const { type } = action;
    const payload = 'payload' in action ? action.payload : undefined;

    try {
      switch (type) {
        case 'SELECT_CHARACTER': {
          if (this.masterState.phase !== 'LOBBY') return;
          const targetChar = payload?.character as Suspect;
          if (!targetChar) return;

          const isTaken = this.masterState.players.some(
            (p) => p.character === targetChar && p.peerId !== senderPeerId
          );
          if (isTaken) return;

          const player = this.masterState.players.find((p) => p.peerId === senderPeerId);
          if (player) {
            player.character = targetChar;
            player.position = {
              x: SUSPECT_STARTING_POSITIONS[targetChar].x,
              y: SUSPECT_STARTING_POSITIONS[targetChar].y,
              room: null,
            };
            player.startingPosition = SUSPECT_STARTING_POSITIONS[targetChar];
            this.broadcastState();
          }
          break;
        }

        case 'ADD_BOT': {
          if (this.masterState.phase !== 'LOBBY' || this.masterState.players.length >= 6) return;

          const taken = new Set(this.masterState.players.map((p) => p.character));
          const reqChar = payload?.character as Suspect;
          const assignedChar = reqChar && !taken.has(reqChar) ? reqChar : ALL_SUSPECTS.find((s) => !taken.has(s));
          if (!assignedChar) return;

          const aiNames: Record<Suspect, string> = {
            'Miss Scarlet': 'Scarlet (AI)',
            'Colonel Mustard': 'Mustard (AI)',
            'Mrs. White': 'Mrs. White (AI)',
            'Mr. Green': 'Mr. Green (AI)',
            'Mrs. Peacock': 'Mrs. Peacock (AI)',
            'Professor Plum': 'Prof. Plum (AI)',
          };

          const botPlayer: Player = {
            peerId: `ai_${assignedChar.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
            name: aiNames[assignedChar] || `${assignedChar} (AI)`,
            character: assignedChar,
            isHost: false,
            isAi: true,
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

          this.masterState.players.push(botPlayer);
          this.masterState.logs.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            type: 'SYSTEM',
            message: `${botPlayer.name} entered Tudor Close Manor as an autonomous investigator.`,
            playerPeerId: botPlayer.peerId,
            playerName: botPlayer.name,
            playerCharacter: assignedChar,
          });

          this.broadcastState();
          break;
        }

        case 'REMOVE_PLAYER': {
          if (this.masterState.phase !== 'LOBBY') return;
          const peerIdToRemove = payload?.peerId as string;
          if (!peerIdToRemove) return;

          const removed = this.masterState.players.find((p) => p.peerId === peerIdToRemove);
          if (removed && !removed.isHost) {
            this.masterState.players = this.masterState.players.filter((p) => p.peerId !== peerIdToRemove);
            this.masterState.logs.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              type: 'SYSTEM',
              message: `${removed.name} departed from the investigation lobby.`,
            });
            this.broadcastState();
          }
          break;
        }

        case 'START_MATCH': {
          if (this.masterState.phase !== 'LOBBY' || this.masterState.players.length < 2) return;

          const playerConfigs = this.masterState.players.map((p) => ({
            peerId: p.peerId,
            character: p.character,
            name: p.name,
            isHost: p.isHost,
            isAi: p.isAi,
          }));

          this.masterState = initializeGame(playerConfigs, this.roomCode);
          this.broadcastState();
          this.triggerAiIfNeeded();
          break;
        }

        case 'ROLL_DICE': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId && this.masterState.phase === 'ROLL') {
            this.masterState = rollDice(this.masterState);
            this.broadcastState();
          }
          break;
        }

        case 'MOVE_TOKEN': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId && this.masterState.phase === 'MOVE') {
            const { x, y } = payload || {};
            if (typeof x === 'number' && typeof y === 'number') {
              this.masterState = moveToken(this.masterState, x, y);
              this.broadcastState();
            }
          }
          break;
        }

        case 'USE_SECRET_PASSAGE': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId && this.masterState.phase === 'ROLL') {
            const targetRoom = payload?.targetRoom as Room;
            if (targetRoom) {
              this.masterState = useSecretPassage(this.masterState, targetRoom);
              this.broadcastState();
            }
          }
          break;
        }

        case 'MAKE_SUGGESTION': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId && (this.masterState.phase === 'MOVE' || this.masterState.phase === 'SUGGEST')) {
            const { suspect, weapon } = payload || {};
            if (suspect && weapon) {
              const res = makeSuggestion(this.masterState, suspect, weapon);
              this.masterState = res.state;
              this.broadcastState();
              this.triggerAiIfNeeded();
            }
          }
          break;
        }

        case 'DISPROVE_CARD': {
          if (this.masterState.phase === 'DISPROVE' && this.masterState.pendingDisproverIndex !== null) {
            const disprover = this.masterState.players[this.masterState.pendingDisproverIndex];
            if (disprover && disprover.peerId === senderPeerId) {
              const cardId = payload?.cardId as string;
              if (cardId) {
                const res = disproveCard(this.masterState, disprover.peerId, cardId);
                this.masterState = res.state;
                this.broadcastState(this.masterState.lastDisprovedCardForSuggester);
                this.triggerAiIfNeeded();
              }
            }
          }
          break;
        }

        case 'MAKE_ACCUSATION': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId) {
            const { suspect, weapon, room } = payload || {};
            if (suspect && weapon && room) {
              const res = makeAccusation(this.masterState, suspect, weapon, room);
              this.masterState = res.state;
              this.broadcastState(null, res.result);
              if (!this.masterState.winner) {
                this.triggerAiIfNeeded();
              }
            }
          }
          break;
        }

        case 'END_TURN': {
          const active = this.masterState.players[this.masterState.activePlayerIndex];
          if (active && active.peerId === senderPeerId) {
            this.masterState = endTurn(this.masterState);
            this.broadcastState();
            this.triggerAiIfNeeded();
          }
          break;
        }

        case 'CHAT_MESSAGE': {
          const sender = this.masterState.players.find((p) => p.peerId === senderPeerId);
          const text = (payload?.text || '').trim();
          if (sender && text) {
            this.masterState.logs.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              type: 'CHAT',
              message: `${sender.name}: ${text}`,
              playerPeerId: sender.peerId,
              playerName: sender.name,
              playerCharacter: sender.character,
            });
            this.broadcastState();
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[HostController] Error processing action:', type, err);
    }
  }

  // ----------------------------------------------------
  // AI Automation
  // ----------------------------------------------------

  private triggerAiIfNeeded() {
    if (this.masterState.phase === 'LOBBY' || this.masterState.phase === 'GAME_OVER') {
      if (this.aiTimer) {
        clearTimeout(this.aiTimer);
        this.aiTimer = null;
      }
      return;
    }

    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }

    const activePlayer = this.masterState.players[this.masterState.activePlayerIndex];
    const isAiTurn = activePlayer && activePlayer.isAi && !activePlayer.hasAccusedWrongly;

    const isAiDisprove =
      this.masterState.phase === 'DISPROVE' &&
      this.masterState.pendingDisproverIndex !== null &&
      this.masterState.players[this.masterState.pendingDisproverIndex]?.isAi;

    if (isAiTurn || isAiDisprove) {
      this.aiTimer = setTimeout(() => {
        this.executeAiStep();
      }, 900);
    }
  }

  private executeAiStep() {
    if (!this.masterState || this.masterState.phase === 'LOBBY' || this.masterState.phase === 'GAME_OVER') return;

    // 1. AI Disproving
    if (this.masterState.phase === 'DISPROVE' && this.masterState.pendingDisproverIndex !== null) {
      const disprover = this.masterState.players[this.masterState.pendingDisproverIndex];
      if (disprover && disprover.isAi && this.masterState.currentSuggestion) {
        const sugg = this.masterState.currentSuggestion;
        const matchingCards = disprover.hand.filter(
          (c) => c.name === sugg.suspect || c.name === sugg.weapon || c.name === sugg.room
        );

        if (matchingCards.length > 0) {
          const chosenCard = matchingCards[Math.floor(Math.random() * matchingCards.length)];
          this.handlePlayerAction(disprover.peerId, {
            type: 'DISPROVE_CARD',
            payload: { cardId: chosenCard.id },
          });
        }
        return;
      }
    }

    // 2. AI Active Turn Actions
    const activePlayer = this.masterState.players[this.masterState.activePlayerIndex];
    if (!activePlayer || !activePlayer.isAi) return;

    if (this.masterState.phase === 'ROLL') {
      if (activePlayer.position.room) {
        const passage = SECRET_PASSAGES[activePlayer.position.room];
        if (passage && Math.random() < 0.45) {
          this.handlePlayerAction(activePlayer.peerId, {
            type: 'USE_SECRET_PASSAGE',
            payload: { targetRoom: passage },
          });
          return;
        }
      }
      this.handlePlayerAction(activePlayer.peerId, { type: 'ROLL_DICE' });
    } else if (this.masterState.phase === 'MOVE') {
      const validMoves = this.masterState.validMoves || [];
      if (validMoves.length === 0) {
        this.handlePlayerAction(activePlayer.peerId, { type: 'END_TURN' });
        return;
      }
      const doorwayMove = validMoves.find((m) => m.isDoorway);
      const chosenMove = doorwayMove || validMoves[Math.floor(Math.random() * validMoves.length)];

      this.handlePlayerAction(activePlayer.peerId, {
        type: 'MOVE_TOKEN',
        payload: { x: chosenMove.x, y: chosenMove.y },
      });
    } else if (this.masterState.phase === 'SUGGEST') {
      if (activePlayer.position.room) {
        const myHandNames = new Set(activePlayer.hand.map((c) => c.name));
        const candidateSuspects = ALL_SUSPECTS.filter((s) => !myHandNames.has(s));
        const candidateWeapons = ALL_WEAPONS.filter((w) => !myHandNames.has(w));

        const suspect = candidateSuspects[Math.floor(Math.random() * candidateSuspects.length)] || ALL_SUSPECTS[0];
        const weapon = candidateWeapons[Math.floor(Math.random() * candidateWeapons.length)] || ALL_WEAPONS[0];

        this.handlePlayerAction(activePlayer.peerId, {
          type: 'MAKE_SUGGESTION',
          payload: { suspect, weapon },
        });
      } else {
        this.handlePlayerAction(activePlayer.peerId, { type: 'END_TURN' });
      }
    } else if (this.masterState.phase === 'ACCUSE') {
      this.handlePlayerAction(activePlayer.peerId, { type: 'END_TURN' });
    }
  }

  // ----------------------------------------------------
  // State Broadcasting (Optimized for 5-6 Concurrent Detectives)
  // ----------------------------------------------------

  broadcastState(
    disprovedCard?: DisprovedCardPayload | null,
    accusationResult?: AccusationResultPayload | null
  ) {
    // 0. Cache master state to browser storage immediately
    gameCache.saveMasterState(this.roomCode, this.masterState);

    // 1. Update Host local state immediately with strict masking
    const hostMasked = maskStateForPeer(this.masterState, this.hostPeerId);
    const isHostSuggester =
      !!disprovedCard && disprovedCard.suggesterPeerId === this.hostPeerId;
    const isHostAccuser =
      !!accusationResult && accusationResult.accuserPeerId === this.hostPeerId;
    const canHostInspectEnvelope =
      !!accusationResult &&
      (accusationResult.isCorrect || isHostAccuser);

    this.onStateUpdated(
      hostMasked,
      isHostSuggester ? disprovedCard : null,
      canHostInspectEnvelope ? accusationResult : null
    );

    // 2. Compact public spectator state (all hands stripped, solution hidden, logs limited to last 12)
    const spectatorState: MaskedGameState = {
      ...maskStateForPeer(this.masterState, '__SPECTATOR__'),
      logs: this.masterState.logs.slice(-12),
    };

    // 3. Single Unified Broadcast packet: NEVER include handsMap, disprovedCard, or secret envelope
    // This broadcasts public game board state (positions, phase, active player, logs) to all connected clients.
    clientTransport.send({
      type: 'SYNC_STATE',
      state: spectatorState,
      // If accusation was correct, game is won and solution is public. Otherwise null.
      accusationResult: accusationResult?.isCorrect ? accusationResult : null,
      syncTimestamp: Date.now(),
    });

    // 4. Send direct targeted updates with confidential hand to each individual player
    for (const player of this.masterState.players) {
      if (player.isAi || player.peerId === this.hostPeerId) continue;

      const playerMasked = maskStateForPeer(this.masterState, player.peerId);
      const isSuggester =
        !!disprovedCard && disprovedCard.suggesterPeerId === player.peerId;
      const isAccuser =
        !!accusationResult && accusationResult.accuserPeerId === player.peerId;
      const canInspectEnvelope =
        !!accusationResult &&
        (accusationResult.isCorrect || isAccuser);

      clientTransport.sendDirect(player.peerId, {
        type: 'PLAYER_STATE',
        targetPeerId: player.peerId,
        state: playerMasked,
        disprovedCard: isSuggester ? disprovedCard : null,
        accusationResult: canInspectEnvelope ? accusationResult : null,
        syncTimestamp: Date.now(),
      });
    }
  }

  handleSyncRequest(guestPeerId?: string) {
    // When a guest requests an immediate resync after a lag spike or tab switch
    if (guestPeerId) {
      const player = this.masterState.players.find((p) => p.peerId === guestPeerId);
      if (player) {
        player.isConnected = true;
        const playerMasked = maskStateForPeer(this.masterState, player.peerId);
        clientTransport.sendDirect(player.peerId, {
          type: 'PLAYER_STATE',
          targetPeerId: player.peerId,
          state: playerMasked,
          syncTimestamp: Date.now(),
        });
      }
    }
    this.broadcastState();
  }

  private startSyncHeartbeat() {
    if (this.syncHeartbeatTimer) clearInterval(this.syncHeartbeatTimer);
    // Periodically re-syncs all clients every 2.5 seconds to prevent drift on serverless / Vercel networks
    this.syncHeartbeatTimer = setInterval(() => {
      if (this.masterState.phase !== 'GAME_OVER') {
        this.broadcastState();
      }
    }, 2500);
  }

  destroy() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.syncHeartbeatTimer) {
      clearInterval(this.syncHeartbeatTimer);
      this.syncHeartbeatTimer = null;
    }
  }
}
