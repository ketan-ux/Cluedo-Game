import { corridorNeighbours, ROOM_LAYOUTS, roomsEnterableFrom, Square, squareKey } from './board';
import { Room } from './constants';

export type Location = { type: 'square'; x: number; y: number } | { type: 'room'; room: Room };

/**
 * A legal destination for this roll. `path` lists every corridor square stepped on, in order,
 * so clients can animate the walk. Room entries end on the square outside the door.
 */
export type MoveOption =
  | { kind: 'square'; key: string; x: number; y: number; path: Square[] }
  | { kind: 'room'; key: string; room: Room; path: Square[] };

export function squareTarget(s: Square): string {
  return `sq:${s.x},${s.y}`;
}

export function roomTarget(room: Room): string {
  return `room:${room}`;
}

/**
 * Strict movement rules:
 * - orthogonal steps only, never onto or through an occupied square, never the same square twice;
 * - a corridor destination must use exactly `steps` squares;
 * - a room may be entered through a door with any number of steps up to `steps` (entering ends the move);
 * - leaving a room costs one step (onto the square outside the door) and that room cannot be re-entered.
 */
export function legalMoves(from: Location, steps: number, occupied: ReadonlySet<string>): MoveOption[] {
  const squares = new Map<string, MoveOption>();
  const rooms = new Map<Room, MoveOption>();
  const visited = new Set<string>();
  const path: Square[] = [];
  const leaving = from.type === 'room' ? from.room : null;

  const visit = (at: Square, used: number) => {
    if (used === steps) {
      const key = squareKey(at);
      if (!squares.has(key)) squares.set(key, { kind: 'square', key: squareTarget(at), x: at.x, y: at.y, path: [...path] });
      return;
    }
    for (const room of roomsEnterableFrom(at)) {
      if (room === leaving) continue;
      const best = rooms.get(room);
      if (!best || best.path.length > path.length) {
        rooms.set(room, { kind: 'room', key: roomTarget(room), room, path: [...path] });
      }
    }
    for (const next of corridorNeighbours(at)) {
      const key = squareKey(next);
      if (visited.has(key) || occupied.has(key)) continue;
      visited.add(key);
      path.push(next);
      visit(next, used + 1);
      path.pop();
      visited.delete(key);
    }
  };

  if (from.type === 'square') {
    visited.add(squareKey(from));
    visit(from, 0);
  } else {
    for (const door of ROOM_LAYOUTS[from.room].doors) {
      const key = squareKey(door.outside);
      if (occupied.has(key)) continue;
      visited.add(key);
      path.push(door.outside);
      visit(door.outside, 1);
      path.pop();
      visited.delete(key);
    }
  }

  return [...rooms.values(), ...squares.values()];
}
