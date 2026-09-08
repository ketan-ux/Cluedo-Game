import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { gameCache, ActiveSession } from '../utils/gameCache';
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
  const [cachedSession, setCachedSession] = useState<ActiveSession | null>(null);

  const hostControllerRef = useRef<HostController | null>(null);
  const myPeerIdRef = useRef<string>('');
  const roomCodeRef = useRef<string>('');
  const isHostRef = useRef<boolean>(false);
  const maskedStateRef = useRef<MaskedGameState | null>(null);
  const hasAutoRehydratedRef = useRef<boolean>(false);
  const joinWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const joinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  myPeerIdRef.current = myPeerId;
  roomCodeRef.current = roomCode;
  isHostRef.current = isHost;
  maskedStateRef.current = maskedState;

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

      // Persist active session metadata for lobby banner
      const currentCode = roomCodeRef.current || newState.roomCode;
      const currentPeer = myPeerIdRef.current;
      if (currentCode && currentPeer) {
        const myP = newState.players.find((p) => p.peerId === currentPeer);
        gameCache.saveSession({
          roomCode: currentCode,
          peerId: currentPeer,
          playerName: myP?.name || 'Detective',
          character: myP?.character || 'Miss Scarlet',
          isHost: isHostRef.current,
          lastActive: Date.now(),
        });
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
        if (payload.type === 'SYNC_REQUEST') {
          hostControllerRef.current.handleSyncRequest(payload.peerId);
          return;
        }

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

        // Host Unified Broadcast Synchronizer
        if (payload.type === 'SYNC_STATE' && payload.state) {
          const matchingPlayer = payload.state.players.find(
            (p: MaskedPlayer) => p.peerId === currentPeerId
          );

          if (matchingPlayer) {
            if (joinWatchdogTimerRef.current) {
              clearTimeout(joinWatchdogTimerRef.current);
              joinWatchdogTimerRef.current = null;
            }
            if (joinIntervalRef.current) {
              clearInterval(joinIntervalRef.current);
              joinIntervalRef.current = null;
            }

            const myHand = payload.hands?.[currentPeerId] || matchingPlayer.hand || [];
            const isSuggester =
              payload.disprovedForSuggester &&
              payload.disprovedForSuggester.suggesterPeerId === currentPeerId;

            // Merge historical logs on client
            const existingLogs = maskedStateRef.current?.logs || [];
            const existingLogIds = new Set(existingLogs.map((l: any) => l.id));
            const newLogs = (payload.state.logs || []).filter((l: any) => !existingLogIds.has(l.id));
            const mergedLogs = [...existingLogs, ...newLogs].slice(-50);

            const personalState: MaskedGameState = {
              ...payload.state,
              logs: mergedLogs,
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
          } else if (!maskedStateRef.current) {
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

          const existingLogs = maskedStateRef.current?.logs || [];
          const existingLogIds = new Set(existingLogs.map((l: any) => l.id));
          const newLogs = (payload.state.logs || []).filter((l: any) => !existingLogIds.has(l.id));
          const mergedLogs = [...existingLogs, ...newLogs].slice(-50);

          const personalState: MaskedGameState = {
            ...payload.state,
            logs: mergedLogs,
          };

          applyStateUpdate(personalState, payload.disprovedCard, payload.accusationResult);
          return;
        }

        if (payload.type === 'STATE_UPDATE' && payload.state) {
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
          } else if (!maskedStateRef.current) {
            applyStateUpdate(payload.state, null, payload.accusationResult);
          }
        }
      }
    },
    [applyStateUpdate]
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
        // Reuse peerId if reconnecting to the same room
        const existingSession = gameCache.getSession();
        const peerId =
          existingSession && existingSession.roomCode === cleanCode && existingSession.peerId
            ? existingSession.peerId
            : `guest_${cleanCode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
    const code = roomCodeRef.current;
    const wasHost = isHostRef.current;
    const peer = myPeerIdRef.current;

    if (hostControllerRef.current) {
      hostControllerRef.current.destroy();
      hostControllerRef.current = null;
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
    setCachedSession(null);

    // Clear cached session & states
    gameCache.clearSession();
    if (wasHost && code) {
      gameCache.clearMasterState(code);
    }
    if (code && peer) {
      gameCache.clearClientState(code, peer);
    }

    // Clear URL param
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('join');
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
    }
  }, [teardownNetwork]);

  const discardCachedSession = useCallback(() => {
    const session = cachedSession || gameCache.getSession();
    if (session) {
      gameCache.clearSession();
      if (session.isHost) {
        gameCache.clearMasterState(session.roomCode);
      }
      gameCache.clearClientState(session.roomCode, session.peerId);
    }
    setCachedSession(null);
  }, [cachedSession]);

  const resumeSession = useCallback(() => {
    const session = gameCache.getSession();
    if (!session) return;

    if (session.isHost) {
      const cachedMaster = gameCache.getMasterState(session.roomCode);
      if (cachedMaster && cachedMaster.phase !== 'GAME_OVER') {
        teardownNetwork();
        setRoomCode(session.roomCode);
        setMyPeerId(session.peerId);
        setIsHost(true);
        myPeerIdRef.current = session.peerId;
        roomCodeRef.current = session.roomCode;
        isHostRef.current = true;

        const controller = new HostController(
          session.roomCode,
          session.peerId,
          session.playerName,
          session.character,
          applyStateUpdate,
          cachedMaster
        );
        hostControllerRef.current = controller;
        clientTransport.connect(session.roomCode, session.peerId, handleIncomingPacket, true);
        setStatus(cachedMaster.phase === 'LOBBY' ? 'LOBBY' : 'IN_GAME');
      }
    } else {
      joinRoom(session.roomCode, session.character, session.playerName);
    }
  }, [applyStateUpdate, handleIncomingPacket, joinRoom, teardownNetwork]);

  const closeDisprovedCardReveal = useCallback(() => {
    setDisprovedCardReveal(null);
  }, []);

  const closeAccusationReveal = useCallback(() => {
    setAccusationReveal(null);
  }, []);

  // Inspect active session on mount to populate Lobby screen recovery options, NEVER force into game!
  useEffect(() => {
    if (hasAutoRehydratedRef.current) return;
    hasAutoRehydratedRef.current = true;

    const session = gameCache.getSession();
    if (session) {
      setCachedSession(session);
    }
  }, []);

  // Window visibility & online event listeners to immediately trigger sync on Vercel
  useEffect(() => {
    const handleSync = () => {
      if (
        document.visibilityState === 'visible' &&
        !isHostRef.current &&
        roomCodeRef.current &&
        myPeerIdRef.current
      ) {
        clientTransport.send({
          type: 'SYNC_REQUEST',
          peerId: myPeerIdRef.current,
          roomCode: roomCodeRef.current,
        });
      }
    };

    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownNetwork();
    };
  }, [teardownNetwork]);

  const myPlayer: MaskedPlayer | undefined = useMemo(() => {
    return maskedState?.players.find((p) => p.peerId === myPeerId);
  }, [maskedState?.players, myPeerId]);

  const myHand: Card[] = useMemo(() => {
    return myPlayer?.hand || [];
  }, [myPlayer?.hand]);

  const actions = useMemo(
    () => ({
      createRoom,
      joinRoom,
      resumeSession,
      discardCachedSession,
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
    }),
    [
      createRoom,
      joinRoom,
      resumeSession,
      discardCachedSession,
      selectCharacter,
      addAiBot,
      removePlayer,
      startMatch,
      rollDice,
      moveToken,
      useSecretPassage,
      makeSuggestion,
      disproveCardAction,
      makeAccusationAction,
      endTurn,
      sendChatMessage,
      leaveGame,
      closeDisprovedCardReveal,
      closeAccusationReveal,
    ]
  );

  return {
    maskedState,
    isHost,
    myPeerId,
    myPlayer,
    myHand,
    roomCode,
    status,
    errorMessage,
    cachedSession,
    disprovedCardReveal,
    accusationReveal,
    actions,
  };
}
