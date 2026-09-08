import {
  Card,
  GameState,
  MaskedGameState,
  Suspect,
} from '../types/cluedo';

export interface ActiveSession {
  roomCode: string;
  peerId: string;
  playerName: string;
  character: Suspect;
  isHost: boolean;
  lastActive: number;
}

const SESSION_KEY = 'cluedo_noir_active_session_v1';
const MASTER_PREFIX = 'cluedo_noir_master_v1_';
const CLIENT_PREFIX = 'cluedo_noir_client_v1_';
const NOTEBOOK_PREFIX = 'cluedo_noir_notebook_v1_';

// In-memory memory fallback if localStorage is disabled or in private mode
const memoryStore = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Storage access restricted or disabled
  }
  return memoryStore.get(key) || null;
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Quota exceeded or storage disabled
  }
  memoryStore.set(key, value);
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // noop
  }
  memoryStore.delete(key);
}

export const gameCache = {
  // 1. User Session Management
  saveSession(session: ActiveSession): void {
    safeSet(SESSION_KEY, JSON.stringify(session));
  },

  getSession(): ActiveSession | null {
    const data = safeGet(SESSION_KEY);
    if (!data) return null;
    try {
      const session: ActiveSession = JSON.parse(data);
      // Expire sessions older than 24 hours
      if (Date.now() - session.lastActive > 24 * 60 * 60 * 1000) {
        safeRemove(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      safeRemove(SESSION_KEY);
      return null;
    }
  },

  clearSession(): void {
    safeRemove(SESSION_KEY);
  },

  // 2. Host Master Game State Caching (All Secret Envelopes, Hands, Board State)
  saveMasterState(roomCode: string, state: GameState): void {
    const clean = roomCode.toUpperCase().trim();
    try {
      safeSet(`${MASTER_PREFIX}${clean}`, JSON.stringify({ state, timestamp: Date.now() }));
    } catch (err) {
      console.warn('[Cache] Could not save master state:', err);
    }
  },

  getMasterState(roomCode: string): GameState | null {
    const clean = roomCode.toUpperCase().trim();
    const data = safeGet(`${MASTER_PREFIX}${clean}`);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.state) {
        return parsed.state as GameState;
      }
    } catch {
      // noop
    }
    return null;
  },

  clearMasterState(roomCode: string): void {
    const clean = roomCode.toUpperCase().trim();
    safeRemove(`${MASTER_PREFIX}${clean}`);
  },

  // 3. Client Masked State & Hand Caching
  saveClientState(
    roomCode: string,
    peerId: string,
    state: MaskedGameState,
    hand?: Card[]
  ): void {
    const key = `${CLIENT_PREFIX}${roomCode.toUpperCase().trim()}_${peerId}`;
    try {
      safeSet(key, JSON.stringify({ state, hand: hand || [], timestamp: Date.now() }));
    } catch (err) {
      console.warn('[Cache] Could not save client state:', err);
    }
  },

  getClientState(
    roomCode: string,
    peerId: string
  ): { state: MaskedGameState; hand: Card[] } | null {
    const key = `${CLIENT_PREFIX}${roomCode.toUpperCase().trim()}_${peerId}`;
    const data = safeGet(key);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.state) {
        return {
          state: parsed.state as MaskedGameState,
          hand: parsed.hand || [],
        };
      }
    } catch {
      // noop
    }
    return null;
  },

  // 4. Detective Notebook Deductions Caching
  saveNotebook(
    roomCode: string,
    peerId: string,
    marks: Record<string, any>,
    notes: Record<string, string>
  ): void {
    const key = `${NOTEBOOK_PREFIX}${roomCode.toUpperCase().trim()}_${peerId}`;
    try {
      safeSet(key, JSON.stringify({ marks, notes, timestamp: Date.now() }));
    } catch {
      // noop
    }
  },

  getNotebook(
    roomCode: string,
    peerId: string
  ): { marks: Record<string, any>; notes: Record<string, string> } | null {
    const key = `${NOTEBOOK_PREFIX}${roomCode.toUpperCase().trim()}_${peerId}`;
    const data = safeGet(key);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.marks) {
        return {
          marks: parsed.marks,
          notes: parsed.notes || {},
        };
      }
    } catch {
      // noop
    }
    return null;
  },
};
