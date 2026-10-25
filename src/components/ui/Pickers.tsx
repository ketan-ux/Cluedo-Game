import React from 'react';
import { Check } from 'lucide-react';
import { CardName, cardKind } from '../../game/constants';
import { CardArt } from './CardView';

interface PickerProps<T extends CardName> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  hand: CardName[];
  tone?: 'gold' | 'red';
}

const SHAPE = { suspect: 'aspect-[5/6]', weapon: 'aspect-square', room: 'aspect-[3/2]' };
const COLUMNS = { suspect: 'grid-cols-3 sm:grid-cols-6', weapon: 'grid-cols-3 sm:grid-cols-6', room: 'grid-cols-3' };

/** A grid of pictures to pick from; cards in your own hand are flagged. */
export function CardPicker<T extends CardName>({ label, options, value, onChange, hand, tone = 'gold' }: PickerProps<T>) {
  const kind = cardKind(options[0]);
  const ring =
    tone === 'red'
      ? 'border-[var(--crimson-light)] shadow-[0_0_0_2px_rgba(200,16,46,0.6),0_0_18px_rgba(200,16,46,0.5)]'
      : 'border-[var(--gold-light)] shadow-[0_0_0_2px_rgba(243,215,122,0.5),0_0_18px_rgba(243,215,122,0.45)]';
  return (
    <fieldset className="space-y-2">
      <legend className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] font-deco uppercase tracking-[0.22em] text-[var(--gold)] font-bold">{label}</span>
        <span className="font-deco font-bold text-[var(--parchment)] text-sm">{value}</span>
      </legend>
      <div className={`grid ${COLUMNS[kind]} gap-1.5 sm:gap-2`}>
        {options.map((o) => {
          const on = value === o;
          const mine = hand.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={on}
              aria-label={mine ? `${o} (in your hand)` : o}
              className={`relative ${SHAPE[kind]} overflow-hidden rounded-xl border-2 transition-all active:scale-95 ${
                on ? ring : 'border-[var(--gold)]/25 hover:border-[var(--gold)]/60'
              }`}
            >
              <CardArt card={o} className={`absolute inset-0 w-full h-full ${mine && !on ? 'opacity-55' : ''}`} />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pt-4 pb-1 text-center font-deco font-bold text-[10.5px] sm:text-[11px] leading-tight text-[var(--parchment)]">
                {o}
              </span>
              {mine && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-400 text-[#1f120a] text-[9px] font-mono font-bold leading-none shadow">
                  YOURS
                </span>
              )}
              {on && (
                <span
                  className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow ${
                    tone === 'red' ? 'bg-[var(--crimson-light)] text-white' : 'bg-[var(--gold-light)] text-[#1f120a]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
