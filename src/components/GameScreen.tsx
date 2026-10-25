import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CardName } from '../game/constants';
import { Envelope, GameEvent } from '../game/engine';
import { AnyAction, RoomView } from '../game/protocol';
import { EventBatch } from '../net/useRoom';
import { sounds } from '../utils/audio';
import { haptics } from '../utils/prefs';
import { BoardView, useBoardMode } from './board/BoardView';
import { BottomNav, SettingsSheet, Tab, TopBar } from './game/Chrome';
import { DiceBadge, SuggestionBanner, Toast, Toasts, TurnBanner } from './game/Overlays';
import { ActionBar, CaseLog, Chat, PlayersStrip, SidePanel, useUnread } from './game/Panels';
import { DetectiveNotes, useNotebook } from './ui/DetectiveNotebook';
import {
  AccusationModal,
  AccusationResultModal,
  CardRevealModal,
  DisproveModal,
  GameOverModal,
  SuggestionModal,
  UnrefutedModal,
} from './ui/GameDialogs';
import { CaseFile, HandFan } from './ui/HandTray';
import { Modal } from './ui/Modal';
import { RulesSheet } from './ui/RulesSheet';

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

  const [sheet, setSheet] = useState<Tab | 'settings' | 'rules' | null>(null);
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
            haptics.buzz([40, 60, 40]);
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
  const mustShow = options.show.length > 0 && !!suggestion;
  const unread = useUnread(room.chat.length, sheet === 'chat');
  const notebook = useNotebook(room.code, myId ?? 'spectator');

  // A buzz when someone is waiting on you to show a card.
  useEffect(() => {
    if (mustShow) haptics.buzz(90);
  }, [mustShow, suggestion?.turn]);

  const notes = me && myId && (
    <DetectiveNotes notebook={notebook} myId={myId} hand={hand} seen={me.seen} players={game.players} compact />
  );

  return (
    <div className="game-grid text-[var(--parchment)]">
      <TopBar
        code={room.code}
        connected={connected}
        boardMode={boardMode}
        onToggleBoard={() => setBoardMode(boardMode === '3d' ? '2d' : '3d')}
        onNotes={() => setSheet('notes')}
        onSettings={() => setSheet('settings')}
      />

      <div className="ga-players">
        <PlayersStrip room={room} />
      </div>

      {room.away && (
        <div className="ga-away">
          <AwayBanner name={name(room.away.memberId)} deadline={room.away.deadline} stage={game.turn.stage} />
        </div>
      )}

      {notes && <aside className="ga-notes flex-col overflow-y-auto p-2 pr-0">{notes}</aside>}

      <section className="ga-board px-1.5 sm:px-2">
        <div className="relative w-full h-full rounded-2xl overflow-hidden felt shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
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
          <TurnBanner game={game} youId={myId} />
          <Toasts toasts={toasts} />
        </div>
      </section>

      <div className="ga-dock px-1.5 sm:px-2 pt-1.5 pb-1.5">
        <div className="max-w-3xl mx-auto">
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
          />
        </div>
      </div>

      <div className="ga-hand justify-center">
        <HandFan hand={hand} />
      </div>

      <aside className="ga-side p-2 pl-0">
        <SidePanel room={room} onChat={(text) => act({ type: 'chat', text })} />
      </aside>

      <BottomNav onOpen={setSheet} cards={hand.length} unread={unread} alert={mustShow} />

      {sheet === 'cards' && me && (
        <Modal title="Case file" subtitle="Only you can see this." onClose={() => setSheet(null)} tall wide>
          <CaseFile hand={hand} seen={me.seen} shown={me.shown} players={game.players} />
        </Modal>
      )}
      {sheet === 'notes' && notes && (
        <Modal title="Detective notes" onClose={() => setSheet(null)} tall wide bodyClassName="!px-2 sm:!px-4">
          <DetectiveNotes notebook={notebook} myId={myId!} hand={hand} seen={me!.seen} players={game.players} titled={false} />
        </Modal>
      )}
      {sheet === 'log' && (
        <Modal title="Case log" onClose={() => setSheet(null)} tall wide>
          <CaseLog game={game} />
        </Modal>
      )}
      {sheet === 'chat' && (
        <Modal title="Chat" onClose={() => setSheet(null)} tall bodyClassName="flex flex-col">
          <Chat messages={room.chat} youId={myId} onSend={(text) => act({ type: 'chat', text })} />
        </Modal>
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          boardMode={boardMode}
          setBoardMode={setBoardMode}
          onRules={() => setSheet('rules')}
          onLeave={onLeave}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'rules' && <RulesSheet onClose={() => setSheet(null)} />}

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
    <div className="px-3 py-1.5 bg-red-950/80 border-y border-red-800/60 text-sm text-red-100 text-center">
      {name} has disconnected. {stage === 'disprove' ? 'A card will be shown for them' : 'Their turn will be skipped'} in {secs}s
      unless they return.
    </div>
  );
}
