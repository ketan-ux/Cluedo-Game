import {
  ALL_ROOMS,
  ALL_SUSPECTS,
  ALL_WEAPONS,
  Card,
  DisprovedCardPayload,
  GameLogEntry,
  GameState,
  MaskedGameState,
  MaskedPlayer,
  Player,
  Position,
  Room,
  SECRET_PASSAGES,
  SuggestionPayload,
  Suspect,
  SUSPECT_STARTING_POSITIONS,
  Weapon,
} from '../types/cluedo';
import { createDeck, getCardById } from './assets';
import { calculateValidMoves, getDoorwayTarget, ROOM_DEFINITIONS } from './boardGrid';

// Utility to shuffle an array immutably
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function initializeGame(
  playerConfigs: Array<{
    peerId: string;
    character: Suspect;
    name: string;
    isHost: boolean;
    isAi?: boolean;
  }>,
  roomCode: string
): GameState {
  if (playerConfigs.length < 2) {
    throw new Error('Cluedo requires at least 2 players to start a match.');
  }

  // 1. Create and isolate the Murder Envelope
  const deck = createDeck();
  const suspectCards = shuffle(deck.filter((c) => c.type === 'SUSPECT'));
  const weaponCards = shuffle(deck.filter((c) => c.type === 'WEAPON'));
  const roomCards = shuffle(deck.filter((c) => c.type === 'ROOM'));

  const envelope = {
    suspect: suspectCards[0].name as Suspect,
    weapon: weaponCards[0].name as Weapon,
    room: roomCards[0].name as Room,
  };

  // 2. Remaining 18 cards to be dealt
  const remainingCards = shuffle([
    ...suspectCards.slice(1),
    ...weaponCards.slice(1),
    ...roomCards.slice(1),
  ]);

  // 3. Setup players and distribute hands
  const players: Player[] = playerConfigs.map((cfg) => ({
    peerId: cfg.peerId,
    character: cfg.character,
    name: cfg.name,
    isHost: cfg.isHost,
    isAi: !!cfg.isAi,
    position: {
      x: SUSPECT_STARTING_POSITIONS[cfg.character].x,
      y: SUSPECT_STARTING_POSITIONS[cfg.character].y,
      room: null,
    },
    hand: [],
    hasAccusedWrongly: false,
    isConnected: true,
    startingPosition: SUSPECT_STARTING_POSITIONS[cfg.character],
  }));

  // Deal cards round-robin
  let pIdx = 0;
  for (const card of remainingCards) {
    players[pIdx % players.length].hand.push(card);
    pIdx++;
  }

  // 4. Randomize initial weapon placements among rooms
  const shuffledRooms = shuffle(ALL_ROOMS);
  const weaponPositions: Record<Weapon, Room> = {} as Record<Weapon, Room>;
  ALL_WEAPONS.forEach((w, idx) => {
    weaponPositions[w] = shuffledRooms[idx % shuffledRooms.length];
  });

  // 5. Turn Order: Miss Scarlet always starts if present, else player 0
  let scarletIndex = players.findIndex((p) => p.character === 'Miss Scarlet');
  const activePlayerIndex = scarletIndex >= 0 ? scarletIndex : 0;

  const initialLogs: GameLogEntry[] = [
    {
      id: `log_init_${Date.now()}`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      message: `The investigation begins at Tudor Close Manor. Murder envelope sealed secretly.`,
    },
    {
      id: `log_first_${Date.now() + 1}`,
      timestamp: Date.now() + 1,
      type: 'SYSTEM',
      message: `${players[activePlayerIndex].name} (${players[activePlayerIndex].character}) holds the first turn!`,
      playerPeerId: players[activePlayerIndex].peerId,
      playerName: players[activePlayerIndex].name,
      playerCharacter: players[activePlayerIndex].character,
    },
  ];

  return {
    roomCode,
    phase: 'ROLL',
    envelope,
    players,
    activePlayerIndex,
    diceRoll: null,
    remainingSteps: 0,
    currentSuggestion: null,
    pendingDisproverIndex: null,
    winner: null,
    weaponPositions,
    turnNumber: 1,
    lastDisprovedCardForSuggester: null,
    logs: initialLogs,
    validMoves: [],
    turnHasSuggested: false,
  };
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== 'ROLL' || state.winner) return state;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;

  const activePlayer = state.players[state.activePlayerIndex];
  const occupied = state.players.map((p) => p.position);
  const validMoves = calculateValidMoves(activePlayer.position, total, occupied);

  const log: GameLogEntry = {
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'ROLL',
    message: `${activePlayer.name} rolled [${d1}, ${d2}] for a total of ${total} steps.`,
    playerPeerId: activePlayer.peerId,
    playerName: activePlayer.name,
    playerCharacter: activePlayer.character,
  };

  return {
    ...state,
    diceRoll: [d1, d2],
    remainingSteps: total,
    validMoves,
    phase: 'MOVE',
    logs: [...state.logs, log],
  };
}

export function moveToken(state: GameState, targetX: number, targetY: number): GameState {
  if (state.phase !== 'MOVE' || state.winner) return state;

  const activePlayer = state.players[state.activePlayerIndex];
  const valid = state.validMoves?.find((m) => m.x === targetX && m.y === targetY);

  if (!valid) {
    throw new Error(`Invalid move coordinate (${targetX}, ${targetY})`);
  }

  const doorwayRoom = getDoorwayTarget(targetX, targetY);
  const targetRoom = doorwayRoom || null;

  const newPosition: Position = {
    x: targetX,
    y: targetY,
    room: targetRoom,
  };

  const updatedPlayers = state.players.map((p, idx) =>
    idx === state.activePlayerIndex ? { ...p, position: newPosition } : p
  );

  const logs = [...state.logs];

  if (targetRoom) {
    logs.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      type: 'MOVE',
      message: `${activePlayer.name} stepped through the doorway into the ${targetRoom}!`,
      playerPeerId: activePlayer.peerId,
      playerName: activePlayer.name,
      playerCharacter: activePlayer.character,
    });

    // Stepping into a room immediately consumes remaining steps and opens the suggestion window
    return {
      ...state,
      players: updatedPlayers,
      remainingSteps: 0,
      validMoves: [],
      phase: 'SUGGEST',
      logs,
    };
  } else {
    logs.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      type: 'MOVE',
      message: `${activePlayer.name} moved to corridor (${targetX}, ${targetY}).`,
      playerPeerId: activePlayer.peerId,
      playerName: activePlayer.name,
      playerCharacter: activePlayer.character,
    });

    return {
      ...state,
      players: updatedPlayers,
      remainingSteps: 0,
      validMoves: [],
      phase: 'ACCUSE',
      logs,
    };
  }
}

export function useSecretPassage(state: GameState, targetRoom: Room): GameState {
  if (state.phase !== 'ROLL' || state.winner) return state;

  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.position.room) {
    throw new Error('Must be inside a room to use a secret passage');
  }

  const allowedTarget = SECRET_PASSAGES[activePlayer.position.room];
  if (allowedTarget !== targetRoom) {
    throw new Error(`Secret passage from ${activePlayer.position.room} does not lead to ${targetRoom}`);
  }

  const targetRoomDef = ROOM_DEFINITIONS[targetRoom];
  const newPosition: Position = {
    x: targetRoomDef.center.x,
    y: targetRoomDef.center.y,
    room: targetRoom,
  };

  const updatedPlayers = state.players.map((p, idx) =>
    idx === state.activePlayerIndex ? { ...p, position: newPosition } : p
  );

  const log: GameLogEntry = {
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'PASSAGE',
    message: `${activePlayer.name} slipped through the secret passage from ${activePlayer.position.room} to ${targetRoom}!`,
    playerPeerId: activePlayer.peerId,
    playerName: activePlayer.name,
    playerCharacter: activePlayer.character,
  };

  return {
    ...state,
    players: updatedPlayers,
    phase: 'SUGGEST',
    remainingSteps: 0,
    validMoves: [],
    logs: [...state.logs, log],
  };
}

export function makeSuggestion(
  state: GameState,
  suspect: Suspect,
  weapon: Weapon
): { state: GameState; requiresDisprove: boolean } {
  if (state.phase !== 'SUGGEST' || state.winner) {
    return { state, requiresDisprove: false };
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const currentRoom = activePlayer.position.room;
  if (!currentRoom) {
    throw new Error('Cannot make a suggestion outside of a room');
  }

  // 1. Teleport the accused suspect to this room
  const targetRoomDef = ROOM_DEFINITIONS[currentRoom];
  const updatedPlayers = state.players.map((p) => {
    if (p.character === suspect) {
      return {
        ...p,
        position: {
          x: targetRoomDef.center.x,
          y: targetRoomDef.center.y,
          room: currentRoom,
        },
      };
    }
    return p;
  });

  // 2. Teleport the weapon token to this room
  const updatedWeapons = {
    ...state.weaponPositions,
    [weapon]: currentRoom,
  };

  const suggestionPayload: SuggestionPayload = {
    suggesterPeerId: activePlayer.peerId,
    suggesterName: activePlayer.name,
    suggesterCharacter: activePlayer.character,
    suspect,
    weapon,
    room: currentRoom,
  };

  const suggestLog: GameLogEntry = {
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'SUGGEST',
    message: `${activePlayer.name} suggests: "It was ${suspect}, in the ${currentRoom}, with the ${weapon}!"`,
    playerPeerId: activePlayer.peerId,
    playerName: activePlayer.name,
    playerCharacter: activePlayer.character,
  };

  // 3. Query players clockwise starting with player to the left
  let disproverIndex: number | null = null;
  const numPlayers = updatedPlayers.length;

  for (let offset = 1; offset < numPlayers; offset++) {
    const checkIndex = (state.activePlayerIndex + offset) % numPlayers;
    const opponent = updatedPlayers[checkIndex];

    const hasMatchingCard = opponent.hand.some(
      (card) => card.name === suspect || card.name === weapon || card.name === currentRoom
    );

    if (hasMatchingCard) {
      disproverIndex = checkIndex;
      break;
    }
  }

  if (disproverIndex !== null) {
    // A player can disprove
    const disprover = updatedPlayers[disproverIndex];
    const promptLog: GameLogEntry = {
      id: `log_${Date.now() + 1}`,
      timestamp: Date.now() + 1,
      type: 'SYSTEM',
      message: `Waiting for ${disprover.name} to reveal a card to disprove the suggestion...`,
      playerPeerId: disprover.peerId,
      playerName: disprover.name,
      playerCharacter: disprover.character,
    };

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      weaponPositions: updatedWeapons,
      currentSuggestion: suggestionPayload,
      pendingDisproverIndex: disproverIndex,
      phase: 'DISPROVE',
      turnHasSuggested: true,
      logs: [...state.logs, suggestLog, promptLog],
    };

    return { state: nextState, requiresDisprove: true };
  } else {
    // Nobody could disprove
    const noDisproveLog: GameLogEntry = {
      id: `log_${Date.now() + 1}`,
      timestamp: Date.now() + 1,
      type: 'NO_DISPROVE',
      message: `Nobody was able to disprove ${activePlayer.name}'s suggestion!`,
    };

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      weaponPositions: updatedWeapons,
      currentSuggestion: null,
      pendingDisproverIndex: null,
      phase: 'ACCUSE',
      turnHasSuggested: true,
      logs: [...state.logs, suggestLog, noDisproveLog],
    };

    return { state: nextState, requiresDisprove: false };
  }
}

export function disproveCard(
  state: GameState,
  disproverPeerId: string,
  cardId: string
): { state: GameState; revealedCard: Card } {
  if (state.phase !== 'DISPROVE' || !state.currentSuggestion) {
    throw new Error('Not currently in a disprove phase');
  }

  const disprover = state.players.find((p) => p.peerId === disproverPeerId);
  if (!disprover) {
    throw new Error(`Disprover player not found: ${disproverPeerId}`);
  }

  const card = disprover.hand.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Player does not possess card ${cardId}`);
  }

  const suggestion = state.currentSuggestion;
  const isMatch =
    card.name === suggestion.suspect ||
    card.name === suggestion.weapon ||
    card.name === suggestion.room;

  if (!isMatch) {
    throw new Error(`Selected card ${card.name} does not match any element of the suggestion`);
  }

  const suggester = state.players.find((p) => p.peerId === suggestion.suggesterPeerId)!;

  const publicLog: GameLogEntry = {
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'DISPROVE',
    message: `${disprover.name} showed 1 card privately to ${suggester.name}.`,
    playerPeerId: disprover.peerId,
    playerName: disprover.name,
    playerCharacter: disprover.character,
  };

  const payload: DisprovedCardPayload = {
    card,
    disproverPeerId: disprover.peerId,
    disproverName: disprover.name,
    suggesterPeerId: suggester.peerId,
  };

  const nextState: GameState = {
    ...state,
    phase: 'ACCUSE',
    currentSuggestion: null,
    pendingDisproverIndex: null,
    lastDisprovedCardForSuggester: payload,
    logs: [...state.logs, publicLog],
  };

  return { state: nextState, revealedCard: card };
}

export function makeAccusation(
  state: GameState,
  suspect: Suspect,
  weapon: Weapon,
  room: Room
): GameState {
  if (state.winner) return state;

  const activePlayer = state.players[state.activePlayerIndex];
  const envelope = state.envelope;

  const isCorrect =
    envelope.suspect === suspect &&
    envelope.weapon === weapon &&
    envelope.room === room;

  if (isCorrect) {
    // Instant Win!
    const winLog: GameLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      type: 'WIN',
      message: `SOLVED! ${activePlayer.name} correctly accused: ${suspect} in the ${room} with the ${weapon}! Case Closed!`,
      playerPeerId: activePlayer.peerId,
      playerName: activePlayer.name,
      playerCharacter: activePlayer.character,
    };

    return {
      ...state,
      winner: activePlayer,
      phase: 'GAME_OVER',
      logs: [...state.logs, winLog],
    };
  } else {
    // Incorrect Accusation: Player eliminated from turns
    const failLog: GameLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      type: 'FAIL_ACCUSE',
      message: `WRONG ACCUSATION! ${activePlayer.name} accused ${suspect} in ${room} with ${weapon}. They have been permanently eliminated from solving the crime!`,
      playerPeerId: activePlayer.peerId,
      playerName: activePlayer.name,
      playerCharacter: activePlayer.character,
    };

    const updatedPlayers = state.players.map((p, idx) =>
      idx === state.activePlayerIndex ? { ...p, hasAccusedWrongly: true } : p
    );

    // Check if all players are eliminated
    const remainingActive = updatedPlayers.filter((p) => !p.hasAccusedWrongly);
    if (remainingActive.length === 0) {
      const allFailLog: GameLogEntry = {
        id: `log_${Date.now() + 1}`,
        timestamp: Date.now() + 1,
        type: 'SYSTEM',
        message: `All detectives failed their accusations! The murderer (${envelope.suspect} in the ${envelope.room} with the ${envelope.weapon}) escaped unpunished!`,
      };

      return {
        ...state,
        players: updatedPlayers,
        phase: 'GAME_OVER',
        logs: [...state.logs, failLog, allFailLog],
      };
    }

    // Advance turn to next non-eliminated player
    return endTurn({
      ...state,
      players: updatedPlayers,
      logs: [...state.logs, failLog],
    });
  }
}

export function endTurn(state: GameState): GameState {
  if (state.winner || state.phase === 'GAME_OVER') return state;

  const numPlayers = state.players.length;
  let nextIndex = (state.activePlayerIndex + 1) % numPlayers;

  // Skip players who have wrongly accused unless all are eliminated
  let attempts = 0;
  while (state.players[nextIndex].hasAccusedWrongly && attempts < numPlayers) {
    nextIndex = (nextIndex + 1) % numPlayers;
    attempts++;
  }

  const nextPlayer = state.players[nextIndex];
  const nextLog: GameLogEntry = {
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    type: 'SYSTEM',
    message: `Turn ${state.turnNumber + 1}: It is now ${nextPlayer.name}'s (${nextPlayer.character}) turn.`,
    playerPeerId: nextPlayer.peerId,
    playerName: nextPlayer.name,
    playerCharacter: nextPlayer.character,
  };

  return {
    ...state,
    activePlayerIndex: nextIndex,
    turnNumber: state.turnNumber + 1,
    phase: 'ROLL',
    diceRoll: null,
    remainingSteps: 0,
    currentSuggestion: null,
    pendingDisproverIndex: null,
    validMoves: [],
    turnHasSuggested: false,
    lastDisprovedCardForSuggester: null,
    logs: [...state.logs, nextLog],
  };
}

/**
 * Strips confidential envelope & opponent hands from state before transmitting across WebRTC.
 */
export function maskStateForPeer(masterState: GameState, recipientPeerId: string): MaskedGameState {
  const maskedPlayers: MaskedPlayer[] = masterState.players.map((p) => {
    const isMe = p.peerId === recipientPeerId;
    return {
      peerId: p.peerId,
      character: p.character,
      name: p.name,
      isHost: p.isHost,
      isAi: p.isAi,
      position: p.position,
      startingPosition: p.startingPosition,
      cardCount: p.hand.length,
      hand: isMe ? p.hand : undefined,
      hasAccusedWrongly: p.hasAccusedWrongly,
      isConnected: p.isConnected,
    };
  });

  const winner: MaskedPlayer | null = masterState.winner
    ? {
        peerId: masterState.winner.peerId,
        character: masterState.winner.character,
        name: masterState.winner.name,
        isHost: masterState.winner.isHost,
        isAi: masterState.winner.isAi,
        position: masterState.winner.position,
        startingPosition: masterState.winner.startingPosition,
        cardCount: masterState.winner.hand.length,
        hasAccusedWrongly: masterState.winner.hasAccusedWrongly,
        isConnected: masterState.winner.isConnected,
      }
    : null;

  // Only the suggester sees their disproved card payload in state
  const isSuggester = masterState.lastDisprovedCardForSuggester?.suggesterPeerId === recipientPeerId;
  const filteredDisprovedCard = isSuggester ? masterState.lastDisprovedCardForSuggester : null;

  return {
    roomCode: masterState.roomCode,
    phase: masterState.phase,
    players: maskedPlayers,
    activePlayerIndex: masterState.activePlayerIndex,
    diceRoll: masterState.diceRoll,
    remainingSteps: masterState.remainingSteps,
    currentSuggestion: masterState.currentSuggestion,
    pendingDisproverIndex: masterState.pendingDisproverIndex,
    winner,
    weaponPositions: masterState.weaponPositions,
    turnNumber: masterState.turnNumber,
    lastDisprovedCardForSuggester: filteredDisprovedCard,
    logs: masterState.logs,
    validMoves: masterState.players[masterState.activePlayerIndex]?.peerId === recipientPeerId ? masterState.validMoves : [],
    turnHasSuggested: masterState.turnHasSuggested,
  };
}
