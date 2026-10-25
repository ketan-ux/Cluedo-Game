import React, { useMemo } from 'react';
import * as THREE from 'three';
import { toWorld } from './geometry';

// Low-poly furniture, placed against the walls so it never hides a pawn, weapon or label.
// Positions are in board squares (the same units as the map).

const M = {
  darkWood: new THREE.MeshStandardMaterial({ color: '#3a2212', roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.55 }),
  iron: new THREE.MeshStandardMaterial({ color: '#2b2b2e', metalness: 0.6, roughness: 0.4 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.3 }),
  marble: new THREE.MeshStandardMaterial({ color: '#e7e1d4', roughness: 0.35 }),
  velvet: new THREE.MeshStandardMaterial({ color: '#7d1d2a', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#2f6b3a', roughness: 0.8 }),
  terracotta: new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.8 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#f1ead8', roughness: 0.4 }),
  black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.3, metalness: 0.2 }),
  fire: new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#ff5a00', emissiveIntensity: 2 }),
  rug: new THREE.MeshStandardMaterial({ color: '#7a2121', roughness: 1 }),
  books: [
    new THREE.MeshStandardMaterial({ color: '#6b1d1d', roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#1d3d6b', roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#2f5a2f', roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.8 }),
  ],
};

function Box({
  at,
  size,
  material,
  y = 0,
}: {
  at: [number, number];
  size: [number, number, number];
  material: THREE.Material;
  y?: number;
}) {
  const p = toWorld({ x: at[0], y: at[1] }, y + size[1] / 2);
  return (
    <mesh position={p} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Stove({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.8, 0.55, 1.3]} material={M.iron} />
      <Box at={[x, y]} size={[0.84, 0.04, 1.34]} material={M.brass} y={0.55} />
      <Box at={[x + 0.1, y - 0.4]} size={[0.14, 0.5, 0.14]} material={M.iron} y={0.59} />
    </>
  );
}

function Counter({ x, y, length }: { x: number; y: number; length: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.7, 0.5, length]} material={M.wood} />
      <Box at={[x, y]} size={[0.76, 0.05, length + 0.06]} material={M.marble} y={0.5} />
    </>
  );
}

function Piano({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[1.5, 0.45, 1.0]} material={M.black} y={0.25} />
      {[
        [x - 0.6, y - 0.35],
        [x + 0.6, y - 0.35],
        [x, y + 0.38],
      ].map(([lx, ly], i) => (
        <Box key={i} at={[lx, ly]} size={[0.08, 0.25, 0.08]} material={M.black} />
      ))}
      <Box at={[x, y - 0.55]} size={[1.3, 0.05, 0.16]} material={M.ivory} y={0.42} />
    </>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  const p = toWorld({ x, y });
  return (
    <group position={p}>
      <mesh position={[0, 0.18, 0]} material={M.terracotta} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.36, 14]} />
      </mesh>
      <mesh position={[0, 0.6, 0]} material={M.leaf} castShadow>
        <icosahedronGeometry args={[0.34, 1]} />
      </mesh>
      <mesh position={[0.15, 0.85, 0.05]} material={M.leaf} castShadow>
        <icosahedronGeometry args={[0.2, 1]} />
      </mesh>
    </group>
  );
}

function DiningTable({ x, y, length }: { x: number; y: number; length: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.9, 0.05, length]} material={M.darkWood} y={0.42} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => <Box key={`${sx}${sy}`} at={[x + sx * 0.36, y + sy * (length / 2 - 0.12)]} size={[0.07, 0.42, 0.07]} material={M.darkWood} />)
      )}
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={toWorld({ x, y: y - length / 2 + f * length }, 0.52)} material={M.brass} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 0.14, 10]} />
        </mesh>
      ))}
    </>
  );
}

function CueRack({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.18, 0.9, 1.4]} material={M.darkWood} />
      {[-0.5, -0.25, 0, 0.25, 0.5].map((o) => (
        <Box key={o} at={[x - 0.14, y + o]} size={[0.04, 0.95, 0.04]} material={M.wood} />
      ))}
    </>
  );
}

function Bookshelf({ x, y, length }: { x: number; y: number; length: number }) {
  const books = useMemo(() => Array.from({ length: Math.floor(length / 0.16) }, (_, i) => M.books[(i * 7) % 4]), [length]);
  return (
    <>
      <Box at={[x, y]} size={[0.45, 0.8, length]} material={M.darkWood} />
      {[0.18, 0.5].map((shelf) =>
        books.map((m, i) => (
          <Box key={`${shelf}${i}`} at={[x - 0.12, y - length / 2 + 0.12 + i * 0.16]} size={[0.2, 0.24, 0.12]} material={m} y={shelf} />
        ))
      )}
    </>
  );
}

function Sofa({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.75, 0.25, 1.8]} material={M.velvet} />
      <Box at={[x - 0.3, y]} size={[0.18, 0.55, 1.8]} material={M.velvet} />
      <Box at={[x, y - 0.85]} size={[0.75, 0.4, 0.16]} material={M.velvet} />
      <Box at={[x, y + 0.85]} size={[0.75, 0.4, 0.16]} material={M.velvet} />
    </>
  );
}

function Fireplace({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.45, 0.75, 1.5]} material={M.marble} />
      <Box at={[x - 0.2, y]} size={[0.1, 0.42, 0.8]} material={M.black} />
      <Box at={[x - 0.23, y]} size={[0.06, 0.16, 0.6]} material={M.fire} />
    </>
  );
}

function Clock({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.45, 1.25, 0.4]} material={M.darkWood} />
      <mesh position={toWorld({ x: x + 0.24, y }, 1.02)} rotation={[0, Math.PI / 2, 0]} material={M.ivory}>
        <circleGeometry args={[0.15, 20]} />
      </mesh>
      <Box at={[x + 0.21, y]} size={[0.02, 0.4, 0.2]} material={M.brass} y={0.35} />
    </>
  );
}

function Desk({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.8, 0.48, 1.3]} material={M.darkWood} />
      <Box at={[x + 0.05, y - 0.35]} size={[0.3, 0.06, 0.4]} material={M.ivory} y={0.48} />
      <mesh position={toWorld({ x: x - 0.1, y: y + 0.35 }, 0.62)} material={M.brass} castShadow>
        <cylinderGeometry args={[0.03, 0.08, 0.28, 10]} />
      </mesh>
    </>
  );
}

function Safe({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box at={[x, y]} size={[0.6, 0.6, 0.6]} material={M.iron} />
      <mesh position={toWorld({ x: x + 0.31, y }, 0.32)} rotation={[0, 0, Math.PI / 2]} material={M.brass}>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 16]} />
      </mesh>
    </>
  );
}

function Rug({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  return (
    <mesh position={toWorld({ x, y }, 0.008)} rotation={[-Math.PI / 2, 0, 0]} material={M.rug} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

export function Furniture() {
  return (
    <group>
      {/* Kitchen */}
      <Stove x={5.45} y={3.3} />
      <Counter x={0.45} y={4.3} length={2.2} />
      {/* Ballroom */}
      <Piano x={9.3} y={3.3} />
      <Plant x={15.4} y={2.6} />
      {/* Conservatory */}
      <Plant x={18.5} y={2.8} />
      <Plant x={23.5} y={3.6} />
      {/* Dining Room */}
      <DiningTable x={1.0} y={12.6} length={3.6} />
      {/* Billiard Room */}
      <CueRack x={23.75} y={10.5} />
      {/* Library */}
      <Bookshelf x={23.7} y={16.5} length={2.6} />
      {/* Lounge */}
      <Sofa x={0.65} y={22.0} />
      <Fireplace x={6.72} y={22.4} />
      {/* Hall */}
      <Rug x={12} y={21.7} w={3.6} d={2.4} />
      <Clock x={9.3} y={20.4} />
      {/* Study */}
      <Desk x={23.4} y={22.7} />
      <Safe x={17.5} y={23.6} />
    </group>
  );
}
