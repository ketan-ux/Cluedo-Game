import { Room, ROOMS, Suspect, SUSPECTS } from './constants';

// The classic 24 x 25 board, top row first. x grows to the right, y grows downwards.
//   #  outside the house / wall      .  corridor square
//   X  central staircase (envelope)  1-6 starting squares (seating order)
//   K Kitchen  B Ballroom  C Conservatory  D Dining Room  R Billiard Room
//   L Library  U Lounge    H Hall          S Study
const MAP = [
  '#########3####4#########',
  'KKKKKK#...BBBB...#CCCCCC',
  'KKKKKK..BBBBBBBB..CCCCCC',
  'KKKKKK..BBBBBBBB..CCCCCC',
  'KKKKKK..BBBBBBBB..CCCCCC',
  'KKKKKK..BBBBBBBB...CCCC#',
  '#KKKKK..BBBBBBBB.......5',
  '#.......BBBBBBBB.......#',
  '#.................RRRRRR',
  'DDDDD.............RRRRRR',
  'DDDDDDDD..XXXXX...RRRRRR',
  'DDDDDDDD..XXXXX...RRRRRR',
  'DDDDDDDD..XXXXX...RRRRRR',
  'DDDDDDDD..XXXXX........#',
  'DDDDDDDD..XXXXX...LLLLL#',
  'DDDDDDDD..XXXXX..LLLLLLL',
  '#.........XXXXX..LLLLLLL',
  '2................LLLLLLL',
  '#........HHHHHH...LLLLL#',
  'UUUUUUU..HHHHHH........6',
  'UUUUUUU..HHHHHH........#',
  'UUUUUUU..HHHHHH..SSSSSSS',
  'UUUUUUU..HHHHHH..SSSSSSS',
  'UUUUUUU..HHHHHH..SSSSSSS',
  'UUUUUUU1#HHHHHH##SSSSSSS',
];

export const BOARD_WIDTH = 24;
export const BOARD_HEIGHT = 25;

const ROOM_LETTERS: Record<string, Room> = {
  K: 'Kitchen',
  B: 'Ballroom',
  C: 'Conservatory',
  D: 'Dining Room',
  R: 'Billiard Room',
  L: 'Library',
  U: 'Lounge',
  H: 'Hall',
  S: 'Study',
};

export type Cell =
  | { kind: 'void' }
  | { kind: 'stairs' }
  | { kind: 'corridor'; start?: Suspect }
  | { kind: 'room'; room: Room };

export interface Square {
  x: number;
  y: number;
}

/** A door joins one room square to the corridor square directly outside it. */
export interface Door {
  room: Room;
  inside: Square;
  outside: Square;
}

export const DOORS: readonly Door[] = (
  [
    ['Kitchen', 4, 6, 4, 7],
    ['Ballroom', 8, 5, 7, 5],
    ['Ballroom', 15, 5, 16, 5],
    ['Ballroom', 9, 7, 9, 8],
    ['Ballroom', 14, 7, 14, 8],
    ['Conservatory', 18, 4, 18, 5],
    ['Dining Room', 7, 12, 8, 12],
    ['Dining Room', 6, 15, 6, 16],
    ['Billiard Room', 18, 9, 17, 9],
    ['Billiard Room', 22, 12, 22, 13],
    ['Library', 20, 14, 20, 13],
    ['Library', 17, 16, 16, 16],
    ['Lounge', 6, 19, 6, 18],
    ['Hall', 11, 18, 11, 17],
    ['Hall', 12, 18, 12, 17],
    ['Hall', 14, 20, 15, 20],
    ['Study', 17, 21, 17, 20],
  ] as const
).map(([room, ix, iy, ox, oy]) => ({ room, inside: { x: ix, y: iy }, outside: { x: ox, y: oy } }));

function parseCell(ch: string): Cell {
  if (ch === '#') return { kind: 'void' };
  if (ch === 'X') return { kind: 'stairs' };
  if (ch === '.') return { kind: 'corridor' };
  if (ch >= '1' && ch <= '6') return { kind: 'corridor', start: SUSPECTS[Number(ch) - 1] };
  const room = ROOM_LETTERS[ch];
  if (!room) throw new Error(`Unknown board character "${ch}"`);
  return { kind: 'room', room };
}

const CELLS: Cell[][] = MAP.map((row) => Array.from(row, parseCell));

export function cellAt(x: number, y: number): Cell {
  if (x < 0 || y < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return { kind: 'void' };
  return CELLS[y][x];
}

export function isCorridor(x: number, y: number): boolean {
  return cellAt(x, y).kind === 'corridor';
}

export function squareKey(s: Square): string {
  return `${s.x},${s.y}`;
}

export const START_SQUARES = Object.fromEntries(
  CELLS.flatMap((row, y) =>
    row.flatMap((cell, x) => (cell.kind === 'corridor' && cell.start ? [[cell.start, { x, y }]] : []))
  )
) as Record<Suspect, Square>;

export interface RoomLayout {
  room: Room;
  cells: Square[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  doors: Door[];
}

export const ROOM_LAYOUTS = Object.fromEntries(
  ROOMS.map((room) => {
    const cells: Square[] = [];
    CELLS.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell.kind === 'room' && cell.room === room) cells.push({ x, y });
      })
    );
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    return [
      room,
      {
        room,
        cells,
        bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
        doors: DOORS.filter((d) => d.room === room),
      },
    ];
  })
) as Record<Room, RoomLayout>;

/** Corridor squares that sit directly outside a door, mapped to the room(s) they lead into. */
const DOOR_OUTSIDE = new Map<string, Room[]>();
for (const door of DOORS) {
  const key = squareKey(door.outside);
  DOOR_OUTSIDE.set(key, [...(DOOR_OUTSIDE.get(key) ?? []), door.room]);
}

export function roomsEnterableFrom(s: Square): Room[] {
  return DOOR_OUTSIDE.get(squareKey(s)) ?? [];
}

const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export function corridorNeighbours(s: Square): Square[] {
  const out: Square[] = [];
  for (const [dx, dy] of DIRECTIONS) {
    if (isCorridor(s.x + dx, s.y + dy)) out.push({ x: s.x + dx, y: s.y + dy });
  }
  return out;
}
