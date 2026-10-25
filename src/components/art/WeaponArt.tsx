import React, { useId } from 'react';
import { Weapon } from '../../game/constants';

// Weapon illustrations for the cards, on a 100 x 100 canvas.

function Candlestick({ id }: { id: string }) {
  return (
    <>
      <ellipse cx="50" cy="26" rx="14" ry="16" fill={`url(#glow${id})`} />
      <path d="M50 12 C55 19 54 25 50 27 C46 25 45 19 50 12 Z" fill="#ffb347" />
      <path d="M50 17 C52 21 52 24 50 25.5 C48 24 48 21 50 17 Z" fill="#fff2b0" />
      <rect x="45" y="27" width="10" height="20" rx="1.5" fill="#f4efe2" />
      <path d="M38 48 H62 L58 53 H42 Z" fill={`url(#brass${id})`} />
      <path d="M46 53 H54 L53 72 H47 Z" fill={`url(#brass${id})`} />
      <ellipse cx="50" cy="62" rx="6" ry="2.5" fill={`url(#brass${id})`} />
      <path d="M44 72 H56 L64 82 H36 Z" fill={`url(#brass${id})`} />
      <ellipse cx="50" cy="84" rx="20" ry="5" fill={`url(#brass${id})`} />
    </>
  );
}

function Dagger({ id }: { id: string }) {
  return (
    <g transform="rotate(-40 50 50)">
      <path d="M50 6 L57 20 L57 60 L43 60 L43 20 Z" fill={`url(#steel${id})`} />
      <path d="M50 8 L50 60" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" />
      <rect x="32" y="60" width="36" height="6" rx="3" fill={`url(#brass${id})`} />
      <rect x="45" y="66" width="10" height="20" rx="2" fill="#5a3418" />
      {[69, 74, 79, 84].map((y) => (
        <path key={y} d={`M45 ${y} L55 ${y + 2}`} stroke="#3a2212" strokeWidth="1.2" />
      ))}
      <circle cx="50" cy="90" r="5" fill={`url(#brass${id})`} />
    </g>
  );
}

function LeadPipe({ id }: { id: string }) {
  return (
    <>
      <path d="M18 82 L18 40 Q18 22 36 22 L82 22" stroke={`url(#lead${id})`} strokeWidth="13" fill="none" strokeLinecap="butt" />
      <path d="M14 42 L14 82" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
      <rect x="9" y="80" width="18" height="10" rx="2" fill="#5d6066" />
      <rect x="80" y="13" width="10" height="18" rx="2" fill="#5d6066" />
      <path d="M22 50 L14 52 M22 64 L14 66" stroke="#000" strokeOpacity="0.2" strokeWidth="1.5" />
    </>
  );
}

function Revolver({ id }: { id: string }) {
  return (
    <g transform="translate(4 6)">
      <rect x="40" y="28" width="50" height="9" rx="2" fill={`url(#steel${id})`} />
      <rect x="86" y="24" width="4" height="5" fill="#55585e" />
      <path d="M22 26 H46 V48 H30 Z" fill="#55585e" />
      <rect x="30" y="28" width="20" height="16" rx="5" fill={`url(#steel${id})`} />
      {[34, 40, 46].map((x) => (
        <path key={x} d={`M${x} 29 V43`} stroke="#3a3c40" strokeWidth="1" />
      ))}
      <path d="M20 26 L14 22 L18 30 Z" fill="#55585e" />
      <path d="M36 48 Q38 58 48 56 L46 52 Q41 53 41 48 Z" fill="#3a3c40" />
      <path d="M22 44 L32 46 L28 76 Q22 80 14 76 Z" fill={`url(#pearl${id})`} stroke="#b8ab92" strokeWidth="0.8" />
      <circle cx="24" cy="60" r="1.6" fill="#c9a24a" />
    </g>
  );
}

function Rope() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={50} cy={40 + i * 9} rx={28 - i * 2} ry={12} fill="none" stroke="#c8a36a" strokeWidth="7" />
      ))}
      {[0, 1, 2].map((i) =>
        Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * Math.PI * 2;
          const rx = 28 - i * 2;
          const x = 50 + Math.cos(a) * rx;
          const y = 40 + i * 9 + Math.sin(a) * 12;
          return <path key={`${i}${k}`} d={`M${x - 2} ${y - 2.5} L${x + 2} ${y + 2.5}`} stroke="#8a6a3a" strokeWidth="1.1" />;
        })
      )}
      <path d="M74 58 Q82 72 72 84 Q66 92 58 88" stroke="#c8a36a" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M78 66 L74 68 M78 76 L74 76 M70 85 L68 82" stroke="#8a6a3a" strokeWidth="1.1" />
    </>
  );
}

function Wrench({ id }: { id: string }) {
  return (
    <g transform="rotate(35 50 50)">
      <path
        d="M44 30 L44 86 Q44 92 50 92 Q56 92 56 86 L56 30 Q66 26 68 16 L60 18 L56 10 L44 10 L40 18 L32 16 Q34 26 44 30 Z"
        fill={`url(#steel${id})`}
        stroke="#3a3c40"
        strokeWidth="1"
      />
      <rect x="45" y="8" width="10" height="9" fill="#120a06" />
      <path d="M47 40 V80" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="50" cy="86" r="2.4" fill="#120a06" />
    </g>
  );
}

const DRAW: Record<Weapon, (p: { id: string }) => React.ReactElement> = {
  Candlestick,
  Dagger,
  'Lead Pipe': LeadPipe,
  Revolver,
  Rope,
  Wrench,
};

export function WeaponArt({ weapon, className = '' }: { weapon: Weapon; className?: string }) {
  const id = useId().replace(/:/g, '');
  const Draw = DRAW[weapon];
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={weapon}>
      <defs>
        <linearGradient id={`brass${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8a6a1f" />
          <stop offset="0.45" stopColor="#f3d77a" />
          <stop offset="1" stopColor="#a8822a" />
        </linearGradient>
        <linearGradient id={`steel${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#7c8088" />
          <stop offset="0.5" stopColor="#eef0f3" />
          <stop offset="1" stopColor="#9aa0a8" />
        </linearGradient>
        <linearGradient id={`lead${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9aa0a8" />
          <stop offset="1" stopColor="#5d6066" />
        </linearGradient>
        <linearGradient id={`pearl${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#f7f2e6" />
          <stop offset="1" stopColor="#d8ccb4" />
        </linearGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Draw id={id} />
    </svg>
  );
}
