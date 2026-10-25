import React from 'react';
import { CardName } from '../../game/constants';
import { SeenCard, ShownCard } from '../../game/engine';
import { PublicPlayer } from '../../game/view';
import { CardView } from './CardView';
import { SectionTitle } from './Modal';

/** Your hand, fanned out under the board on wide screens. */
export function HandFan({ hand }: { hand: CardName[] }) {
  const mid = (hand.length - 1) / 2;
  return (
    <section aria-label={`Your cards (${hand.length})`} className="w-full flex flex-col items-center pt-1 pb-5">
      <div className="hand-fan flex justify-center items-end px-6">
        {hand.map((card, i) => (
          <div key={card} style={{ transform: `rotate(${(i - mid) * 2.5}deg) translateY(${Math.abs(i - mid) * 2}px)`, zIndex: i }}>
            <CardView card={card} size="sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Everything you know from cards: your hand, what you were shown, and what you showed. */
export function CaseFile({
  hand,
  seen,
  shown,
  players,
}: {
  hand: CardName[];
  seen: SeenCard[];
  shown: ShownCard[];
  players: PublicPlayer[];
}) {
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone';
  return (
    <div className="space-y-5">
      <section aria-label={`Your cards (${hand.length})`} className="space-y-3">
        <SectionTitle>Your cards · {hand.length}</SectionTitle>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 justify-items-center">
          {hand.map((card) => (
            <CardView key={card} card={card} size="sm" />
          ))}
        </div>
        <p className="text-center text-sm italic text-[var(--muted)]">None of these can be in the envelope.</p>
      </section>
      <section className="space-y-2">
        <SectionTitle>Shown to you</SectionTitle>
        {seen.length === 0 ? (
          <p className="text-center text-sm italic text-[var(--muted)]">Nobody has shown you a card yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[...seen].reverse().map((s) => (
              <li key={`${s.card}-${s.turn}`} className="flex items-center gap-3 p-1.5 rounded-xl bg-black/20 border border-[var(--gold)]/15">
                <CardView card={s.card} size="xs" />
                <div className="text-sm leading-snug">
                  <div className="font-deco font-bold">{s.card}</div>
                  <div className="italic text-[var(--muted)]">
                    from {name(s.fromId)}, turn {s.turn}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {shown.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>You showed</SectionTitle>
          <ul className="space-y-1 text-sm">
            {[...shown].reverse().map((s) => (
              <li key={`${s.card}-${s.turn}`} className="flex justify-between gap-2 px-2 py-1 rounded-lg bg-black/15">
                <span className="font-semibold">{s.card}</span>
                <span className="italic text-[var(--muted)]">
                  to {name(s.toId)}, turn {s.turn}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
