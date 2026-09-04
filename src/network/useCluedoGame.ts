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
import {
  apiCreateRoom,
  apiGetRoomState,
  apiJoinRoom,
  apiLeaveRoom,
  apiSendAction,
  formatRoomCode,
  getWsUrl,
} from './peerProtocol';
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

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roomCodeRef = useRef<string>('');
  const peerIdRef = useRef<string>('');

  roomCodeRef.current = roomCode;
  peerIdRef.current = myPeerId;

  // Cleanup helper
  const teardownNetwork = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
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

  // Initialize WebSocket and HTTP polling loop for the active room
  const startRealtimeSync = useCallback(
    (code: string, peerId: string) => {
      teardownNetwork();

      // 1. Establish WebSocket Connection
      const wsUrl = getWsUrl();
      if (wsUrl) {
        try {
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log('[Game WS] Connected to relay server for room', code);
            ws.send(
              JSON.stringify({
                type: 'JOIN_CHANNEL',
                roomCode: code,
                peerId,
              })
            );
          };

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'STATE_UPDATE' && msg.state) {
                applyStateUpdate(msg.state, msg.disprovedCard, msg.accusationResult);
              }
            } catch (err) {
              console.warn('[Game WS] Message parse error:', err);
            }
          };

          ws.onerror = (err) => {
            console.warn('[Game WS] Connection notice, HTTP polling active:', err);
          };

          ws.onclose = () => {
            console.log('[Game WS] Closed, HTTP polling continuing in background');
          };
        } catch (err) {
          console.warn('[Game WS] Init error:', err);
        }
      }

      // 2. HTTP Polling Backup (every 1200ms)
      pollIntervalRef.current = setInterval(async () => {
        if (!roomCodeRef.current || !peerIdRef.current) return;
        const res = await apiGetRoomState(roomCodeRef.current, peerIdRef.current);
        if (res.success && res.state) {
          applyStateUpdate(res.state, res.disprovedCard, res.accusationResult);
        }
      }, 1200);
    },
    [teardownNetwork, applyStateUpdate]
  );

  // 1. Create Room (Host)
  const createRoom = useCallback(
    async (character: Suspect, playerName: string) => {
      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        const res = await apiCreateRoom(character, playerName);
        if (!res.success || !res.roomCode || !res.peerId || !res.state) {
          setErrorMessage(res.error || 'Failed to create room on server');
          setStatus('ERROR');
          return;
        }

        setRoomCode(res.roomCode);
        setMyPeerId(res.peerId);
        setIsHost(true);
        applyStateUpdate(res.state);

        startRealtimeSync(res.roomCode, res.peerId);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error communicating with game server');
        setStatus('ERROR');
      }
    },
    [applyStateUpdate, startRealtimeSync]
  );

  // 2. Join Room (Guest)
  const joinRoom = useCallback(
    async (inputCode: string, character: Suspect, playerName: string) => {
      const cleanCode = formatRoomCode(inputCode);
      if (!cleanCode || cleanCode.length < 4) {
        setErrorMessage('Please provide a valid 6-character room code.');
        return;
      }

      setStatus('CONNECTING');
      setErrorMessage('');

      try {
        const res = await apiJoinRoom(cleanCode, playerName, character);
        if (!res.success || !res.roomCode || !res.peerId || !res.state) {
          setErrorMessage(res.error || `Unable to join room ${cleanCode}`);
          setStatus('ERROR');
          return;
        }

        setRoomCode(res.roomCode);
        setMyPeerId(res.peerId);
        setIsHost(res.isHost || false);
        applyStateUpdate(res.state);

        startRealtimeSync(res.roomCode, res.peerId);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error joining investigation room');
        setStatus('ERROR');
      }
    },
    [applyStateUpdate, startRealtimeSync]
  );

  // Action Dispatcher (WebSocket + HTTP Fallback)
  const sendAction = useCallback(
    async (packet: NetworkPacket) => {
      const code = roomCodeRef.current;
      const peerId = peerIdRef.current;
      if (!code || !peerId) return;

      // 1. Send via WebSocket if open (sub-millisecond instant delivery)
      let sentViaWs = false;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'ACTION',
              roomCode: code,
              peerId,
              action: packet,
            })
          );
          sentViaWs = true;
        } catch (err) {
          console.warn('[Game Action] WS send error:', err);
        }
      }

      // 2. If WS is not connected or as fail-safe, dispatch via HTTP REST
      if (!sentViaWs) {
        const res = await apiSendAction(code, peerId, packet);
        if (res.success && res.state) {
          applyStateUpdate(res.state, res.disprovedCard, res.accusationResult);
        } else if (res.error) {
          console.warn('[Game Action] HTTP error:', res.error);
        }
      }
    },
    [applyStateUpdate]
  );

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
    if (roomCodeRef.current && peerIdRef.current) {
      apiLeaveRoom(roomCodeRef.current, peerIdRef.current).catch(() => {});
    }
    teardownNetwork();
    setMaskedState(null);
    setStatus('IDLE');
    setRoomCode('');
    setMyPeerId('');
    setIsHost(false);
    setErrorMessage('');
    setDisprovedCardReveal(null);
    setAccusationReveal(null);
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
