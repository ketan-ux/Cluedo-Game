import React from 'react';
import { Card, CardType, SUSPECT_COLORS, Suspect, Weapon, Room } from '../../types/cluedo';
import { CHARACTER_DETAILS, WEAPON_DETAILS } from '../../engine/assets';
import { ROOM_DEFINITIONS } from '../../engine/boardGrid';
import { Shield, Sparkles, Flame, Eye } from 'lucide-react';

interface CardViewProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isRevealed?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  size = 'md',
  isRevealed = true,
  isSelectable = false,
  isSelected = false,
  onClick,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-24 h-36 text-xs',
    md: 'w-36 h-52 text-sm',
    lg: 'w-48 h-72 text-base',
    xl: 'w-64 h-96 text-lg',
  };

  const getCategoryColor = () => {
    if (card.type === 'SUSPECT') return '#9b111e';
    if (card.type === 'WEAPON') return '#4a4a4a';
    return '#5a5a40';
  };

  const getTypeBadge = () => {
    if (card.type === 'SUSPECT') return { label: 'SUSPECT', bg: 'bg-[#9b111e]/15 text-[#9b111e] border-[#9b111e]/40' };
    if (card.type === 'WEAPON') return { label: 'WEAPON', bg: 'bg-[#5c3e29]/15 text-[#5c3e29] border-[#5c3e29]/40' };
    return { label: 'ROOM', bg: 'bg-[#2e4a36]/15 text-[#2e4a36] border-[#2e4a36]/40' };
  };

  const badge = getTypeBadge();

  if (!isRevealed) {
    return (
      <div
        id={`card-hidden-${card.id}`}
        className={`relative ${sizeClasses[size]} rounded bg-[#f4e4bc] border-2 border-[#d4af37] flex flex-col items-center justify-center p-2 shadow-xl ${className}`}
      >
        <div className="absolute inset-1.5 border border-[#d4af37]/40 rounded-sm bg-[#251610]/5 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-[#d4af37] bg-[#251610] flex items-center justify-center text-[#d4af37] mb-1 font-deco font-bold">
            ?
          </div>
          <span className="font-deco text-[9px] tracking-[0.2em] text-[#2d1b10] uppercase font-bold">CONFIDENTIAL</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`card-${card.id}`}
      onClick={isSelectable ? onClick : undefined}
      className={`group relative ${sizeClasses[size]} rounded bg-[#f4e4bc] text-[#2d1b10] border-2 border-[#d4af37] shadow-xl flex flex-col justify-between p-2 select-none transition-all duration-300 ${
        isSelectable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-[0_10px_20px_rgba(212,175,55,0.2)]' : ''
      } ${
        isSelected
          ? 'ring-4 ring-[#d4af37] scale-105 shadow-[0_0_20px_rgba(212,175,55,0.6)]'
          : ''
      } ${className}`}
    >
      {/* Inner Inset Frame */}
      <div className="flex-1 border border-[#d4af37]/30 bg-[#251610]/5 rounded-sm p-1.5 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-0.5">
          <span className="text-[8px] font-bold tracking-[0.15em] uppercase text-[#2d1b10]/70">
            {badge.label}
          </span>
          <span className="text-[8px] font-mono text-[#d4af37] font-bold">1926</span>
        </div>

        {/* Artwork Representation */}
        <div className="my-1 flex-1 flex flex-col items-center justify-center text-center">
          {card.type === 'SUSPECT' && (
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#d4af37] flex items-center justify-center shadow-[0_0_10px_rgba(155,17,30,0.3)] mb-1"
                style={{ backgroundColor: SUSPECT_COLORS[card.name as Suspect]?.hex || '#9b111e' }}
              >
                <span className="text-base sm:text-lg font-deco font-bold text-white drop-shadow">
                  {card.name.charAt(0)}
                </span>
              </div>
              <p className="text-[9px] font-serif-vintage italic text-[#5c3e29] line-clamp-1">
                {CHARACTER_DETAILS[card.name as Suspect]?.title}
              </p>
            </div>
          )}

          {card.type === 'WEAPON' && (
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-[#d4af37] bg-[#251610] flex items-center justify-center shadow mb-1 text-[#f4e4bc]">
                <Sparkles className="w-5 h-5 text-[#d4af37]" />
              </div>
              <p className="text-[8px] font-mono tracking-wider text-[#7a5c43] uppercase">
                {WEAPON_DETAILS[card.name as Weapon]?.material}
              </p>
            </div>
          )}

          {card.type === 'ROOM' && (
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-md border-2 border-[#d4af37] flex items-center justify-center shadow mb-1 text-white"
                style={{ backgroundColor: ROOM_DEFINITIONS[card.name as Room]?.themeColor || '#78350f' }}
              >
                <Flame className="w-5 h-5 text-[#fbbf24]" />
              </div>
              <p className="text-[8px] font-serif-vintage italic text-[#5c3e29] line-clamp-1">
                {ROOM_DEFINITIONS[card.name as Room]?.description.slice(0, 24)}...
              </p>
            </div>
          )}
        </div>

        {/* Name in Card */}
        <div className="text-center border-t border-[#d4af37]/20 pt-0.5">
          <h4 className="font-deco font-bold text-[10px] sm:text-xs leading-tight text-[#2d1b10] uppercase tracking-wider truncate">
            {card.name}
          </h4>
        </div>
      </div>

      {/* Signature Artistic Flair Category Pill Bar */}
      <div
        className="h-2 sm:h-2.5 mt-1 rounded-full shadow-inner"
        style={{ backgroundColor: getCategoryColor() }}
      />
    </div>
  );
};
