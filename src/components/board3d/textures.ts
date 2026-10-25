import * as THREE from 'three';
import { Room } from '../../game/constants';

// Every texture is painted on a canvas at runtime: nothing to download, nothing to license.

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // Keeps floor patterns crisp at low angles instead of shimmering (clamped to what the GPU supports).
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A tiny deterministic PRNG so every player sees the same grain. */
function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, alpha: number, seed: number) {
  const r = rand(seed);
  for (let i = 0; i < w * h * 0.08; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha * r()})` : `rgba(0,0,0,${alpha * r()})`;
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
}

export function woodTexture(base: string, grain: string, seed = 1, size = 512): THREE.CanvasTexture {
  const { c, g } = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const r = rand(seed);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = grain;
    g.globalAlpha = 0.08 + r() * 0.18;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    const y = r() * size;
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 6 + (r() - 0.5) * 4);
    g.stroke();
  }
  g.globalAlpha = 1;
  noise(g, size, size, 0.08, seed + 7);
  return toTexture(c);
}

type Painter = (g: CanvasRenderingContext2D, s: number) => void;

const checker =
  (a: string, b: string, n: number): Painter =>
  (g, s) => {
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? a : b;
        g.fillRect(x * t, y * t, t, t);
      }
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * t, 0);
      g.lineTo(i * t, s);
      g.moveTo(0, i * t);
      g.lineTo(s, i * t);
      g.stroke();
    }
  };

const parquet: Painter = (g, s) => {
  const r = rand(11);
  const n = 8;
  const t = s / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const shade = 150 + Math.floor(r() * 40);
      g.fillStyle = `rgb(${shade},${Math.floor(shade * 0.66)},${Math.floor(shade * 0.38)})`;
      g.fillRect(x * t, y * t, t, t);
      g.strokeStyle = 'rgba(60,30,10,0.35)';
      g.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        if ((x + y) % 2) {
          g.moveTo(x * t + (k * t) / 4, y * t);
          g.lineTo(x * t + (k * t) / 4, (y + 1) * t);
        } else {
          g.moveTo(x * t, y * t + (k * t) / 4);
          g.lineTo((x + 1) * t, y * t + (k * t) / 4);
        }
        g.stroke();
      }
      g.strokeRect(x * t, y * t, t, t);
    }
};

const carpet =
  (base: string, pattern: string, border: string): Painter =>
  (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = pattern;
    g.lineWidth = 3;
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const cx = x * t + t / 2;
        const cy = y * t + t / 2;
        g.beginPath();
        g.moveTo(cx, cy - t * 0.38);
        g.lineTo(cx + t * 0.38, cy);
        g.lineTo(cx, cy + t * 0.38);
        g.lineTo(cx - t * 0.38, cy);
        g.closePath();
        g.stroke();
        g.fillStyle = border;
        g.beginPath();
        g.arc(cx, cy, t * 0.06, 0, Math.PI * 2);
        g.fill();
      }
    noise(g, s, s, 0.12, 5);
  };

const baize: Painter = (g, s) => {
  g.fillStyle = '#2f6b45';
  g.fillRect(0, 0, s, s);
  noise(g, s, s, 0.25, 3);
};

const stone: Painter = (g, s) => {
  const r = rand(21);
  const n = 4;
  const t = s / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = 175 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${v - 30},${v},${v - 40})`;
      g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
    }
  g.strokeStyle = 'rgba(40,50,30,0.5)';
  g.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * t, 0);
    g.lineTo(i * t, s);
    g.moveTo(0, i * t);
    g.lineTo(s, i * t);
    g.stroke();
  }
  noise(g, s, s, 0.15, 9);
};

const planks =
  (base: string): Painter =>
  (g, s) => {
    const r = rand(31);
    const n = 6;
    const t = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = base;
      g.globalAlpha = 0.85 + r() * 0.15;
      g.fillRect(0, i * t, s, t);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(20,10,5,0.45)';
      g.lineWidth = 2;
      g.strokeRect(-2, i * t, s + 4, t);
      const joint = r() * s;
      g.beginPath();
      g.moveTo(joint, i * t);
      g.lineTo(joint, (i + 1) * t);
      g.stroke();
    }
    noise(g, s, s, 0.1, 13);
  };

const FLOORS: Record<Room, { painter: Painter; squaresPerRepeat: number }> = {
  Kitchen: { painter: checker('#2a2a2a', '#e9e1cc', 4), squaresPerRepeat: 2 },
  Ballroom: { painter: parquet, squaresPerRepeat: 4 },
  Conservatory: { painter: stone, squaresPerRepeat: 2 },
  'Dining Room': { painter: carpet('#6e1f2a', '#c9a24a', '#e8c76a'), squaresPerRepeat: 3 },
  'Billiard Room': { painter: planks('#5a3a22'), squaresPerRepeat: 3 },
  Library: { painter: carpet('#3d2b57', '#a68cc9', '#d8c4f0'), squaresPerRepeat: 3 },
  Lounge: { painter: carpet('#7a2121', '#d9a45a', '#f0c27a'), squaresPerRepeat: 3 },
  Hall: { painter: checker('#d9d0bd', '#8c8576', 4), squaresPerRepeat: 3 },
  Study: { painter: planks('#3f2c1c'), squaresPerRepeat: 3 },
};

export function floorTexture(room: Room): { texture: THREE.CanvasTexture; squaresPerRepeat: number } {
  const { c, g } = canvas(256);
  FLOORS[room].painter(g, 256);
  return { texture: toTexture(c), squaresPerRepeat: FLOORS[room].squaresPerRepeat };
}

export function baizeTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(128);
  baize(g, 128);
  return toTexture(c);
}

/** Text painted onto a transparent canvas, for labels lying on the board. */
export function labelTexture(
  text: string,
  { color = '#fff6dc', outline = '#2a180c', font = '700 72px Cinzel, Georgia, serif' } = {}
): { texture: THREE.CanvasTexture; aspect: number } {
  const probe = canvas(8).g;
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + 48;
  const { c, g } = canvas(width, 112);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = outline;
  g.strokeText(text, width / 2, 58);
  g.fillStyle = color;
  g.fillText(text, width / 2, 58);
  return { texture: toTexture(c, false), aspect: width / 112 };
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
};

export function dieFaceTexture(value: number): THREE.CanvasTexture {
  const { c, g } = canvas(128);
  g.fillStyle = '#f7f0de';
  g.fillRect(0, 0, 128, 128);
  for (const [x, y] of PIPS[value]) {
    g.fillStyle = value === 1 ? '#9b111e' : '#1d120b';
    g.beginPath();
    g.arc(x * 128, y * 128, value === 1 ? 17 : 12, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, false);
}
