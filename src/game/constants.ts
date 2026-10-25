// Seating order around the board, clockwise from Miss Scarlet. Turn order and the
// order in which players are asked to disprove a suggestion both follow it.
export const SUSPECTS = [
  'Miss Scarlet',
  'Colonel Mustard',
  'Mrs. White',
  'Mr. Green',
  'Mrs. Peacock',
  'Professor Plum',
] as const;

export const WEAPONS = ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'] as const;

export const ROOMS = [
  'Kitchen',
  'Ballroom',
  'Conservatory',
  'Dining Room',
  'Billiard Room',
  'Library',
  'Lounge',
  'Hall',
  'Study',
] as const;

export type Suspect = (typeof SUSPECTS)[number];
export type Weapon = (typeof WEAPONS)[number];
export type Room = (typeof ROOMS)[number];
export type CardName = Suspect | Weapon | Room;
export type CardKind = 'suspect' | 'weapon' | 'room';

export const ALL_CARDS: readonly CardName[] = [...SUSPECTS, ...WEAPONS, ...ROOMS];

export function isSuspect(v: unknown): v is Suspect {
  return (SUSPECTS as readonly unknown[]).includes(v);
}
export function isWeapon(v: unknown): v is Weapon {
  return (WEAPONS as readonly unknown[]).includes(v);
}
export function isRoom(v: unknown): v is Room {
  return (ROOMS as readonly unknown[]).includes(v);
}
export function isCard(v: unknown): v is CardName {
  return isSuspect(v) || isWeapon(v) || isRoom(v);
}

export function cardKind(card: CardName): CardKind {
  if (isSuspect(card)) return 'suspect';
  if (isWeapon(card)) return 'weapon';
  return 'room';
}

export const SECRET_PASSAGES: Partial<Record<Room, Room>> = {
  Kitchen: 'Study',
  Study: 'Kitchen',
  Lounge: 'Conservatory',
  Conservatory: 'Lounge',
};

export const SUSPECT_COLORS: Record<Suspect, string> = {
  'Miss Scarlet': '#c8102e',
  'Colonel Mustard': '#e1ad01',
  'Mrs. White': '#f2f0e6',
  'Mr. Green': '#1f7a3a',
  'Mrs. Peacock': '#1f4fa3',
  'Professor Plum': '#6b2d84',
};

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
