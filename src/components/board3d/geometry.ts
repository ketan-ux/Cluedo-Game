import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD_HEIGHT, BOARD_WIDTH, cellAt, ROOM_LAYOUTS, Square } from '../../game/board';
import { Room } from '../../game/constants';
import { doorEdges, wallSegments } from '../board/layout';

/** Board squares to world units: one square is one unit, the board is centred on the origin. */
export const toWorld = (p: Square, y = 0) => new THREE.Vector3(p.x - BOARD_WIDTH / 2, y, p.y - BOARD_HEIGHT / 2);

export const WALL_HEIGHT = 0.38;
export const TILE_TOP = 0.04;

/** One flat mesh per room made from its squares, with UVs in board space so patterns run across squares. */
export function roomFloorGeometry(room: Room, squaresPerRepeat: number, y = 0.003): THREE.BufferGeometry {
  const cells = ROOM_LAYOUTS[room].cells;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  cells.forEach((c, i) => {
    const corners = [
      [c.x, c.y],
      [c.x, c.y + 1],
      [c.x + 1, c.y + 1],
      [c.x + 1, c.y],
    ];
    for (const [x, z] of corners) {
      pos.push(x - BOARD_WIDTH / 2, y, z - BOARD_HEIGHT / 2);
      uv.push(x / squaresPerRepeat, -z / squaresPerRepeat);
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Every room wall as one merged mesh, leaving gaps at the doors. */
export function wallsGeometry(): THREE.BufferGeometry {
  const t = 0.12;
  const parts = wallSegments().map((w) => {
    const horizontal = w.y1 === w.y2;
    const box = new THREE.BoxGeometry(horizontal ? 1 + t : t, WALL_HEIGHT, horizontal ? t : 1 + t);
    const mid = toWorld({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 }, WALL_HEIGHT / 2);
    box.translate(mid.x, mid.y, mid.z);
    return box;
  });
  return mergeGeometries(parts)!;
}

/** Gold thresholds across each doorway. */
export function thresholdsGeometry(): THREE.BufferGeometry {
  const parts = doorEdges().map((e) => {
    const horizontal = e.y1 === e.y2;
    const box = new THREE.BoxGeometry(horizontal ? 0.8 : 0.16, 0.03, horizontal ? 0.16 : 0.8);
    const mid = toWorld({ x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 }, 0.02);
    box.translate(mid.x, mid.y, mid.z);
    return box;
  });
  return mergeGeometries(parts)!;
}

export function corridorSquares(): Square[] {
  const out: Square[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) for (let x = 0; x < BOARD_WIDTH; x++) if (cellAt(x, y).kind === 'corridor') out.push({ x, y });
  return out;
}

/** The central staircase holding the envelope: three stepped tiers over squares 10-14, 10-16. */
export const STAIRS = {
  centre: toWorld({ x: 12.5, y: 13.5 }),
  tiers: [
    { w: 5, d: 7, h: 0.22 },
    { w: 4.1, d: 6.1, h: 0.22 },
    { w: 3.2, d: 5.2, h: 0.22 },
  ],
  get top() {
    return this.tiers.reduce((sum, t) => sum + t.h, 0);
  },
};

export const sharedGeometry = {
  tile: new THREE.BoxGeometry(0.94, TILE_TOP, 0.94).translate(0, TILE_TOP / 2, 0),
  marker: new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2),
  disc: new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32),
  ring: new THREE.RingGeometry(0.42, 0.55, 40).rotateX(-Math.PI / 2),
  dot: new THREE.SphereGeometry(0.1, 12, 8),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
