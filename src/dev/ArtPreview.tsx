import React from 'react';
import { ALL_CARDS, ROOMS, SUSPECTS, WEAPONS } from '../game/constants';
import { Avatar, Portrait } from '../components/art/Portraits';
import { RoomArt } from '../components/art/RoomArt';
import { WeaponArt } from '../components/art/WeaponArt';
import { Logo } from '../components/art/Logo';
import { CardBack, CardView } from '../components/ui/CardView';
import { AccusationModal, CardRevealModal, DisproveModal, GameOverModal, SuggestionModal } from '../components/ui/GameDialogs';

const noop = () => {};
const HAND = ['Miss Scarlet', 'Rope', 'Kitchen'] as const;

/** One dialog on its own, e.g. ?art=suggest, for checking layouts. */
function DialogPreview({ name }: { name: string }) {
  const hand = [...HAND];
  const dialog =
    name === 'suggest' ? (
      <SuggestionModal room="Library" hand={hand} onSuggest={noop} onClose={noop} />
    ) : name === 'accuse' ? (
      <AccusationModal hand={hand} onAccuse={noop} onClose={noop} />
    ) : name === 'disprove' ? (
      <DisproveModal suggesterName="Ben" suggestion={{ suspect: 'Miss Scarlet', weapon: 'Rope', room: 'Hall' }} cards={['Miss Scarlet', 'Rope']} onShow={noop} />
    ) : name === 'reveal' ? (
      <CardRevealModal card="Lead Pipe" otherName="Ben" direction="received" onClose={noop} />
    ) : (
      <GameOverModal winnerName="Ana" winnerSuspect="Mrs. Peacock" envelope={{ suspect: 'Mr. Green', weapon: 'Wrench', room: 'Study' }} isHost onRematch={noop} onLeave={noop} />
    );
  return <div id="art-preview" className="min-h-screen">{dialog}</div>;
}

/** Development-only gallery of the artwork (open the site with ?art). */
export default function ArtPreview() {
  const which = new URLSearchParams(window.location.search).get('art');
  if (which) return <DialogPreview name={which} />;
  return (
    <div className="min-h-screen p-4 space-y-6 bg-[#1a0e08] text-[#f4e4bc]" id="art-preview">
      <Logo className="w-[360px]" />
      <section className="flex flex-wrap gap-4">
        {SUSPECTS.map((s) => (
          <figure key={s} className="w-40 text-center">
            <div className="w-40 h-48 rounded-[50%] overflow-hidden border-4 border-[#d4af37]">
              <Portrait suspect={s} className="w-full h-full" />
            </div>
            <figcaption className="mt-1 text-sm">{s}</figcaption>
            <div className="flex justify-center gap-2 mt-1">
              <Avatar suspect={s} size={40} />
              <Avatar suspect={s} size={28} ring="turn" />
            </div>
          </figure>
        ))}
      </section>
      <section className="flex flex-wrap gap-3">
        {ROOMS.map((r) => (
          <figure key={r} className="w-60 text-center">
            <RoomArt room={r} className="w-60 h-40 rounded border-2 border-[#d4af37]" />
            <figcaption className="text-sm">{r}</figcaption>
          </figure>
        ))}
      </section>
      <section className="flex flex-wrap gap-3">
        {WEAPONS.map((w) => (
          <figure key={w} className="w-32 text-center">
            <div className="w-32 h-32 rounded bg-[#2a1a10] border-2 border-[#d4af37]">
              <WeaponArt weapon={w} className="w-full h-full" />
            </div>
            <figcaption className="text-sm">{w}</figcaption>
          </figure>
        ))}
      </section>
      <section className="flex flex-wrap gap-3 items-end">
        {ALL_CARDS.map((c) => (
          <CardView key={c} card={c} size="md" />
        ))}
        <CardBack size="md" />
      </section>
      <section className="flex flex-wrap gap-2 items-end">
        {ALL_CARDS.slice(0, 8).map((c) => (
          <CardView key={c} card={c} size="xs" />
        ))}
        {ALL_CARDS.slice(8, 12).map((c) => (
          <CardView key={c} card={c} size="sm" />
        ))}
        <CardView card="Candlestick" size="lg" selected />
      </section>
    </div>
  );
}
