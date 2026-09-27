import { AccusationResultPayload, DisprovedCardPayload, MaskedGameState, NetworkPacket, Suspect } from '../types/cluedo';

export function formatRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getShareableInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('join', roomCode);
  url.searchParams.delete('room');
  url.searchParams.delete('code');
  if (url.hostname.startsWith('ais-dev-')) {
    url.hostname = url.hostname.replace('ais-dev-', 'ais-pre-');
  }
  return url.toString();
}
