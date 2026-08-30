import { Peer, DataConnection } from 'peerjs';
import {
  DisprovedCardPayload,
  MaskedGameState,
  NetworkPacket,
  Suspect,
} from '../types/cluedo';
import { getGuestPeerId, getHostPeerId } from './peerProtocol';

export interface ClientCallbacks {
  onStateUpdate: (maskedState: MaskedGameState) => void;
  onDisprovedCardPrivate?: (payload: DisprovedCardPayload) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: Error) => void;
}

export class P2PGuestClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
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

  private connect() {
    this.peer = new Peer(this.myPeerId, {
      debug: 1,
    });

    this.peer.on('open', (id) => {
      console.log('[P2P Client] Guest peer opened with ID:', id);
      const hostId = getHostPeerId(this.roomCode);
      const conn = this.peer!.connect(hostId, {
        reliable: true,
      });

      this.connection = conn;

      conn.on('open', () => {
        console.log('[P2P Client] Connected to host:', hostId);
        this.callbacks.onConnected();

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
          const packet = data as NetworkPacket;
          if (packet.type === 'SYNC_STATE') {
            this.callbacks.onStateUpdate(packet.payload.maskedState);
          } else if (packet.type === 'DISPROVED_REVEAL') {
            this.callbacks.onDisprovedCardPrivate?.(packet.payload);
          }
        } catch (err) {
          console.error('[P2P Client] Error processing incoming packet:', err);
        }
      });

      conn.on('close', () => {
        console.log('[P2P Client] Connection to host closed');
        this.callbacks.onDisconnected();
      });

      conn.on('error', (err) => {
        console.error('[P2P Client] Connection error:', err);
        this.callbacks.onError(err);
      });
    });

    this.peer.on('error', (err) => {
      console.error('[P2P Client] Peer error:', err);
      this.callbacks.onError(err);
    });
  }

  public sendPacket(packet: NetworkPacket) {
    if (this.connection && this.connection.open) {
      this.connection.send(packet);
    } else {
      console.warn('[P2P Client] Cannot send packet, connection is not open');
    }
  }

  public destroy() {
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
