import React, { useId } from 'react';
import { Suspect, SUSPECT_COLORS } from '../../game/constants';

// Original portraits in a 1920s poster style. Each is a bust on a 100 x 120 canvas.

const SKIN = {
  scarlet: '#f2cdb1',
  mustard: '#e7b893',
  white: '#efd2ba',
  green: '#d9a37c',
  peacock: '#f0cfb6',
  plum: '#e9c09f',
};

function Face({ skin, lips = '#b5524a', brows = '#3a2618' }: { skin: string; lips?: string; brows?: string }) {
  return (
    <>
      <path d="M43 70 L57 70 L58.5 90 L41.5 90 Z" fill={skin} />
      <path d="M43 76 Q50 81 57 76 L57 72 L43 72 Z" fill="#000" opacity="0.12" />
      <ellipse cx="33.8" cy="55" rx="3" ry="5" fill={skin} />
      <ellipse cx="66.2" cy="55" rx="3" ry="5" fill={skin} />
      <ellipse cx="50" cy="52" rx="16" ry="20.5" fill={skin} />
      <path d="M41 46.5 Q44 44.8 47 46.3" stroke={brows} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M53 46.3 Q56 44.8 59 46.5" stroke={brows} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="44" cy="51.5" rx="1.9" ry="1.3" fill="#20140c" />
      <ellipse cx="56" cy="51.5" rx="1.9" ry="1.3" fill="#20140c" />
      <path d="M50.3 53.5 Q48.4 59.5 50.8 60.6" stroke="#000" strokeOpacity="0.28" strokeWidth="1" fill="none" />
      <path d="M45.2 65 Q50 67.6 54.8 65" stroke={lips} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <ellipse cx="41.5" cy="59" rx="3.2" ry="2" fill="#d9776a" opacity="0.18" />
      <ellipse cx="58.5" cy="59" rx="3.2" ry="2" fill="#d9776a" opacity="0.18" />
    </>
  );
}

const SHOULDERS = 'M4 120 C6 98 25 87 50 87 C75 87 94 98 96 120 Z';

function Scarlet() {
  return (
    <>
      <path d={SHOULDERS} fill="#b10f26" />
      <path d="M38 87 L50 106 L62 87 Z" fill={SKIN.scarlet} />
      <path d="M22 96 Q30 104 38 90 M78 96 Q70 104 62 90" stroke="#7d0a1a" strokeWidth="1.2" fill="none" />
      <Face skin={SKIN.scarlet} lips="#c4122c" brows="#160d0d" />
      <path
        d="M33 55 C30 34 41 27.5 52 28.5 C64 29.5 71 39 67.5 56 C66.8 62 65 66 62 69 L61 57 C60 46 55 41.5 47 42.5 C41 45 39.5 53 38.5 69 C35 65 33.4 60 33 55 Z"
        fill="#141010"
      />
      <path d="M38 43 Q44 37 50 41 Q55 36 62 41" stroke="#3a3030" strokeWidth="1" fill="none" />
      <circle cx="33.5" cy="62" r="1.6" fill="#d4af37" />
      <circle cx="66.5" cy="62" r="1.6" fill="#d4af37" />
      <path d="M55 65.6 L85 80" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M83 79 L86.5 80.7" stroke="#f4efe2" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M87 78 Q84 73 88 69 Q92 65 89 60" stroke="#ddd" strokeOpacity="0.55" strokeWidth="1.1" fill="none" />
    </>
  );
}

function Mustard() {
  return (
    <>
      <path d={SHOULDERS} fill="#c08f1a" />
      <path d="M40 87 L50 97 L60 87 L58 86 L50 92 L42 86 Z" fill="#5a3a12" />
      <rect x="10" y="96" width="18" height="5" rx="2" fill="#d4af37" transform="rotate(-18 19 98)" />
      <rect x="72" y="96" width="18" height="5" rx="2" fill="#d4af37" transform="rotate(18 81 98)" />
      {[
        ['#9b111e', 30],
        ['#1f4fa3', 36],
        ['#1f7a3a', 42],
      ].map(([c, x]) => (
        <g key={x as number}>
          <rect x={x as number} y="103" width="4" height="5" fill={c as string} />
          <circle cx={(x as number) + 2} cy="111" r="2" fill="#d4af37" />
        </g>
      ))}
      <path d="M50 97 L50 120" stroke="#8a6510" strokeWidth="1" />
      <circle cx="50" cy="104" r="1.2" fill="#d4af37" />
      <circle cx="50" cy="112" r="1.2" fill="#d4af37" />
      <Face skin={SKIN.mustard} lips="#9b5a46" brows="#8c7a56" />
      <path d="M34 50 C33 35 42 29 51 30 C61 30.5 68 37 66.5 50 C64 42 58 38.5 51 38.5 C45 39 38 41 34 50 Z" fill="#b8a77d" />
      <path d="M40 37 Q50 33 60 37" stroke="#8c7a56" strokeWidth="1" fill="none" />
      <path d="M38.5 62 C42 57.5 47 58.5 50 61 C53 58.5 58 57.5 61.5 62 C58 61 54 63 50 63.5 C46 63 42 61 38.5 62 Z" fill="#d1bb84" stroke="#8c7a56" strokeWidth="0.6" />
      <circle cx="56" cy="51.5" r="4.2" fill="none" stroke="#d4af37" strokeWidth="1" />
      <path d="M60 53 Q64 64 61 78" stroke="#d4af37" strokeWidth="0.6" fill="none" />
    </>
  );
}

function White() {
  return (
    <>
      <path d={SHOULDERS} fill="#262326" />
      <path d="M36 87 L50 99 L64 87 L60 86 L50 94 L40 86 Z" fill="#f6f3ea" />
      <path d="M38 99 L62 99 L60 120 L40 120 Z" fill="#f6f3ea" />
      <path d="M38 99 L62 99" stroke="#cfc8b8" strokeWidth="1" />
      <Face skin={SKIN.white} lips="#a8615a" brows="#8d8579" />
      <path d="M41 59 Q42 62 41 64 M59 59 Q58 62 59 64" stroke="#000" strokeOpacity="0.15" strokeWidth="0.8" fill="none" />
      <path d="M34 54 C32 38 41 31 50 31 C60 31 68 38 66 54 C64 45 59 41 50 41 C42 41 36 45 34 54 Z" fill="#b8b1a5" />
      <ellipse cx="50" cy="28" rx="9" ry="6" fill="#a9a296" />
      <path d="M33 39 Q36 30 42 31 Q45 26 50 29 Q55 26 58 31 Q64 30 67 39 Q60 34 50 35 Q40 34 33 39 Z" fill="#fbfaf5" stroke="#d6d0c2" strokeWidth="0.6" />
      {[36, 41, 46, 51, 56, 61, 65].map((x) => (
        <circle key={x} cx={x} cy={36 - Math.sin(((x - 33) / 34) * Math.PI) * 5} r="1.6" fill="#fbfaf5" stroke="#d6d0c2" strokeWidth="0.4" />
      ))}
    </>
  );
}

function Green() {
  return (
    <>
      <path d={SHOULDERS} fill="#1d6b35" />
      <path d="M40 87 L50 108 L60 87 Z" fill="#f2efe6" />
      <path d="M36 87 L50 110 L42 120 L28 98 Z M64 87 L50 110 L58 120 L72 98 Z" fill="#185a2c" />
      <path d="M48.5 92 L51.5 92 L53 104 L50 110 L47 104 Z" fill="#0d3a1c" />
      <Face skin={SKIN.green} lips="#8f4f3c" brows="#2a1a10" />
      <path d="M45 65.5 Q50 67 55.5 64" stroke="#8f4f3c" strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <path d="M34 52 L34 60 Q35 63 36 60 L36 50 Z M66 52 L66 60 Q65 63 64 60 L64 50 Z" fill="#2a1a10" />
      <ellipse cx="50" cy="38.5" rx="26" ry="5.5" fill="#2c3a30" />
      <path d="M35 38 C35 25 40 19.5 50 19.5 C60 19.5 65 25 65 38 Z" fill="#33433a" />
      <path d="M44 21 Q50 25 56 21" stroke="#22302a" strokeWidth="1.2" fill="none" />
      <rect x="35" y="32" width="30" height="5" fill="#1f7a3a" />
    </>
  );
}

function Peacock() {
  return (
    <>
      <path d={SHOULDERS} fill="#1c4791" />
      <path d="M28 91 Q50 100 72 91 L74 96 Q50 106 26 96 Z" fill={SKIN.peacock} />
      {Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        return <circle key={i} cx={36 + t * 28} cy={86 + Math.sin(t * Math.PI) * 6} r="1.9" fill="#f7f3ea" stroke="#cfc6b4" strokeWidth="0.4" />;
      })}
      <Face skin={SKIN.peacock} lips="#b23a48" brows="#3a2418" />
      <path
        d="M33.5 55 C30 38 38 30 50 30 C62 30 70 38 66.5 55 C65 46 60 41 50 41 C40 41 35 46 33.5 55 Z"
        fill="#3b2316"
      />
      <ellipse cx="50" cy="27" rx="14" ry="9" fill="#3b2316" />
      <ellipse cx="50" cy="20" rx="8" ry="6" fill="#4a2c1c" />
      <path d="M58 24 Q66 12 70 2" stroke="#5c7a3a" strokeWidth="1.2" fill="none" />
      <ellipse cx="69" cy="6" rx="5.5" ry="7.5" fill="#2f7d5b" transform="rotate(20 69 6)" />
      <ellipse cx="69.3" cy="6.3" rx="3.4" ry="4.6" fill="#d4af37" transform="rotate(20 69 6)" />
      <ellipse cx="69.5" cy="6.6" rx="2" ry="2.8" fill="#1a3f8a" transform="rotate(20 69 6)" />
      <circle cx="33.8" cy="62" r="1.8" fill="#f7f3ea" />
      <circle cx="66.2" cy="62" r="1.8" fill="#f7f3ea" />
    </>
  );
}

function Plum() {
  return (
    <>
      <path d={SHOULDERS} fill="#5d2673" />
      <path d="M41 87 L50 100 L59 87 Z" fill="#f2efe6" />
      <path d="M43 90 L50 94 L57 90 L57 96 L50 92.5 L43 96 Z" fill="#d4af37" />
      <circle cx="50" cy="93" r="1.6" fill="#b08d2a" />
      <path d="M36 87 L50 100 L40 120 L26 100 Z M64 87 L50 100 L60 120 L74 100 Z" fill="#4c1f5e" />
      <Face skin={SKIN.plum} lips="#9a5246" brows="#5a4636" />
      <path d="M34 54 C33 46 34 41 37 38 C36 44 37 49 38 54 Z M66 54 C67 46 66 41 63 38 C64 44 63 49 62 54 Z" fill="#7a6656" />
      <path d="M38 38 Q50 30 62 38" stroke="#000" strokeOpacity="0.08" strokeWidth="3" fill="none" />
      <circle cx="44" cy="51.5" r="4.6" fill="#fff" fillOpacity="0.12" stroke="#2a1a10" strokeWidth="1.2" />
      <circle cx="56" cy="51.5" r="4.6" fill="#fff" fillOpacity="0.12" stroke="#2a1a10" strokeWidth="1.2" />
      <path d="M48.6 51 Q50 50 51.4 51" stroke="#2a1a10" strokeWidth="1.1" fill="none" />
      <path d="M46.5 69 Q50 73 53.5 69 Q50 70.5 46.5 69 Z" fill="#6a5646" />
    </>
  );
}

const DRAW: Record<Suspect, () => React.ReactElement> = {
  'Miss Scarlet': Scarlet,
  'Colonel Mustard': Mustard,
  'Mrs. White': White,
  'Mr. Green': Green,
  'Mrs. Peacock': Peacock,
  'Professor Plum': Plum,
};

/** A suspect's portrait. Fills its box; crop it with a rounded or oval container. */
export function Portrait({ suspect, className = '' }: { suspect: Suspect; className?: string }) {
  const id = useId().replace(/:/g, '');
  const Draw = DRAW[suspect];
  return (
    <svg viewBox="0 0 100 120" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-label={suspect}>
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={SUSPECT_COLORS[suspect]} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#120a06" />
        </radialGradient>
      </defs>
      <rect width="100" height="120" fill={`url(#bg${id})`} />
      <g opacity="0.25">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M50 40 L${-10 + i * 11} -5`} stroke="#d4af37" strokeWidth="0.5" />
        ))}
      </g>
      <Draw />
    </svg>
  );
}

/** Round head-and-shoulders token in the suspect's colour. */
export function Avatar({
  suspect,
  size = 40,
  ring,
  dim = false,
  className = '',
}: {
  suspect: Suspect;
  size?: number;
  ring?: 'turn' | 'wait' | 'none';
  dim?: boolean;
  className?: string;
}) {
  const ringClass =
    ring === 'turn'
      ? 'ring-[3px] ring-[var(--gold-light)] shadow-[0_0_14px_rgba(255,213,74,0.7)]'
      : ring === 'wait'
        ? 'ring-[3px] ring-amber-500/80 animate-pulse'
        : 'ring-2 ring-black/40';
  return (
    <span
      className={`relative inline-block shrink-0 rounded-full overflow-hidden border-2 ${ringClass} ${dim ? 'grayscale opacity-60' : ''} ${className}`}
      style={{ width: size, height: size, borderColor: SUSPECT_COLORS[suspect] }}
    >
      {/* Crop to the face: a 56-unit window of the 100 x 120 portrait. */}
      <Portrait suspect={suspect} className="absolute left-[-39.3%] top-[-39.3%] w-[178.6%] h-[214.3%] max-w-none" />
    </span>
  );
}
