/**
 * Universal Client-Side Real-Time Transport for Vercel & Static Deployments
 *
 * Uses a resilient dual-transport architecture:
 * 1. BroadcastChannel: Instant, zero-latency synchronization across browser tabs on the same device.
 * 2. Public HTTPS/SSE Relay (ntfy.sh): Global cross-device, cross-network synchronization
 *    that requires zero backend server, zero configuration, zero API keys, and passes through all firewalls/NATs.
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
  private onMessage: MessageHandler | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private seenPacketIds: Set<string> = new Set();
  private relayTopic: string = '';
  private pollInterval: NodeJS.Timeout | null = null;

  connect(roomCode: string, peerId: string, onMessage: MessageHandler) {
    this.disconnect();
    this.roomCode = roomCode.toUpperCase().trim();
    this.peerId = peerId;
    this.onMessage = onMessage;
    this.relayTopic = `cluedo_noir_v2_${this.roomCode}`;
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

    // 2. Setup Server-Sent Events (SSE) from global public relay
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const sseUrl = `https://ntfy.sh/${this.relayTopic}/sse`;
        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.message) {
              const packet: TransportPacket = JSON.parse(data.message);
              this.handleIncoming(packet);
            }
          } catch {
            // Ignore keep-alive or malformed pings
          }
        };

        this.eventSource.onerror = (err) => {
          console.warn('[Transport] Relay SSE connection issue, continuing to listen...', err);
        };
      } catch (err) {
        console.warn('[Transport] EventSource init error:', err);
      }
    }

    console.log(`[Transport] Connected to room ${this.roomCode} as ${this.peerId}`);
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

    // 1. Broadcast to local tabs immediately
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (err) {
        console.warn('[Transport] BroadcastChannel send error:', err);
      }
    }

    // 2. Publish to global relay for cross-network players
    try {
      await fetch(`https://ntfy.sh/${this.relayTopic}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Title': `Cluedo ${this.roomCode}`,
        },
        body: JSON.stringify(packet),
      });
    } catch (err) {
      console.warn('[Transport] Global relay publish error:', err);
    }
  }

  private handleIncoming(packet: any) {
    if (!packet || typeof packet !== 'object' || !packet.id) return;
    if (packet.senderId === this.peerId) return; // Ignore own messages
    if (this.seenPacketIds.has(packet.id)) return; // Deduplicate

    this.seenPacketIds.add(packet.id);
    if (this.seenPacketIds.size > 200) {
      // Keep memory bounded
      const ids = Array.from(this.seenPacketIds);
      this.seenPacketIds = new Set(ids.slice(ids.length - 100));
    }

    if (this.onMessage) {
      this.onMessage(packet);
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
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
