import React, { useEffect, useState } from 'react';
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
          {/* Long single words (Candlestick, Conservatory) shrink rather than break mid-word. */}
          <div className={`font-deco font-bold uppercase leading-tight break-words ${card.length > 10 && !card.includes(' ') ? 'text-[0.74em]' : 'text-[0.92em]'}`}>
            {card}
          </div>
          <div className="font-serif-vintage italic opacity-75 leading-tight truncate text-[0.85em]">{cardSubtitle(card)}</div>
        </div>
      </div>
      <div className="h-1.5 mt-1 rounded-full" style={{ backgroundColor: kind.band }} />
    </button>
  );
}

export function CardBack({ size = 'md', className = '' }: { size?: CardViewProps['size']; className?: string }) {
  return (
    <div
      className={`relative ${SIZES[size]} shrink-0 rounded-lg border-2 border-[#d4af37] shadow-xl p-1.5 bg-[#5c1018] ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(212,175,55,0.18) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(212,175,55,0.18) 0 2px, transparent 2px 10px)',
      }}
      aria-hidden="true"
    >
      <div className="w-full h-full rounded-md border border-[#d4af37]/60 flex items-center justify-center">
        <span className="font-deco font-black text-[#d4af37] text-[2.2em] drop-shadow">?</span>
      </div>
    </div>
  );
}

/** A card that arrives face down and turns over. */
export function FlipCard({ card, size = 'md', delay = 300 }: { card: CardName; size?: CardViewProps['size']; delay?: number }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUp(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    // Purely decorative, so it must never catch a tap meant for the buttons around it.
    <div className="[perspective:1200px] pointer-events-none">
      <div
        className="relative transition-transform duration-700 ease-out [transform-style:preserve-3d]"
        style={{ transform: up ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div className="[backface-visibility:hidden]">
          <CardBack size={size} />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <CardView card={card} size={size} />
        </div>
      </div>
    </div>
  );
}
