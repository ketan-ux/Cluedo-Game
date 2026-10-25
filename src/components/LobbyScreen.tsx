import React, { useState } from 'react';
import { Bot, BookOpen, Check, Copy, LogOut, Play, Share2, UserMinus } from 'lucide-react';
import { MIN_PLAYERS, SUSPECTS } from '../game/constants';
import { AnyAction, RoomView } from '../game/protocol';
import { Logo } from './art/Logo';
import { SuspectTile } from './art/SuspectTile';
import { Button, SectionTitle } from './ui/Modal';
import { RulesSheet } from './ui/RulesSheet';

interface LobbyProps {
  room: RoomView;
  act: (action: AnyAction) => void;
  onLeave: () => void;
}

const SMALL_BUTTON =
  'w-full min-h-9 px-2 rounded-lg text-[11px] font-deco font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors';

export function LobbyScreen({ room, act, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [rules, setRules] = useState(false);
  const isHost = room.hostId === room.youId;
  const me = room.members.find((m) => m.id === room.youId);
  const host = room.members.find((m) => m.isHost);
  const invite = `${window.location.origin}/?join=${room.code}`;
  const canStart = room.members.length >= MIN_PLAYERS;

  const copy = async (what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? invite : room.code);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; the code is on screen to read out.
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cluedo', text: `Join my game of Cluedo. Room code ${room.code}.`, url: invite });
        return;
      } catch {
        // Cancelled or unsupported, so copy instead.
      }
    }
    await copy('link');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center safe-top">
      <div className="w-full max-w-5xl flex-1 px-3 sm:px-6 pt-3 sm:pt-8 pb-4 space-y-4 sm:space-y-5 lg:flex lg:flex-col lg:justify-center">
        <header className="panel gold-frame rounded-[1.5rem] px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
          <div className="text-center sm:text-left">
            <Logo className="w-40 sm:w-56 mx-auto sm:mx-0" tagline={false} />
            <p className="font-serif-vintage italic text-[15px] text-[var(--muted)] sm:mt-1">
              The guests are arriving. {isHost ? 'Start once everyone is seated.' : `${host?.name ?? 'The host'} will start the game.`}
            </p>
          </div>
          <div className="w-full sm:w-auto rounded-2xl parchment px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 text-center sm:text-left">
              <div className="text-[10px] font-deco font-bold uppercase tracking-[0.25em] text-[#7a5a3a]">Room code</div>
              <button
                type="button"
                onClick={() => copy('code')}
                className="font-mono font-black text-3xl tracking-[0.3em] text-[var(--crimson)]"
                aria-label={`Room code ${room.code}. Copy it`}
              >
                <span id="room-code-display">{room.code}</span>
              </button>
              <div className="text-[11px] italic text-[#7a5a3a] h-4">{copied === 'code' ? 'Code copied' : copied === 'link' ? 'Invite link copied' : ''}</div>
            </div>
            <button
              type="button"
              onClick={share}
              className="min-h-12 px-4 rounded-xl bg-[var(--crimson)] text-[#fbeacb] border border-[var(--gold-dark)] font-deco font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow"
            >
              {copied === 'link' ? <Check className="w-4 h-4" /> : 'share' in navigator ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Invite
            </button>
          </div>
        </header>

        <section className="space-y-3">
          <SectionTitle>
            The seating plan · {room.members.length} of {SUSPECTS.length}
          </SectionTitle>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {SUSPECTS.map((s) => {
              const m = room.members.find((x) => x.suspect === s);
              const mine = !!m && m.id === room.youId;
              return (
                <div key={s} className="flex flex-col gap-1.5">
                  <SuspectTile
                    suspect={s}
                    dim={!m}
                    selected={mine}
                    caption={
                      m ? (
                        <span className={mine ? 'text-[var(--gold-light)] not-italic font-bold' : 'text-[var(--parchment)] not-italic'}>
                          {mine ? `${m.name} (you)` : m.name}
                        </span>
                      ) : (
                        'Empty seat'
                      )
                    }
                    badge={
                      m && (
                        <>
                          {m.isHost && <Badge>HOST</Badge>}
                          {m.isBot && <Badge tone="red">BOT</Badge>}
                          {!m.isBot && (
                            <span
                              className={`w-2.5 h-2.5 rounded-full mt-1 border border-black/50 ${m.connected ? 'bg-emerald-400' : 'bg-red-500'}`}
                              aria-label={m.connected ? 'online' : 'disconnected'}
                            />
                          )}
                        </>
                      )
                    }
                  />
                  {!m && me && (
                    <button
                      type="button"
                      onClick={() => act({ type: 'pickSuspect', suspect: s })}
                      className={`${SMALL_BUTTON} bg-[var(--mahogany)] text-[var(--parchment)] border-[var(--gold)]/40 hover:bg-[var(--mahogany-3)]`}
                    >
                      Sit here
                    </button>
                  )}
                  {!m && isHost && (
                    <button
                      type="button"
                      onClick={() => act({ type: 'addBot', suspect: s })}
                      className={`${SMALL_BUTTON} bg-transparent text-[var(--gold)] border-dashed border-[var(--gold)]/45 hover:bg-[var(--gold)]/10`}
                    >
                      <Bot className="w-3.5 h-3.5" /> Add bot
                    </button>
                  )}
                  {m && isHost && !mine && (
                    <button
                      type="button"
                      onClick={() => act({ type: 'remove', memberId: m.id })}
                      className={`${SMALL_BUTTON} bg-transparent text-red-300 border-red-900/60 hover:bg-red-950/50`}
                      aria-label={`Remove ${m.name}`}
                    >
                      <UserMinus className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm italic text-[var(--muted)]">
            Take an empty seat to change suspect. Play goes clockwise from Miss Scarlet.
          </p>
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => setRules(true)}>
              <BookOpen className="w-4 h-4" /> How to play
            </Button>
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 w-full panel border-x-0 border-b-0 safe-bottom">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-3 flex items-center gap-3">
          <Button variant="secondary" onClick={onLeave}>
            <LogOut className="w-4 h-4" /> Leave
          </Button>
          {isHost ? (
            <Button id="start-game" disabled={!canStart} onClick={() => act({ type: 'start' })} className="flex-1 min-h-12 text-sm">
              <Play className="w-4 h-4" /> {canStart ? 'Seal the envelope & start' : 'Add a friend or a bot'}
            </Button>
          ) : (
            <span className="flex-1 text-center text-sm italic text-[var(--muted)]">Waiting for {host?.name ?? 'the host'} to start…</span>
          )}
        </div>
      </footer>
      {rules && <RulesSheet onClose={() => setRules(false)} />}
    </div>
  );
}

function Badge({ children, tone = 'gold' }: { children: React.ReactNode; tone?: 'gold' | 'red' }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold leading-none shadow ${
        tone === 'red' ? 'bg-[var(--crimson)] text-[#fbeacb]' : 'bg-[var(--gold)] text-[#1f120a]'
      }`}
    >
      {children}
    </span>
  );
}
