import React, { useState } from 'react';
import { ArrowRight, BookOpen, Loader2, MailOpen, RotateCcw } from 'lucide-react';
import { Suspect, SUSPECTS } from '../game/constants';
import { SUSPECT_LORE } from '../game/lore';
import { normaliseRoomCode, ROOM_CODE_LENGTH } from '../game/protocol';
import { readLocal, Session, writeLocal } from '../net/session';
import { Logo } from './art/Logo';
import { Avatar } from './art/Portraits';
import { SuspectTile } from './art/SuspectTile';
import { Button, SectionTitle } from './ui/Modal';
import { RulesSheet } from './ui/RulesSheet';

interface HomeProps {
  busy: boolean;
  lastSession: Session | null;
  onCreate: (name: string, suspect: Suspect) => void;
  onJoin: (code: string, name: string, suspect: Suspect) => void;
  onResume: (s: Session) => void;
}

const INPUT =
  'w-full px-4 py-3 rounded-xl bg-[var(--ink)]/70 border border-[var(--gold)]/40 text-base text-[var(--parchment)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:border-[var(--gold-light)] focus:ring-2 focus:ring-[var(--gold)]/30';

export function HomeScreen({ busy, lastSession, onCreate, onJoin, onResume }: HomeProps) {
  const invited = normaliseRoomCode(new URLSearchParams(window.location.search).get('join') ?? '');
  const [tab, setTab] = useState<'host' | 'join'>(invited ? 'join' : 'host');
  const [name, setName] = useState<string>(() => readLocal('cluedo.name', ''));
  const [code, setCode] = useState(invited);
  const [suspect, setSuspect] = useState<Suspect>(() => readLocal('cluedo.suspect', 'Miss Scarlet'));
  const [rules, setRules] = useState(false);

  const remember = () => {
    writeLocal('cluedo.name', name.trim());
    writeLocal('cluedo.suspect', suspect);
  };
  const canJoin = code.length === ROOM_CODE_LENGTH && name.trim().length > 0;
  const submit = () => {
    if (busy) return;
    if (tab === 'host' && name.trim()) {
      remember();
      onCreate(name.trim(), suspect);
    } else if (tab === 'join' && canJoin) {
      remember();
      onJoin(code, name.trim(), suspect);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex justify-center px-3 sm:px-6 py-4 sm:py-8 safe-top">
      <div className="w-full max-w-5xl lg:my-auto">
        <div className="panel gold-frame rounded-[1.75rem] overflow-hidden">
          <div className="grid lg:grid-cols-[1.15fr_1fr]">
            {/* The box lid: title and the six suspects. */}
            <section className="relative px-4 sm:px-8 pt-6 pb-5 lg:py-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(155,17,30,0.45),transparent_70%)]">
              <Logo className="w-full max-w-[22rem] mx-auto block" />
              <p className="mt-2 text-center font-serif-vintage italic text-[15px] text-[var(--muted)]">
                Six guests. Nine rooms. Six weapons. One murder.
              </p>

              <SectionTitle className="mt-6 mb-3">Choose your suspect</SectionTitle>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {SUSPECTS.map((s) => (
                  <SuspectTile key={s} suspect={s} selected={suspect === s} onClick={() => setSuspect(s)} />
                ))}
              </div>
              <p className="mt-3 text-center text-sm font-serif-vintage italic text-[var(--parchment)]/85 min-h-[2.5em] leading-snug px-2">
                {SUSPECT_LORE[suspect].bio}
              </p>
            </section>

            {/* The table card: who you are and where you are going. */}
            <section className="px-4 sm:px-8 pt-5 pb-6 lg:py-10 bg-black/20 lg:border-l border-t lg:border-t-0 border-[var(--gold)]/25 flex flex-col gap-4">
              {lastSession && (
                <div className="p-3 rounded-2xl bg-[var(--felt)] border border-[var(--gold)]/60 flex items-center gap-3">
                  {lastSession.suspect && <Avatar suspect={lastSession.suspect} size={44} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-deco font-bold text-[var(--gold-light)] text-sm">Your game in room {lastSession.code}</div>
                    <div className="text-sm italic text-[var(--muted)] truncate">Pick up where you left off as {lastSession.name}</div>
                  </div>
                  <Button onClick={() => onResume(lastSession)} disabled={busy}>
                    <RotateCcw className="w-4 h-4" /> Rejoin
                  </Button>
                </div>
              )}

              {invited && (
                <div className="p-3 rounded-2xl parchment flex items-center gap-3">
                  <MailOpen className="w-7 h-7 text-[var(--crimson)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-deco font-bold text-sm">You are invited</div>
                    <div className="text-sm italic text-[#5c3e29]">
                      Room <span className="font-mono not-italic font-bold tracking-widest">{invited}</span>. Pick a suspect, enter your name and join.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex rounded-xl bg-[var(--ink)]/80 p-1 border border-[var(--gold)]/30" role="tablist">
                {(['host', 'join'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`flex-1 min-h-10 rounded-lg font-deco font-bold text-xs uppercase tracking-[0.14em] transition-colors ${
                      tab === t ? 'bg-[linear-gradient(180deg,#f6dd8a,#d4af37)] text-[#1f120a]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {t === 'host' ? 'Host a game' : 'Join a game'}
                  </button>
                ))}
              </div>

              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-deco uppercase tracking-[0.2em] text-[var(--gold)] font-bold">Your name</span>
                  <input
                    id="player-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="What your friends call you"
                    autoComplete="nickname"
                    enterKeyHint={tab === 'host' ? 'go' : 'next'}
                    className={INPUT}
                  />
                </label>

                {tab === 'join' && (
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-deco uppercase tracking-[0.2em] text-[var(--gold)] font-bold">Room code</span>
                    <input
                      id="room-code"
                      value={code}
                      onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
                      placeholder="ABCDE"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      className={`${INPUT} font-mono text-2xl font-bold text-[var(--gold-light)] tracking-[0.45em] text-center uppercase`}
                    />
                  </label>
                )}

                {tab === 'host' ? (
                  <Button id="create-room" type="submit" className="w-full min-h-12 text-sm" disabled={busy || !name.trim()}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create a room <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button id="join-room" type="submit" className="w-full min-h-12 text-sm" disabled={busy || !canJoin}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Join the game <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
                <p className="text-sm text-center italic text-[var(--muted)] -mt-1">
                  {tab === 'host'
                    ? 'You will get a code and a link to send your friends. Bots can fill empty seats.'
                    : 'If someone already has your suspect, you get the next free one.'}
                </p>
              </form>

              <ol className="hidden lg:grid gap-3 mt-2">
                {[
                  ['Host', 'Create a room and send the link to your friends, wherever they are.'],
                  ['Seat', 'Everyone picks a suspect. Bots can take any empty chairs.'],
                  ['Solve', 'Roll, sneak through the house, question the guests and be first to name the killer.'],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-3 items-start">
                    <span className="w-8 h-8 shrink-0 rounded-full border border-[var(--gold)] text-[var(--gold-light)] font-deco font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-[15px] leading-snug">
                      <span className="font-deco font-bold text-[var(--parchment)] text-sm uppercase tracking-wider">{title}. </span>
                      <span className="italic text-[var(--muted)]">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-auto pt-2 flex justify-center">
                <Button variant="ghost" onClick={() => setRules(true)}>
                  <BookOpen className="w-4 h-4" /> How to play
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
      {rules && <RulesSheet onClose={() => setRules(false)} />}
    </div>
  );
}
