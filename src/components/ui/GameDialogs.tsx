import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Gavel, MailOpen, RotateCcw, Search, Shield, Skull, Sparkles, Trophy, XCircle } from 'lucide-react';
import { CardName, Room, ROOMS, Suspect, SUSPECTS, Weapon, WEAPONS } from '../../game/constants';
import { Envelope } from '../../game/engine';
import { sounds } from '../../utils/audio';
import { Portrait } from '../art/Portraits';
import { RoomArt } from '../art/RoomArt';
import { CardView, FlipCard } from './CardView';
import { Button, Modal } from './Modal';
import { CardPicker } from './Pickers';

function firstNotIn<T extends CardName>(list: readonly T[], hand: CardName[], preferred?: T): T {
  return preferred ?? list.find((c) => !hand.includes(c)) ?? list[0];
}

export function SuggestionModal({
  room,
  hand,
  onSuggest,
  onClose,
}: {
  room: Room;
  hand: CardName[];
  onSuggest: (suspect: Suspect, weapon: Weapon) => void;
  onClose: () => void;
}) {
  const [suspect, setSuspect] = useState<Suspect>(() => firstNotIn(SUSPECTS, hand));
  const [weapon, setWeapon] = useState<Weapon>(() => firstNotIn(WEAPONS, hand));
  return (
    <Modal
      title="Make a suggestion"
      subtitle={
        <>
          The suspect and weapon you name are brought into the {room}.
        </>
      }
      icon={<Sparkles className="w-5 h-5" />}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button id="submit-suggestion" onClick={() => onSuggest(suspect, weapon)}>
            Suggest
          </Button>
        </>
      }
    >
      <div className="relative h-20 sm:h-24 rounded-xl overflow-hidden border border-[var(--gold)]/50">
        <RoomArt room={room} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <div className="text-[10px] font-deco font-bold uppercase tracking-[0.25em] text-[var(--gold)]">Where</div>
          <div className="font-deco font-black text-xl text-[var(--parchment)]">The {room}</div>
        </div>
      </div>
      <CardPicker label="Who?" options={SUSPECTS} value={suspect} onChange={setSuspect} hand={hand} />
      <CardPicker label="With what?" options={WEAPONS} value={weapon} onChange={setWeapon} hand={hand} />
      <p className="parchment p-3 rounded-xl text-center font-serif-vintage italic text-[17px] leading-snug">
        “I suggest it was <strong className="not-italic font-deco text-[var(--crimson)]">{suspect}</strong>, in the{' '}
        <strong className="not-italic font-deco text-[var(--crimson)]">{room}</strong>, with the{' '}
        <strong className="not-italic font-deco text-[var(--crimson)]">{weapon}</strong>.”
      </p>
    </Modal>
  );
}

export function AccusationModal({
  hand,
  initial,
  onAccuse,
  onClose,
}: {
  hand: CardName[];
  initial?: Partial<Envelope>;
  onAccuse: (e: Envelope) => void;
  onClose: () => void;
}) {
  const [suspect, setSuspect] = useState<Suspect>(() => firstNotIn(SUSPECTS, hand, initial?.suspect));
  const [weapon, setWeapon] = useState<Weapon>(() => firstNotIn(WEAPONS, hand, initial?.weapon));
  const [room, setRoom] = useState<Room>(() => firstNotIn(ROOMS, hand, initial?.room));
  const [sure, setSure] = useState(false);
  const holding = [suspect, weapon, room].filter((c) => hand.includes(c));

  if (sure) {
    return (
      <Modal
        title="Open the envelope?"
        subtitle="There is no going back. If any card is wrong you are out of the game."
        icon={<MailOpen className="w-5 h-5" />}
        tone="red"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSure(false)}>
              <ArrowLeft className="w-4 h-4" /> Change
            </Button>
            <Button id="confirm-accusation" variant="danger" onClick={() => onAccuse({ suspect, weapon, room })}>
              <Gavel className="w-4 h-4" /> I accuse
            </Button>
          </>
        }
      >
        <div className="flex justify-center gap-2 sm:gap-3">
          <CardView card={suspect} size="sm" />
          <CardView card={weapon} size="sm" />
          <CardView card={room} size="sm" />
        </div>
        <p className="parchment p-3 rounded-xl text-center font-serif-vintage italic text-[17px] leading-snug">
          “I accuse <strong className="not-italic font-deco text-[var(--crimson)]">{suspect}</strong> of murder, in the{' '}
          <strong className="not-italic font-deco text-[var(--crimson)]">{room}</strong>, with the{' '}
          <strong className="not-italic font-deco text-[var(--crimson)]">{weapon}</strong>!”
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Make an accusation"
      subtitle="Get all three right and you win. Get any wrong and you are out (you still show cards)."
      icon={<Gavel className="w-5 h-5" />}
      tone="red"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button id="accuse-next" variant="danger" onClick={() => setSure(true)}>
            Accuse…
          </Button>
        </>
      }
    >
      {holding.length > 0 && (
        <p className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-600/60 text-amber-100 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You hold {holding.join(' and ')}, so this accusation cannot be right.
        </p>
      )}
      <CardPicker label="Who?" options={SUSPECTS} value={suspect} onChange={setSuspect} hand={hand} tone="red" />
      <CardPicker label="With what?" options={WEAPONS} value={weapon} onChange={setWeapon} hand={hand} tone="red" />
      <CardPicker label="Where?" options={ROOMS} value={room} onChange={setRoom} hand={hand} tone="red" />
    </Modal>
  );
}

export function DisproveModal({
  suggesterName,
  suggestion,
  cards,
  onShow,
}: {
  suggesterName: string;
  suggestion: { suspect: Suspect; weapon: Weapon; room: Room };
  cards: CardName[];
  onShow: (card: CardName) => void;
}) {
  const [picked, setPicked] = useState<CardName | null>(cards.length === 1 ? cards[0] : null);
  return (
    <Modal
      title="Disprove the suggestion"
      subtitle={
        <>
          {suggesterName} suggests {suggestion.suspect}, in the {suggestion.room}, with the {suggestion.weapon}. Only{' '}
          {suggesterName} will see the card you choose.
        </>
      }
      icon={<Shield className="w-5 h-5" />}
      footer={
        <Button id="show-card" disabled={!picked} onClick={() => picked && onShow(picked)}>
          <Eye className="w-4 h-4" /> Show {suggesterName} this card
        </Button>
      }
    >
      <div className="flex flex-wrap justify-center gap-3 py-2">
        {cards.map((c) => (
          <CardView key={c} card={c} size="md" selected={picked === c} onClick={() => setPicked(c)} />
        ))}
      </div>
    </Modal>
  );
}

export function CardRevealModal({
  card,
  otherName,
  direction,
  onClose,
}: {
  card: CardName;
  otherName: string;
  direction: 'received' | 'given';
  onClose: () => void;
}) {
  useEffect(() => {
    sounds.playCardSlide();
  }, []);
  return (
    <Modal
      title={direction === 'received' ? `${otherName} shows you a card` : `You showed ${otherName}`}
      subtitle={direction === 'received' ? 'Nobody else can see this. It is not in the envelope.' : 'Only they saw it.'}
      icon={<Search className="w-5 h-5" />}
      onClose={onClose}
      footer={<Button onClick={onClose}>Got it</Button>}
    >
      <div className="flex justify-center py-2">
        <FlipCard card={card} size="lg" />
      </div>
    </Modal>
  );
}

export function UnrefutedModal({
  suggestion,
  hand,
  canAccuse,
  onAccuse,
  onClose,
}: {
  suggestion: Envelope;
  hand: CardName[];
  canAccuse: boolean;
  onAccuse: () => void;
  onClose: () => void;
}) {
  const cards = [suggestion.suspect, suggestion.weapon, suggestion.room];
  const unheld = cards.filter((c) => !hand.includes(c));
  return (
    <Modal
      title="No one could disprove you"
      subtitle={
        unheld.length === 3
          ? 'You hold none of these, so all three must be in the envelope.'
          : `Apart from what you hold, ${unheld.join(', ')} must be in the envelope.`
      }
      icon={<Sparkles className="w-5 h-5" />}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canAccuse && (
            <Button variant="danger" onClick={onAccuse}>
              <Gavel className="w-4 h-4" /> Accuse
            </Button>
          )}
        </>
      }
    >
      <div className="flex justify-center gap-2 sm:gap-3">
        {cards.map((c) => (
          <div key={c} className={hand.includes(c) ? 'opacity-40' : ''}>
            <CardView card={c} size="sm" />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function AccusationResultModal({
  accuserName,
  isMe,
  accusation,
  envelope,
  onClose,
}: {
  accuserName: string;
  isMe: boolean;
  accusation: Envelope;
  envelope?: Envelope;
  onClose: () => void;
}) {
  useEffect(() => {
    sounds.playGavelBang();
  }, []);
  const keys = ['suspect', 'weapon', 'room'] as const;
  return (
    <Modal
      title={isMe ? 'Your accusation was wrong' : `${accuserName} accused wrongly`}
      subtitle={
        isMe
          ? 'You have looked in the envelope. You can no longer win, but you must still show cards when asked.'
          : `At least one of these is not in the envelope. ${accuserName} is out but still shows cards.`
      }
      icon={<XCircle className="w-5 h-5" />}
      tone="red"
      onClose={onClose}
      footer={<Button onClick={onClose}>Continue</Button>}
    >
      <div>
        <h3 className="text-[11px] font-deco uppercase tracking-[0.2em] text-[var(--gold)] mb-2 text-center">The accusation</h3>
        <div className="flex justify-center gap-2 sm:gap-3">
          {keys.map((k) => (
            <div key={k} className="relative">
              <CardView card={accusation[k]} size="sm" />
              {envelope && (
                <span className="absolute -top-2 -right-2 rounded-full bg-[var(--mahogany)]">
                  {accusation[k] === envelope[k] ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {envelope && (
        <div>
          <h3 className="text-[11px] font-deco uppercase tracking-[0.2em] text-[var(--gold)] mb-2 text-center">Inside the envelope (only you can see this)</h3>
          <div className="flex justify-center gap-2 sm:gap-3">
            {keys.map((k) => (
              <CardView key={k} card={envelope[k]} size="sm" />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function GameOverModal({
  winnerName,
  winnerSuspect,
  envelope,
  isHost,
  onRematch,
  onLeave,
}: {
  winnerName: string | null;
  winnerSuspect?: Suspect;
  envelope: Envelope;
  isHost: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    if (!winnerName) return;
    sounds.playVictoryFanfare();
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#d4af37', '#c8102e', '#1f7a3a', '#1f4fa3', '#ffffff'] });
  }, [winnerName]);
  return (
    <Modal
      title={winnerName ? `${winnerName} solved the case!` : 'The murderer got away'}
      subtitle={winnerName ? `Playing as ${winnerSuspect}.` : 'Every detective made a wrong accusation.'}
      icon={winnerName ? <Trophy className="w-5 h-5" /> : <Skull className="w-5 h-5" />}
      tone={winnerName ? 'gold' : 'red'}
      footer={
        <>
          <Button variant="secondary" onClick={onLeave}>
            Leave room
          </Button>
          {isHost ? (
            <Button id="rematch" onClick={onRematch}>
              <RotateCcw className="w-4 h-4" /> Play again
            </Button>
          ) : (
            <span className="text-sm italic text-[var(--muted)] self-center">Waiting for the host to start another game…</span>
          )}
        </>
      }
    >
      {winnerSuspect && (
        <div className="mx-auto w-28 rounded-[50%] overflow-hidden border-4 border-[var(--gold)] shadow-[0_0_30px_rgba(212,175,55,0.45)]">
          <Portrait suspect={winnerSuspect} className="block w-full h-auto" />
        </div>
      )}
      <h3 className="text-center font-serif-vintage italic text-[17px]">
        It was <strong className="not-italic font-deco text-[var(--gold-light)]">{envelope.suspect}</strong>, in the{' '}
        <strong className="not-italic font-deco text-[var(--gold-light)]">{envelope.room}</strong>, with the{' '}
        <strong className="not-italic font-deco text-[var(--gold-light)]">{envelope.weapon}</strong>.
      </h3>
      <div className="flex justify-center gap-2 sm:gap-3">
        <FlipCard card={envelope.suspect} size="sm" delay={300} />
        <FlipCard card={envelope.weapon} size="sm" delay={650} />
        <FlipCard card={envelope.room} size="sm" delay={1000} />
      </div>
    </Modal>
  );
}
