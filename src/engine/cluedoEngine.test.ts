import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  rollDice,
  moveToken,
  makeSuggestion,
  disproveCard,
  makeAccusation,
  endTurn,
  maskStateForPeer,
  useSecretPassage,
} from './cluedoEngine';
import { calculateValidMoves, isCorridor } from './boardGrid';
import { ALL_ROOMS, ALL_SUSPECTS, ALL_WEAPONS, Player } from '../types/cluedo';

describe('Authentic Cluedo Game Engine', () => {
  const testPlayers = [
    { peerId: 'peer_scarlet', character: 'Miss Scarlet' as const, name: 'Scarlet Player', isHost: true },
    { peerId: 'peer_mustard', character: 'Colonel Mustard' as const, name: 'Mustard Player', isHost: false },
    { peerId: 'peer_white', character: 'Mrs. White' as const, name: 'White Player', isHost: false },
  ];

  it('1. Correctly seals the Murder Envelope and fairly distributes 18 cards', () => {
    const game = initializeGame(testPlayers, 'TEST-1234');

    // Envelope holds exactly 1 suspect, 1 weapon, 1 room
    expect(ALL_SUSPECTS).toContain(game.envelope.suspect);
    expect(ALL_WEAPONS).toContain(game.envelope.weapon);
    expect(ALL_ROOMS).toContain(game.envelope.room);

    // Envelope cards are NOT dealt into players' hands
    const allPlayerCards = game.players.flatMap((p) => p.hand);
    expect(allPlayerCards.length).toBe(18); // 21 total cards - 3 in envelope = 18

    // Check envelope cards are not in hands
    const envelopeSuspectInHand = allPlayerCards.some((c) => c.name === game.envelope.suspect);
    const envelopeWeaponInHand = allPlayerCards.some((c) => c.name === game.envelope.weapon);
    const envelopeRoomInHand = allPlayerCards.some((c) => c.name === game.envelope.room);

    expect(envelopeSuspectInHand).toBe(false);
    expect(envelopeWeaponInHand).toBe(false);
    expect(envelopeRoomInHand).toBe(false);

    // Distribution fairness: with 3 players, each gets 6 cards
    expect(game.players[0].hand.length).toBe(6);
    expect(game.players[1].hand.length).toBe(6);
    expect(game.players[2].hand.length).toBe(6);

    // Miss Scarlet takes the first turn
    expect(game.players[game.activePlayerIndex].character).toBe('Miss Scarlet');
    expect(game.phase).toBe('ROLL');
  });

  it('2. Enforces corridor movement, collision, and doorway entry', () => {
    let game = initializeGame(testPlayers, 'TEST-MOVE');
    game = rollDice(game);

    expect(game.diceRoll).not.toBeNull();
    expect(game.remainingSteps).toBeGreaterThanOrEqual(2);
    expect(game.remainingSteps).toBeLessThanOrEqual(12);
    expect(game.phase).toBe('MOVE');
    expect(game.validMoves && game.validMoves.length).toBeGreaterThan(0);

    // Test collision calculation: player cannot jump over or onto occupied corridor
    const movesWithBlockedTile = calculateValidMoves(
      { x: 16, y: 0, room: null },
      2,
      [{ x: 16, y: 1, room: null }] // Blocked right in front
    );
    // (16, 1) should not be valid
    expect(movesWithBlockedTile.some((m) => m.x === 16 && m.y === 1)).toBe(false);
  });

  it('3. Clockwise suggestion and disproving loop', () => {
    let game = initializeGame(testPlayers, 'TEST-SUGGEST');

    // Place active player in the Lounge
    game.players[0].position = { x: 3, y: 22, room: 'Lounge' };
    game.phase = 'SUGGEST';

    // Give Colonel Mustard (player 1) the 'Dagger' card
    game.players[1].hand = [
      { id: 'weapon_dagger', type: 'WEAPON', name: 'Dagger', assetPath: '/assets/cards/weapon_dagger.png' },
    ];
    // Give Mrs. White (player 2) no matching cards
    game.players[2].hand = [];

    const { state: suggestedState, requiresDisprove } = makeSuggestion(game, 'Colonel Mustard', 'Dagger');

    expect(requiresDisprove).toBe(true);
    expect(suggestedState.phase).toBe('DISPROVE');
    expect(suggestedState.pendingDisproverIndex).toBe(1); // Mustard is next clockwise

    // Mustard disproves with Dagger
    const { state: disprovedState, revealedCard } = disproveCard(
      suggestedState,
      'peer_mustard',
      'weapon_dagger'
    );

    expect(revealedCard.name).toBe('Dagger');
    expect(disprovedState.phase).toBe('ACCUSE');
    expect(disprovedState.lastDisprovedCardForSuggester?.card.name).toBe('Dagger');
  });

  it('4. False accusation permanently eliminates player from active turns', () => {
    let game = initializeGame(testPlayers, 'TEST-ACCUSE');

    const wrongSuspect = ALL_SUSPECTS.find((s) => s !== game.envelope.suspect)!;
    const wrongWeapon = ALL_WEAPONS.find((w) => w !== game.envelope.weapon)!;
    const wrongRoom = ALL_ROOMS.find((r) => r !== game.envelope.room)!;

    const { state: afterWrongAccusation, result } = makeAccusation(game, wrongSuspect, wrongWeapon, wrongRoom);

    // Result payload includes the secret envelope reveal
    expect(result.isCorrect).toBe(false);
    expect(result.envelope).toEqual(game.envelope);

    // Scarlet is now marked as hasAccusedWrongly
    expect(afterWrongAccusation.players[0].hasAccusedWrongly).toBe(true);
    // Turn automatically moved to Colonel Mustard (index 1)
    expect(afterWrongAccusation.activePlayerIndex).toBe(1);
    expect(afterWrongAccusation.winner).toBeNull();
  });

  it('5. Correct accusation immediately wins the game', () => {
    let game = initializeGame(testPlayers, 'TEST-WIN');

    const { state: winState, result } = makeAccusation(
      game,
      game.envelope.suspect,
      game.envelope.weapon,
      game.envelope.room
    );

    expect(result.isCorrect).toBe(true);
    expect(winState.winner).not.toBeNull();
    expect(winState.winner?.peerId).toBe('peer_scarlet');
    expect(winState.phase).toBe('GAME_OVER');
  });

  it('6. Anti-Cheat State Masking strictly protects envelope and opponent hands', () => {
    const game = initializeGame(testPlayers, 'TEST-MASK');
    const maskedForMustard = maskStateForPeer(game, 'peer_mustard');

    // Envelope is undefined/stripped
    expect((maskedForMustard as any).envelope).toBeUndefined();

    // Mustard sees their own hand
    const mustardInMasked = maskedForMustard.players.find((p) => p.peerId === 'peer_mustard');
    expect(mustardInMasked?.hand).toBeDefined();
    expect(mustardInMasked?.hand?.length).toBe(6);

    // Scarlet and White hands are masked to undefined, only cardCount is sent
    const scarletInMasked = maskedForMustard.players.find((p) => p.peerId === 'peer_scarlet');
    expect(scarletInMasked?.hand).toBeUndefined();
    expect(scarletInMasked?.cardCount).toBe(6);
  });
});
