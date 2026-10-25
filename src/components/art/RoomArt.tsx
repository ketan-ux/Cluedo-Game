import React, { useId } from 'react';
import { Room } from '../../game/constants';

// Small interior vignettes for the room cards, on a 120 x 80 canvas.

function Kitchen() {
  return (
    <>
      <rect width="120" height="80" fill="#cdbb94" />
      {Array.from({ length: 12 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => (
          <rect key={`${i}${j}`} x={i * 10} y={56 + j * 8} width="10" height="8" fill={(i + j) % 2 ? '#2a2a2a' : '#eee5cf'} />
        ))
      )}
      <rect x="14" y="26" width="40" height="30" fill="#2b2b2e" />
      <rect x="12" y="23" width="44" height="4" fill="#c9a24a" />
      <rect x="20" y="34" width="12" height="14" rx="1" fill="#141414" />
      <rect x="36" y="34" width="12" height="14" rx="1" fill="#141414" />
      <rect x="42" y="4" width="8" height="20" fill="#3a3a3e" />
      <ellipse cx="24" cy="21" rx="7" ry="2" fill="#7c8088" />
      <rect x="18" y="14" width="12" height="7" fill="#9aa0a8" />
      <path d="M66 56 V30 H110 V56" fill="#7a4a2a" />
      <rect x="64" y="28" width="48" height="4" fill="#e7e1d4" />
      {[72, 84, 96].map((x) => (
        <path key={x} d={`M${x} 8 V18 M${x - 3} 18 h6 v4 h-6 z`} stroke="#555" strokeWidth="1.2" fill="#9aa0a8" />
      ))}
    </>
  );
}

function Ballroom() {
  return (
    <>
      <rect width="120" height="80" fill="#3d2410" />
      <path d="M0 50 L120 50 L120 80 L0 80 Z" fill="#b8895a" />
      {Array.from({ length: 13 }, (_, i) => (
        <path key={i} d={`M${60 + (i - 6) * 4} 50 L${60 + (i - 6) * 18} 80`} stroke="#7a5532" strokeWidth="0.8" />
      ))}
      <path d="M0 62 H120 M0 72 H120" stroke="#7a5532" strokeWidth="0.6" />
      {[16, 104].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="10" width="18" height="40" rx="9" fill="#5b3a20" />
          <rect x={x - 7} y="12" width="14" height="36" rx="7" fill="#87a7c4" opacity="0.6" />
        </g>
      ))}
      <path d="M60 0 V12" stroke="#c9a24a" strokeWidth="1.2" />
      <path d="M40 18 Q60 30 80 18" stroke="#c9a24a" strokeWidth="2" fill="none" />
      <path d="M46 16 Q60 24 74 16" stroke="#c9a24a" strokeWidth="1.5" fill="none" />
      {[40, 47, 54, 60, 66, 73, 80].map((x, i) => (
        <g key={x}>
          <path d={`M${x} ${18 + Math.sin((i / 6) * Math.PI) * 6} v6`} stroke="#e8f0ff" strokeWidth="1" />
          <circle cx={x} cy={25 + Math.sin((i / 6) * Math.PI) * 6} r="1.6" fill="#fff8d0" />
        </g>
      ))}
      <circle cx="60" cy="12" r="3" fill="#ffe28a" />
    </>
  );
}

function Conservatory() {
  return (
    <>
      <rect width="120" height="80" fill="#24402c" />
      <path d="M10 60 V30 Q60 -6 110 30 V60 Z" fill="#a9c9b3" opacity="0.55" />
      <path d="M10 60 V30 Q60 -6 110 30 V60" stroke="#e7e1d4" strokeWidth="2" fill="none" />
      {[26, 43, 60, 77, 94].map((x) => (
        <path key={x} d={`M${x} 60 V${30 - Math.cos(((x - 60) / 50) * Math.PI) * 12}`} stroke="#e7e1d4" strokeWidth="1.2" />
      ))}
      <path d="M10 42 H110" stroke="#e7e1d4" strokeWidth="1.2" />
      <rect x="0" y="60" width="120" height="20" fill="#8a9f7c" />
      {[22, 98].map((x) => (
        <g key={x}>
          <path d={`M${x - 8} 72 h16 l-3 -12 h-10 z`} fill="#a0522d" />
          {[-1, -0.4, 0.3, 1].map((a) => (
            <path key={a} d={`M${x} 60 Q${x + a * 14} ${44} ${x + a * 18} ${36}`} stroke="#2f6b3a" strokeWidth="4" fill="none" strokeLinecap="round" />
          ))}
        </g>
      ))}
      <path d="M54 70 h12 l-2 -10 h-8 z" fill="#d9d1c0" />
      <ellipse cx="60" cy="50" rx="9" ry="12" fill="#3f7d4a" />
    </>
  );
}

function DiningRoom() {
  return (
    <>
      <rect width="120" height="80" fill="#5a1d26" />
      <path d="M0 0 H120 V30 H0 Z" fill="#6e2430" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M${i * 16 + 8} 0 V30`} stroke="#c9a24a" strokeOpacity="0.35" strokeWidth="0.8" />
      ))}
      <rect x="0" y="62" width="120" height="18" fill="#3a1218" />
      <path d="M14 46 L106 46 L114 58 L6 58 Z" fill="#3a2212" />
      <path d="M14 46 L106 46" stroke="#f4efe2" strokeWidth="2" />
      {[20, 100].map((x) => (
        <path key={x} d={`M${x} 58 V70`} stroke="#3a2212" strokeWidth="3" />
      ))}
      {[36, 60, 84].map((x) => (
        <g key={x}>
          <path d={`M${x} 46 V36 M${x - 6} 36 h12 M${x - 6} 36 v-6 M${x + 6} 36 v-6 M${x} 36 v-7`} stroke="#c9a24a" strokeWidth="1.4" fill="none" />
          {[-6, 0, 6].map((dx) => (
            <ellipse key={dx} cx={x + dx} cy={dx === 0 ? 27 : 28} rx="1" ry="2" fill="#ffd27a" />
          ))}
        </g>
      ))}
      {[10, 110].map((x) => (
        <path key={x} d={`M${x} 70 V40 h${x < 60 ? 8 : -8} v18`} stroke="#3a2212" strokeWidth="2.5" fill="none" />
      ))}
    </>
  );
}

function BilliardRoom() {
  return (
    <>
      <rect width="120" height="80" fill="#2a1a10" />
      <path d="M0 0 H120 V36 H0 Z" fill="#1f3a2a" />
      <path d="M52 0 V10 M44 14 L60 6 L76 14 Z" stroke="#c9a24a" strokeWidth="1.4" fill="#2b5a3a" />
      <ellipse cx="60" cy="16" rx="18" ry="3" fill="#ffe28a" opacity="0.35" />
      <path d="M16 40 L104 40 L114 62 L6 62 Z" fill="#5a3418" />
      <path d="M20 42 L100 42 L108 60 L12 60 Z" fill="#2f7a46" />
      {[
        [40, 52, '#f4efe2'],
        [66, 48, '#c8102e'],
        [74, 54, '#e1ad01'],
        [80, 49, '#1f4fa3'],
        [70, 51, '#141414'],
      ].map(([x, y, c]) => (
        <circle key={`${x}${y}`} cx={x as number} cy={y as number} r="2.6" fill={c as string} />
      ))}
      <path d="M10 66 L42 52" stroke="#d9b98a" strokeWidth="1.8" strokeLinecap="round" />
      {[18, 102].map((x) => (
        <path key={x} d={`M${x} 62 V76`} stroke="#5a3418" strokeWidth="4" />
      ))}
    </>
  );
}

function Library() {
  const colours = ['#6b1d1d', '#1d3d6b', '#2f5a2f', '#8a6a2a', '#4a2c5c', '#7a4a2a'];
  return (
    <>
      <rect width="120" height="80" fill="#2a1a10" />
      {[8, 30, 52].map((y, row) => (
        <g key={y}>
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={i} x={2 + i * 4.9} y={y + ((i * 7 + row) % 3)} width="4.2" height={18 - ((i * 7 + row) % 3)} fill={colours[(i * 5 + row) % 6]} />
          ))}
          <rect x="0" y={y + 18} width="120" height="3" fill="#5a3418" />
        </g>
      ))}
      <path d="M86 4 L98 78 M100 4 L112 78" stroke="#c9a24a" strokeWidth="1.6" />
      {[12, 26, 40, 54, 68].map((y) => (
        <path key={y} d={`M${86 + (y - 4) * 0.162} ${y} H${100 + (y - 4) * 0.162}`} stroke="#c9a24a" strokeWidth="1.4" />
      ))}
    </>
  );
}

function Lounge() {
  return (
    <>
      <rect width="120" height="80" fill="#5a1818" />
      <path d="M0 0 H120 V56 H0 Z" fill="#6e2121" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M${i * 13} 0 V56`} stroke="#d9a45a" strokeOpacity="0.2" strokeWidth="3" />
      ))}
      <rect x="0" y="56" width="120" height="24" fill="#3a1212" />
      <rect x="70" y="20" width="40" height="36" fill="#e7e1d4" />
      <rect x="66" y="16" width="48" height="5" fill="#e7e1d4" />
      <rect x="78" y="30" width="24" height="26" fill="#1a0d08" />
      <path d="M82 56 Q86 40 90 50 Q92 36 96 48 Q100 42 98 56 Z" fill="#ff8a1f" />
      <path d="M86 56 Q89 46 92 52 Q95 45 95 56 Z" fill="#ffd27a" />
      <path d="M10 62 V38 Q10 30 18 30 H38 Q46 30 46 38 V62 Z" fill="#7d1d2a" />
      <rect x="6" y="46" width="44" height="16" rx="4" fill="#9b2535" />
      <rect x="6" y="40" width="8" height="22" rx="3" fill="#8a2030" />
      <rect x="42" y="40" width="8" height="22" rx="3" fill="#8a2030" />
      <path d="M10 62 V70 M46 62 V70" stroke="#3a2212" strokeWidth="3" />
    </>
  );
}

function Hall() {
  return (
    <>
      <rect width="120" height="80" fill="#3a2a14" />
      {Array.from({ length: 12 }, (_, i) =>
        Array.from({ length: 2 }, (_, j) => (
          <rect key={`${i}${j}`} x={i * 10} y={62 + j * 9} width="10" height="9" fill={(i + j) % 2 ? '#8c8576' : '#d9d0bd'} />
        ))
      )}
      <rect x="40" y="10" width="40" height="52" fill="#5a3418" />
      <path d="M40 10 Q60 -4 80 10" fill="#5a3418" />
      <rect x="44" y="14" width="15" height="48" fill="#6b4226" />
      <rect x="61" y="14" width="15" height="48" fill="#6b4226" />
      <circle cx="57" cy="40" r="1.6" fill="#c9a24a" />
      <circle cx="63" cy="40" r="1.6" fill="#c9a24a" />
      <rect x="14" y="16" width="12" height="46" fill="#3a2212" />
      <circle cx="20" cy="24" r="4.5" fill="#f1ead8" stroke="#c9a24a" strokeWidth="1" />
      <path d="M20 24 V21.5 M20 24 H22" stroke="#222" strokeWidth="0.8" />
      <path d="M20 34 V48" stroke="#c9a24a" strokeWidth="0.8" />
      <circle cx="20" cy="48" r="2" fill="#c9a24a" />
      <rect x="88" y="16" width="22" height="16" fill="#8a6a2a" />
      <rect x="90" y="18" width="18" height="12" fill="#4a3a5a" />
    </>
  );
}

function Study() {
  return (
    <>
      <rect width="120" height="80" fill="#1f2833" />
      <path d="M0 0 H120 V54 H0 Z" fill="#2e3a4a" />
      <rect x="0" y="54" width="120" height="26" fill="#3f2c1c" />
      <rect x="10" y="10" width="26" height="20" fill="#c9a24a" />
      <rect x="12" y="12" width="22" height="16" fill="#3a5a3a" />
      <path d="M30 40 H96 V62 H30 Z" fill="#3a2212" />
      <path d="M28 38 H98 V42 H28 Z" fill="#5a3418" />
      <path d="M34 62 V74 M92 62 V74" stroke="#3a2212" strokeWidth="4" />
      <path d="M44 38 V24 M38 24 L50 24 L46 18 H42 Z" stroke="#c9a24a" strokeWidth="1.4" fill="#2f6b3a" />
      <ellipse cx="44" cy="30" rx="10" ry="3" fill="#ffe28a" opacity="0.25" />
      <path d="M72 38 Q70 30 76 30 H84 Q90 30 88 38 Z" fill="#141414" />
      <path d="M74 30 Q80 24 86 30" stroke="#141414" strokeWidth="2" fill="none" />
      <rect x="100" y="44" width="16" height="18" fill="#2b2b2e" />
      <circle cx="108" cy="53" r="3.5" fill="#c9a24a" />
    </>
  );
}

const DRAW: Record<Room, () => React.ReactElement> = {
  Kitchen,
  Ballroom,
  Conservatory,
  'Dining Room': DiningRoom,
  'Billiard Room': BilliardRoom,
  Library,
  Lounge,
  Hall,
  Study,
};

export function RoomArt({ room, className = '' }: { room: Room; className?: string }) {
  const id = useId().replace(/:/g, '');
  const Draw = DRAW[room];
  return (
    <svg viewBox="0 0 120 80" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-label={room}>
      <defs>
        <radialGradient id={`v${id}`} cx="50%" cy="45%" r="70%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <Draw />
      <rect width="120" height="80" fill={`url(#v${id})`} />
    </svg>
  );
}
