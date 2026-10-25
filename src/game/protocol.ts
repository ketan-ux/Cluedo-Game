import { Suspect } from './constants';
import { GameAction, GameEvent } from './engine';
import { GameView } from './view';

/** Lobby and room-level actions. Host-only ones are checked on the server. */
export type RoomAction =
  | { type: 'pickSuspect'; suspect: Suspect }
  | { type: 'addBot'; suspect?: Suspect }
  | { type: 'remove'; memberId: string }
  | { type: 'start' }
  | { type: 'rematch' }
  | { type: 'chat'; text: string };

export type AnyAction = RoomAction | GameAction;

export type ClientMessage =
  | { t: 'hello'; token?: string; name: string; suspect?: Suspect }
  | { t: 'act'; action: AnyAction }
  | { t: 'leave' };

export interface MemberView {
  id: string;
  name: string;
  suspect: Suspect;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface ChatMessage {
  id: number;
  at: number;
  memberId: string;
  name: string;
  text: string;
}

export interface RoomView {
  code: string;
  status: 'lobby' | 'playing' | 'over';
  youId: string | null;
  hostId: string | null;
  members: MemberView[];
  chat: ChatMessage[];
  game: GameView | null;
  /** A disconnected player is holding up the game; their move is made for them at `deadline`. */
  away: { memberId: string; deadline: number } | null;
}

export type ServerMessage =
  | { t: 'welcome'; memberId: string; token: string }
  | { t: 'state'; room: RoomView; events: GameEvent[] }
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'removed' };

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}
