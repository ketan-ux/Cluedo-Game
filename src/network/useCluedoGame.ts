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
import { formatRoomCode, generateRoomCode } from './peerProtocol';
import { clientTransport, TransportPacket } from './clientTransport';
import { HostController } from '../engine/hostController';
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

  const hostControllerRef = useRef<HostController | null>(null);
  const myPeerIdRef = useRef<string>('');
  const roomCodeRef = useRef<string>('');
  const isHostRef = useRef<boolean>(false);
  const joinWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const joinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  myPeerIdRef.current = myPeerId;
  roomCodeRef.current = roomCode;
  isHostRef.current = isHost;

  // Cleanup helper
  const teardownNetwork = useCallback(() => {
    if (joinWatchdogTimerRef.current) {
      clearTimeout(joinWatchdogTimerRef.current);
      joinWatchdogTimerRef.current = null;
    }
    if (joinIntervalRef.current) {
      clearInterval(joinIntervalRef.current);
      joinIntervalRef.current = null;
    }
    if (hostControllerRef.current) {
      hostControllerRef.current.destroy();
      hostControllerRef.current = null;
    }
    clientTransport.disconnect();
  }, []);

  // Update game state and handle sounds / transitions
  const applyStateUpdate = useCallback(
    (
      newState: MaskedGameState,
      disproved?: DisprovedCardPayload | null,
      accusation?: AccusationResultPayload | null
    ) => {
      setMaskedState(newState);
      if (newState.phase === 'LOBBY') {
        setStatus('LOBBY');
      } else {
        setStatus('IN_GAME');
      }

      if (disproved) {
        setDisprovedCardReveal(disproved);
        sounds.playCardSlide();
      }

      if (accusation) {
        setAccusationReveal(accusation);
        if (accusation.isCorrect) {
          sounds.playVictoryFanfare();
        } else {
          sounds.playGavelBang();
        }
      }
    },
    []
  );

  // Handle incoming packets from other players / host
  const handleIncomingPacket = useCallback(
    (packet: TransportPacket) => {
      const payload = packet.payload;
      if (!payload || typeof payload !== 'object') return;

      const currentPeerId = myPeerIdRef.current;
      const isCurrentHost = isHostRef.current;

      // 1. HOST: Process requests from guests
      if (isCurrentHost && hostControllerRef.current) {
        if (payload.type === 'JOIN_REQUEST') {
          hostControllerRef.current.handleJoinRequest(
            payload.peerId,
            payload.name,
            payload.character
          );
          return;
        }

        if (payload.type === 'PLAYER_ACTION') {
          hostControllerRef.current.handlePlayerAction(payload.peerId, payload.action);
          return;
        }
      }

      // 2. GUEST: Process updates from Host
      if (!isCurrentHost) {
        if (payload.type === 'JOIN_ACCEPTED' && payload.targetPeerId === currentPeerId) {
          if (joinWatchdogTimerRef.current) {
            clearTimeout(joinWatchdogTimerRef.current);
            joinWatchdogTimerRef.current = null;
          }
          if (joinIntervalRef.current) {
            clearInterval(joinIntervalRef.current);
            joinIntervalRef.current = null;
          }
          return;
        }

        if (payload.type === 'JOIN_REJECTED' && payload.targetPeerId === currentPeerId) {
          if (joinWatchdogTimerRef.current) {
            clearTimeout(joinWatchdogTimerRef.current);
            joinWatchdogTimerRef.current = null;
          }
          if (joinIntervalRef.current) {
            clearInterval(joinIntervalRef.current);
            joinIntervalRef.current = null;
          }
          setStatus('ERROR');
          setErrorMessage(payload.reason || 'Unable to join the investigation room.');
          return;
        }

        // 5-Player Unified Broadcast Synchronizer
        if (payload.type === 'SYNC_STATE' && payload.state) {
          const isPlayerInState = payload.state.players.some((p: MaskedPlayer) => p.peerId === currentPeerId);
          if (isPlayerInState) {
            if (joinWatchdogTimerRef.current) {
              clearTimeout(joinWatchdogTimerRef.current);
              joinWatchdogTimerRef.current = null;
            }
            if (joinIntervalRef.current) {
              clearInterval(joinIntervalRef.current);
              joinIntervalRef.current = null;
            }

            const myHand = payload.hands?.[currentPeerId] || [];
            const isSuggester =
              payload.disprovedForSuggester &&
              payload.disprovedForSuggester.suggesterPeerId === currentPeerId;

            const personalState: MaskedGameState = {
              ...payload.state,
              players: payload.state.players.map((p: MaskedPlayer) =>
                p.peerId === currentPeerId ? { ...p, hand: myHand } : p
              ),
            };

            applyStateUpdate(
              personalState,
              isSuggester ? payload.disprovedForSuggester : null,
              payload.accusationResult
            );
            return;
          } else if (!maskedState) {
            applyStateUpdate(payload.state, null, payload.accusationResult);
            return;
          }
        }

        if (payload.type === 'PLAYER_STATE' && payload.targetPeerId === currentPeerId) {
          if (joinWatchdogTimerRef.current) {
            clearTimeout(joinWatchdogTimerRef.current);
            joinWatchdogTimerRef.current = null;
          }
          if (joinIntervalRef.current) {
            clearInterval(joinIntervalRef.current);
            joinIntervalRef.current = null;
          }
          applyStateUpdate(payload.state, payload.disprovedCard, payload.accusationResult);
          return;
        }

        if (payload.type === 'STATE_UPDATE' && payload.state) {
          // If guest sees themselves in the players list, cancel watchdog and switch to game
          const isPlayerInState = payload.state.players.some((p: MaskedPlayer) => p.peerId === currentPeerId);
          if (isPlayerInState) {
            if (joinWatchdogTimerRef.current) {
              clearTimeout(joinWatchdogTimerRef.current);
              joinWatchdogTimerRef.current = null;
            }
            if (joinIntervalRef.current) {
              clearInterval(joinIntervalRef.current);
              joinIntervalRef.current = null;
            }
            applyStateUpdate(payload.state, null, payload.accusationResult);
          } else if (!maskedState) {
            // General broadcast
            applyStateUpdate(payload.state, null, payload.accusationResult);
          }
        }
      }
    },
    [applyStateUpdate, maskedState]
  );

  // 1. Create Room (Host)
  const createRoom = useCallback(
    (character: Suspect, playerName: string) => {
      teardownNetwork();
      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        const code = generateRoomCode();
        const peerId = `host_${code}_${Date.now()}`;

        setRoomCode(code);
        setMyPeerId(peerId);
        setIsHost(true);
        myPeerIdRef.current = peerId;
        roomCodeRef.current = code;
        isHostRef.current = true;

        // Initialize Host Controller
        const controller = new HostController(
          code,
          peerId,
          playerName || 'Detective Holmes',
          character,
          applyStateUpdate
        );
        hostControllerRef.current = controller;

        // Connect client transport for multi-player messaging (as Host)
        clientTransport.connect(code, peerId, handleIncomingPacket, true);

        // Update URL query parameter
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('room', code);
          window.history.replaceState({}, '', url.toString());
        }

        setStatus('LOBBY');
      } catch (err: any) {
        console.error('[Game] Error hosting room:', err);
        setErrorMessage(err.message || 'Failed to initialize investigation room');
        setStatus('ERROR');
      }
    },
    [applyStateUpdate, handleIncomingPacket, teardownNetwork]
  );

  // 2. Join Room (Guest)
  const joinRoom = useCallback(
    (inputCode: string, character: Suspect, playerName: string) => {
      const cleanCode = formatRoomCode(inputCode);
      if (!cleanCode || cleanCode.length < 4) {
        setErrorMessage('Please provide a valid 6-character room code.');
        return;
      }

      teardownNetwork();
      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        const peerId = `guest_${cleanCode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setRoomCode(cleanCode);
        setMyPeerId(peerId);
        setIsHost(false);
        myPeerIdRef.current = peerId;
        roomCodeRef.current = cleanCode;
        isHostRef.current = false;

        // Connect transport to room as Guest
        clientTransport.connect(cleanCode, peerId, handleIncomingPacket, false);

        // Send initial join request
        const sendJoin = () => {
          clientTransport.send({
            type: 'JOIN_REQUEST',
            peerId,
            name: playerName || character,
            character,
          });
        };

        // Send immediately
        sendJoin();

        // Re-send join request every 1.5 seconds in case host was connecting
        joinIntervalRef.current = setInterval(() => {
          sendJoin();
        }, 1500);

        // 15-second watchdog timer (ensuring P2P WebRTC / Relay handshake completes)
        joinWatchdogTimerRef.current = setTimeout(() => {
          if (joinIntervalRef.current) {
            clearInterval(joinIntervalRef.current);
            joinIntervalRef.current = null;
          }
          setStatus('ERROR');
          setErrorMessage(
            `Unable to connect to Tudor Manor room ${cleanCode}. Please verify the room code and ensure the Host has the game open.`
          );
        }, 15000);
      } catch (err: any) {
        console.error('[Game] Error joining room:', err);
        setErrorMessage(err.message || 'Failed to connect to room');
        setStatus('ERROR');
      }
    },
    [handleIncomingPacket, teardownNetwork]
  );

  // Send action either to local HostController (if Host) or via transport to Host (if Guest)
  const sendAction = useCallback((action: NetworkPacket) => {
    const peerId = myPeerIdRef.current;
    if (isHostRef.current && hostControllerRef.current) {
      hostControllerRef.current.handlePlayerAction(peerId, action);
    } else {
      clientTransport.send({
        type: 'PLAYER_ACTION',
        peerId,
        action,
      });
    }
  }, []);

  // Gameplay Actions
  const selectCharacter = useCallback(
    (char: Suspect) => {
      sendAction({ type: 'SELECT_CHARACTER', payload: { character: char } });
    },
    [sendAction]
  );

  const addAiBot = useCallback(
    (char: Suspect) => {
      sendAction({ type: 'ADD_BOT', payload: { character: char } });
    },
    [sendAction]
  );

  const removePlayer = useCallback(
    (peerIdToRemove: string) => {
      sendAction({ type: 'REMOVE_PLAYER', payload: { peerId: peerIdToRemove } });
    },
    [sendAction]
  );

  const startMatch = useCallback(() => {
    sendAction({ type: 'START_MATCH' });
  }, [sendAction]);

  const rollDice = useCallback(() => {
    sounds.playDiceRoll();
    sendAction({ type: 'ROLL_DICE' });
  }, [sendAction]);

  const moveToken = useCallback(
    (x: number, y: number) => {
      sounds.playPawnStep();
      sendAction({ type: 'MOVE_TOKEN', payload: { x, y } });
    },
    [sendAction]
  );

  const useSecretPassage = useCallback(
    (targetRoom: Room) => {
      sounds.playDoorCreak();
      sendAction({ type: 'USE_SECRET_PASSAGE', payload: { targetRoom } });
    },
    [sendAction]
  );

  const makeSuggestion = useCallback(
    (suspect: Suspect, weapon: Weapon) => {
      sendAction({ type: 'MAKE_SUGGESTION', payload: { suspect, weapon } });
    },
    [sendAction]
  );

  const disproveCardAction = useCallback(
    (cardId: string) => {
      sounds.playCardSlide();
      sendAction({ type: 'DISPROVE_CARD', payload: { cardId } });
    },
    [sendAction]
  );

  const makeAccusationAction = useCallback(
    (suspect: Suspect, weapon: Weapon, room: Room) => {
      sounds.playGavelBang();
      sendAction({ type: 'MAKE_ACCUSATION', payload: { suspect, weapon, room } });
    },
    [sendAction]
  );

  const endTurn = useCallback(() => {
    sendAction({ type: 'END_TURN' });
  }, [sendAction]);

  const sendChatMessage = useCallback(
    (text: string) => {
      sendAction({ type: 'CHAT_MESSAGE', payload: { text } });
    },
    [sendAction]
  );

  const leaveGame = useCallback(() => {
    teardownNetwork();
    setMaskedState(null);
    setStatus('IDLE');
    setRoomCode('');
    setMyPeerId('');
    setIsHost(false);
    setErrorMessage('');
    setDisprovedCardReveal(null);
    setAccusationReveal(null);

    // Clear URL param
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('join');
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
    }
  }, [teardownNetwork]);

  const closeDisprovedCardReveal = useCallback(() => {
    setDisprovedCardReveal(null);
  }, []);

  const closeAccusationReveal = useCallback(() => {
    setAccusationReveal(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownNetwork();
    };
  }, [teardownNetwork]);

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
      disproveCard: disproveCardAction,
      makeAccusation: makeAccusationAction,
      endTurn,
      sendChatMessage,
      leaveGame,
      closeDisprovedCardReveal,
      closeAccusationReveal,
    },
  };
}
