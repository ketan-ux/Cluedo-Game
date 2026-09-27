import {
  doc,
  collection,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { TransportPacket } from './clientTransport';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

class FirestoreRelay {
  private roomCode: string = '';
  private peerId: string = '';
  private unsubPackets: Unsubscribe | null = null;
  private unsubRoom: Unsubscribe | null = null;
  private seenPacketIds: Set<string> = new Set();
  private isConnected: boolean = false;

  startRoomSync(
    roomCode: string,
    peerId: string,
    onPacket: (packet: TransportPacket) => void,
    onDirectState?: (state: any) => void
  ) {
    this.stopRoomSync();
    this.roomCode = roomCode.toUpperCase().trim();
    this.peerId = peerId;
    this.isConnected = true;

    const sessionStart = Date.now() - 3000;

    try {
      // 1. Listen to real-time packets in the room subcollection
      const packetsRef = collection(db, 'rooms', this.roomCode, 'packets');
      const packetsQuery = query(packetsRef, orderBy('timestamp', 'desc'), limit(25));

      this.unsubPackets = onSnapshot(
        packetsQuery,
        (snapshot) => {
          if (!this.isConnected) return;

          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (!data || !data.id) return;
              if (data.senderId === this.peerId) return;
              if (this.seenPacketIds.has(data.id)) return;

              // Do not process stale packets from past games
              if (data.timestamp && data.timestamp < sessionStart) return;

              // Confidential targeted packet filtering
              const targetPeerId = data.targetPeerId || data.payload?.targetPeerId;
              if (targetPeerId && targetPeerId !== this.peerId) {
                return;
              }

              this.seenPacketIds.add(data.id);

              let parsedPayload = data.payload;
              if (typeof data.payload === 'string') {
                try {
                  parsedPayload = JSON.parse(data.payload);
                } catch {
                  // Keep as string
                }
              }

              const packet: TransportPacket = {
                id: data.id,
                roomCode: data.roomCode,
                senderId: data.senderId,
                timestamp: data.timestamp || Date.now(),
                payload: parsedPayload,
              };

              onPacket(packet);
            }
          });
        },
        (err) => {
          console.warn('[Firestore Relay] Packets snapshot error:', err);
        }
      );

      // 2. Listen to room document for instant fast-sync
      const roomDocRef = doc(db, 'rooms', this.roomCode);
      this.unsubRoom = onSnapshot(
        roomDocRef,
        (snap) => {
          if (!this.isConnected || !snap.exists()) return;
          const data = snap.data();
          if (data && data.stateJson && onDirectState) {
            try {
              const state = JSON.parse(data.stateJson);
              onDirectState(state);
            } catch {
              // Ignore parse errors
            }
          }
        },
        (err) => {
          console.warn('[Firestore Relay] Room document snapshot error:', err);
        }
      );

      console.log(`[Firestore Relay] Listening to room ${this.roomCode} as ${this.peerId}`);
    } catch (err) {
      console.warn('[Firestore Relay] Connection error:', err);
    }
  }

  async sendPacket(packet: TransportPacket, stateJsonToSync?: string) {
    if (!this.isConnected || !this.roomCode) return;

    this.seenPacketIds.add(packet.id);

    try {
      const packetDocRef = doc(db, 'rooms', this.roomCode, 'packets', packet.id);
      const targetPeerId = packet.payload?.targetPeerId || null;

      // 1. Write the real-time packet
      await setDoc(packetDocRef, {
        id: packet.id,
        roomCode: this.roomCode,
        senderId: this.peerId,
        targetPeerId,
        type: packet.payload?.type || 'EVENT',
        payload: JSON.stringify(packet.payload),
        timestamp: packet.timestamp || Date.now(),
        serverTime: serverTimestamp(),
      });

      // 2. If state was updated, update the room document for fast sync
      if (stateJsonToSync) {
        const roomDocRef = doc(db, 'rooms', this.roomCode);
        await setDoc(
          roomDocRef,
          {
            roomCode: this.roomCode,
            hostPeerId: packet.senderId,
            phase: packet.payload?.state?.phase || 'LOBBY',
            stateJson: stateJsonToSync,
            lastActivity: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('[Firestore Relay] Send error:', err);
    }
  }

  stopRoomSync() {
    this.isConnected = false;
    if (this.unsubPackets) {
      this.unsubPackets();
      this.unsubPackets = null;
    }
    if (this.unsubRoom) {
      this.unsubRoom();
      this.unsubRoom = null;
    }
    this.seenPacketIds.clear();
  }
}

export const firestoreRelay = new FirestoreRelay();
