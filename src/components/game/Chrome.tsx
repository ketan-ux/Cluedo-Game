import React from 'react';
import { BookOpen, Box, LogOut, MessageCircle, NotebookPen, ScrollText, Settings, Square as SquareIcon, Vibrate, Volume2, VolumeX, WalletCards, WifiOff } from 'lucide-react';
import { BoardMode } from '../board/BoardView';
import { Logo } from '../art/Logo';
import { Button, Modal } from '../ui/Modal';
import { usePrefs } from '../../utils/prefs';

const ICON_BUTTON =
  'h-10 min-w-10 px-2.5 rounded-xl bg-[var(--mahogany)] border border-[var(--gold)]/40 text-[var(--parchment)] text-[11px] font-deco font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--mahogany-3)] active:scale-95';

export function TopBar({
  code,
  connected,
  boardMode,
  onToggleBoard,
  onNotes,
  onSettings,
}: {
  code: string;
  connected: boolean;
  boardMode: BoardMode;
  onToggleBoard: () => void;
  onNotes: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="ga-top safe-top panel !border-x-0 !border-t-0 z-10">
      <div className="h-12 px-2 sm:px-3 flex items-center gap-2">
        <Logo tagline={false} className="h-8 w-auto shrink-0" />
        <span className="px-2 py-0.5 rounded-md bg-black/30 border border-[var(--gold)]/25 font-mono text-[12px] tracking-[0.2em] text-[var(--muted)]">{code}</span>
        {!connected && (
          <span className="flex items-center gap-1 text-[12px] text-red-300 animate-pulse">
            <WifiOff className="w-3.5 h-3.5" /> <span className="hidden min-[380px]:inline">Reconnecting…</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onNotes} className={`notes-button ${ICON_BUTTON}`}>
            <NotebookPen className="w-4 h-4 text-[var(--gold)]" /> Notes
          </button>
          <button
            type="button"
            onClick={onToggleBoard}
            className={ICON_BUTTON}
            aria-label={boardMode === '3d' ? 'Switch to the flat 2D board' : 'Switch to the 3D board'}
          >
            {boardMode === '3d' ? <SquareIcon className="w-4 h-4 text-[var(--gold)]" /> : <Box className="w-4 h-4 text-[var(--gold)]" />}
            {boardMode === '3d' ? '2D' : '3D'}
          </button>
          <button type="button" onClick={onSettings} className={ICON_BUTTON} aria-label="Settings">
            <Settings className="w-4 h-4 text-[var(--gold)]" />
          </button>
        </div>
      </div>
    </header>
  );
}

export type Tab = 'cards' | 'notes' | 'log' | 'chat';

export function BottomNav({ onOpen, cards, unread, alert }: { onOpen: (t: Tab) => void; cards: number; unread: number; alert: boolean }) {
  const items: Array<{ tab: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
    { tab: 'cards', label: 'Cards', icon: <WalletCards className="w-5 h-5" />, badge: cards },
    { tab: 'notes', label: 'Notes', icon: <NotebookPen className="w-5 h-5" /> },
    { tab: 'log', label: 'Log', icon: <ScrollText className="w-5 h-5" /> },
    { tab: 'chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" />, badge: unread || undefined },
  ];
  return (
    <nav className="ga-nav panel !border-x-0 !border-b-0 safe-bottom" aria-label="Game panels">
      <div className="grid grid-cols-4 pt-1">
        {items.map((it) => (
          <button
            key={it.tab}
            type="button"
            onClick={() => onOpen(it.tab)}
            className="relative h-12 flex flex-col items-center justify-center gap-0.5 text-[var(--muted)] hover:text-[var(--parchment)] active:scale-95"
          >
            <span className="relative text-[var(--gold)]">
              {it.icon}
              {it.badge !== undefined && (
                <span
                  className={`absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-mono font-bold leading-4 text-center ${
                    it.tab === 'chat' || (it.tab === 'cards' && alert) ? 'bg-[var(--crimson-light)] text-white' : 'bg-[var(--gold)] text-[#1f120a]'
                  }`}
                >
                  {it.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-deco font-bold uppercase tracking-[0.14em]">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function Toggle({ on, onChange, label, icon, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; icon: React.ReactNode; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-[var(--gold)]/20 text-left"
    >
      <span className="text-[var(--gold)]">{icon}</span>
      <span className="flex-1">
        <span className="block font-deco font-bold text-sm">{label}</span>
        {hint && <span className="block text-sm italic text-[var(--muted)]">{hint}</span>}
      </span>
      <span className={`relative w-12 h-7 rounded-full transition-colors ${on ? 'bg-[var(--gold)]' : 'bg-[var(--mahogany-3)]'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-[var(--parchment)] shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function SettingsSheet({
  boardMode,
  setBoardMode,
  onRules,
  onLeave,
  onClose,
}: {
  boardMode: BoardMode;
  setBoardMode: (m: BoardMode) => void;
  onRules: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const prefs = usePrefs();
  return (
    <Modal title="Settings" icon={<Settings className="w-5 h-5" />} onClose={onClose}>
      <Toggle on={prefs.sound} onChange={prefs.setSound} label="Sound" icon={prefs.sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />} />
      <Toggle on={prefs.buzz} onChange={prefs.setBuzz} label="Vibrate" hint="On your turn, and when you must show a card." icon={<Vibrate className="w-5 h-5" />} />
      <div className="p-3 rounded-xl bg-black/20 border border-[var(--gold)]/20 space-y-2">
        <div className="font-deco font-bold text-sm">Board</div>
        <div className="flex rounded-xl bg-[var(--ink)]/80 p-1 border border-[var(--gold)]/30">
          {(['3d', '2d'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={boardMode === m}
              onClick={() => setBoardMode(m)}
              className={`flex-1 min-h-10 rounded-lg font-deco font-bold text-xs uppercase tracking-[0.14em] ${
                boardMode === m ? 'bg-[linear-gradient(180deg,#f6dd8a,#d4af37)] text-[#1f120a]' : 'text-[var(--muted)]'
              }`}
            >
              {m === '3d' ? '3D table' : 'Flat plan'}
            </button>
          ))}
        </div>
        <p className="text-sm italic text-[var(--muted)]">The flat plan is lighter on older phones.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onRules}>
          <BookOpen className="w-4 h-4" /> How to play
        </Button>
        <button
          type="button"
          aria-label="Leave game"
          onClick={() => {
            if (window.confirm('Leave this game? Your seat stays, and you can rejoin from the home screen.')) onLeave();
          }}
          className="min-h-11 px-4 rounded-xl font-deco font-bold text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 text-red-200 border border-red-900/70 hover:bg-red-950/50"
        >
          <LogOut className="w-4 h-4" /> Leave game
        </button>
      </div>
    </Modal>
  );
}
