export type Suspect =
  | 'Miss Scarlet'
  | 'Colonel Mustard'
  | 'Mrs. White'
  | 'Mr. Green'
  | 'Mrs. Peacock'
  | 'Professor Plum';

export type Weapon =
  | 'Candlestick'
  | 'Dagger'
  | 'Lead Pipe'
  | 'Revolver'
  | 'Rope'
  | 'Wrench';

export type Room =
  | 'Kitchen'
  | 'Ballroom'
  | 'Conservatory'
  | 'Dining Room'
  | 'Billiard Room'
  | 'Library'
  | 'Lounge'
  | 'Hall'
  | 'Study';

export type CardType = 'SUSPECT' | 'WEAPON' | 'ROOM';

export interface Card {
  id: string;
  type: CardType;
  name: Suspect | Weapon | Room;
  assetPath: string;
  color?: string;
  subtitle?: string;
}

export interface Position {
  x: number;
  y: number;
  room: Room | null;
}

export interface Player {
  peerId: string;
  character: Suspect;
  name: string;
  isHost: boolean;
  isAi?: boolean;
  position: Position;
  hand: Card[];
  hasAccusedWrongly: boolean;
  isConnected: boolean;
  startingPosition: { x: number; y: number };
}

export interface MaskedPlayer {
  peerId: string;
  character: Suspect;
  name: string;
  isHost: boolean;
  isAi?: boolean;
  position: Position;
  hand?: Card[]; // Provided only for the client's own player
  cardCount: number;
  hasAccusedWrongly: boolean;
  isConnected: boolean;
  startingPosition: { x: number; y: number };
}

export interface SuggestionPayload {
  suggesterPeerId: string;
  suggesterName: string;
  suggesterCharacter: Suspect;
  suspect: Suspect;
  weapon: Weapon;
  room: Room;
}

export interface DisprovedCardPayload {
  card: Card;
  disproverPeerId: string;
  disproverName: string;
  suggesterPeerId: string;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'MOVE' | 'ROLL' | 'PASSAGE' | 'SUGGEST' | 'DISPROVE' | 'NO_DISPROVE' | 'ACCUSE' | 'WIN' | 'FAIL_ACCUSE' | 'SYSTEM' | 'CHAT';
  message: string;
  playerPeerId?: string;
  playerName?: string;
  playerCharacter?: Suspect;
}

export type GamePhase =
  | 'LOBBY'
  | 'ROLL'
  | 'MOVE'
  | 'SUGGEST'
  | 'DISPROVE'
  | 'ACCUSE'
  | 'GAME_OVER';

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  envelope: {
    suspect: Suspect;
    weapon: Weapon;
    room: Room;
  };
  players: Player[];
  activePlayerIndex: number;
  diceRoll: [number, number] | null;
  remainingSteps: number;
  currentSuggestion: SuggestionPayload | null;
  pendingDisproverIndex: number | null;
  queryStartIndex?: number | null;
  winner: Player | null;
  weaponPositions: Record<Weapon, Room>;
  turnNumber: number;
  lastDisprovedCardForSuggester?: DisprovedCardPayload | null;
  logs: GameLogEntry[];
  validMoves?: Array<{ x: number; y: number; isDoorway?: boolean; targetRoom?: Room }>;
  turnHasSuggested?: boolean;
}

export interface MaskedGameState {
  roomCode: string;
  phase: GamePhase;
  players: MaskedPlayer[];
  activePlayerIndex: number;
  diceRoll: [number, number] | null;
  remainingSteps: number;
  currentSuggestion: SuggestionPayload | null;
  pendingDisproverIndex: number | null;
  winner: MaskedPlayer | null;
  weaponPositions: Record<Weapon, Room>;
  turnNumber: number;
  lastDisprovedCardForSuggester?: DisprovedCardPayload | null;
  logs: GameLogEntry[];
  validMoves?: Array<{ x: number; y: number; isDoorway?: boolean; targetRoom?: Room }>;
  turnHasSuggested?: boolean;
}

export const SECRET_PASSAGES: Record<Room, Room | null> = {
  Kitchen: 'Study',
  Study: 'Kitchen',
  Lounge: 'Conservatory',
  Conservatory: 'Lounge',
  Ballroom: null,
  'Dining Room': null,
  'Billiard Room': null,
  Library: null,
  Hall: null,
};

export const SUSPECT_COLORS: Record<Suspect, { bg: string; text: string; hex: string; lightHex: string; borderHex: string }> = {
  'Miss Scarlet': { bg: 'bg-red-700', text: 'text-red-100', hex: '#dc2626', lightHex: '#f87171', borderHex: '#ef4444' },
  'Colonel Mustard': { bg: 'bg-amber-600', text: 'text-amber-100', hex: '#d97706', lightHex: '#fbbf24', borderHex: '#f59e0b' },
  'Mrs. White': { bg: 'bg-slate-200', text: 'text-slate-900', hex: '#e2e8f0', lightHex: '#ffffff', borderHex: '#cbd5e1' },
  'Mr. Green': { bg: 'bg-emerald-700', text: 'text-emerald-100', hex: '#059669', lightHex: '#34d399', borderHex: '#10b981' },
  'Mrs. Peacock': { bg: 'bg-sky-700', text: 'text-sky-100', hex: '#0284c7', lightHex: '#38bdf8', borderHex: '#0ea5e9' },
  'Professor Plum': { bg: 'bg-purple-800', text: 'text-purple-100', hex: '#7e22ce', lightHex: '#c084fc', borderHex: '#a855f7' },
};

export const SUSPECT_STARTING_POSITIONS: Record<Suspect, { x: number; y: number }> = {
  'Miss Scarlet': { x: 16, y: 0 },
  'Colonel Mustard': { x: 23, y: 7 },
  'Mrs. White': { x: 9, y: 24 },
  'Mr. Green': { x: 14, y: 24 },
  'Mrs. Peacock': { x: 0, y: 18 },
  'Professor Plum': { x: 0, y: 5 },
};

export const ALL_SUSPECTS: Suspect[] = [
  'Miss Scarlet',
  'Colonel Mustard',
  'Mrs. White',
  'Mr. Green',
  'Mrs. Peacock',
  'Professor Plum',
];

export const ALL_WEAPONS: Weapon[] = [
  'Candlestick',
  'Dagger',
  'Lead Pipe',
  'Revolver',
  'Rope',
  'Wrench',
];

export const ALL_ROOMS: Room[] = [
  'Kitchen',
  'Ballroom',
  'Conservatory',
  'Dining Room',
  'Billiard Room',
  'Library',
  'Lounge',
  'Hall',
  'Study',
];

// Network Action Packets
export type NetworkPacket =
  | { type: 'JOIN_LOBBY'; payload: { name: string; character: Suspect } }
  | { type: 'SELECT_CHARACTER'; payload: { character: Suspect } }
  | { type: 'ADD_BOT'; payload: { character: Suspect } }
  | { type: 'REMOVE_PLAYER'; payload: { peerId: string } }
  | { type: 'START_MATCH' }
  | { type: 'ROLL_DICE' }
  | { type: 'MOVE_TOKEN'; payload: { x: number; y: number } }
  | { type: 'USE_SECRET_PASSAGE'; payload: { targetRoom: Room } }
  | { type: 'MAKE_SUGGESTION'; payload: { suspect: Suspect; weapon: Weapon } }
  | { type: 'DISPROVE_CARD'; payload: { cardId: string } }
  | { type: 'PASS_DISPROVE' }
  | { type: 'MAKE_ACCUSATION'; payload: { suspect: Suspect; weapon: Weapon; room: Room } }
  | { type: 'END_TURN' }
  | { type: 'CHAT_MESSAGE'; payload: { text: string } }
  | { type: 'SYNC_STATE'; payload: { maskedState: MaskedGameState } }
  | { type: 'DISPROVED_REVEAL'; payload: DisprovedCardPayload }
  | { type: 'PING' }
  | { type: 'PONG' };
