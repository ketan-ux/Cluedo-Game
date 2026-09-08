import Peer, { DataConnection } from 'peerjs';

/**
 * Universal Client-Side Real-Time Multi-Player Transport for Vercel & Static Deployments
 *
 * Designed to seamlessly support 5-6 concurrent players without rate-limits or data drop:
 * 1. Direct WebRTC Data Channels (PeerJS): Ultra-fast, zero-server-relay P2P star topology.
 *    No rate limits, no 4KB message truncation, handles 5-6 players effortlessly.
 * 2. BroadcastChannel: Instant 0ms synchronization across browser tabs on the same device.
 * 3. Public Relay Fallback (ntfy.sh): Low-frequency fallback with single-packet broadcast
 *    and safe error parsing to prevent JSON syntax errors.
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
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private seenPacketIds: Set<string> = new Set();
  private relayTopic: string = '';

  // PeerJS WebRTC State
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private guestConnections: Map<string, DataConnection> = new Map();
  private isWebRTCReady: boolean = false;

  connect(roomCode: string, peerId: string, onMessage: MessageHandler, isHost: boolean = false) {
    this.disconnect();
    this.roomCode = roomCode.toUpperCase().trim();
    this.peerId = peerId;
    this.isHost = isHost;
    this.onMessage = onMessage;
    this.relayTopic = `cluedo_5p_${this.roomCode.toLowerCase()}`;
    this.isConnected = true;

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

    // 2. Setup PeerJS WebRTC Direct DataChannels (P2P mesh without server bottlenecks)
    if (typeof window !== 'undefined') {
      try {
        this.initPeerJS();
      } catch (err) {
        console.warn('[Transport] PeerJS initialization error:', err);
      }
    }

    // 3. Setup Public SSE Relay as fallback for firewalled networks
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const sseUrl = `https://ntfy.sh/${this.relayTopic}/sse`;
        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onmessage = (event) => {
          try {
            if (!event.data || typeof event.data !== 'string') return;
            // Guard against HTML error pages or non-JSON keep-alive pings
            if (!event.data.trim().startsWith('{')) return;

            const data = JSON.parse(event.data);
            if (data && data.message && typeof data.message === 'string' && data.message.trim().startsWith('{')) {
              const packet: TransportPacket = JSON.parse(data.message);
              this.handleIncoming(packet);
            }
          } catch {
            // Silently ignore malformed or keep-alive pings
          }
        };

        this.eventSource.onerror = () => {
          // SSE reconnects automatically
        };
      } catch (err) {
        console.warn('[Transport] EventSource init error:', err);
      }
    }

    console.log(`[Transport] Connected to room ${this.roomCode} as ${this.peerId} (Host: ${isHost})`);
  }

  private initPeerJS() {
    // Generate clean alphanumeric ID for PeerJS
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
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        this.isWebRTCReady = true;

        if (!this.isHost) {
          // Guest: Connect directly to the Host's Peer ID
          const hostPeerId = `cluedo-v4-host-${cleanRoom}`;
          this.connectToHostPeer(hostPeerId);
        }
      });

      this.peer.on('connection', (conn) => {
        // Host: Handle incoming Guest connection
        conn.on('open', () => {
          this.guestConnections.set(conn.peer, conn);
        });

        conn.on('data', (data: any) => {
          this.handleIncoming(data);
        });

        conn.on('close', () => {
          this.guestConnections.delete(conn.peer);
        });

        conn.on('error', () => {
          this.guestConnections.delete(conn.peer);
        });
      });

      this.peer.on('error', (err: any) => {
        // Ignore expected errors like ID taken (reconnection)
        if (err.type === 'unavailable-id' && !this.isHost) {
          // Try with a random suffix
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
      console.warn('[Transport] PeerJS creation warning:', err);
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
        // Retry connection after brief delay if still in game
        if (this.isConnected && !this.isHost) {
          setTimeout(() => this.connectToHostPeer(hostPeerId), 2500);
        }
      });

      conn.on('error', () => {
        this.hostConnection = null;
      });
    } catch (err) {
      console.warn('[Transport] WebRTC connection to host error:', err);
    }
  }

  async send(payload: any): Promise<void> {
    if (!this.isConnected || !this.roomCode) return;

    const packet: TransportPacket = {
      id: `${this.peerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: Date.now(),
      payload,
    };

    // Mark as seen by sender so we don't process our own echo
    this.seenPacketIds.add(packet.id);

    // 1. Broadcast to local tabs immediately (0ms)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (err) {
        console.warn('[Transport] BroadcastChannel send error:', err);
      }
    }

    // 2. Send directly over WebRTC DataChannel
    let sentViaWebRTC = false;
    if (this.isHost) {
      // Host broadcasts to all connected guests
      for (const [peerKey, conn] of this.guestConnections.entries()) {
        if (conn.open) {
          try {
            conn.send(packet);
            sentViaWebRTC = true;
          } catch {
            this.guestConnections.delete(peerKey);
          }
        }
      }
    } else {
      // Guest sends to Host
      if (this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send(packet);
          sentViaWebRTC = true;
        } catch {
          this.hostConnection = null;
        }
      }
    }

    // 3. Publish to global public relay (Fallback for players across firewalled NATs)
    try {
      let packetStr = JSON.stringify(packet);
      if (packetStr.length >= 3900 && packet.payload?.type === 'SYNC_STATE' && packet.payload.state) {
        // Strip logs down to 3 if needed to fit under public relay limit
        const slimPacket = {
          ...packet,
          payload: {
            ...packet.payload,
            state: {
              ...packet.payload.state,
              logs: packet.payload.state.logs?.slice(-3) || [],
            },
          },
        };
        packetStr = JSON.stringify(slimPacket);
      }

      if (packetStr.length < 3900) {
        await fetch(`https://ntfy.sh/${this.relayTopic}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Title': `Cluedo ${this.roomCode}`,
          },
          body: packetStr,
        }).catch(() => {
          // Ignore network errors on public relay
        });
      }
    } catch {
      // Ignore network errors
    }
  }

  /**
   * Direct send to a specific peer over WebRTC if connected (does not broadcast to relay)
   */
  sendDirect(targetPeerId: string, payload: any): void {
    if (!this.isConnected) return;

    const packet: TransportPacket = {
      id: `${this.peerId}_dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: Date.now(),
      payload,
    };

    // BroadcastChannel for local tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {
        // noop
      }
    }

    // Direct WebRTC
    for (const conn of this.guestConnections.values()) {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch {
          // noop
        }
      }
    }
  }

  private handleIncoming(packet: any) {
    if (!packet || typeof packet !== 'object' || !packet.id) return;
    if (packet.senderId === this.peerId) return; // Ignore own messages
    if (this.seenPacketIds.has(packet.id)) return; // Deduplicate

    this.seenPacketIds.add(packet.id);
    if (this.seenPacketIds.size > 300) {
      // Keep memory bounded
      const ids = Array.from(this.seenPacketIds);
      this.seenPacketIds = new Set(ids.slice(ids.length - 150));
    }

    if (this.onMessage) {
      this.onMessage(packet);
    }
  }

  disconnect() {
    this.isConnected = false;
    this.isWebRTCReady = false;

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

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // noop
      }
      this.eventSource = null;
    }

    this.seenPacketIds.clear();
    this.onMessage = null;
  }
}

export const clientTransport = new ClientTransport();

