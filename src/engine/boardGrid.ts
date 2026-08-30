import { Position, Room, SECRET_PASSAGES, Suspect, SUSPECT_STARTING_POSITIONS, Weapon } from '../types/cluedo';

export interface RoomDefinition {
  name: Room;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: { x: number; y: number };
  doorways: Array<{ x: number; y: number }>;
  secretPassageTo: Room | null;
  themeColor: string;
  description: string;
}

export const ROOM_DEFINITIONS: Record<Room, RoomDefinition> = {
  Kitchen: {
    name: 'Kitchen',
    bounds: { minX: 0, maxX: 5, minY: 0, maxY: 6 },
    center: { x: 2, y: 3 },
    doorways: [{ x: 4, y: 7 }],
    secretPassageTo: 'Study',
    themeColor: '#78350f',
    description: 'Cast iron stoves, prep counters, and meat hooks.',
  },
  Ballroom: {
    name: 'Ballroom',
    bounds: { minX: 8, maxX: 15, minY: 0, maxY: 6 },
    center: { x: 12, y: 3 },
    doorways: [
      { x: 8, y: 6 },
      { x: 9, y: 7 },
      { x: 14, y: 7 },
      { x: 15, y: 6 },
    ],
    secretPassageTo: null,
    themeColor: '#1e3a8a',
    description: 'Polished parquet dance floor under a massive crystal chandelier.',
  },
  Conservatory: {
    name: 'Conservatory',
    bounds: { minX: 18, maxX: 23, minY: 0, maxY: 5 },
    center: { x: 21, y: 2 },
    doorways: [{ x: 18, y: 5 }],
    secretPassageTo: 'Lounge',
    themeColor: '#064e3b',
    description: 'Verdant glass solarium filled with exotic ferns and stone statues.',
  },
  'Dining Room': {
    name: 'Dining Room',
    bounds: { minX: 0, maxX: 7, minY: 9, maxY: 15 },
    center: { x: 4, y: 12 },
    doorways: [
      { x: 7, y: 12 },
      { x: 6, y: 16 },
    ],
    secretPassageTo: null,
    themeColor: '#831843',
    description: 'Grand mahogany dining banquet set with silver service.',
  },
  'Billiard Room': {
    name: 'Billiard Room',
    bounds: { minX: 18, maxX: 23, minY: 8, maxY: 12 },
    center: { x: 21, y: 10 },
    doorways: [
      { x: 18, y: 9 },
      { x: 22, y: 13 },
    ],
    secretPassageTo: null,
    themeColor: '#047857',
    description: 'Heavy green baize slate table with antique cue racks.',
  },
  Library: {
    name: 'Library',
    bounds: { minX: 17, maxX: 23, minY: 14, maxY: 18 },
    center: { x: 20, y: 16 },
    doorways: [
      { x: 20, y: 13 },
      { x: 16, y: 16 },
    ],
    secretPassageTo: null,
    themeColor: '#4c1d95',
    description: 'Floor-to-ceiling leather-bound tomes and rolling brass ladders.',
  },
  Lounge: {
    name: 'Lounge',
    bounds: { minX: 0, maxX: 6, minY: 19, maxY: 24 },
    center: { x: 3, y: 22 },
    doorways: [{ x: 6, y: 18 }],
    secretPassageTo: 'Conservatory',
    themeColor: '#991b1b',
    description: 'Plush velvet armchairs facing a roaring brick fireplace.',
  },
  Hall: {
    name: 'Hall',
    bounds: { minX: 9, maxX: 14, minY: 18, maxY: 24 },
    center: { x: 12, y: 21 },
    doorways: [
      { x: 11, y: 17 },
      { x: 12, y: 17 },
      { x: 15, y: 20 },
    ],
    secretPassageTo: null,
    themeColor: '#854d0e',
    description: 'Towering foyer with sweeping dual staircases and oil portraits.',
  },
  Study: {
    name: 'Study',
    bounds: { minX: 17, maxX: 23, minY: 20, maxY: 24 },
    center: { x: 20, y: 22 },
    doorways: [{ x: 17, y: 20 }],
    secretPassageTo: 'Kitchen',
    themeColor: '#1e293b',
    description: 'Heavy roll-top desk, safe, and private telephone.',
  },
};

// Inaccessible Cellar in Center (where the envelope rests)
export const CELLAR_BOUNDS = { minX: 9, maxX: 14, minY: 9, maxY: 15 };

// Check if a tile coordinate is a designated starting position for any suspect
export function isStartingPosition(x: number, y: number): Suspect | null {
  for (const [suspect, pos] of Object.entries(SUSPECT_STARTING_POSITIONS) as [
    Suspect,
    { x: number; y: number }
  ][]) {
    if (pos.x === x && pos.y === y) return suspect;
  }
  return null;
}

// Check if a tile coordinate is inside any room
export function getRoomAtCoordinate(x: number, y: number): Room | null {
  for (const [roomName, def] of Object.entries(ROOM_DEFINITIONS) as [Room, RoomDefinition][]) {
    if (
      x >= def.bounds.minX &&
      x <= def.bounds.maxX &&
      y >= def.bounds.minY &&
      y <= def.bounds.maxY
    ) {
      return roomName;
    }
  }
  return null;
}

// Check if coordinate is in the Cellar (center envelope area)
export function isCellar(x: number, y: number): boolean {
  return (
    x >= CELLAR_BOUNDS.minX &&
    x <= CELLAR_BOUNDS.maxX &&
    y >= CELLAR_BOUNDS.minY &&
    y <= CELLAR_BOUNDS.maxY
  );
}

// Check if tile is a valid walkable corridor square
export function isCorridor(x: number, y: number): boolean {
  if (x < 0 || x > 23 || y < 0 || y > 24) return false;
  if (isCellar(x, y)) return false;
  if (getRoomAtCoordinate(x, y) !== null) return false;
  
  // Starting positions are always valid corridor squares
  if (isStartingPosition(x, y)) return true;

  // Unused corner blocks in original board
  if ((x === 6 && y === 0) || (x === 17 && y === 0)) return false;
  if ((x === 0 && y === 6) || (x === 0 && y === 8)) return false;
  if ((x === 23 && y === 6) || (x === 23 && y === 8)) return false;
  if ((x === 0 && y === 16) || (x === 0 && y === 18)) return false;
  if ((x === 23 && y === 13) || (x === 23 && y === 14)) return false;
  if (x === 7 && y === 24) return false;
  if (x === 16 && y === 24) return false;

  return true;
}

// Check if stepping on (x, y) is entering a doorway into a room
export function getDoorwayTarget(x: number, y: number): Room | null {
  for (const [roomName, def] of Object.entries(ROOM_DEFINITIONS) as [Room, RoomDefinition][]) {
    for (const d of def.doorways) {
      if (d.x === x && d.y === y) {
        return roomName;
      }
    }
  }
  return null;
}

export interface ValidMove {
  x: number;
  y: number;
  isDoorway?: boolean;
  targetRoom?: Room;
  isSecretPassage?: boolean;
}

/**
 * Calculates all reachable coordinates / room doorways for a player given dice steps,
 * preventing stepping on or through occupied corridor squares.
 */
export function calculateValidMoves(
  currentPos: Position,
  steps: number,
  occupiedPositions: Array<{ x: number; y: number; room: Room | null }>
): ValidMove[] {
  const occupiedSet = new Set(
    occupiedPositions
      .filter((p) => p.room === null)
      .map((p) => `${p.x},${p.y}`)
  );

  // Exclude player's current position from collision check
  if (currentPos.room === null) {
    occupiedSet.delete(`${currentPos.x},${currentPos.y}`);
  }

  const results: ValidMove[] = [];
  const visited = new Map<string, number>(); // key -> minimum distance reached

  // Starting origins
  const queue: Array<{ x: number; y: number; dist: number }> = [];

  if (currentPos.room) {
    // If starting inside a room, player can exit via any of the room's doorways with step cost 1
    const roomDef = ROOM_DEFINITIONS[currentPos.room];
    for (const door of roomDef.doorways) {
      if (!occupiedSet.has(`${door.x},${door.y}`)) {
        queue.push({ x: door.x, y: door.y, dist: 1 });
        visited.set(`${door.x},${door.y}`, 1);
        if (steps >= 1) {
          results.push({ x: door.x, y: door.y });
        }
      }
    }
  } else {
    queue.push({ x: currentPos.x, y: currentPos.y, dist: 0 });
    visited.set(`${currentPos.x},${currentPos.y}`, 0);
  }

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;

    if (curr.dist >= steps) continue;

    for (const dir of directions) {
      const nx = curr.x + dir.dx;
      const ny = curr.y + dir.dy;
      const key = `${nx},${ny}`;
      const nextDist = curr.dist + 1;

      if (nx < 0 || nx > 23 || ny < 0 || ny > 24) continue;
      if (occupiedSet.has(key)) continue;

      // Check if it is a doorway
      const doorwayRoom = getDoorwayTarget(nx, ny);
      if (doorwayRoom) {
        // Entering a doorway can be a destination
        if (doorwayRoom !== currentPos.room) {
          if (!results.some((r) => r.x === nx && r.y === ny)) {
            results.push({
              x: nx,
              y: ny,
              isDoorway: true,
              targetRoom: doorwayRoom,
            });
          }
        }
      }

      // Check if it's a corridor square
      if (isCorridor(nx, ny)) {
        if (!visited.has(key) || visited.get(key)! > nextDist) {
          visited.set(key, nextDist);
          queue.push({ x: nx, y: ny, dist: nextDist });

          if (nextDist <= steps && !results.some((r) => r.x === nx && r.y === ny)) {
            results.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  // Filter out the exact starting position if not moved
  return results.filter(
    (m) => !(currentPos.room === null && m.x === currentPos.x && m.y === currentPos.y)
  );
}

// Compute offsets for multiple pawns in the same room so they don't overlap
export function getRoomTokenOffset(indexInRoom: number): { offsetX: number; offsetY: number } {
  const offsets = [
    { offsetX: -16, offsetY: -16 },
    { offsetX: 16, offsetY: -16 },
    { offsetX: -16, offsetY: 16 },
    { offsetX: 16, offsetY: 16 },
    { offsetX: 0, offsetY: -28 },
    { offsetX: 0, offsetY: 28 },
  ];
  return offsets[indexInRoom % offsets.length];
}
