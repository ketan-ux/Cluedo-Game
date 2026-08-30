import { Peer, DataConnection } from 'peerjs';
import {
  AccusationResultPayload,
  DisprovedCardPayload,
  MaskedGameState,
  NetworkPacket,
  Suspect,
} from '../types/cluedo';
import {
  apiJoinRoom,
  apiPollPackets,
  apiSendPacket,
  getGuestPeerId,
  getHostPeerId,
  getWsUrl,
  GLOBAL_ICE_SERVERS,
} from './peerProtocol';

export interface ClientCallbacks {
  onStateUpdate: (maskedState: MaskedGameState) => void;
  onDisprovedCardPrivate?: (payload: DisprovedCardPayload) => void;
  onAccusationResult?: (payload: AccusationResultPayload) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: Error) => void;
}

export class P2PGuestClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private ws: WebSocket | null = null;
  private isDestroyed: boolean = false;
  private hasTriggeredConnected: boolean = false;
  private wsReconnectTimeout: any = null;
  private httpPollInterval: any = null;
  private processedPacketIds: Set<string> = new Set();
  private roomCode: string;
  private guestName: string;
  private character: Suspect;
  private callbacks: ClientCallbacks;
  public myPeerId: string;

  constructor(
    roomCode: string,
    guestName: string,
    character: Suspect,
    callbacks: ClientCallbacks
  ) {
    this.roomCode = roomCode;
    this.guestName = guestName;
    this.character = character;
    this.callbacks = callbacks;
    this.myPeerId = getGuestPeerId(roomCode, guestName);
    this.connect();
  }

  private async connect() {
    // 1. Initial join via HTTP API (works through ANY firewall / restricted Wi-Fi)
    try {
      const joinRes = await apiJoinRoom(this.roomCode, this.myPeerId, this.guestName, this.character);
      if (joinRes && joinRes.success) {
        if (!this.hasTriggeredConnected) {
          this.hasTriggeredConnected = true;
          this.callbacks.onConnected();
        }
        if (joinRes.latestStateSnapshot) {
          this.callbacks.onStateUpdate(joinRes.latestStateSnapshot);
        }
      }
    } catch (e) {
      console.warn('[P2P Client] HTTP join notice:', e);
    }

    // 2. Start WebSocket Relay for low-latency updates
    this.connectWebSocket();

    // 3. Start background HTTP polling fallback
    this.startHttpPolling();

    // 4. Connect WebRTC (optional direct channel)
    this.connectPeerJs();
  }

  private startHttpPolling() {
    if (this.httpPollInterval) clearInterval(this.httpPollInterval);
    this.httpPollInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const data = await apiPollPackets(this.roomCode, this.myPeerId, false);
        if (data) {
          if (!this.hasTriggeredConnected) {
            this.hasTriggeredConnected = true;
            this.callbacks.onConnected();
          }
          if (data.latestSnapshot) {
            this.callbacks.onStateUpdate(data.latestSnapshot);
          }
          if (data.packets && Array.isArray(data.packets)) {
            for (const queued of data.packets) {
              if (queued.id && this.processedPacketIds.has(queued.id)) continue;
              if (queued.id) this.processedPacketIds.add(queued.id);
              this.handleInboundPacket(queued.packet);
            }
          }
        }
      } catch (err) {
        // silent fallback
      }
    }, 1500);
  }

  private handleInboundPacket(packet: NetworkPacket) {
    if (!packet) return;
    if (packet.type === 'SYNC_STATE' && packet.payload?.maskedState) {
      this.callbacks.onStateUpdate(packet.payload.maskedState);
    } else if (packet.type === 'DISPROVED_REVEAL') {
      this.callbacks.onDisprovedCardPrivate?.(packet.payload);
    } else if (packet.type === 'ACCUSATION_REVEAL') {
      this.callbacks.onAccusationResult?.(packet.payload);
    }
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[P2P Client WS] Connected to global relay');
        this.sendWs({
          type: 'GUEST_JOIN',
          roomCode: this.roomCode,
          payload: {
            guestPeerId: this.myPeerId,
            name: this.guestName,
            character: this.character,
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'JOIN_ACCEPTED') {
            console.log('[P2P Client WS] Joined room successfully:', this.roomCode);
            if (!this.hasTriggeredConnected) {
              this.hasTriggeredConnected = true;
              this.callbacks.onConnected();
            }
            if (msg.latestSnapshot) {
              this.callbacks.onStateUpdate(msg.latestSnapshot);
            }
            // Send JOIN_LOBBY packet to host
            this.sendPacket({
              type: 'JOIN_LOBBY',
              payload: {
                name: this.guestName,
                character: this.character,
              },
            });
          } else if (msg.type === 'JOIN_ERROR') {
            console.warn('[P2P Client WS] Join notice:', msg.message);
          } else if (msg.type === 'HOST_PACKET') {
            this.handleInboundPacket(msg.packet as NetworkPacket);
          }
        } catch (err) {
          console.error('[P2P Client WS] Error processing message:', err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          console.log('[P2P Client WS] Disconnected from relay, reconnecting in 2s...');
          this.wsReconnectTimeout = setTimeout(() => this.connectWebSocket(), 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[P2P Client WS] WebSocket warning:', err);
      };
    } catch (err) {
      console.warn('[P2P Client WS] Failed to init WebSocket relay:', err);
    }
  }

  private sendWs(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private connectPeerJs() {
    try {
      this.peer = new Peer(this.myPeerId, {
        debug: 1,
        config: {
          iceServers: GLOBAL_ICE_SERVERS,
        },
      });

      this.peer.on('open', (id) => {
        console.log('[P2P Client WebRTC] Guest peer opened with ID:', id);
        const hostId = getHostPeerId(this.roomCode);
        const conn = this.peer!.connect(hostId, {
          reliable: true,
        });

        this.connection = conn;

        conn.on('open', () => {
          console.log('[P2P Client WebRTC] Connected directly to host:', hostId);
          if (!this.hasTriggeredConnected) {
            this.hasTriggeredConnected = true;
            this.callbacks.onConnected();
          }

          // Send JOIN_LOBBY packet
          this.sendPacket({
            type: 'JOIN_LOBBY',
            payload: {
              name: this.guestName,
              character: this.character,
            },
          });
        });

        conn.on('data', (data: any) => {
          try {
            this.handleInboundPacket(data as NetworkPacket);
          } catch (err) {
            console.error('[P2P Client WebRTC] Error processing packet:', err);
          }
        });

        conn.on('close', () => {
          console.log('[P2P Client WebRTC] Direct connection closed');
        });

        conn.on('error', (err) => {
          console.warn('[P2P Client WebRTC] Direct connection warning:', err);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[P2P Client WebRTC] Peer notice (Relay active):', err);
      });
    } catch (err) {
      console.warn('[P2P Client WebRTC] Failed to init PeerJS (WebSocket active):', err);
    }
  }

  public sendPacket(packet: NetworkPacket) {
    // 1. Send via WebSocket Relay (100% reliable worldwide)
    this.sendWs({
      type: 'GUEST_TO_HOST',
      roomCode: this.roomCode,
      payload: { packet },
    });

    // 2. Also send via HTTP REST endpoint
    apiSendPacket(this.roomCode, {
      fromPeerId: this.myPeerId,
      packet,
    });

    // 3. Send via direct WebRTC connection if open
    if (this.connection && this.connection.open) {
      this.connection.send(packet);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.wsReconnectTimeout) clearTimeout(this.wsReconnectTimeout);
    if (this.httpPollInterval) clearInterval(this.httpPollInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}


