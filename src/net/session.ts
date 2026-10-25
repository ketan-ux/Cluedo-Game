import { Suspect } from '../game/constants';

export interface Session {
  code: string;
  token: string;
  name: string;
  suspect?: Suspect;
}

// The current tab's seat lives in sessionStorage, so two tabs on one device can be two players.
// The last seat is also kept in localStorage so a closed tab can offer to rejoin.
const TAB_KEY = 'cluedo.session';
const LAST_KEY = 'cluedo.lastSession';

function read(storage: () => Storage, key: string): Session | null {
  try {
    const raw = storage().getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return typeof s.code === 'string' && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: Session | null) {
  try {
    if (value) storage().setItem(key, JSON.stringify(value));
    else storage().removeItem(key);
  } catch {
    // Storage can be unavailable (private mode); the game still works, it just cannot resume.
  }
}

export const sessions = {
  current: () => read(() => sessionStorage, TAB_KEY),
  last: () => read(() => localStorage, LAST_KEY),
  save(s: Session) {
    write(() => sessionStorage, TAB_KEY, s);
    write(() => localStorage, LAST_KEY, s);
  },
  /** Forget this tab's seat but keep it offered for rejoining from the home screen. */
  clearCurrent() {
    write(() => sessionStorage, TAB_KEY, null);
  },
  clear() {
    write(() => sessionStorage, TAB_KEY, null);
    write(() => localStorage, LAST_KEY, null);
  },
};

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or privacy-mode errors.
  }
}
