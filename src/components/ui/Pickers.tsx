import React from 'react';
import { CardName, isSuspect, isWeapon, SUSPECT_COLORS } from '../../game/constants';
import { WeaponIcon } from '../icons';

interface PickerProps<T extends CardName> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  hand: CardName[];
  tone?: 'gold' | 'red';
}

function Swatch({ card }: { card: CardName }) {
  if (isSuspect(card)) {
    return <span className="w-5 h-5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: SUSPECT_COLORS[card] }} />;
  }
  if (isWeapon(card)) return <WeaponIcon weapon={card} size={18} className="shrink-0 text-[#d4af37]" />;
  return <span className="w-5 h-5 shrink-0 rounded-sm bg-[#d4af37]/30 border border-[#d4af37]/50" />;
}

/** A grid of tappable choices; cards in your own hand are flagged. */
export function CardPicker<T extends CardName>({ label, options, value, onChange, hand, tone = 'gold' }: PickerProps<T>) {
  const ring = tone === 'red' ? 'border-red-500 ring-2 ring-red-500/60 bg-[#9b111e]/25' : 'border-[#d4af37] ring-2 ring-[#d4af37]/60 bg-[#1a0f0d]';
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-deco uppercase tracking-wider text-[#d4af37] font-bold mb-1.5">{label}</legend>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`min-h-11 p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
              value === o ? ring : 'bg-[#1a0f0d]/60 border-[#d4af37]/20 hover:border-[#d4af37]/50'
            }`}
          >
            <Swatch card={o} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold truncate">{o}</span>
              {hand.includes(o) && <span className="block text-[9px] font-mono text-amber-400 font-bold leading-tight">In your hand</span>}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
