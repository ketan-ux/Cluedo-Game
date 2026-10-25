import React, { useId } from 'react';

/** The title: deco lettering with a magnifying glass. Original artwork, not the trademark logo. */
export function Logo({ className = '', tagline = true }: { className?: string; tagline?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox={tagline ? '0 0 360 120' : '0 4 360 92'} className={className} role="img" aria-label="Cluedo">
      <defs>
        <linearGradient id={`red${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0243a" />
          <stop offset="1" stopColor="#8a0c1a" />
        </linearGradient>
        <linearGradient id={`gold${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2b2" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6a1f" />
        </linearGradient>
        <filter id={`shadow${id}`} x="-10%" y="-10%" width="120%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>
      <g stroke={`url(#gold${id})`} strokeWidth="1.5" fill="none" opacity="0.9">
        <path d="M20 22 H140 M220 22 H340" />
        <path d="M20 26 H120 M240 26 H340" strokeWidth="0.8" />
        <path d="M180 8 L190 18 L180 28 L170 18 Z" fill={`url(#gold${id})`} />
      </g>
      <text
        x="180"
        y="84"
        textAnchor="middle"
        fontFamily="Cinzel, Georgia, serif"
        fontWeight="900"
        fontSize="64"
        letterSpacing="6"
        fill={`url(#red${id})`}
        stroke={`url(#gold${id})`}
        strokeWidth="2.2"
        paintOrder="stroke"
        filter={`url(#shadow${id})`}
      >
        CLUEDO
      </text>
      <g transform="translate(318 46) rotate(35)" filter={`url(#shadow${id})`}>
        <circle r="13" fill="#fff" fillOpacity="0.12" stroke={`url(#gold${id})`} strokeWidth="4" />
        <rect x="-3" y="14" width="6" height="22" rx="2.5" fill="#3a2212" stroke={`url(#gold${id})`} strokeWidth="1" />
      </g>
      {tagline && (
        <text x="180" y="110" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="11" letterSpacing="5" fill="#d4af37">
          THE GREAT DETECTIVE GAME
        </text>
      )}
    </svg>
  );
}
