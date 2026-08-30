import { Peer, DataConnection } from 'peerjs';
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
  Suspect,
  SUSPECT_STARTING_POSITIONS,
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
} from '../engine/cluedoEngine';
import { getHostPeerId, getWsUrl, GLOBAL_ICE_SERVERS } from './peerProtocol';
import { ROOM_DEFINITIONS } from '../engine/boardGrid';

export interface ServerCallbacks {
  onStateUpdate: (maskedState: MaskedGameState) => void;
  onDisprovedCardPrivate?: (payload: DisprovedCardPayload) => void;
  onAccusationResult?: (payload: AccusationResultPayload) => void;
  onError: (err: Error) => void;
  onClientConnected?: (peerId: string) => void;
  onClientDisconnected?: (peerId: string) => void;
}

export class P2PHostServer {
  private peer: Peer | null = null;
  private ws: WebSocket | null = null;
  private wsConnected: boolean = false;
  private wsReconnectTimeout: any = null;
  private isDestroyed: boolean = false;
  private connections: Map<string, DataConnection> = new Map();
  private masterState: GameState | null = null;
  private roomCode: string;
  private callbacks: ServerCallbacks;
  private hostPeerId: string;
  private hostPlayer: { character: Suspect; name: string };
  private aiActionTimeout: NodeJS.Timeout | null = null;

  constructor(
    roomCode: string,
    hostPlayer: { character: Suspect; name: string },
    callbacks: ServerCallbacks
  ) {
    this.roomCode = roomCode;
    this.hostPlayer = hostPlayer;
    this.callbacks = callbacks;
    this.hostPeerId = getHostPeerId(roomCode);
    this.initializeLobby();
  }

  private initializeLobby() {
    this.setupLobbyState();
    this.connectWebSocket();
    this.initPeerJs();
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[P2P Server WS] Connected to global relay');
        this.wsConnected = true;
        this.sendWs({
          type: 'HOST_REGISTER',
          roomCode: this.roomCode,
          payload: { hostPeerId: this.hostPeerId },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'HOST_REGISTERED') {
            console.log('[P2P Server WS] Room is registered globally:', this.roomCode);
          } else if (msg.type === 'CLIENT_CONNECTED') {
            console.log('[P2P Server WS] Remote guest connected:', msg.peerId);
            this.callbacks.onClientConnected?.(msg.peerId);
            if (this.masterState) {
              this.broadcastState();
            }
          } else if (msg.type === 'CLIENT_DISCONNECTED') {
            console.log('[P2P Server WS] Remote guest disconnected:', msg.peerId);
            this.callbacks.onClientDisconnected?.(msg.peerId);
            if (this.masterState) {
              if (this.masterState.phase === 'LOBBY') {
                this.masterState.players = this.masterState.players.filter((p) => p.peerId !== msg.peerId);
              } else {
                const player = this.masterState.players.find((p) => p.peerId === msg.peerId);
                if (player) player.isConnected = false;
              }
              this.broadcastState();
            }
          } else if (msg.type === 'GUEST_PACKET') {
            this.processPacket(msg.fromPeerId, msg.packet);
          }
        } catch (err) {
          console.error('[P2P Server WS] Error handling WS packet:', err);
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        if (!this.isDestroyed) {
          console.log('[P2P Server WS] Disconnected from relay, reconnecting in 2.5s...');
          this.wsReconnectTimeout = setTimeout(() => this.connectWebSocket(), 2500);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[P2P Server WS] WebSocket notice:', err);
      };
    } catch (err) {
      console.warn('[P2P Server WS] Failed to init WebSocket relay:', err);
    }
  }

  private sendWs(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private initPeerJs() {
    try {
      this.peer = new Peer(this.hostPeerId, {
        debug: 1,
        config: {
          iceServers: GLOBAL_ICE_SERVERS,
        },
      });

      this.peer.on('open', (id) => {
        console.log('[P2P Server WebRTC] Host peer opened with ID:', id);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('[P2P Server WebRTC] Peer notice (Relay active):', err);
      });
    } catch (err) {
      console.warn('[P2P Server WebRTC] PeerJS init error (WebSocket active):', err);
    }
  }

  private setupLobbyState() {
    const hostP: Player = {
      peerId: this.hostPeerId,
      character: this.hostPlayer.character,
      name: this.hostPlayer.name,
      isHost: true,
      isAi: false,
      position: {
        x: SUSPECT_STARTING_POSITIONS[this.hostPlayer.character].x,
        y: SUSPECT_STARTING_POSITIONS[this.hostPlayer.character].y,
        room: null,
      },
      hand: [],
      hasAccusedWrongly: false,
      isConnected: true,
      startingPosition: SUSPECT_STARTING_POSITIONS[this.hostPlayer.character],
    };

    this.masterState = {
      roomCode: this.roomCode,
      phase: 'LOBBY',
      envelope: { suspect: 'Miss Scarlet', weapon: 'Candlestick', room: 'Hall' },
      players: [hostP],
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
          message: `Lobby created by ${this.hostPlayer.name} (${this.hostPlayer.character}). Room code: ${this.roomCode}`,
        },
      ],
      validMoves: [],
    };

    this.broadcastState();
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('[P2P Server] Guest connected:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.callbacks.onClientConnected?.(conn.peer);

      // Send initial lobby state masked
      if (this.masterState) {
        conn.send({
          type: 'SYNC_STATE',
          payload: { maskedState: maskStateForPeer(this.masterState, conn.peer) },
        });
      }
    });

    conn.on('data', (data: any) => {
      try {
        const packet = data as NetworkPacket;
        this.processPacket(conn.peer, packet);
      } catch (err) {
        console.error('[P2P Server] Error handling data packet:', err);
      }
    });

    conn.on('close', () => {
      console.log('[P2P Server] Guest disconnected:', conn.peer);
      this.connections.delete(conn.peer);
      this.callbacks.onClientDisconnected?.(conn.peer);

      if (this.masterState) {
        if (this.masterState.phase === 'LOBBY') {
          this.masterState.players = this.masterState.players.filter((p) => p.peerId !== conn.peer);
        } else {
          const player = this.masterState.players.find((p) => p.peerId === conn.peer);
          if (player) player.isConnected = false;
        }
        this.broadcastState();
      }
    });
  }

  public processPacket(senderPeerId: string, packet: NetworkPacket) {
    if (!this.masterState) return;

    switch (packet.type) {
      case 'JOIN_LOBBY': {
        if (this.masterState.phase !== 'LOBBY') return;
        const exists = this.masterState.players.find((p) => p.peerId === senderPeerId);
        if (!exists) {
          // Check if requested character is already taken
          let assignedChar = packet.payload.character;
          const takenChars = new Set(this.masterState.players.map((p) => p.character));
          if (takenChars.has(assignedChar)) {
            assignedChar = ALL_SUSPECTS.find((s) => !takenChars.has(s)) || 'Colonel Mustard';
          }

          const newPlayer: Player = {
            peerId: senderPeerId,
            character: assignedChar,
            name: packet.payload.name || `Guest-${senderPeerId.slice(-4)}`,
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

          this.masterState.players.push(newPlayer);
          this.masterState.logs.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            type: 'SYSTEM',
            message: `${newPlayer.name} joined as ${newPlayer.character}.`,
            playerPeerId: newPlayer.peerId,
            playerName: newPlayer.name,
            playerCharacter: newPlayer.character,
          });
          this.broadcastState();
        }
        break;
      }

      case 'SELECT_CHARACTER': {
        if (this.masterState.phase !== 'LOBBY') return;
        const targetChar = packet.payload.character;
        const isTaken = this.masterState.players.some(
          (p) => p.character === targetChar && p.peerId !== senderPeerId
        );
        if (!isTaken) {
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
        }
        break;
      }

      case 'ADD_BOT': {
        if (this.masterState.phase !== 'LOBBY') return;
        const targetChar = packet.payload.character;
        const isTaken = this.masterState.players.some((p) => p.character === targetChar);
        if (!isTaken) {
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
          this.masterState.players.push(botPlayer);
          this.masterState.logs.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            type: 'SYSTEM',
            message: `AI Detective added as ${targetChar}.`,
          });
          this.broadcastState();
        }
        break;
      }

      case 'REMOVE_PLAYER': {
        if (this.masterState.phase !== 'LOBBY') return;
        this.masterState.players = this.masterState.players.filter(
          (p) => p.peerId !== packet.payload.peerId
        );
        this.broadcastState();
        break;
      }

      case 'START_MATCH': {
        if (this.masterState.phase !== 'LOBBY' || senderPeerId !== this.hostPeerId) return;
        if (this.masterState.players.length < 2) return;

        const playerConfigs = this.masterState.players.map((p) => ({
          peerId: p.peerId,
          character: p.character,
          name: p.name,
          isHost: p.isHost,
          isAi: p.isAi,
        }));

        this.masterState = initializeGame(playerConfigs, this.roomCode);
        this.broadcastState();
        this.triggerAiTurnIfNeeded();
        break;
      }

      case 'ROLL_DICE': {
        if (!this.isActiveTurn(senderPeerId)) return;
        this.masterState = rollDice(this.masterState);
        this.broadcastState();
        this.triggerAiTurnIfNeeded();
        break;
      }

      case 'MOVE_TOKEN': {
        if (!this.isActiveTurn(senderPeerId)) return;
        try {
          this.masterState = moveToken(
            this.masterState,
            packet.payload.x,
            packet.payload.y
          );
          this.broadcastState();
          this.triggerAiTurnIfNeeded();
        } catch (e: any) {
          console.error('[P2P Server] Move error:', e.message);
        }
        break;
      }

      case 'USE_SECRET_PASSAGE': {
        if (!this.isActiveTurn(senderPeerId)) return;
        try {
          this.masterState = useSecretPassage(this.masterState, packet.payload.targetRoom);
          this.broadcastState();
          this.triggerAiTurnIfNeeded();
        } catch (e: any) {
          console.error('[P2P Server] Secret passage error:', e.message);
        }
        break;
      }

      case 'MAKE_SUGGESTION': {
        if (!this.isActiveTurn(senderPeerId)) return;
        const result = makeSuggestion(
          this.masterState,
          packet.payload.suspect,
          packet.payload.weapon
        );
        this.masterState = result.state;
        this.broadcastState();
        this.triggerAiDisproveIfNeeded();
        break;
      }

      case 'DISPROVE_CARD': {
        if (this.masterState.phase !== 'DISPROVE') return;
        const disprover = this.masterState.players[this.masterState.pendingDisproverIndex ?? -1];
        if (!disprover || disprover.peerId !== senderPeerId) return;

        try {
          const { state: nextState, revealedCard } = disproveCard(
            this.masterState,
            senderPeerId,
            packet.payload.cardId
          );
          this.masterState = nextState;

          // Send private reveal to suggester
          const suggesterPeerId = nextState.lastDisprovedCardForSuggester?.suggesterPeerId;
          const disprovedPayload = nextState.lastDisprovedCardForSuggester!;

          if (suggesterPeerId === this.hostPeerId) {
            this.callbacks.onDisprovedCardPrivate?.(disprovedPayload);
          } else if (suggesterPeerId) {
            // 1. Send via WebSocket Relay
            this.sendWs({
              type: 'HOST_TO_GUEST',
              roomCode: this.roomCode,
              payload: {
                targetPeerId: suggesterPeerId,
                packet: {
                  type: 'DISPROVED_REVEAL',
                  payload: disprovedPayload,
                },
              },
            });

            // 2. Send via WebRTC DataConnection if open
            const suggesterConn = this.connections.get(suggesterPeerId);
            if (suggesterConn && suggesterConn.open) {
              suggesterConn.send({
                type: 'DISPROVED_REVEAL',
                payload: disprovedPayload,
              });
            }
          }

          this.broadcastState();
          this.triggerAiTurnIfNeeded();
        } catch (e: any) {
          console.error('[P2P Server] Disprove error:', e.message);
        }
        break;
      }

      case 'MAKE_ACCUSATION': {
        if (!this.isActiveTurn(senderPeerId)) return;
        const { state: nextState, result } = makeAccusation(
          this.masterState,
          packet.payload.suspect,
          packet.payload.weapon,
          packet.payload.room
        );
        this.masterState = nextState;

        // If host was the accuser, notify host directly
        if (senderPeerId === this.hostPeerId) {
          this.callbacks.onAccusationResult?.(result);
        } else {
          // Send private ACCUSATION_REVEAL to the accuser
          this.sendWs({
            type: 'HOST_TO_GUEST',
            roomCode: this.roomCode,
            payload: {
              targetPeerId: senderPeerId,
              packet: {
                type: 'ACCUSATION_REVEAL',
                payload: result,
              },
            },
          });

          const accuserConn = this.connections.get(senderPeerId);
          if (accuserConn && accuserConn.open) {
            accuserConn.send({
              type: 'ACCUSATION_REVEAL',
              payload: result,
            });
          }
        }

        this.broadcastState();
        this.triggerAiTurnIfNeeded();
        break;
      }

      case 'END_TURN': {
        if (!this.isActiveTurn(senderPeerId)) return;
        this.masterState = endTurn(this.masterState);
        this.broadcastState();
        this.triggerAiTurnIfNeeded();
        break;
      }

      case 'CHAT_MESSAGE': {
        const sender = this.masterState.players.find((p) => p.peerId === senderPeerId);
        if (sender && packet.payload.text.trim()) {
          this.masterState.logs.push({
            id: `chat_${Date.now()}`,
            timestamp: Date.now(),
            type: 'CHAT',
            message: packet.payload.text.trim(),
            playerPeerId: sender.peerId,
            playerName: sender.name,
            playerCharacter: sender.character,
          });
          this.broadcastState();
        }
        break;
      }
    }
  }

  private isActiveTurn(senderPeerId: string): boolean {
    if (!this.masterState || this.masterState.phase === 'LOBBY' || this.masterState.phase === 'GAME_OVER') {
      return false;
    }
    const activePlayer = this.masterState.players[this.masterState.activePlayerIndex];
    return activePlayer && activePlayer.peerId === senderPeerId;
  }

  private broadcastState() {
    if (!this.masterState) return;

    // Send to local host
    const hostMasked = maskStateForPeer(this.masterState, this.hostPeerId);
    this.callbacks.onStateUpdate(hostMasked);

    // Send personalized masked state to each remote player
    for (const player of this.masterState.players) {
      if (player.peerId === this.hostPeerId || player.isAi) continue;

      const peerMasked = maskStateForPeer(this.masterState, player.peerId);

      // 1. Send via WebSocket relay (100% reliable worldwide across different networks)
      this.sendWs({
        type: 'HOST_TO_GUEST',
        roomCode: this.roomCode,
        payload: {
          targetPeerId: player.peerId,
          packet: {
            type: 'SYNC_STATE',
            payload: { maskedState: peerMasked },
          },
        },
      });

      // 2. Send via direct WebRTC connection if open
      const conn = this.connections.get(player.peerId);
      if (conn && conn.open) {
        conn.send({
          type: 'SYNC_STATE',
          payload: { maskedState: peerMasked },
        });
      }
    }
  }

  // AI Automation Logic
  private triggerAiTurnIfNeeded() {
    if (!this.masterState || this.masterState.phase === 'LOBBY' || this.masterState.phase === 'GAME_OVER') return;

    const activePlayer = this.masterState.players[this.masterState.activePlayerIndex];
    if (!activePlayer || !activePlayer.isAi) return;

    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);

    this.aiActionTimeout = setTimeout(() => {
      this.executeAiAction();
    }, 900);
  }

  private executeAiAction() {
    if (!this.masterState) return;
    const activePlayer = this.masterState.players[this.masterState.activePlayerIndex];
    if (!activePlayer || !activePlayer.isAi) return;

    if (this.masterState.phase === 'ROLL') {
      // Check secret passage
      if (activePlayer.position.room) {
        const passage = SECRET_PASSAGES[activePlayer.position.room];
        if (passage && Math.random() < 0.45) {
          this.processPacket(activePlayer.peerId, {
            type: 'USE_SECRET_PASSAGE',
            payload: { targetRoom: passage },
          });
          return;
        }
      }
      // Roll dice
      this.processPacket(activePlayer.peerId, { type: 'ROLL_DICE' });
    } else if (this.masterState.phase === 'MOVE') {
      const validMoves = this.masterState.validMoves || [];
      if (validMoves.length === 0) {
        this.processPacket(activePlayer.peerId, { type: 'END_TURN' });
        return;
      }

      // Prioritize doorways into rooms
      const doorwayMove = validMoves.find((m) => m.isDoorway);
      const chosenMove = doorwayMove || validMoves[Math.floor(Math.random() * validMoves.length)];

      this.processPacket(activePlayer.peerId, {
        type: 'MOVE_TOKEN',
        payload: { x: chosenMove.x, y: chosenMove.y },
      });
    } else if (this.masterState.phase === 'SUGGEST') {
      if (activePlayer.position.room) {
        // Pick suspect & weapon not in hand
        const myHandNames = new Set(activePlayer.hand.map((c) => c.name));
        const candidateSuspects = ALL_SUSPECTS.filter((s) => !myHandNames.has(s));
        const candidateWeapons = ALL_WEAPONS.filter((w) => !myHandNames.has(w));

        const suspect = candidateSuspects[Math.floor(Math.random() * candidateSuspects.length)] || ALL_SUSPECTS[0];
        const weapon = candidateWeapons[Math.floor(Math.random() * candidateWeapons.length)] || ALL_WEAPONS[0];

        this.processPacket(activePlayer.peerId, {
          type: 'MAKE_SUGGESTION',
          payload: { suspect, weapon },
        });
      } else {
        this.processPacket(activePlayer.peerId, { type: 'END_TURN' });
      }
    } else if (this.masterState.phase === 'ACCUSE') {
      // AI ends turn (or makes a calculated guess if end-game)
      this.processPacket(activePlayer.peerId, { type: 'END_TURN' });
    }
  }

  private triggerAiDisproveIfNeeded() {
    if (!this.masterState || this.masterState.phase !== 'DISPROVE') return;

    const disprover = this.masterState.players[this.masterState.pendingDisproverIndex ?? -1];
    if (!disprover || !disprover.isAi) return;

    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);

    this.aiActionTimeout = setTimeout(() => {
      if (!this.masterState || !this.masterState.currentSuggestion) return;
      const sugg = this.masterState.currentSuggestion;
      const matchingCards = disprover.hand.filter(
        (c) => c.name === sugg.suspect || c.name === sugg.weapon || c.name === sugg.room
      );

      if (matchingCards.length > 0) {
        const picked = matchingCards[Math.floor(Math.random() * matchingCards.length)];
        this.processPacket(disprover.peerId, {
          type: 'DISPROVE_CARD',
          payload: { cardId: picked.id },
        });
      }
    }, 1200);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.wsReconnectTimeout) clearTimeout(this.wsReconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
