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

export const GLOBAL_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
];

export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.protocol}//${window.location.host}/api`;
}

// HTTP fallback helpers
export async function apiRegisterRoom(roomCode: string, hostPeerId: string, name: string, character: string) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, hostPeerId, name, character }),
    });
    return await res.json();
  } catch (err) {
    console.warn('[Protocol] apiRegisterRoom error:', err);
    return null;
  }
}

export async function apiJoinRoom(roomCode: string, guestPeerId: string, name: string, character: string) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestPeerId, name, character }),
    });
    return await res.json();
  } catch (err) {
    console.warn('[Protocol] apiJoinRoom error:', err);
    return null;
  }
}

export async function apiSendPacket(roomCode: string, payload: {
  fromPeerId?: string;
  targetPeerId?: string;
  packet: NetworkPacket;
  isHostBroadcast?: boolean;
}) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${roomCode}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn('[Protocol] apiSendPacket error:', err);
    return null;
  }
}

export async function apiPollPackets(roomCode: string, peerId: string, isHost: boolean) {
  try {
    const url = `${getApiBaseUrl()}/rooms/${roomCode}/poll?peerId=${encodeURIComponent(peerId)}&isHost=${isHost ? 'true' : 'false'}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

