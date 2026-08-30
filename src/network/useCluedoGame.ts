import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AccusationResultPayload,
  Card,
  DisprovedCardPayload,
  MaskedGameState,
  MaskedPlayer,
  NetworkPacket,
  Room,
  Suspect,
  Weapon,
} from '../types/cluedo';
import { P2PHostServer } from './p2pServer';
import { P2PGuestClient } from './p2pClient';
import { formatRoomCode, generateRoomCode, getHostPeerId } from './peerProtocol';
import { sounds } from '../utils/audio';

export function useCluedoGame() {
  const [maskedState, setMaskedState] = useState<MaskedGameState | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LOBBY' | 'IN_GAME' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [disprovedCardReveal, setDisprovedCardReveal] = useState<DisprovedCardPayload | null>(null);
  const [accusationReveal, setAccusationReveal] = useState<AccusationResultPayload | null>(null);

  const hostServerRef = useRef<P2PHostServer | null>(null);
  const guestClientRef = useRef<P2PGuestClient | null>(null);

  // Sync state handler
  const handleStateUpdate = useCallback((newState: MaskedGameState) => {
    setMaskedState(newState);
    if (newState.phase === 'LOBBY') {
      setStatus('LOBBY');
    } else {
      setStatus('IN_GAME');
    }
  }, []);

  // Private disproved reveal handler
  const handleDisprovedCardPrivate = useCallback((payload: DisprovedCardPayload) => {
    setDisprovedCardReveal(payload);
    sounds.playCardSlide();
  }, []);

  // Private accusation outcome & envelope reveal handler
  const handleAccusationResult = useCallback((payload: AccusationResultPayload) => {
    setAccusationReveal(payload);
    if (payload.isCorrect) {
      sounds.playVictoryFanfare();
    } else {
      sounds.playGavelBang();
    }
  }, []);

  // 1. Create Room as Host
  const createRoom = useCallback(
    (character: Suspect, playerName: string) => {
      const code = generateRoomCode();
      setRoomCode(code);
      setIsHost(true);
      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        if (hostServerRef.current) hostServerRef.current.destroy();
        if (guestClientRef.current) guestClientRef.current.destroy();

        const server = new P2PHostServer(code, { character, name: playerName }, {
          onStateUpdate: handleStateUpdate,
          onDisprovedCardPrivate: handleDisprovedCardPrivate,
          onAccusationResult: handleAccusationResult,
          onError: (err) => {
            setErrorMessage(err.message);
            setStatus('ERROR');
          },
        });

        hostServerRef.current = server;
        setMyPeerId(getHostPeerId(code));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to create host room');
        setStatus('ERROR');
      }
    },
    [handleStateUpdate, handleDisprovedCardPrivate, handleAccusationResult]
  );

  // 2. Join Room as Guest
  const joinRoom = useCallback(
    (inputCode: string, character: Suspect, playerName: string) => {
      const cleanCode = formatRoomCode(inputCode);
      if (!cleanCode) {
        setErrorMessage('Please provide a valid 6-character room code.');
        return;
      }

      setRoomCode(cleanCode);
      setIsHost(false);
      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        if (hostServerRef.current) hostServerRef.current.destroy();
        if (guestClientRef.current) guestClientRef.current.destroy();

        const client = new P2PGuestClient(cleanCode, playerName, character, {
          onStateUpdate: handleStateUpdate,
          onDisprovedCardPrivate: handleDisprovedCardPrivate,
          onAccusationResult: handleAccusationResult,
          onConnected: () => {
            setStatus('LOBBY');
          },
          onDisconnected: () => {
            console.log('[Game] Direct channel notice, background sync active');
          },
          onError: (err) => {
            console.warn('[Game] Network notice:', err);
          },
        });

        guestClientRef.current = client;
        setMyPeerId(client.myPeerId);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to join game');
        setStatus('ERROR');
      }
    },
    [handleStateUpdate, handleDisprovedCardPrivate, handleAccusationResult]
  );

  // Send packet routing
  const sendPacket = useCallback(
    (packet: NetworkPacket) => {
      if (isHost && hostServerRef.current) {
        hostServerRef.current.processPacket(myPeerId, packet);
      } else if (guestClientRef.current) {
        guestClientRef.current.sendPacket(packet);
      }
    },
    [isHost, myPeerId]
  );

  // Action methods
  const selectCharacter = useCallback(
    (char: Suspect) => {
      sendPacket({ type: 'SELECT_CHARACTER', payload: { character: char } });
    },
    [sendPacket]
  );

  const addAiBot = useCallback(
    (char: Suspect) => {
      sendPacket({ type: 'ADD_BOT', payload: { character: char } });
    },
    [sendPacket]
  );

  const removePlayer = useCallback(
    (peerIdToRemove: string) => {
      sendPacket({ type: 'REMOVE_PLAYER', payload: { peerId: peerIdToRemove } });
    },
    [sendPacket]
  );

  const startMatch = useCallback(() => {
    sendPacket({ type: 'START_MATCH' });
  }, [sendPacket]);

  const rollDice = useCallback(() => {
    sounds.playDiceRoll();
    sendPacket({ type: 'ROLL_DICE' });
  }, [sendPacket]);

  const moveToken = useCallback(
    (x: number, y: number) => {
      sounds.playPawnStep();
      sendPacket({ type: 'MOVE_TOKEN', payload: { x, y } });
    },
    [sendPacket]
  );

  const useSecretPassage = useCallback(
    (targetRoom: Room) => {
      sounds.playDoorCreak();
      sendPacket({ type: 'USE_SECRET_PASSAGE', payload: { targetRoom } });
    },
    [sendPacket]
  );

  const makeSuggestion = useCallback(
    (suspect: Suspect, weapon: Weapon) => {
      sendPacket({ type: 'MAKE_SUGGESTION', payload: { suspect, weapon } });
    },
    [sendPacket]
  );

  const disproveCard = useCallback(
    (cardId: string) => {
      sounds.playCardSlide();
      sendPacket({ type: 'DISPROVE_CARD', payload: { cardId } });
    },
    [sendPacket]
  );

  const makeAccusation = useCallback(
    (suspect: Suspect, weapon: Weapon, room: Room) => {
      sounds.playGavelBang();
      sendPacket({ type: 'MAKE_ACCUSATION', payload: { suspect, weapon, room } });
    },
    [sendPacket]
  );

  const endTurn = useCallback(() => {
    sendPacket({ type: 'END_TURN' });
  }, [sendPacket]);

  const sendChatMessage = useCallback(
    (text: string) => {
      sendPacket({ type: 'CHAT_MESSAGE', payload: { text } });
    },
    [sendPacket]
  );

  const leaveGame = useCallback(() => {
    if (hostServerRef.current) hostServerRef.current.destroy();
    if (guestClientRef.current) guestClientRef.current.destroy();
    setMaskedState(null);
    setStatus('IDLE');
    setRoomCode('');
    setErrorMessage('');
    setDisprovedCardReveal(null);
    setAccusationReveal(null);
  }, []);

  const closeDisprovedCardReveal = useCallback(() => {
    setDisprovedCardReveal(null);
  }, []);

  const closeAccusationReveal = useCallback(() => {
    setAccusationReveal(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hostServerRef.current) hostServerRef.current.destroy();
      if (guestClientRef.current) guestClientRef.current.destroy();
    };
  }, []);

  const myPlayer: MaskedPlayer | undefined = maskedState?.players.find(
    (p) => p.peerId === myPeerId
  );

  const myHand: Card[] = myPlayer?.hand || [];

  return {
    maskedState,
    isHost,
    myPeerId,
    myPlayer,
    myHand,
    roomCode,
    status,
    errorMessage,
    disprovedCardReveal,
    accusationReveal,
    actions: {
      createRoom,
      joinRoom,
      selectCharacter,
      addAiBot,
      removePlayer,
      startMatch,
      rollDice,
      moveToken,
      useSecretPassage,
      makeSuggestion,
      disproveCard,
      makeAccusation,
      endTurn,
      sendChatMessage,
      leaveGame,
      closeDisprovedCardReveal,
      closeAccusationReveal,
    },
  };
}
