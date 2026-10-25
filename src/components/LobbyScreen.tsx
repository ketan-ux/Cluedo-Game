import React, { useState } from 'react';
import { Bot, Check, Copy, LogOut, Play, Share2, UserMinus, Users, Wifi, WifiOff } from 'lucide-react';
import { MIN_PLAYERS, SUSPECT_COLORS, SUSPECTS } from '../game/constants';
import { SUSPECT_LORE } from '../game/lore';
import { AnyAction, RoomView } from '../game/protocol';
import { Button } from './ui/Modal';

interface LobbyProps {
  room: RoomView;
  act: (action: AnyAction) => void;
  onLeave: () => void;
}

export function LobbyScreen({ room, act, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.youId;
  const me = room.members.find((m) => m.id === room.youId);
  const invite = `${window.location.origin}/?join=${room.code}`;
  const canStart = room.members.length >= MIN_PLAYERS;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cluedo', text: `Join my Cluedo game. Room code ${room.code}`, url: invite });
        return;
      } catch {
        // Fall back to copying.
      }
    }
    await navigator.clipboard?.writeText(invite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl mahogany-panel border-2 border-[#d4af37] p-4 sm:p-8 shadow-2xl space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d4af37]/30 pb-5">
          <div>
            <h1 className="font-deco font-black text-2xl sm:text-3xl text-[#f4e4bc] tracking-wider">The guests are arriving</h1>
            <p className="text-sm text-[#baa479] font-serif-vintage italic">
              Share the code with your friends. {isHost ? 'Start when everyone is seated.' : 'The host will start the game.'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#1a0f0d] border-2 border-[#d4af37] rounded-xl px-4 py-2.5">
            <div>
              <div className="text-[10px] font-deco text-[#baa479] uppercase tracking-widest">Room code</div>
              <div id="room-code-display" className="font-mono font-black text-2xl text-[#d4af37] tracking-[0.3em]">
                {room.code}
              </div>
            </div>
            <button
              type="button"
              onClick={share}
              className="ml-2 p-2.5 rounded-lg bg-[#251610] text-[#d4af37] border border-[#d4af37]/40 flex items-center gap-1.5 text-xs font-bold"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : 'share' in navigator ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Invite'}</span>
            </button>
          </div>
        </header>

        <section>
          <h2 className="font-deco font-bold text-[#f4e4bc] flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#d4af37]" /> Seats ({room.members.length} / 6)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {SUSPECTS.map((s) => {
              const m = room.members.find((x) => x.suspect === s);
              const mine = m?.id === room.youId;
              return (
                <div
                  key={s}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between gap-2 ${
                    mine ? 'bg-[#251610] border-[#d4af37] ring-2 ring-[#d4af37]/40' : m ? 'bg-[#1a0f0d] border-[#d4af37]/25' : 'border-dashed border-[#d4af37]/30 bg-[#1a0f0d]/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-full shrink-0 border-2 border-[#d4af37] ${m ? '' : 'opacity-40'}`}
                      style={{ backgroundColor: SUSPECT_COLORS[s] }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{m ? (mine ? `${m.name} (you)` : m.name) : 'Empty seat'}</span>
                        {m?.isHost && <span className="px-1.5 rounded bg-[#d4af37]/20 text-[9px] font-mono text-[#d4af37]">HOST</span>}
                        {m?.isBot && <span className="px-1.5 rounded bg-[#9b111e]/25 text-[9px] font-mono text-red-200">BOT</span>}
                        {m && !m.isBot && (m.connected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />)}
                      </div>
                      <p className="text-xs text-[#baa479] truncate font-serif-vintage italic">
                        {s} · {SUSPECT_LORE[s].title}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!m && me && (
                      <button
                        type="button"
                        onClick={() => act({ type: 'pickSuspect', suspect: s })}
                        className="px-2.5 py-1.5 rounded bg-[#251610] text-[#f4e4bc] border border-[#d4af37]/40 text-[11px] font-deco uppercase"
                      >
                        Sit here
                      </button>
                    )}
                    {!m && isHost && (
                      <button
                        type="button"
                        onClick={() => act({ type: 'addBot', suspect: s })}
                        className="px-2.5 py-1.5 rounded bg-[#251610] text-[#d4af37] border border-[#d4af37]/30 text-[11px] font-deco uppercase flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" /> Add bot
                      </button>
                    )}
                    {m && isHost && !mine && (
                      <button
                        type="button"
                        onClick={() => act({ type: 'remove', memberId: m.id })}
                        className="p-2 rounded text-red-300 hover:bg-red-950/50"
                        aria-label={`Remove ${m.name}`}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#d4af37]/30 pt-5">
          <Button variant="secondary" onClick={onLeave}>
            <LogOut className="w-4 h-4" /> Leave
          </Button>
          {isHost ? (
            <Button id="start-game" disabled={!canStart} onClick={() => act({ type: 'start' })} className="py-3.5 sm:px-8">
              <Play className="w-4 h-4" /> {canStart ? 'Seal the envelope & start' : 'Need at least 2 players (bots count)'}
            </Button>
          ) : (
            <span className="text-sm text-[#baa479] italic text-center">Waiting for the host to start…</span>
          )}
        </footer>
      </div>
    </div>
  );
}
