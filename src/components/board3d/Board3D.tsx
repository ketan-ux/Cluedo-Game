import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { Crosshair, Mountain, RotateCw } from 'lucide-react';
import { BOARD_HEIGHT, BOARD_WIDTH, START_SQUARES } from '../../game/board';
import { ROOMS, Room, SECRET_PASSAGES, Suspect, SUSPECT_COLORS, SUSPECTS, Weapon, WEAPONS } from '../../game/constants';
import { Envelope, GameEvent } from '../../game/engine';
import { MoveOption } from '../../game/movement';
import { GameView } from '../../game/view';
import { labelSpot, PASSAGE_CORNER, pawnPositions, roomCentre, weaponPositions } from '../board/layout';
import { BoardProps, pointerKind } from '../board/types';
import {
  corridorSquares,
  roomFloorGeometry,
  sharedGeometry,
  STAIRS,
  thresholdsGeometry,
  TILE_TOP,
  toWorld,
  wallsGeometry,
} from './geometry';
import { buildWeapon, DIE_SIZE, dieGeometry, dieMaterials, dieRestRotation, pawnGeometry, pawnMaterial } from './pieces';
import { baizeTexture, floorTexture, labelTexture, woodTexture } from './textures';
import { Furniture } from './furniture';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Ignore taps that were really drags of the camera. */
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta < 8;

function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => {
      if (live) setReady(true);
    };
    if (!document.fonts) {
      done();
      return;
    }
    document.fonts.load('700 72px Cinzel').then(done, done);
    const t = setTimeout(done, 2500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, []);
  return ready;
}

// ---------------------------------------------------------------------------
// The printed board, the walls and the table. Built once.
// ---------------------------------------------------------------------------

function StaticBoard({ fontsReady }: { fontsReady: boolean }) {
  const parts = useMemo(() => {
    const wood = woodTexture('#5a3420', '#2b170c', 3);
    wood.repeat.set(3, 3);
    const frameWood = woodTexture('#6b3f22', '#2e180b', 9);
    frameWood.repeat.set(2, 2);
    const floors = ROOMS.map((room) => {
      const { texture, squaresPerRepeat } = floorTexture(room);
      return { room, geometry: roomFloorGeometry(room, squaresPerRepeat), material: new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }) };
    });
    const tiles = corridorSquares();
    return {
      table: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75 }),
      frame: new THREE.MeshStandardMaterial({ map: frameWood, roughness: 0.6 }),
      base: new THREE.MeshStandardMaterial({ color: '#21140c', roughness: 0.9 }),
      walls: wallsGeometry(),
      wallMaterial: new THREE.MeshStandardMaterial({ color: '#3b2415', roughness: 0.7 }),
      thresholds: thresholdsGeometry(),
      gold: new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8, roughness: 0.3 }),
      floors,
      tiles,
      tileMaterial: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      stairs: new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.6 }),
      baize: new THREE.MeshStandardMaterial({ map: baizeTexture(), roughness: 1 }),
    };
  }, []);

  const tilesRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = tilesRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const light = new THREE.Color('#e9d6a8');
    const dark = new THREE.Color('#dac394');
    parts.tiles.forEach((s, i) => {
      const p = toWorld({ x: s.x + 0.5, y: s.y + 0.5 });
      m.makeTranslation(p.x, 0, p.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, (s.x + s.y) % 2 ? light : dark);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [parts]);

  const labels = useMemo(() => {
    if (!fontsReady) return [];
    return ROOMS.map((room) => {
      const c = roomCentre(room);
      const { texture, aspect } = labelTexture(room.toUpperCase());
      const width = Math.min(c.width - 1.0, aspect * 0.85);
      return { room, texture, width, height: width / aspect, pos: toWorld(labelSpot(room), 0.06) };
    });
  }, [fontsReady]);

  const stairsTitle = useMemo(() => (fontsReady ? labelTexture('CLUEDO', { color: '#d4af37', outline: '#140b07' }) : null), [fontsReady]);

  let tierY = 0;
  return (
    <group>
      <mesh position={[0, -0.36, 0]} receiveShadow material={parts.table}>
        <boxGeometry args={[46, 0.2, 46]} />
      </mesh>
      <mesh position={[0, -0.14, 0]} receiveShadow castShadow material={parts.frame}>
        <boxGeometry args={[BOARD_WIDTH + 1.2, 0.26, BOARD_HEIGHT + 1.2]} />
      </mesh>
      <mesh position={[0, -0.005, 0]} receiveShadow material={parts.base}>
        <boxGeometry args={[BOARD_WIDTH, 0.01, BOARD_HEIGHT]} />
      </mesh>
      <instancedMesh ref={tilesRef} args={[sharedGeometry.tile, parts.tileMaterial, parts.tiles.length]} receiveShadow />
      {parts.floors.map((f) => (
        <mesh key={f.room} geometry={f.geometry} material={f.material} receiveShadow />
      ))}
      <mesh geometry={parts.walls} material={parts.wallMaterial} castShadow receiveShadow />
      <mesh geometry={parts.thresholds} material={parts.gold} />

      {SUSPECTS.map((s) => {
        const p = toWorld({ x: START_SQUARES[s].x + 0.5, y: START_SQUARES[s].y + 0.5 }, TILE_TOP + 0.012);
        return (
          <mesh key={s} position={p} geometry={sharedGeometry.disc} receiveShadow>
            <meshStandardMaterial color={SUSPECT_COLORS[s]} roughness={0.5} />
          </mesh>
        );
      })}

      {labels.map((l) => (
        <mesh key={l.room} position={l.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[l.width, l.height]} />
          <meshBasicMaterial map={l.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      {/* Central staircase */}
      <group position={STAIRS.centre}>
        {STAIRS.tiers.map((t, i) => {
          const y = tierY + t.h / 2;
          tierY += t.h;
          return (
            <group key={i}>
              <mesh position={[0, y, 0]} material={parts.stairs} castShadow receiveShadow>
                <boxGeometry args={[t.w, t.h, t.d]} />
              </mesh>
              <mesh position={[0, y + t.h / 2 + 0.004, 0]} material={parts.gold}>
                <boxGeometry args={[t.w + 0.02, 0.01, 0.05]} />
              </mesh>
            </group>
          );
        })}
        <mesh position={[0, STAIRS.top + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={parts.baize} receiveShadow>
          <planeGeometry args={[2.9, 4.9]} />
        </mesh>
        {stairsTitle && (
          <mesh position={[0, STAIRS.top + 0.01, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.5, 2.5 / stairsTitle.aspect]} />
            <meshBasicMaterial map={stairsTitle.texture} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      </group>

      <Furniture />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pieces and their animations
// ---------------------------------------------------------------------------

type Track =
  | { kind: 'walk'; points: THREE.Vector3[]; t0: number; seg: number }
  | { kind: 'arc'; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; height: number }
  | { kind: 'sink'; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number };

interface PieceState {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  track: Track | null;
}

const WALK_STEP = 0.16;

function sample(track: Track, now: number): { pos: THREE.Vector3; done: boolean } {
  const t = Math.max(0, now - track.t0);
  if (track.kind === 'walk') {
    const total = track.seg * (track.points.length - 1);
    if (t >= total) return { pos: track.points[track.points.length - 1].clone(), done: true };
    const i = Math.floor(t / track.seg);
    const u = (t - i * track.seg) / track.seg;
    const pos = track.points[i].clone().lerp(track.points[i + 1], u);
    pos.y += Math.sin(u * Math.PI) * 0.22;
    return { pos, done: false };
  }
  const u = Math.min(1, t / track.dur);
  if (track.kind === 'arc') {
    const pos = track.from.clone().lerp(track.to, easeInOut(u));
    pos.y += Math.sin(u * Math.PI) * track.height;
    return { pos, done: u >= 1 };
  }
  // Secret passage: sink through the floor, rise in the other room.
  const pos = u < 0.5 ? track.from.clone() : track.to.clone();
  pos.y -= u < 0.5 ? ease(u * 2) * 1.1 : (1 - ease((u - 0.5) * 2)) * 1.1;
  return { pos, done: u >= 1 };
}

function usePieceDirector(game: GameView, batchId: number, events: GameEvent[]) {
  const pieces = useRef(new Map<string, PieceState>());
  const lastBatch = useRef(batchId);
  const clock = useThree((s) => s.clock);
  const invalidate = useThree((s) => s.invalidate);

  const pawnTargets = useMemo(() => {
    const at = pawnPositions(game.pawns);
    return Object.fromEntries(SUSPECTS.map((s) => [s, toWorld(at[s], TILE_TOP)])) as Record<Suspect, THREE.Vector3>;
  }, [game.pawns]);
  const weaponTargets = useMemo(() => {
    const at = weaponPositions(game.weapons);
    return Object.fromEntries(WEAPONS.map((w) => [w, toWorld(at[w], 0.005)])) as Record<Weapon, THREE.Vector3>;
  }, [game.weapons]);

  useLayoutEffect(() => {
    const now = clock.getElapsedTime();
    const fresh = batchId !== lastBatch.current;
    lastBatch.current = batchId;
    const recent = fresh ? events : [];

    const update = (key: string, target: THREE.Vector3, make: (from: THREE.Vector3) => Track) => {
      const st = pieces.current.get(key);
      if (!st) {
        pieces.current.set(key, { pos: target.clone(), target: target.clone(), track: null });
        return;
      }
      if (st.target.distanceToSquared(target) < 1e-6) return;
      st.track = make(st.pos.clone());
      st.target = target.clone();
    };

    for (const s of SUSPECTS) {
      const target = pawnTargets[s];
      const ev = recent.find((e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved' && e.suspect === s);
      update(`p:${s}`, target, (from) => {
        if (ev?.how === 'walk' && ev.path.length) {
          const points = [from, ...ev.path.map((p) => toWorld({ x: p.x + 0.5, y: p.y + 0.5 }, TILE_TOP))];
          if (points[points.length - 1].distanceToSquared(target) > 1e-6) points.push(target);
          return { kind: 'walk', points, t0: now, seg: WALK_STEP };
        }
        if (ev?.how === 'passage') return { kind: 'sink', from, to: target, t0: now, dur: 1.1 };
        if (ev?.how === 'summoned') return { kind: 'arc', from, to: target, t0: now + 0.2, dur: 1.1, height: 2.4 };
        return { kind: 'arc', from, to: target, t0: now, dur: 0.45, height: 0.3 };
      });
    }
    for (const w of WEAPONS) {
      const moved = recent.some((e) => e.type === 'weaponMoved' && e.weapon === w);
      update(`w:${w}`, weaponTargets[w], (from) =>
        moved
          ? { kind: 'arc', from, to: weaponTargets[w], t0: now + 0.35, dur: 1.1, height: 2.2 }
          : { kind: 'arc', from, to: weaponTargets[w], t0: now, dur: 0.45, height: 0.2 }
      );
    }
    invalidate();
  }, [pawnTargets, weaponTargets, batchId, events, clock, invalidate]);

  return pieces;
}

function Piece({
  id,
  pieces,
  children,
}: {
  id: string;
  pieces: React.MutableRefObject<Map<string, PieceState>>;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const st = pieces.current.get(id);
    const g = ref.current;
    if (!st || !g) return;
    if (st.track) {
      const { pos, done } = sample(st.track, state.clock.getElapsedTime());
      st.pos.copy(pos);
      if (done) st.track = null;
      state.invalidate();
    } else {
      st.pos.copy(st.target);
    }
    g.position.copy(st.pos);
  });
  const initial = pieces.current.get(id)?.pos;
  return (
    <group ref={ref} position={initial}>
      {children}
    </group>
  );
}

/** A gold marker over whoever's turn it is. It bounces when the turn starts, then keeps still. */
function ActiveMarker() {
  const ref = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const now = state.clock.getElapsedTime();
    born.current ??= now;
    const t = now - born.current;
    const settle = Math.max(0, 1 - t / 3);
    ref.current.position.y = 1.4 + Math.abs(Math.sin(t * 5)) * 0.35 * settle;
    ref.current.rotation.y = t * 2 * settle;
    if (settle > 0) state.invalidate();
  });
  return (
    <mesh ref={ref} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.13, 0.26, 4]} />
      <meshStandardMaterial color="#ffd54a" emissive="#b8860b" emissiveIntensity={0.8} metalness={0.6} roughness={0.3} />
    </mesh>
  );
}

function Pieces({ game, myId, batchId, events }: { game: GameView; myId: string | null; batchId: number; events: GameEvent[] }) {
  const pieces = usePieceDirector(game, batchId, events);
  const weapons = useMemo(() => Object.fromEntries(WEAPONS.map((w) => [w, buildWeapon(w)])) as Record<Weapon, THREE.Group>, []);
  const active = game.phase === 'playing' ? game.players.find((p) => p.id === game.turn.playerId)?.suspect : undefined;
  const mine = game.players.find((p) => p.id === myId)?.suspect;
  return (
    <group>
      {SUSPECTS.map((s) => (
        <Piece key={s} id={`p:${s}`} pieces={pieces}>
          <mesh geometry={pawnGeometry} material={pawnMaterial(s)} castShadow scale={1.2} />
          {s === mine && (
            <mesh geometry={sharedGeometry.ring} position={[0, 0.01, 0]}>
              <meshBasicMaterial color="#fff6dc" transparent opacity={0.85} />
            </mesh>
          )}
          {s === active && <ActiveMarker key={game.turn.number} />}
        </Piece>
      ))}
      {WEAPONS.map((w) => (
        <Piece key={w} id={`w:${w}`} pieces={pieces}>
          <primitive object={weapons[w]} />
        </Piece>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dice: thrown across the staircase, landing on the faces the server rolled.
// ---------------------------------------------------------------------------

const DICE_REST = [new THREE.Vector3(-0.55, 0, -1.25), new THREE.Vector3(0.6, 0, -1.05)];
export const DICE_ROLL_SECONDS = 1.2;

function Dice({ roll, rollId }: { roll: [number, number] | null; rollId: number }) {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const materials = useMemo(() => dieMaterials(), []);
  const clock = useThree((s) => s.clock);
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef<[number, number]>([3, 4]);
  const anim = useRef<{ t0: number; values: [number, number]; spin: THREE.Vector3[]; yaw: number[] } | null>(null);
  const restY = STAIRS.centre.y + STAIRS.top + DIE_SIZE / 2;
  const rest = (i: number) => new THREE.Vector3(STAIRS.centre.x + DICE_REST[i].x, restY, STAIRS.centre.z + DICE_REST[i].z);

  useLayoutEffect(() => {
    if (!roll || rollId === 0) return;
    last.current = roll;
    anim.current = {
      t0: clock.getElapsedTime(),
      values: roll,
      spin: [0, 1].map(() => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()),
      yaw: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
    };
    invalidate();
  }, [rollId, roll, clock, invalidate]);

  useFrame((state) => {
    const a = anim.current;
    refs.forEach((ref, i) => {
      const m = ref.current;
      if (!m) return;
      const end = rest(i);
      if (!a) {
        m.position.copy(end);
        m.quaternion.copy(dieRestRotation(last.current[i], i * 0.6 + 0.3));
        return;
      }
      const t = Math.min(1, (state.clock.getElapsedTime() - a.t0) / DICE_ROLL_SECONDS);
      const start = end.clone().add(new THREE.Vector3(-3.2 + i * 0.8, 2.6, 3.6));
      m.position.copy(start).lerp(end, ease(t));
      m.position.y = end.y + 2.6 * Math.pow(1 - t, 2) * Math.abs(Math.cos(t * Math.PI * 2.5));
      const final = dieRestRotation(a.values[i], a.yaw[i]);
      const tumble = new THREE.Quaternion().setFromAxisAngle(a.spin[i], (1 - ease(t)) * Math.PI * 7);
      m.quaternion.copy(final).premultiply(tumble);
    });
    if (a) {
      if (state.clock.getElapsedTime() - a.t0 >= DICE_ROLL_SECONDS) anim.current = null;
      state.invalidate();
    }
  });

  return (
    <>
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref} geometry={dieGeometry} material={materials} castShadow />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// The envelope on the staircase. It opens when the case is solved.
// ---------------------------------------------------------------------------

function EnvelopeProp({ solution, fontsReady }: { solution: Envelope | null; fontsReady: boolean }) {
  const flap = useRef<THREE.Group>(null);
  const cards = useRef<THREE.Group>(null);
  const opened = useRef<number | null>(null);
  const flapShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.8, 0);
    s.lineTo(0.8, 0);
    s.lineTo(0, 0.62);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  const cardTextures = useMemo(() => {
    if (!solution || !fontsReady) return null;
    return [solution.suspect, solution.weapon, solution.room].map(
      (name) => labelTexture(name.toUpperCase(), { color: '#2d1b10', outline: '#f4e4bc', font: '700 56px Cinzel, Georgia, serif' }).texture
    );
  }, [solution, fontsReady]);

  useFrame((state) => {
    if (!solution) {
      opened.current = null;
      if (flap.current) flap.current.rotation.x = -Math.PI / 2 + 0.02;
      if (cards.current) cards.current.visible = false;
      return;
    }
    opened.current ??= state.clock.getElapsedTime();
    const t = Math.min(1, (state.clock.getElapsedTime() - opened.current) / 1.6);
    if (flap.current) flap.current.rotation.x = -Math.PI / 2 + 0.02 - ease(Math.min(1, t * 2)) * Math.PI * 0.9;
    if (cards.current) {
      cards.current.visible = t > 0.35;
      cards.current.position.y = ease(Math.max(0, (t - 0.35) / 0.65)) * 0.9;
    }
    if (t < 1) state.invalidate();
  });

  const top = STAIRS.centre.y + STAIRS.top;
  return (
    <group position={[STAIRS.centre.x + 0.05, top + 0.03, STAIRS.centre.z + 1.35]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.05, 1.05]} />
        <meshStandardMaterial color="#efe3c4" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.026, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.13, 24]} />
        <meshStandardMaterial color="#8b1520" roughness={0.4} />
      </mesh>
      <group ref={flap} position={[0, 0.03, -0.52]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={flapShape} rotation={[0, 0, Math.PI]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#e6d7b2" side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      </group>
      <group ref={cards} visible={false}>
        {cardTextures?.map((tex, i) => (
          <group key={i} position={[(i - 1) * 0.55, 0.35, -0.1]} rotation={[-0.35, 0, (i - 1) * -0.12]}>
            <mesh>
              <boxGeometry args={[0.5, 0.72, 0.01]} />
              <meshStandardMaterial color="#f4e4bc" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.007]}>
              <planeGeometry args={[0.46, 0.18]} />
              <meshBasicMaterial map={tex} transparent toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Where you can go this roll
// ---------------------------------------------------------------------------

function Pulse({ children }: { children: (material: THREE.MeshStandardMaterial) => React.ReactNode }) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffb300', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }),
    []
  );
  useFrame((state) => {
    material.emissiveIntensity = 0.55 + Math.sin(state.clock.getElapsedTime() * 4) * 0.35;
    state.invalidate();
  });
  return <>{children(material)}</>;
}

function MoveTargets({
  moves,
  selected,
  onPick,
}: {
  moves: MoveOption[];
  selected: string | null;
  onPick: (target: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const squares = moves.filter((m): m is Extract<MoveOption, { kind: 'square' }> => m.kind === 'square');
  const rooms = moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room');
  const squaresRef = useRef<THREE.InstancedMesh>(null);
  const roomGeometries = useMemo(() => Object.fromEntries(ROOMS.map((r) => [r, roomFloorGeometry(r, 1, 0.02)])) as Record<Room, THREE.BufferGeometry>, []);
  const enterLabel = useMemo(() => labelTexture('ENTER', { color: '#1a0f0d', outline: '#ffd54a' }), []);
  const overlay = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.3, depthWrite: false }), []);
  const chosenOverlay = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.5, depthWrite: false }), []);

  useLayoutEffect(() => {
    const mesh = squaresRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    squares.forEach((s, i) => {
      const p = toWorld({ x: s.x + 0.5, y: s.y + 0.5 }, TILE_TOP + 0.015);
      m.makeTranslation(p.x, p.y, p.z);
      if (s.key === selected) m.scale(new THREE.Vector3(1.12, 1, 1.12));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = squares.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [squares, selected]);

  const preview = moves.find((m) => m.key === (selected ?? hover));
  const tap = (key: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isTap(e)) onPick(key);
  };

  return (
    <Pulse>
      {(material) => (
        <group>
          {squares.length > 0 && (
            <instancedMesh
              ref={squaresRef}
              args={[sharedGeometry.marker, material, Math.max(1, squares.length)]}
              onClick={(e) => {
                e.stopPropagation();
                if (e.instanceId !== undefined && isTap(e)) onPick(squares[e.instanceId].key);
              }}
              onPointerMove={(e) => e.instanceId !== undefined && setHover(squares[e.instanceId].key)}
              onPointerOut={() => setHover(null)}
            />
          )}
          {rooms.map((m) => {
            const c = roomCentre(m.room);
            return (
              <group key={m.key}>
                <mesh
                  geometry={roomGeometries[m.room]}
                  material={selected === m.key ? chosenOverlay : overlay}
                  onClick={tap(m.key)}
                  onPointerOver={() => setHover(m.key)}
                  onPointerOut={() => setHover(null)}
                />
                <sprite position={toWorld({ x: c.x, y: c.y }, 1.2)} scale={[2.8, 2.8 / enterLabel.aspect, 1]} onClick={tap(m.key)}>
                  <spriteMaterial map={enterLabel.texture} depthTest={false} toneMapped={false} />
                </sprite>
              </group>
            );
          })}
          {preview?.path.map((s, i) => (
            <mesh key={i} geometry={sharedGeometry.dot} position={toWorld({ x: s.x + 0.5, y: s.y + 0.5 }, TILE_TOP + 0.12)}>
              <meshStandardMaterial color="#9b111e" emissive="#5a0008" />
            </mesh>
          ))}
        </group>
      )}
    </Pulse>
  );
}

function PassageDoors({ game, myId, onPassage }: { game: GameView; myId: string | null; onPassage: () => void }) {
  const mySuspect = game.players.find((p) => p.id === myId)?.suspect;
  const mine = mySuspect ? game.pawns[mySuspect] : null;
  const myTurn = game.turn.playerId === myId && game.phase === 'playing';
  return (
    <group>
      {(Object.keys(PASSAGE_CORNER) as Room[]).map((room) => {
        const at = PASSAGE_CORNER[room]!;
        const usable = myTurn && game.options.passage === SECRET_PASSAGES[room] && mine?.type === 'room' && mine.room === room;
        return (
          <group key={room} position={toWorld({ x: at.x + 0.5, y: at.y + 0.5 }, 0.02)}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                if (usable && isTap(e)) onPassage();
              }}
            >
              <boxGeometry args={[0.8, 0.04, 0.8]} />
              <meshStandardMaterial
                color={usable ? '#ffd54a' : '#2a180c'}
                emissive={usable ? '#b8860b' : '#000000'}
                emissiveIntensity={usable ? 0.8 : 0}
                roughness={0.6}
              />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[-0.22 + i * 0.22, 0.03 + i * 0.03, 0.22 - i * 0.22]}>
                <boxGeometry args={[0.2, 0.05 + i * 0.06, 0.2]} />
                <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.35} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera: fits the board to the screen; drag to pan, pinch to zoom and turn.
// ---------------------------------------------------------------------------

export interface CameraCommand {
  id: number;
  kind: 'fit' | 'tilt' | 'turn';
}

function fitDistance(camera: THREE.PerspectiveCamera, polar: number, azimuth: number): number {
  const corners = [
    [-BOARD_WIDTH / 2 - 0.6, -BOARD_HEIGHT / 2 - 0.6],
    [BOARD_WIDTH / 2 + 0.6, -BOARD_HEIGHT / 2 - 0.6],
    [-BOARD_WIDTH / 2 - 0.6, BOARD_HEIGHT / 2 + 0.6],
    [BOARD_WIDTH / 2 + 0.6, BOARD_HEIGHT / 2 + 0.6],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const probe = camera.clone();
  let lo = 5;
  let hi = 200;
  for (let i = 0; i < 30; i++) {
    const d = (lo + hi) / 2;
    probe.position.setFromSphericalCoords(d, polar, azimuth);
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld();
    const fits = corners.every((c) => {
      const p = c.clone().project(probe);
      return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.97;
    });
    if (fits) hi = d;
    else lo = d;
  }
  return hi;
}

function CameraRig({ command }: { command: CameraCommand }) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<MapControls | null>(null);
  const view = useRef({ polar: 0.55, azimuth: 0 });

  // A layout effect, so the controls exist before the first fit below.
  useLayoutEffect(() => {
    const c = new MapControls(camera, gl.domElement);
    c.screenSpacePanning = false;
    c.enableDamping = false;
    c.zoomToCursor = true;
    c.minDistance = 5;
    c.maxPolarAngle = 1.15;
    c.addEventListener('change', () => {
      // Keep the board in view: the look-at point stays over the board.
      const t = c.target;
      const clamped = new THREE.Vector3(
        THREE.MathUtils.clamp(t.x, -BOARD_WIDTH / 2, BOARD_WIDTH / 2),
        0,
        THREE.MathUtils.clamp(t.z, -BOARD_HEIGHT / 2, BOARD_HEIGHT / 2)
      );
      if (!clamped.equals(t)) {
        camera.position.add(clamped.clone().sub(t));
        t.copy(clamped);
      }
      invalidate();
    });
    controls.current = c;
    return () => c.dispose();
  }, [camera, gl, invalidate]);

  const fit = () => {
    const c = controls.current;
    if (!c) return;
    const cam = camera as THREE.PerspectiveCamera;
    const d = fitDistance(cam, view.current.polar, view.current.azimuth);
    c.maxDistance = d * 1.6;
    c.target.set(0, 0, 0);
    camera.position.setFromSphericalCoords(d, view.current.polar, view.current.azimuth);
    camera.lookAt(0, 0, 0);
    c.update();
    invalidate();
  };

  useLayoutEffect(fit, [size.width, size.height]);
  useEffect(() => {
    if (command.id === 0) return;
    if (command.kind === 'tilt') view.current.polar = view.current.polar > 0.2 ? 0.02 : 0.55;
    if (command.kind === 'turn') view.current.azimuth += Math.PI / 2;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);
  return null;
}

// ---------------------------------------------------------------------------

function Scene({ game, myId, batch, selected, onPick, onPassage, command }: BoardProps & { command: CameraCommand }) {
  const fontsReady = useFontsReady();
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const { gl, size } = useThree();
  const compact = size.width < 700;

  useEffect(() => {
    if (!batch.events.some((e) => e.type === 'rolled')) return;
    setRollId(batch.id);
    setRolling(true);
    const t = setTimeout(() => setRolling(false), DICE_ROLL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [batch]);

  useEffect(() => {
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  // Development only: lets browser tests tap an exact square on the 3D board.
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__boardToScreen = (x: number, y: number) => {
      const v = toWorld({ x: x + 0.5, y: y + 0.5 }, TILE_TOP).project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
    };
  }, [camera, gl]);

  const suggestionRoom = game.turn.stage === 'disprove' ? game.turn.suggestion?.room : undefined;
  const showTargets = !rolling && game.options.moves.length > 0;

  return (
    <>
      <color attach="background" args={['#120a06']} />
      <hemisphereLight args={['#fff1d6', '#2a1a10', 0.85]} />
      <directionalLight
        position={[9, 22, 12]}
        intensity={1.9}
        castShadow
        shadow-mapSize={compact ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-17}
        shadow-camera-right={17}
        shadow-camera-top={17}
        shadow-camera-bottom={-17}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, 6, 0]} intensity={18} distance={22} color="#ffcf8a" />

      <CameraRig command={command} />
      <StaticBoard fontsReady={fontsReady} />
      {suggestionRoom && <SuggestionGlow room={suggestionRoom} />}
      <Pieces game={game} myId={myId} batchId={batch.id} events={batch.events} />
      <Dice roll={game.turn.roll} rollId={rollId} />
      <EnvelopeProp solution={game.phase === 'over' ? game.envelope : null} fontsReady={fontsReady} />
      <PassageDoors game={game} myId={myId} onPassage={onPassage} />
      {showTargets && <MoveTargets moves={game.options.moves} selected={selected} onPick={(t) => onPick(t, pointerKind())} />}
    </>
  );
}

function SuggestionGlow({ room }: { room: Room }) {
  const geometry = useMemo(() => roomFloorGeometry(room, 1, 0.015), [room]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c8102e', transparent: true, opacity: 0.2, depthWrite: false }), []);
  useFrame((state) => {
    material.opacity = 0.12 + (Math.sin(state.clock.getElapsedTime() * 3) + 1) * 0.08;
    state.invalidate();
  });
  return <mesh geometry={geometry} material={material} />;
}

/** The 3D table. Renders only when something changes or moves, to save phone batteries. */
export default function Board3D(props: BoardProps) {
  const [command, setCommand] = useState<CameraCommand>({ id: 0, kind: 'fit' });
  const send = (kind: CameraCommand['kind']) => setCommand((c) => ({ id: c.id + 1, kind }));
  return (
    <div className="relative w-full h-full touch-none" data-board="3d">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{ fov: 38, near: 0.1, far: 300, position: [0, 30, 18] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        aria-label="Cluedo board"
      >
        <Scene {...props} command={command} />
      </Canvas>
      <div className="absolute bottom-2 right-2 flex flex-col gap-1.5 z-10">
        {[
          { kind: 'fit' as const, label: 'Fit board to screen', icon: <Crosshair className="w-4 h-4" /> },
          { kind: 'tilt' as const, label: 'Switch between top-down and angled view', icon: <Mountain className="w-4 h-4" /> },
          { kind: 'turn' as const, label: 'Turn the board', icon: <RotateCw className="w-4 h-4" /> },
        ].map((b) => (
          <button
            key={b.kind}
            type="button"
            onClick={() => send(b.kind)}
            aria-label={b.label}
            title={b.label}
            className="w-9 h-9 rounded-lg bg-[#1a0e08]/85 border border-[#d4af37]/60 text-[#d4af37] flex items-center justify-center shadow-lg active:scale-95"
          >
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
