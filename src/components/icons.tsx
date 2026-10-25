import React from 'react';
import { Weapon } from '../game/constants';

// Simple line drawings on a 24 x 24 grid, so they work in HTML and nested inside the board SVG.
const WEAPON_PATHS: Record<Weapon, React.ReactNode> = {
  Candlestick: (
    <>
      <path d="M12 2c1.4 1.6 1.4 3 0 4-1.4-1-1.4-2.4 0-4z" fill="currentColor" stroke="none" />
      <rect x="10.5" y="6.5" width="3" height="8" rx="0.6" />
      <path d="M8 14.5h8M12 14.5v4M7.5 21.5h9l-1.5-3h-6z" />
    </>
  ),
  Dagger: (
    <>
      <path d="M12 2l2 3v9h-4V5z" />
      <path d="M7 14h10M12 14v5" />
      <circle cx="12" cy="20.5" r="1.5" />
    </>
  ),
  'Lead Pipe': (
    <>
      <path d="M5 21V9a4 4 0 0 1 4-4h10" strokeWidth="3.2" />
      <path d="M3.5 21h3M19 3.5v3" />
    </>
  ),
  Revolver: (
    <>
      <path d="M3 8h14l1-2h3v4H11l-1 2H8l-1.5 7.5H3.5L5 12H3z" />
      <circle cx="12" cy="10.5" r="1.6" />
    </>
  ),
  Rope: (
    <>
      <circle cx="12" cy="11" r="7" />
      <circle cx="12" cy="11" r="4" />
      <path d="M16 17c1 2 3 3.5 5 4" />
    </>
  ),
  Wrench: (
    <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8a2.1 2.1 0 0 1-3-3l8-8-1.3-1.3a4 4 0 0 0-5-5L14 6l-1 2 2 2 2-1 1.3-1.3" />
  ),
};

export function WeaponIcon({ weapon, className, size = 24 }: { weapon: Weapon; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {WEAPON_PATHS[weapon]}
    </svg>
  );
}

/** For use inside another SVG, positioned in that SVG's units. */
export function WeaponGlyph({ weapon, x, y, size }: { weapon: Weapon; x: number; y: number; size: number }) {
  return (
    <svg
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {WEAPON_PATHS[weapon]}
    </svg>
  );
}
