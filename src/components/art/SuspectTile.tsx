import React from 'react';
import { Check } from 'lucide-react';
import { Suspect } from '../../game/constants';
import { SUSPECT_LORE } from '../../game/lore';
import { Portrait } from './Portraits';

/** A framed portrait with a name plate, used to pick or show a suspect. */
export function SuspectTile({
  suspect,
  selected = false,
  onClick,
  dim = false,
  caption,
  badge,
  className = '',
}: {
  suspect: Suspect;
  selected?: boolean;
  onClick?: () => void;
  dim?: boolean;
  /** Replaces the suspect's title under the name. */
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': selected } : {})}
      className={`relative block aspect-[5/6] w-full overflow-hidden rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-[var(--gold-light)] shadow-[0_0_0_2px_rgba(243,215,122,0.5),0_0_22px_rgba(243,215,122,0.45)] -translate-y-0.5'
          : 'border-[var(--gold)]/35'
      } ${onClick ? 'active:scale-[0.97] hover:border-[var(--gold)]' : ''} ${className}`}
    >
      <Portrait suspect={suspect} className={`absolute inset-0 w-full h-full ${dim ? 'grayscale opacity-45' : ''}`} />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-1.5 pt-5 pb-1.5 text-center">
        <span className="block font-deco font-bold text-[11px] sm:text-xs leading-tight text-[var(--parchment)]">{suspect}</span>
        <span className="block text-[11px] italic leading-tight text-[var(--muted)] truncate">{caption ?? SUSPECT_LORE[suspect].title}</span>
      </span>
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--gold-light)] text-[#1f120a] flex items-center justify-center shadow">
          <Check className="w-4 h-4 stroke-[3]" />
        </span>
      )}
      {badge && <span className="absolute top-1.5 left-1.5 flex gap-1">{badge}</span>}
    </Tag>
  );
}
