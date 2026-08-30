import { MaskedGameState, NetworkPacket } from '../types/cluedo';

export const APP_PEER_PREFIX = 'cluedo-noir-v1';

export function formatRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit easily confused chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getHostPeerId(roomCode: string): string {
  return `${APP_PEER_PREFIX}-host-${roomCode.toUpperCase()}`;
}

export function getGuestPeerId(roomCode: string, name: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `${APP_PEER_PREFIX}-guest-${roomCode}-${cleanName}-${randomSuffix}`;
}
