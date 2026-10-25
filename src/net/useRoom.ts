import { useCallback, useEffect, useRef, useState } from 'react';
import { Suspect } from '../game/constants';
import { GameEvent } from '../game/engine';
import { AnyAction, normaliseRoomCode, RoomView } from '../game/protocol';
import { ConnectionStatus, createRoom, RoomClient } from './roomClient';
import { Session, sessions } from './session';

export interface EventBatch {
  id: number;
  events: GameEvent[];
}

function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('join');
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState({}, '', url.toString());
}

export function useRoom() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<EventBatch>({ id: 0, events: [] });
  const client = useRef<RoomClient | null>(null);
  const session = useRef<Session | null>(null);
  const latestRoom = useRef<RoomView | null>(null);
  latestRoom.current = room;

  const connect = useCallback((s: Session) => {
    client.current?.stop();
    session.current = s;
    setError(null);
    setRoomInUrl(s.code);
    client.current = new RoomClient(
      s.code,
      { name: s.name, suspect: s.suspect, token: s.token || undefined },
      {
        onStatus: setStatus,
        onMessage: (msg) => {
          if (msg.t === 'welcome') {
            session.current = { ...session.current!, token: msg.token };
            sessions.save(session.current);
          } else if (msg.t === 'state') {
            setRoom(msg.room);
            if (msg.events.length) setBatch((b) => ({ id: b.id + 1, events: msg.events }));
          } else if (msg.t === 'error') {
            setError(msg.message);
            if (msg.fatal) {
              sessions.clear();
              setRoom(null);
              setRoomInUrl(null);
            }
          } else if (msg.t === 'removed') {
            sessions.clear();
            setRoom(null);
            setRoomInUrl(null);
            setError('The host removed you from the room.');
          }
        },
      }
    );
  }, []);

  // A reload keeps you in your seat.
  useEffect(() => {
    const current = sessions.current();
    const inUrl = new URLSearchParams(window.location.search).get('room');
    if (current && (!inUrl || normaliseRoomCode(inUrl) === current.code)) connect(current);
    return () => client.current?.stop();
  }, [connect]);

  const create = useCallback(
    async (name: string, suspect: Suspect) => {
      setStatus('connecting');
      try {
        const code = await createRoom();
        connect({ code, token: '', name, suspect });
      } catch (err) {
        setStatus('idle');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [connect]
  );

  const join = useCallback(
    (rawCode: string, name: string, suspect: Suspect) => {
      const code = normaliseRoomCode(rawCode);
      const last = sessions.last();
      // Rejoining the same room under the same name on this device resumes that seat.
      const resume = last?.code === code && last.name === name;
      connect({ code, token: resume ? last.token : '', name, suspect });
    },
    [connect]
  );

  const resume = useCallback((s: Session) => connect(s), [connect]);

  const leave = useCallback(() => {
    client.current?.leave();
    client.current = null;
    // Leaving the lobby frees the seat; leaving a game keeps it so you can come back.
    if (!latestRoom.current || latestRoom.current.status === 'lobby' || !session.current?.token) {
      sessions.clear();
    } else {
      sessions.save(session.current);
      sessions.clearCurrent();
    }
    session.current = null;
    setRoom(null);
    setStatus('idle');
    setRoomInUrl(null);
  }, []);

  const act = useCallback((action: AnyAction) => client.current?.send(action), []);
  const clearError = useCallback(() => setError(null), []);

  return { room, status, error, batch, create, join, resume, leave, act, clearError };
}
