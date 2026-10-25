import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, BookOpen, LogOut, Square as SquareIcon, WifiOff } from 'lucide-react';
import { CardName } from '../game/constants';
import { Envelope, GameEvent } from '../game/engine';
import { AnyAction, RoomView } from '../game/protocol';
import { EventBatch } from '../net/useRoom';
import { sounds } from '../utils/audio';
import { BoardView, useBoardMode } from './board/BoardView';
import { DiceBadge, SuggestionBanner, Toast, Toasts } from './game/Overlays';
import { ActionBar, PlayersStrip, SidePanel } from './game/Panels';
import { DetectiveNotebook } from './ui/DetectiveNotebook';
import {
  AccusationModal,
  AccusationResultModal,
  CardRevealModal,
  DisproveModal,
  GameOverModal,
  SuggestionModal,
  UnrefutedModal,
} from './ui/GameDialogs';
import { HandTray } from './ui/HandTray';

interface GameScreenProps {
  room: RoomView;
  batch: EventBatch;
  connected: boolean;
  act: (action: AnyAction) => void;
  onLeave: () => void;
}

type Popup =
  | { kind: 'reveal'; card: CardName; otherName: string }
  | { kind: 'unrefuted'; suggestion: Envelope }
  | { kind: 'accused'; accuserName: string; isMe: boolean; accusation: Envelope; envelope?: Envelope };

export function GameScreen({ room, batch, connected, act, onLeave }: GameScreenProps) {
  const game = room.game!;
  const me = game.me;
  const myId = room.youId;
  const isHost = room.hostId === myId;
  const name = useCallback((id: string) => game.players.find((p) => p.id === id)?.name ?? 'Someone', [game.players]);

  const [notebook, setNotebook] = useState(false);
  const [accusing, setAccusing] = useState<Partial<Envelope> | null>(null);
  const [suggestDismissed, setSuggestDismissed] = useState<number | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rolling, setRolling] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [boardMode, setBoardMode] = useBoardMode();
  const handled = useRef(batch.id);

  // A pending tap-selection only makes sense for the current set of moves.
  useEffect(() => {
    setSelected(null);
  }, [game.turn.number, game.turn.stage]);

  // Let the envelope open on the table before the result covers it.
  useEffect(() => {
    if (game.phase !== 'over') {
      setShowGameOver(false);
      return;
    }
    const t = setTimeout(() => setShowGameOver(true), boardMode === '3d' ? 2200 : 400);
    return () => clearTimeout(t);
  }, [game.phase, boardMode]);

  const move = (target: string) => {
    setSelected(null);
    act({ type: 'move', target });
  };
  const pick = (target: string, pointer: 'mouse' | 'touch') => {
    if (pointer === 'mouse' || selected === target) move(target);
    else setSelected(target);
  };

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Turn server events into animations, sounds and pop-ups, once each.
  useEffect(() => {
    if (batch.id === handled.current) return;
    handled.current = batch.id;
    for (const e of batch.events as GameEvent[]) {
      switch (e.type) {
        case 'turn':
          if (e.playerId === myId) {
            sounds.playDoorCreak();
            toast('Your turn!');
          }
          break;
        case 'rolled':
          sounds.playDiceRoll();
          setRolling(true);
          setTimeout(() => setRolling(false), 700);
          break;
        case 'moved':
          if (e.how === 'walk' && e.path.length) {
            sounds.playPawnStep();
          } else if (e.how === 'passage') {
            sounds.playDoorCreak();
            toast(`${e.suspect} took a secret passage.`);
          } else if (e.how === 'summoned' && e.to.type === 'room') {
            toast(`${e.suspect} was brought into the ${e.to.room}.`);
          }
          break;
        case 'cardShown':
          if (e.card && e.toId === myId) {
            setPopups((p) => [...p, { kind: 'reveal', card: e.card!, otherName: name(e.fromId) }]);
          } else if (e.card && e.fromId === myId) {
            toast(`You showed ${name(e.toId)} the ${e.card}.`);
          } else {
            toast(`${name(e.fromId)} showed ${name(e.toId)} a card.`);
          }
          break;
        case 'unrefuted':
          if (e.playerId === myId && game.turn.suggestion) {
            const s = game.turn.suggestion;
            setPopups((p) => [...p, { kind: 'unrefuted', suggestion: { suspect: s.suspect, weapon: s.weapon, room: s.room } }]);
          } else {
            toast(`No one could disprove ${name(e.playerId)}!`);
          }
          break;
        case 'accused':
          if (!e.correct) {
            setPopups((p) => [
              ...p,
              {
                kind: 'accused',
                accuserName: name(e.playerId),
                isMe: e.playerId === myId,
                accusation: { suspect: e.suspect, weapon: e.weapon, room: e.room },
                envelope: e.envelope,
              },
            ]);
          }
          break;
      }
    }
  }, [batch, myId, name, toast, game.turn.suggestion]);

  const closePopup = () => setPopups((p) => p.slice(1));
  const popup = popups[0];
  const options = game.options;
  const suggestion = game.turn.suggestion;
  const showSuggestModal = !!options.suggestIn && suggestDismissed !== game.turn.number;

  const hand = me?.hand ?? [];
  const handTray = <HandTray hand={hand} onOpenNotebook={() => setNotebook(true)} />;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0d0705] text-[#f4ecd8] overflow-hidden">
      <header className="h-11 shrink-0 px-3 flex items-center justify-between gap-2 border-b border-[#3d2315] bg-[#1a0e08]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-deco font-black tracking-widest text-[#d4af37]">CLUEDO</span>
          <span className="text-[11px] font-mono text-[#baa479] truncate">Room {room.code}</span>
          {!connected && (
            <span className="flex items-center gap-1 text-[11px] text-red-300">
              <WifiOff className="w-3.5 h-3.5" /> Reconnecting…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setBoardMode(boardMode === '3d' ? '2d' : '3d')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2b170e] border border-[#d4af37]/40 text-[11px] font-bold"
            aria-label={boardMode === '3d' ? 'Switch to the flat 2D board' : 'Switch to the 3D board'}
          >
            {boardMode === '3d' ? <SquareIcon className="w-3.5 h-3.5 text-[#d4af37]" /> : <Box className="w-3.5 h-3.5 text-[#d4af37]" />}
            {boardMode === '3d' ? '2D' : '3D'}
          </button>
          <button
            onClick={() => setNotebook(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2b170e] border border-[#d4af37]/60 text-xs font-bold"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" /> Notebook
          </button>
          <button
            onClick={() => {
              if (window.confirm('Leave this game? Your seat stays, and you can rejoin from the home screen.')) onLeave();
            }}
            className="p-2 rounded-lg text-red-200 hover:bg-red-950/60"
            aria-label="Leave game"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <PlayersStrip room={room} />

      {room.away && (
        <AwayBanner name={name(room.away.memberId)} deadline={room.away.deadline} stage={game.turn.stage} />
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2 overflow-y-auto lg:overflow-hidden">
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col gap-2 overflow-y-auto">{handTray}</aside>

        <section className="flex flex-col gap-2 shrink-0 lg:shrink lg:min-h-0 lg:flex-1 items-center">
          <div className="relative w-full aspect-[248/258] max-h-[52dvh] lg:max-h-none lg:aspect-auto lg:flex-1 lg:min-h-0">
            <BoardView
              mode={boardMode}
              onUnsupported={() => setBoardMode('2d')}
              game={game}
              myId={myId}
              batch={batch}
              selected={selected}
              onPick={pick}
              onPassage={() => act({ type: 'passage' })}
            />
            <SuggestionBanner suggestion={suggestion} players={game.players} />
            {boardMode === '2d' && <DiceBadge roll={game.turn.roll} rolling={rolling} />}
          </div>
          <div className="w-full lg:max-w-3xl">
            <ActionBar
              room={room}
              selected={selected}
              onMove={move}
              onClearSelection={() => setSelected(null)}
              onRoll={() => act({ type: 'roll' })}
              onPassage={() => act({ type: 'passage' })}
              onSuggest={() => setSuggestDismissed(null)}
              onAccuse={() => setAccusing({})}
              onEndTurn={() => act({ type: 'endTurn' })}
              onNotebook={() => setNotebook(true)}
            />
          </div>
        </section>

        <aside className="flex-1 min-h-[14rem] lg:flex-none lg:w-96 lg:min-h-0">
          <div className="h-full lg:hidden">
            <SidePanel room={room} onChat={(text) => act({ type: 'chat', text })} hand={handTray} />
          </div>
          <div className="h-full hidden lg:block">
            <SidePanel room={room} onChat={(text) => act({ type: 'chat', text })} />
          </div>
        </aside>
      </main>

      <Toasts toasts={toasts} />

      {/* Showing a card is compulsory, so it comes first. */}
      {options.show.length > 0 && suggestion ? (
        <DisproveModal
          key={`${suggestion.turn}`}
          suggesterName={name(suggestion.suggesterId)}
          suggestion={suggestion}
          cards={options.show}
          onShow={(card) => act({ type: 'show', card })}
        />
      ) : popup?.kind === 'reveal' ? (
        <CardRevealModal card={popup.card} otherName={popup.otherName} direction="received" onClose={closePopup} />
      ) : popup?.kind === 'accused' ? (
        <AccusationResultModal {...popup} onClose={closePopup} />
      ) : popup?.kind === 'unrefuted' ? (
        <UnrefutedModal
          suggestion={popup.suggestion}
          hand={hand}
          canAccuse={options.accuse}
          onClose={closePopup}
          onAccuse={() => {
            setAccusing(popup.suggestion);
            closePopup();
          }}
        />
      ) : game.phase === 'over' && game.envelope && showGameOver ? (
        <GameOverModal
          winnerName={game.winnerId ? name(game.winnerId) : null}
          winnerSuspect={game.players.find((p) => p.id === game.winnerId)?.suspect}
          envelope={game.envelope}
          isHost={isHost}
          onRematch={() => act({ type: 'rematch' })}
          onLeave={onLeave}
        />
      ) : accusing ? (
        <AccusationModal
          hand={hand}
          initial={accusing}
          onClose={() => setAccusing(null)}
          onAccuse={(e) => {
            setAccusing(null);
            act({ type: 'accuse', ...e });
          }}
        />
      ) : showSuggestModal && options.suggestIn ? (
        <SuggestionModal
          room={options.suggestIn}
          hand={hand}
          onClose={() => setSuggestDismissed(game.turn.number)}
          onSuggest={(suspect, weapon) => {
            setSuggestDismissed(game.turn.number);
            act({ type: 'suggest', suspect, weapon });
          }}
        />
      ) : null}

      {me && myId && (
        <DetectiveNotebook
          open={notebook}
          onClose={() => setNotebook(false)}
          roomCode={room.code}
          myId={myId}
          hand={hand}
          seen={me.seen}
          players={game.players}
        />
      )}
    </div>
  );
}

function AwayBanner({ name, deadline, stage }: { name: string; deadline: number; stage: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <div className="px-3 py-1.5 bg-red-950/70 border-b border-red-800/60 text-xs text-red-100 text-center">
      {name} has disconnected. {stage === 'disprove' ? 'A card will be shown for them' : 'Their turn will be skipped'} in {secs}s
      unless they return.
    </div>
  );
}
