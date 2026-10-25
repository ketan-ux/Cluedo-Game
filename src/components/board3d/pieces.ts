import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Suspect, SUSPECT_COLORS, Weapon } from '../../game/constants';
import { dieFaceTexture } from './textures';

// ---------------------------------------------------------------------------
// Pawns: the classic turned-wood shape, one colour per suspect.
// ---------------------------------------------------------------------------

function pawnProfile(): THREE.Vector2[] {
  const pts: Array<[number, number]> = [
    [0, 0],
    [0.33, 0],
    [0.35, 0.025],
    [0.35, 0.07],
    [0.3, 0.1],
    [0.21, 0.15],
    [0.165, 0.24],
    [0.145, 0.36],
    [0.14, 0.44],
    [0.205, 0.475],
    [0.215, 0.5],
    [0.18, 0.525],
    [0.1, 0.55],
  ];
  // Round head.
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push([Math.max(0.0001, Math.cos(a) * 0.145), 0.69 + Math.sin(a) * 0.145]);
  }
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

export const pawnGeometry = new THREE.LatheGeometry(pawnProfile(), 28);

const pawnMaterials = new Map<Suspect, THREE.MeshStandardMaterial>();
export function pawnMaterial(s: Suspect): THREE.MeshStandardMaterial {
  let m = pawnMaterials.get(s);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: SUSPECT_COLORS[s], roughness: 0.32, metalness: 0.08 });
    pawnMaterials.set(s, m);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Weapons: metal and hemp miniatures on pale coasters, so they stand out on dark floors.
// There is no environment map to reflect, so the metals are only partly metallic: fully
// metallic surfaces would render nearly black between highlights.
// ---------------------------------------------------------------------------

const brass = new THREE.MeshStandardMaterial({ color: '#e0b84f', metalness: 0.45, roughness: 0.3, emissive: '#3a2a08' });
const steel = new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 0.4, roughness: 0.25, emissive: '#1c1e22' });
const iron = new THREE.MeshStandardMaterial({ color: '#9aa0aa', metalness: 0.35, roughness: 0.4, emissive: '#15171a' });
const lead = new THREE.MeshStandardMaterial({ color: '#b0b6bf', metalness: 0.3, roughness: 0.45, emissive: '#15171a' });
const leather = new THREE.MeshStandardMaterial({ color: '#8a5530', roughness: 0.65 });
const hemp = new THREE.MeshStandardMaterial({ color: '#e0bd80', roughness: 0.9, emissive: '#2a1c08' });
const coasterTop = new THREE.MeshStandardMaterial({ color: '#f3e6c0', roughness: 0.55 });
const coasterRim = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.5, roughness: 0.3 });
const wax = new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.6 });
const flame = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1f', emissiveIntensity: 2.2 });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, setup?: (m: THREE.Mesh) => void) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  setup?.(m);
  return m;
}

function candlestick(): THREE.Group {
  const g = new THREE.Group();
  const profile = [
    [0, 0],
    [0.16, 0],
    [0.16, 0.03],
    [0.09, 0.06],
    [0.045, 0.1],
    [0.035, 0.34],
    [0.06, 0.37],
    [0.09, 0.4],
    [0.05, 0.42],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(profile, 20), brass));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12).translate(0, 0.5, 0), wax));
  g.add(mesh(new THREE.ConeGeometry(0.022, 0.07, 8).translate(0, 0.615, 0), flame));
  return g;
}

function dagger(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Shape();
  blade.moveTo(0, -0.06);
  blade.lineTo(0.42, 0);
  blade.lineTo(0, 0.06);
  blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.03, bevelEnabled: false }).translate(0, 0, -0.015);
  g.add(mesh(bladeGeo, steel));
  g.add(mesh(new THREE.BoxGeometry(0.035, 0.2, 0.04), brass));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 10).rotateZ(Math.PI / 2).translate(-0.105, 0, 0), leather));
  g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8).translate(-0.205, 0, 0), brass));
  g.rotation.x = -Math.PI / 2;
  g.position.set(0.05, 0.03, 0);
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function leadPipe(): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 0.05, 0.12),
    new THREE.Vector3(0.12, 0.05, 0.12),
    new THREE.Vector3(0.24, 0.05, 0.04),
    new THREE.Vector3(0.28, 0.05, -0.2),
  ]);
  g.add(mesh(new THREE.TubeGeometry(curve, 24, 0.06, 10, false), lead));
  g.add(mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.07, 12).rotateZ(Math.PI / 2).translate(-0.33, 0.05, 0.12), iron));
  g.position.y = 0.015;
  return g;
}

function revolver(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.3, 12).rotateZ(Math.PI / 2).translate(0.13, 0.11, 0), iron));
  g.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.11, 14).rotateZ(Math.PI / 2).translate(-0.06, 0.1, 0), steel));
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.05).translate(-0.06, 0.15, 0), iron));
  const grip = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.06), leather);
  grip.position.set(-0.18, 0.03, 0);
  grip.rotation.z = 0.45;
  g.add(grip);
  // Lying on its side.
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.035;
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

function rope(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(mesh(new THREE.TorusGeometry(0.16 - i * 0.015, 0.045, 8, 28).rotateX(Math.PI / 2).translate(i * 0.015, 0.045 + i * 0.06, 0), hemp));
  }
  const tail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.15, 0.06, 0.05),
    new THREE.Vector3(0.28, 0.035, 0.12),
    new THREE.Vector3(0.36, 0.035, 0.02),
  ]);
  g.add(mesh(new THREE.TubeGeometry(tail, 12, 0.043, 8, false), hemp));
  return g;
}

function wrench(): THREE.Group {
  const s = new THREE.Shape();
  s.moveTo(-0.32, -0.035);
  s.lineTo(0.14, -0.035);
  s.absarc(0.22, 0, 0.1, Math.PI * 1.1, Math.PI * 0.75, true);
  s.lineTo(0.3, 0.035);
  s.lineTo(0.22, 0.035);
  s.lineTo(0.22, -0.02);
  s.lineTo(0.14, 0.035);
  s.lineTo(-0.32, 0.035);
  s.closePath();
  const g = new THREE.Group();
  const body = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), iron);
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.01;
  g.add(body);
  return g;
}

const WEAPON_BUILDERS: Record<Weapon, () => THREE.Group> = {
  Candlestick: candlestick,
  Dagger: dagger,
  'Lead Pipe': leadPipe,
  Revolver: revolver,
  Rope: rope,
  Wrench: wrench,
};

const COASTER_HEIGHT = 0.045;
const coasterGeometry = new THREE.CylinderGeometry(0.44, 0.46, COASTER_HEIGHT, 36).translate(0, COASTER_HEIGHT / 2, 0);
const rimGeometry = new THREE.TorusGeometry(0.45, 0.022, 8, 40).rotateX(Math.PI / 2).translate(0, COASTER_HEIGHT, 0);

/** A weapon token: the miniature, angled across a pale gold-rimmed coaster about one square wide. */
export function buildWeapon(w: Weapon): THREE.Group {
  const model = WEAPON_BUILDERS[w]();
  // The candlestick stands up, so it stays a little shorter than the pawns.
  model.scale.setScalar(w === 'Candlestick' ? 1.9 : 2.35);
  // Diagonal, so a long weapon fits across its coaster and clears its neighbours.
  model.rotation.y = w === 'Candlestick' ? 0 : -0.62;
  model.position.y = COASTER_HEIGHT;
  const token = new THREE.Group();
  const coaster = new THREE.Mesh(coasterGeometry, coasterTop);
  coaster.receiveShadow = true;
  token.add(coaster, new THREE.Mesh(rimGeometry, coasterRim), model);
  return token;
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

export const DIE_SIZE = 0.62;
export const dieGeometry = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 4, 0.09);

// BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z. Opposite faces add up to seven.
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS: Record<number, THREE.Vector3> = {
  3: new THREE.Vector3(1, 0, 0),
  4: new THREE.Vector3(-1, 0, 0),
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(0, 0, 1),
  5: new THREE.Vector3(0, 0, -1),
};

let dieMaterialsCache: THREE.MeshStandardMaterial[] | null = null;
export function dieMaterials(): THREE.MeshStandardMaterial[] {
  dieMaterialsCache ??= FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: dieFaceTexture(v), roughness: 0.35 }));
  return dieMaterialsCache;
}

/** Rotation that puts `value` on top, turned by `yaw` around the vertical. */
export function dieRestRotation(value: number, yaw: number): THREE.Quaternion {
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[value], up);
  return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(q);
}
