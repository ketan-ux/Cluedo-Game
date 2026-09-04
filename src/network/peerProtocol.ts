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

export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.protocol}//${window.location.host}/api`;
}

// ----------------------------------------------------
// Server-Authoritative HTTP Client Helpers
// ----------------------------------------------------

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  roomCode?: string;
  peerId?: string;
  isHost?: boolean;
  state?: MaskedGameState;
  disprovedCard?: DisprovedCardPayload | null;
  accusationResult?: AccusationResultPayload | null;
}

export async function apiCreateRoom(
  character: Suspect,
  name: string,
  roomCode?: string
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character, name, roomCode }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[Protocol] apiCreateRoom error:', err);
    return { success: false, error: err.message || 'Network connection failed' };
  }
}

export async function apiJoinRoom(
  roomCode: string,
  name: string,
  character?: Suspect,
  peerId?: string
): Promise<ApiResponse> {
  const code = formatRoomCode(roomCode);
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, character, peerId }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[Protocol] apiJoinRoom error:', err);
    return { success: false, error: err.message || 'Unable to reach game server' };
  }
}

export async function apiGetRoomState(roomCode: string, peerId: string): Promise<ApiResponse> {
  const code = formatRoomCode(roomCode);
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${code}/state?peerId=${encodeURIComponent(peerId)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Sync failed' };
  }
}

export async function apiSendAction(
  roomCode: string,
  peerId: string,
  action: NetworkPacket
): Promise<ApiResponse> {
  const code = formatRoomCode(roomCode);
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId, action }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[Protocol] apiSendAction error:', err);
    return { success: false, error: err.message || 'Failed to dispatch action' };
  }
}

export async function apiLeaveRoom(roomCode: string, peerId: string): Promise<ApiResponse> {
  const code = formatRoomCode(roomCode);
  try {
    const res = await fetch(`${getApiBaseUrl()}/rooms/${code}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
