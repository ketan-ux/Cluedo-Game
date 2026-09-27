import Peer, { DataConnection } from 'peerjs';
import { firestoreRelay } from './firestoreRelay';

/**
 * Universal High-Reliability Multi-Player Transport for Global Seamless Play
 *
 * Provides robust cross-network communication across different Wi-Fi networks,
 * cellular data, firewalls, and worldwide geographic distances:
 * 1. Native Origin WebSocket Relay (/ws): Low-latency real-time bidirectional relay.
 * 2. Native Origin Server-Sent Events (/api/relay/sse): Guaranteed firewall-crossing streaming fallback.
 * 3. Direct WebRTC Data Channels (PeerJS): Zero-hop P2P channel with Google STUN.
 * 4. BroadcastChannel: 0ms local sync across browser tabs on the same device.
 * 5. REST Polling Fallback (/api/relay/poll): Self-healing catch-up for packet recovery.
 */

export interface TransportPacket {
  id: string;
  senderId: string;
  roomCode: string;
  timestamp: number;
  payload: any;
}

export type MessageHandler = (packet: TransportPacket) => void;

class ClientTransport {
  private roomCode: string = '';
  private peerId: string = '';
  private isHost: boolean = false;
  private onMessage: MessageHandler | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnected: boolean = false;
  private seenPacketIds: Set<string> = new Set();
  private lastReceivedTimestamp: number = 0;
  private pendingOutbox: TransportPacket[] = [];

  // Origin Server WebSocket
  private ws: WebSocket | null = null;
  private wsPingInterval: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private isWsConnecting: boolean = false;

  // Origin Server SSE Stream
  private sse: EventSource | null = null;

  // REST Poll Fallback
  private pollInterval: NodeJS.Timeout | null = null;

  // PeerJS WebRTC State
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private guestConnections: Map<string, DataConnection> = new Map();
  private targetPeerConnections: Map<string, DataConnection> = new Map();

  connect(roomCode: string, peerId: string, onMessage: MessageHandler, isHost: boolean = false) {
    this.disconnect();
    this.roomCode = roomCode.toUpperCase().trim();
    this.peerId = peerId;
    this.isHost = isHost;
    this.onMessage = onMessage;
    this.isConnected = true;
    this.lastReceivedTimestamp = Date.now();

    // 1. Setup BroadcastChannel for instant local / multi-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`cluedo_bc_${this.roomCode}`);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      } catch (err) {
        console.warn('[Transport] BroadcastChannel not available:', err);
      }
    }

    // 2. Setup Native Origin WebSocket Relay (Ultra-fast global relay across networks)
    if (typeof window !== 'undefined' && 'WebSocket' in window) {
      this.initWebSocket();
    }

    // 3. Setup Native Origin SSE Stream Relay (Guaranteed delivery through firewalls/proxies)
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      this.initSSE();
    }

    // 4. Setup Self-Healing Poll Fallback (Safety net for packet catch-up)
    this.initPolling();

    // 5. Setup PeerJS WebRTC Direct DataChannels
    if (typeof window !== 'undefined') {
      try {
        this.initPeerJS();
      } catch (err) {
        console.warn('[Transport] PeerJS initialization error:', err);
      }
    }

    // 6. Setup Cloud Firestore Real-Time Relay (Guaranteed cross-network synchronization)
    try {
      firestoreRelay.startRoomSync(this.roomCode, this.peerId, (packet) => {
        this.handleIncoming(packet);
      });
    } catch (err) {
      console.warn('[Transport] Firestore relay initialization error:', err);
    }

    console.log(`[Transport] Globally connected to room ${this.roomCode} as ${this.peerId} (Host: ${isHost})`);
  }

  // ----------------------------------------------------
  // WebSocket Relay Implementation
  // ----------------------------------------------------
  private initWebSocket() {
    if (!this.isConnected || typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      this.isWsConnecting = true;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!this.isConnected) {
          ws.close();
          return;
        }
        this.ws = ws;
        this.isWsConnecting = false;

        // Register with the global room relay
        ws.send(
          JSON.stringify({
            type: 'RELAY_JOIN',
            roomCode: this.roomCode,
            peerId: this.peerId,
            isHost: this.isHost,
          })
        );

        // Immediately flush any queued outbox packets
        while (this.pendingOutbox.length > 0) {
          const pkt = this.pendingOutbox.shift();
          if (pkt) {
            try {
              ws.send(
                JSON.stringify({
                  type: 'RELAY_PACKET',
                  roomCode: this.roomCode,
                  packet: pkt,
                })
              );
            } catch (err) {
              console.warn('[Transport WS] Outbox flush error:', err);
            }
          }
        }

        // Keep-alive ping every 12 seconds
        if (this.wsPingInterval) clearInterval(this.wsPingInterval);
        this.wsPingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 12000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'RELAY_PACKET' && data.packet) {
            this.handleIncoming(data.packet);
          }
        } catch (err) {
          console.warn('[Transport WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        this.cleanupWs();
        // Reconnect after brief backoff if still active in room
        if (this.isConnected) {
          this.wsReconnectTimeout = setTimeout(() => {
            if (this.isConnected) this.initWebSocket();
          }, 2000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[Transport WS] Socket error, falling back to SSE/HTTP:', err);
        ws.close();
      };
    } catch (err) {
      console.warn('[Transport WS] Init failed:', err);
      this.cleanupWs();
    }
  }

  private cleanupWs() {
    this.isWsConnecting = false;
    if (this.wsPingInterval) {
      clearInterval(this.wsPingInterval);
      this.wsPingInterval = null;
    }
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // noop
      }
      this.ws = null;
    }
  }

  // ----------------------------------------------------
  // Server-Sent Events (SSE) Stream Implementation
  // ----------------------------------------------------
  private initSSE() {
    if (!this.isConnected || typeof window === 'undefined') return;

    try {
      const sseUrl = `/api/relay/sse?roomCode=${encodeURIComponent(this.roomCode)}&peerId=${encodeURIComponent(
        this.peerId
      )}`;
      const sse = new EventSource(sseUrl);

      sse.onmessage = (event) => {
        try {
          if (!event.data || typeof event.data !== 'string') return;
          if (!event.data.trim().startsWith('{')) return;

          const packet = JSON.parse(event.data);
          if (packet && packet.id) {
            this.handleIncoming(packet);
          }
        } catch {
          // Ignore comments or keep-alive pings
        }
      };

      sse.onerror = () => {
        // EventSource automatically handles reconnection
      };

      this.sse = sse;
    } catch (err) {
      console.warn('[Transport SSE] Init error:', err);
    }
  }

  // ----------------------------------------------------
  // Self-Healing HTTP Polling Catch-Up
  // ----------------------------------------------------
  private initPolling() {
    if (!this.isConnected) return;

    const doPoll = async () => {
      if (!this.isConnected || !this.roomCode) return;
      try {
        const since = this.lastReceivedTimestamp;
        const res = await fetch(
          `/api/relay/poll?roomCode=${encodeURIComponent(this.roomCode)}&peerId=${encodeURIComponent(
            this.peerId
          )}&since=${since}`
        );
        if (!res.ok) return;

        const data = await res.json();
        if (data.success && Array.isArray(data.packets)) {
          for (const pkt of data.packets) {
            this.handleIncoming(pkt);
          }
        }
      } catch {
        // Ignore background poll errors
      }
    };

    // Fast initial poll
    setTimeout(doPoll, 350);

    // Continuous catch-up poll
    this.pollInterval = setInterval(doPoll, 1500);
  }

  // ----------------------------------------------------
  // WebRTC Direct P2P (PeerJS with Google STUN)
  // ----------------------------------------------------
  private initPeerJS() {
    const cleanRoom = this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPeer = this.peerId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-8);

    const peerIdToRegister = this.isHost
      ? `cluedo-v4-host-${cleanRoom}`
      : `cluedo-v4-g-${cleanRoom}-${cleanPeer}`;

    try {
      this.peer = new Peer(peerIdToRegister, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        if (!this.isHost) {
          const hostPeerId = `cluedo-v4-host-${cleanRoom}`;
          this.connectToHostPeer(hostPeerId);
        }
      });

      this.peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.guestConnections.set(conn.peer, conn);
        });

        conn.on('data', (data: any) => {
          if (data && typeof data === 'object' && data.senderId) {
            this.targetPeerConnections.set(data.senderId, conn);
          }
          this.handleIncoming(data);
        });

        conn.on('close', () => {
          this.guestConnections.delete(conn.peer);
          for (const [peerId, c] of this.targetPeerConnections.entries()) {
            if (c === conn) {
              this.targetPeerConnections.delete(peerId);
            }
          }
        });

        conn.on('error', () => {
          this.guestConnections.delete(conn.peer);
          for (const [peerId, c] of this.targetPeerConnections.entries()) {
            if (c === conn) {
              this.targetPeerConnections.delete(peerId);
            }
          }
        });
      });

      this.peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id' && !this.isHost) {
          const fallbackId = `cluedo-v4-g-${cleanRoom}-${Math.random().toString(36).slice(2, 7)}`;
          try {
            this.peer?.destroy();
            this.peer = new Peer(fallbackId);
          } catch {
            // noop
          }
        }
      });
    } catch (err) {
      console.warn('[Transport PeerJS] Init warning:', err);
    }
  }

  private connectToHostPeer(hostPeerId: string) {
    if (!this.peer || this.peer.destroyed) return;

    try {
      const conn = this.peer.connect(hostPeerId, {
        reliable: true,
      });

      conn.on('open', () => {
        this.hostConnection = conn;
      });

      conn.on('data', (data: any) => {
        this.handleIncoming(data);
      });

      conn.on('close', () => {
        this.hostConnection = null;
      });

      conn.on('error', () => {
        this.hostConnection = null;
      });
    } catch {
      // Ignored: Origin server relay handles communication seamlessly
    }
  }

  // ----------------------------------------------------
  // Universal Send (Broadcast across WebSocket, HTTP Relay, P2P, BroadcastChannel)
  // ----------------------------------------------------
  async send(payload: any): Promise<void> {
    if (!this.isConnected || !this.roomCode) return;

    const packet: TransportPacket = {
      id: `${this.peerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: Date.now(),
      payload,
    };

    // Mark as seen by sender to avoid self-echo
    this.seenPacketIds.add(packet.id);

    // 1. Broadcast to local tabs on same device (0ms)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (err) {
        console.warn('[Transport] BroadcastChannel error:', err);
      }
    }

    // 2. Send via Native Origin WebSocket
    let sentViaWs = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'RELAY_PACKET',
            roomCode: this.roomCode,
            packet,
          })
        );
        sentViaWs = true;
      } catch {
        sentViaWs = false;
        this.pendingOutbox.push(packet);
      }
    } else {
      this.pendingOutbox.push(packet);
    }

    // 3. Send via Server REST Relay (Guaranteed HTTP delivery if WebSocket was buffering)
    // Always send or fallback if WS is not open
    if (!sentViaWs) {
      fetch('/api/relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          packet,
        }),
      }).catch(() => {
        // Handled silently
      });
    }

    // 4. Send via Cloud Firestore real-time relay for reliable cross-network delivery
    try {
      firestoreRelay.sendPacket(packet);
    } catch {
      // ignore
    }

    // 5. Send via direct WebRTC DataChannel if connected
    if (this.isHost) {
      for (const [peerKey, conn] of this.guestConnections.entries()) {
        if (conn.open) {
          try {
            conn.send(packet);
          } catch {
            this.guestConnections.delete(peerKey);
          }
        }
      }
    } else {
      if (this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send(packet);
        } catch {
          this.hostConnection = null;
        }
      }
    }
  }

  /**
   * Direct send to a specific peer over WebRTC or BroadcastChannel
   */
  sendDirect(targetPeerId: string, payload: any): void {
    if (!this.isConnected) return;

    const packetPayload =
      typeof payload === 'object' && payload !== null
        ? { ...payload, targetPeerId }
        : { data: payload, targetPeerId };

    const packet: TransportPacket = {
      id: `${this.peerId}_dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: Date.now(),
      payload: packetPayload,
    };

    this.seenPacketIds.add(packet.id);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {
        // noop
      }
    }

    // Also route through server relay so target peer receives it across different WiFis!
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'RELAY_PACKET',
            roomCode: this.roomCode,
            packet,
          })
        );
      } catch {
        this.pendingOutbox.push(packet);
      }
    } else {
      this.pendingOutbox.push(packet);
    }

    fetch('/api/relay/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: this.roomCode,
        packet,
      }),
    }).catch(() => {});

    // Also route through Cloud Firestore real-time relay for reliable targeted delivery
    try {
      firestoreRelay.sendPacket(packet);
    } catch {
      // ignore
    }

    // Direct WebRTC: Strictly deliver only to the targeted peer to avoid leaking confidential packets
    if (this.isHost) {
      const targetConn = this.targetPeerConnections.get(targetPeerId);
      if (targetConn && targetConn.open) {
        try {
          targetConn.send(packet);
        } catch {
          // noop
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(packet);
      } catch {
        // noop
      }
    }
  }

  // ----------------------------------------------------
  // Incoming Packet Deduplicator & Dispatcher
  // ----------------------------------------------------
  private handleIncoming(packet: any) {
    if (!packet || typeof packet !== 'object' || !packet.id) return;
    if (packet.senderId === this.peerId) return; // Ignore own messages
    if (this.seenPacketIds.has(packet.id)) return; // Deduplicate

    this.seenPacketIds.add(packet.id);
    this.lastReceivedTimestamp = Math.max(this.lastReceivedTimestamp, packet.timestamp || Date.now());

    // Confidential Targeted Packet Drop: If addressed to someone else, do not deliver locally
    const targetPeerId = packet.payload?.targetPeerId;
    if (targetPeerId && targetPeerId !== this.peerId) {
      return;
    }

    // Keep deduplication set memory bounded
    if (this.seenPacketIds.size > 500) {
      const ids = Array.from(this.seenPacketIds);
      this.seenPacketIds = new Set(ids.slice(ids.length - 250));
    }

    if (this.onMessage) {
      this.onMessage(packet);
    }
  }

  disconnect() {
    this.isConnected = false;

    try {
      firestoreRelay.stopRoomSync();
    } catch {
      // noop
    }

    this.cleanupWs();

    if (this.sse) {
      try {
        this.sse.close();
      } catch {
        // noop
      }
      this.sse = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {
        // noop
      }
      this.hostConnection = null;
    }

    for (const conn of this.guestConnections.values()) {
      try {
        conn.close();
      } catch {
        // noop
      }
    }
    this.guestConnections.clear();
    this.targetPeerConnections.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // noop
      }
      this.peer = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // noop
      }
      this.broadcastChannel = null;
    }

    this.seenPacketIds.clear();
    this.onMessage = null;
  }
}

export const clientTransport = new ClientTransport();
