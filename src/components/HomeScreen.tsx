import React, { useState } from 'react';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { Suspect, SUSPECT_COLORS, SUSPECTS } from '../game/constants';
import { SUSPECT_LORE } from '../game/lore';
import { normaliseRoomCode, ROOM_CODE_LENGTH } from '../game/protocol';
import { readLocal, Session, writeLocal } from '../net/session';
import { Button } from './ui/Modal';

interface HomeProps {
  busy: boolean;
  lastSession: Session | null;
  onCreate: (name: string, suspect: Suspect) => void;
  onJoin: (code: string, name: string, suspect: Suspect) => void;
  onResume: (s: Session) => void;
}

export function HomeScreen({ busy, lastSession, onCreate, onJoin, onResume }: HomeProps) {
  const invited = normaliseRoomCode(new URLSearchParams(window.location.search).get('join') ?? '');
  const [tab, setTab] = useState<'host' | 'join'>(invited ? 'join' : 'host');
  const [name, setName] = useState<string>(() => readLocal('cluedo.name', ''));
  const [code, setCode] = useState(invited);
  const [suspect, setSuspect] = useState<Suspect>(() => readLocal('cluedo.suspect', 'Miss Scarlet'));

  const remember = () => {
    writeLocal('cluedo.name', name.trim());
    writeLocal('cluedo.suspect', suspect);
  };
  const canJoin = code.length === ROOM_CODE_LENGTH && name.trim().length > 0;

  return (
    <div className="min-h-[100dvh] w-full flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl mahogany-panel border-2 border-[#d4af37] p-4 sm:p-8 shadow-2xl space-y-6">
        <header className="text-center space-y-1.5">
          <h1 className="font-deco font-black text-3xl sm:text-5xl text-[#f4e4bc] tracking-wider">CLUEDO</h1>
          <p className="text-sm font-serif-vintage italic text-[#e6c88b]">
            Six guests. Nine rooms. Six weapons. One murder. Solve it before your friends do.
          </p>
        </header>

        {lastSession && (
          <div className="p-3 rounded-xl bg-[#251610] border-2 border-[#d4af37] flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="font-deco font-bold text-[#d4af37]">Game in room {lastSession.code}</div>
              <div className="text-xs text-[#baa479] truncate">Rejoin as {lastSession.name}</div>
            </div>
            <Button onClick={() => onResume(lastSession)} disabled={busy}>
              <RotateCcw className="w-4 h-4" /> Rejoin
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 space-y-2">
            <h2 className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">Choose your suspect</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUSPECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSuspect(s)}
                  aria-pressed={suspect === s}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    suspect === s
                      ? 'bg-[#251610] border-[#d4af37] ring-2 ring-[#d4af37]/70'
                      : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: SUSPECT_COLORS[s] }} />
                    <span className="font-deco font-bold text-xs leading-tight">{s}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-serif-vintage italic text-[#baa479] leading-snug">{SUSPECT_LORE[s].title}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#baa479] italic">If someone else already has this suspect, you will get the next free one.</p>
          </section>

          <section className="lg:col-span-5 space-y-4 bg-[#1a0f0d] p-4 sm:p-5 rounded-2xl border border-[#d4af37]/40">
            <div className="flex rounded-xl bg-[#0d0705] p-1 border border-[#d4af37]/30">
              {(['host', 'join'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-lg font-deco font-bold text-xs uppercase tracking-wider ${
                    tab === t ? 'bg-[#d4af37] text-[#1a0f0d]' : 'text-[#baa479]'
                  }`}
                >
                  {t === 'host' ? 'Host a game' : 'Join a game'}
                </button>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">Your name</span>
              <input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="e.g. Ketan"
                autoComplete="nickname"
                className="w-full px-4 py-3 bg-[#251610] border border-[#d4af37]/40 rounded-xl text-base focus:outline-none focus:border-[#d4af37]"
              />
            </label>

            {tab === 'join' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">Room code</span>
                <input
                  id="room-code"
                  value={code}
                  onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
                  placeholder="ABCDE"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-[#251610] border border-[#d4af37]/40 rounded-xl font-mono text-xl font-bold text-[#d4af37] tracking-[0.4em] focus:outline-none focus:border-[#d4af37]"
                />
              </label>
            )}

            {tab === 'host' ? (
              <Button
                id="create-room"
                className="w-full py-3.5"
                disabled={busy || !name.trim()}
                onClick={() => {
                  remember();
                  onCreate(name.trim(), suspect);
                }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create room <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                id="join-room"
                className="w-full py-3.5"
                disabled={busy || !canJoin}
                onClick={() => {
                  remember();
                  onJoin(code, name.trim(), suspect);
                }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Join room <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
