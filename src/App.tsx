import React, { useEffect } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useRoom } from './net/useRoom';
import { sessions } from './net/session';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { Recover } from './components/Recover';

export default function App() {
  const { room, status, error, batch, create, join, resume, leave, act, clearError } = useRoom();
  const connecting = status === 'connecting' || status === 'reconnecting';

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 5000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  let screen: React.ReactNode;
  if (room && room.status !== 'lobby' && room.game) {
    screen = <GameScreen room={room} batch={batch} connected={status === 'open'} act={act} onLeave={leave} />;
  } else if (room) {
    screen = <LobbyScreen room={room} act={act} onLeave={leave} />;
  } else if (connecting) {
    screen = (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 text-[#d4af37]">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="font-deco">Finding the room…</p>
        <button onClick={leave} className="text-xs text-[#baa479] underline">
          Cancel
        </button>
      </div>
    );
  } else {
    screen = <HomeScreen busy={connecting} lastSession={sessions.last()} onCreate={create} onJoin={join} onResume={resume} />;
  }

  return (
    <>
      <Recover>{screen}</Recover>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,28rem)] p-3 rounded-xl bg-red-950/95 border-2 border-red-600 text-red-100 shadow-2xl flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={clearError} className="p-1 rounded hover:bg-red-900" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
