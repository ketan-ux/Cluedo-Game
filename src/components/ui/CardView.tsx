import React, { useEffect, useState } from 'react';
import { CardName, cardKind, Room, Suspect, Weapon } from '../../game/constants';
import { cardSubtitle } from '../../game/lore';
import { Portrait } from '../art/Portraits';
import { RoomArt } from '../art/RoomArt';
import { WeaponArt } from '../art/WeaponArt';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  xs: 'w-[4.2rem] h-[6.3rem] text-[8px]',
  sm: 'w-[5.6rem] h-[8.4rem] text-[9.5px]',
  md: 'w-[7.4rem] h-[11.1rem] text-[11px]',
  lg: 'w-[10.5rem] h-[15.75rem] text-[14px]',
};

const KIND = {
  suspect: { label: 'Suspect', band: 'bg-[var(--crimson)]' },
  weapon: { label: 'Weapon', band: 'bg-[#3d4048]' },
  room: { label: 'Room', band: 'bg-[#2e5a3c]' },
};

/** The picture on a card, filling its box. */
export function CardArt({ card, className = '' }: { card: CardName; className?: string }) {
  const kind = cardKind(card);
  if (kind === 'suspect') return <Portrait suspect={card as Suspect} className={className} />;
  if (kind === 'room') return <RoomArt room={card as Room} className={className} />;
  return (
    <div className={`bg-[radial-gradient(circle_at_50%_40%,#3a2a1c,#120a06)] flex items-center justify-center ${className}`}>
      <WeaponArt weapon={card as Weapon} className="w-[85%] h-[85%]" />
    </div>
  );
}

interface CardViewProps {
  card: CardName;
  size?: Size;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  /** Faded, e.g. a card you know is not the answer. */
  muted?: boolean;
}

/** A playing card in the classic layout: category band, framed picture, name plate. */
export function CardView({ card, size = 'md', selected = false, onClick, className = '', muted = false }: CardViewProps) {
  const kind = KIND[cardKind(card)];
  const long = card.length > 10 && !card.includes(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={onClick ? selected : undefined}
      aria-label={card}
      className={`card-face relative ${SIZES[size]} shrink-0 rounded-[0.7em] p-[0.45em] flex flex-col select-none transition-transform duration-200 disabled:cursor-default ${
        onClick ? 'cursor-pointer hover:-translate-y-1 active:scale-95' : ''
      } ${selected ? 'ring-4 ring-[var(--gold-light)] -translate-y-1.5 shadow-[0_0_26px_rgba(255,213,74,0.65)]' : ''} ${
        muted ? 'opacity-45 grayscale-[60%]' : ''
      } ${className}`}
    >
      <div className={`${kind.band} rounded-t-[0.45em] text-center text-[#f6ecd2] font-deco font-bold uppercase tracking-[0.22em] text-[0.78em] py-[0.15em]`}>
        {kind.label}
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-b-[0.2em] rounded-t-[2.6em] mt-[0.3em] mx-[0.15em] border-[0.18em] border-[var(--gold)] shadow-inner">
        <CardArt card={card} className="absolute inset-0 w-full h-full" />
      </div>
      <div className="text-center pt-[0.35em] pb-[0.1em] leading-tight">
        <div className={`font-deco font-black uppercase text-[#2a1408] ${long ? 'text-[0.82em]' : 'text-[0.98em]'}`}>{card}</div>
        <div className="font-serif-vintage italic text-[#5c3e29] truncate text-[0.9em]">{cardSubtitle(card)}</div>
      </div>
    </button>
  );
}

export function CardBack({ size = 'md', className = '' }: { size?: Size; className?: string }) {
  return (
    <div className={`card-back relative ${SIZES[size]} shrink-0 rounded-[0.7em] p-[0.45em] ${className}`} aria-hidden="true">
      <div className="w-full h-full rounded-[0.45em] border-[0.15em] border-[var(--gold)]/70 flex items-center justify-center">
        <div className="w-[62%] aspect-[3/4] rounded-[50%] bg-[radial-gradient(circle_at_50%_35%,#8a1622,#3d0910)] border-[0.2em] border-[var(--gold)] shadow-[0_0_0_0.2em_rgba(0,0,0,0.35),0_0.3em_0.8em_rgba(0,0,0,0.6)] flex flex-col items-center justify-center">
          <span className="font-deco font-black text-gold-gradient text-[3em] leading-none">?</span>
          <span className="font-deco font-bold text-[var(--gold-light)] tracking-[0.2em] text-[0.72em] mt-[0.2em]">CLUEDO</span>
        </div>
      </div>
    </div>
  );
}

/** A card that arrives face down and turns over. */
export function FlipCard({ card, size = 'md', delay = 300 }: { card: CardName; size?: Size; delay?: number }) {
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
