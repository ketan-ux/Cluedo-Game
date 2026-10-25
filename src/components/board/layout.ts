import { BOARD_HEIGHT, BOARD_WIDTH, cellAt, DOORS, ROOM_LAYOUTS, Square } from '../../game/board';
import { Room, Suspect, SUSPECTS, Weapon, WEAPONS } from '../../game/constants';
import { Location } from '../../game/movement';
import { GameView } from '../../game/view';

// Board geometry shared by the 2D and 3D boards, in square units (one square = 1).

export const PASSAGE_CORNER: Partial<Record<Room, Square>> = {
  Kitchen: { x: 0, y: 1 },
  Conservatory: { x: 23, y: 1 },
  Lounge: { x: 0, y: 24 },
  Study: { x: 23, y: 24 },
};

export function roomCentre(room: Room) {
  const b = ROOM_LAYOUTS[room].bounds;
  return {
    x: (b.minX + b.maxX + 1) / 2,
    y: (b.minY + b.maxY + 1) / 2,
    top: b.minY,
    bottom: b.maxY + 1,
    width: b.maxX - b.minX + 1,
  };
}

/** Centre of the room's name: on the first row where the room is at its full width. */
export function labelSpot(room: Room): Square {
  const { cells, bounds } = ROOM_LAYOUTS[room];
  const width = bounds.maxX - bounds.minX + 1;
  let row = bounds.minY;
  while (row < bounds.maxY && cells.filter((c) => c.y === row).length < width) row++;
  return { x: (bounds.minX + bounds.maxX + 1) / 2, y: row + 0.85 };
}

export function pawnSpot(room: Room, index: number, count: number): Square {
  const c = roomCentre(room);
  const perRow = count > 3 ? 3 : count;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const inRow = row === 0 ? perRow : count - 3;
  return { x: c.x + (col - (inRow - 1) / 2) * 0.95, y: c.y + (count > 3 ? (row - 0.5) * 0.95 : 0.1) };
}

export function weaponSpot(room: Room, index: number, count: number): Square {
  const c = roomCentre(room);
  return { x: c.x + (index - (count - 1) / 2) * 0.85, y: c.bottom - 0.6 };
}

export function squareCentre(s: Square): Square {
  return { x: s.x + 0.5, y: s.y + 0.5 };
}

/** Where each piece stands for a given state, in square units. */
export function pawnPositions(pawns: Record<Suspect, Location>): Record<Suspect, Square> {
  const out = {} as Record<Suspect, Square>;
  for (const s of SUSPECTS) {
    const loc = pawns[s];
    if (loc.type === 'square') {
      out[s] = squareCentre(loc);
    } else {
      const together = SUSPECTS.filter((o) => {
        const l = pawns[o];
        return l.type === 'room' && l.room === loc.room;
      });
      out[s] = pawnSpot(loc.room, together.indexOf(s), together.length);
    }
  }
  return out;
}

export function weaponPositions(weapons: GameView['weapons']): Record<Weapon, Square> {
  const out = {} as Record<Weapon, Square>;
  for (const w of WEAPONS) {
    const together = WEAPONS.filter((o) => weapons[o] === weapons[w]);
    out[w] = weaponSpot(weapons[w], together.indexOf(w), together.length);
  }
  return out;
}

const DOOR_EDGES = new Set(DOORS.map((d) => `${d.inside.x},${d.inside.y}>${d.outside.x},${d.outside.y}`));

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Room walls: every room-square edge that faces outside the room, except doorways. */
export function wallSegments(): WallSegment[] {
  const walls: WallSegment[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = cellAt(x, y);
      if (cell.kind !== 'room') continue;
      const sides: Array<[number, number, number, number, number, number]> = [
        [0, -1, x, y, x + 1, y],
        [1, 0, x + 1, y, x + 1, y + 1],
        [0, 1, x, y + 1, x + 1, y + 1],
        [-1, 0, x, y, x, y + 1],
      ];
      for (const [dx, dy, x1, y1, x2, y2] of sides) {
        const n = cellAt(x + dx, y + dy);
        if (n.kind === 'room' && n.room === cell.room) continue;
        if (DOOR_EDGES.has(`${x},${y}>${x + dx},${y + dy}`)) continue;
        walls.push({ x1, y1, x2, y2 });
      }
    }
  }
  return walls;
}

/** The edge each door sits on, for drawing thresholds. */
export function doorEdges(): WallSegment[] {
  return DOORS.map((d) => {
    if (d.inside.y !== d.outside.y) {
      const y = Math.max(d.inside.y, d.outside.y);
      return { x1: d.inside.x, y1: y, x2: d.inside.x + 1, y2: y };
    }
    const x = Math.max(d.inside.x, d.outside.x);
    return { x1: x, y1: d.inside.y, x2: x, y2: d.inside.y + 1 };
  });
}
