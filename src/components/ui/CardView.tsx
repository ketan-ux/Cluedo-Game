import React from 'react';
import { CardName, cardKind, Room, Suspect, SUSPECT_COLORS, Weapon } from '../../game/constants';
import { cardSubtitle, ROOM_LORE } from '../../game/lore';
import { WeaponIcon } from '../icons';

interface CardViewProps {
  card: CardName;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZES = {
  xs: 'w-16 h-24 text-[9px]',
  sm: 'w-20 h-28 sm:w-24 sm:h-36 text-[10px]',
  md: 'w-28 h-40 sm:w-32 sm:h-48 text-xs',
  lg: 'w-40 h-60 sm:w-48 sm:h-72 text-sm',
};

const KIND_STYLE = {
  suspect: { label: 'Suspect', band: '#9b111e' },
  weapon: { label: 'Weapon', band: '#3f3f46' },
  room: { label: 'Room', band: '#2e4a36' },
};

export function CardArt({ card, className = '' }: { card: CardName; className?: string }) {
  const kind = cardKind(card);
  if (kind === 'suspect') {
    return (
      <div
        className={`aspect-square rounded-full border-2 border-[#d4af37] flex items-center justify-center font-deco font-black text-white shadow-inner ${className}`}
        style={{ backgroundColor: SUSPECT_COLORS[card as Suspect], color: card === 'Mrs. White' ? '#2a180c' : undefined }}
      >
        {(card as string).split(' ').pop()!.charAt(0)}
      </div>
    );
  }
  if (kind === 'weapon') {
    return (
      <div className={`aspect-square rounded-lg border-2 border-[#d4af37] bg-[#251610] text-[#f4e4bc] flex items-center justify-center ${className}`}>
        <WeaponIcon weapon={card as Weapon} className="w-3/5 h-3/5" />
      </div>
    );
  }
  return (
    <div
      className={`aspect-square rounded-md border-2 border-[#d4af37] flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${ROOM_LORE[card as Room].floor}, ${ROOM_LORE[card as Room].color})` }}
    >
      <span className="font-deco font-black text-white/90 text-[1.4em] drop-shadow">{(card as string).charAt(0)}</span>
    </div>
  );
}

export function CardView({ card, size = 'md', selected = false, onClick, className = '' }: CardViewProps) {
  const kind = KIND_STYLE[cardKind(card)];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative ${SIZES[size]} shrink-0 rounded-lg bg-[#f4e4bc] text-[#2d1b10] border-2 border-[#d4af37] shadow-xl p-1.5 flex flex-col select-none transition-transform duration-200 disabled:cursor-default ${
        onClick ? 'cursor-pointer hover:-translate-y-1 active:scale-95' : ''
      } ${selected ? 'ring-4 ring-[#d4af37] -translate-y-1.5 shadow-[0_0_24px_rgba(212,175,55,0.7)]' : ''} ${className}`}
      aria-pressed={onClick ? selected : undefined}
    >
      <div className="flex-1 border border-[#d4af37]/40 rounded-md flex flex-col items-center justify-between p-1 overflow-hidden">
        <span className="font-bold tracking-[0.15em] uppercase opacity-70 text-[0.8em]">{kind.label}</span>
        <CardArt card={card} className="w-3/5" />
        <div className="text-center w-full">
          <div className="font-deco font-bold uppercase leading-tight text-[0.92em] [overflow-wrap:anywhere]">{card}</div>
          <div className="font-serif-vintage italic opacity-75 leading-tight truncate text-[0.85em]">{cardSubtitle(card)}</div>
        </div>
      </div>
      <div className="h-1.5 mt-1 rounded-full" style={{ backgroundColor: kind.band }} />
    </button>
  );
}
