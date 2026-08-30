import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Enable JSON body parsing for standard APIs and CORS for cross-origin iframes
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ----------------------------------------------------
// Global Real-time Room Coordinator & Multi-Transport Relay
// ----------------------------------------------------
interface QueuedPacket {
  id: string;
  timestamp: number;
  fromPeerId: string;
  packet: any;
}

interface GuestSession {
  peerId: string;
  name: string;
  character?: string;
  ws: WebSocket | null;
  lastSeen: number;
  pendingPackets: QueuedPacket[];
}

interface RoomSession {
  roomCode: string;
  hostPeerId: string;
  hostName: string;
  hostCharacter?: string;
  hostWs: WebSocket | null;
  hostLastSeen: number;
  hostPendingPackets: QueuedPacket[];
  guests: Map<string, GuestSession>;
  latestStateSnapshot: any | null; // Latest MaskedGameState or GameState
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, RoomSession>();

// Helper to sanitize room code
function cleanCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim().slice(0, 6);
}

// ----------------------------------------------------
// REST APIs (Guaranteed Fallback for Any Restricted Network)
// ----------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    activeRooms: rooms.size,
  });
});

// Room query endpoint
app.get('/api/rooms/:roomCode', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const room = rooms.get(code);
  if (!room) {
    return res.json({ exists: false });
  }

  const isHostAlive = (Date.now() - room.hostLastSeen) < 120000; // within 2 minutes

  return res.json({
    exists: true,
    roomCode: code,
    hasHost: isHostAlive,
    hostPeerId: room.hostPeerId,
    guestCount: room.guests.size,
    hasSnapshot: !!room.latestStateSnapshot,
  });
});

// Host registers/updates room via HTTP
app.post('/api/rooms/register', (req, res) => {
  const { roomCode, hostPeerId, name, character } = req.body || {};
  const code = cleanCode(roomCode);
  if (!code || !hostPeerId) {
    return res.status(400).json({ error: 'Missing roomCode or hostPeerId' });
  }

  let room = rooms.get(code);
  if (!room) {
    room = {
      roomCode: code,
      hostPeerId,
      hostName: name || 'Host',
      hostCharacter: character,
      hostWs: null,
      hostLastSeen: Date.now(),
      hostPendingPackets: [],
      guests: new Map(),
      latestStateSnapshot: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    rooms.set(code, room);
  } else {
    room.hostPeerId = hostPeerId;
    if (name) room.hostName = name;
    if (character) room.hostCharacter = character;
    room.hostLastSeen = Date.now();
    room.lastActivity = Date.now();
  }

  return res.json({ success: true, roomCode: code });
});

// Guest joins room via HTTP
app.post('/api/rooms/:roomCode/join', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const { guestPeerId, name, character } = req.body || {};
  if (!guestPeerId) {
    return res.status(400).json({ error: 'Missing guestPeerId' });
  }

  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: `Room "${code}" not found.` });
  }

  let guest = room.guests.get(guestPeerId);
  if (!guest) {
    guest = {
      peerId: guestPeerId,
      name: name || 'Guest',
      character,
      ws: null,
      lastSeen: Date.now(),
      pendingPackets: [],
    };
    room.guests.set(guestPeerId, guest);
  } else {
    guest.lastSeen = Date.now();
    if (name) guest.name = name;
    if (character) guest.character = character;
  }

  room.lastActivity = Date.now();

  // Notify host if host is connected via WS
  if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(
      JSON.stringify({
        type: 'CLIENT_CONNECTED',
        peerId: guestPeerId,
        name: guest.name,
        character: guest.character,
      })
    );
  } else {
    // Queue join notification for host
    room.hostPendingPackets.push({
      id: `join_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      fromPeerId: guestPeerId,
      packet: {
        type: 'JOIN_LOBBY',
        payload: {
          name: guest.name,
          character: guest.character,
        },
      },
    });
  }

  return res.json({
    success: true,
    roomCode: code,
    hostPeerId: room.hostPeerId,
    latestStateSnapshot: room.latestStateSnapshot,
  });
});

// Send packet via HTTP REST (Guest -> Host or Host -> Guest/Broadcast)
app.post('/api/rooms/:roomCode/send', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const { fromPeerId, targetPeerId, packet, isHostBroadcast } = req.body || {};
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: `Room "${code}" not found.` });
  }

  room.lastActivity = Date.now();

  // Save latest state snapshot if this is a SYNC_STATE packet
  if (packet?.type === 'SYNC_STATE' && packet.payload?.maskedState) {
    room.latestStateSnapshot = packet.payload.maskedState;
  }

  const packetEntry: QueuedPacket = {
    id: `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    fromPeerId: fromPeerId || '',
    packet,
  };

  // 1. Host broadcasting to all guests
  if (isHostBroadcast) {
    room.hostLastSeen = Date.now();
    for (const guest of room.guests.values()) {
      guest.pendingPackets.push(packetEntry);
      // If guest has active WS, deliver immediately
      if (guest.ws && guest.ws.readyState === WebSocket.OPEN) {
        guest.ws.send(JSON.stringify({ type: 'HOST_PACKET', packet }));
      }
    }
    return res.json({ success: true, deliveredTo: room.guests.size });
  }

  // 2. Host sending to specific guest
  if (targetPeerId) {
    room.hostLastSeen = Date.now();
    const guest = room.guests.get(targetPeerId);
    if (guest) {
      guest.pendingPackets.push(packetEntry);
      if (guest.ws && guest.ws.readyState === WebSocket.OPEN) {
        guest.ws.send(JSON.stringify({ type: 'HOST_PACKET', packet }));
      }
    }
    return res.json({ success: true });
  }

  // 3. Guest sending packet to host
  if (fromPeerId) {
    const guest = room.guests.get(fromPeerId);
    if (guest) guest.lastSeen = Date.now();

    room.hostPendingPackets.push(packetEntry);
    if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
      room.hostWs.send(
        JSON.stringify({
          type: 'GUEST_PACKET',
          fromPeerId,
          packet,
        })
      );
    }
    return res.json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid packet destination' });
});

// Poll pending packets via HTTP (for clients where WS is blocked)
app.get('/api/rooms/:roomCode/poll', (req, res) => {
  const code = cleanCode(req.params.roomCode);
  const peerId = (req.query.peerId as string) || '';
  const isHost = req.query.isHost === 'true';
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: `Room "${code}" not found.` });
  }

  room.lastActivity = Date.now();

  if (isHost) {
    room.hostLastSeen = Date.now();
    const packets = [...room.hostPendingPackets];
    room.hostPendingPackets = []; // drain
    return res.json({
      packets,
      guestCount: room.guests.size,
      latestSnapshot: room.latestStateSnapshot,
    });
  } else {
    const guest = room.guests.get(peerId);
    if (!guest) {
      return res.status(404).json({ error: 'Guest not registered in this room.' });
    }
    guest.lastSeen = Date.now();
    const packets = [...guest.pendingPackets];
    guest.pendingPackets = []; // drain
    return res.json({
      packets,
      latestSnapshot: room.latestStateSnapshot,
    });
  }
});

// ----------------------------------------------------
// WebSocket Server Attached to HTTP Server
// ----------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const urlObj = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    if (pathname === '/ws' || pathname === '/ws/' || pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.warn('[WS Server] Upgrade error:', err);
  }
});

wss.on('connection', (ws: WebSocket) => {
  let boundRoomCode: string | null = null;
  let boundPeerId: string | null = null;
  let isHost = false;

  // Heartbeat ping/pong (every 15s to keep mobile 5G carrier NAT alive)
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 15000);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, roomCode, payload } = data;

      if (type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }

      // 1. Host registers
      if (type === 'HOST_REGISTER') {
        const code = cleanCode(roomCode);
        boundRoomCode = code;
        boundPeerId = payload.hostPeerId;
        isHost = true;

        let room = rooms.get(code);
        if (!room) {
          room = {
            roomCode: code,
            hostWs: ws,
            hostPeerId: boundPeerId,
            hostName: payload.name || 'Host',
            hostCharacter: payload.character,
            hostLastSeen: Date.now(),
            hostPendingPackets: [],
            guests: new Map(),
            latestStateSnapshot: null,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          };
          rooms.set(code, room);
        } else {
          room.hostWs = ws;
          room.hostPeerId = boundPeerId;
          room.hostLastSeen = Date.now();
          room.lastActivity = Date.now();
        }

        ws.send(
          JSON.stringify({
            type: 'HOST_REGISTERED',
            roomCode: code,
            hostPeerId: boundPeerId,
          })
        );

        // Flush any pending host packets
        if (room.hostPendingPackets.length > 0) {
          for (const queued of room.hostPendingPackets) {
            ws.send(
              JSON.stringify({
                type: 'GUEST_PACKET',
                fromPeerId: queued.fromPeerId,
                packet: queued.packet,
              })
            );
          }
          room.hostPendingPackets = [];
        }

        console.log(`[WS Server] Host registered for room ${code} (${boundPeerId})`);
        return;
      }

      // 2. Guest connects and joins a room
      if (type === 'GUEST_JOIN') {
        const code = cleanCode(roomCode);
        const guestPeerId = payload.guestPeerId;
        const guestName = payload.name || 'Guest';
        const character = payload.character;

        boundRoomCode = code;
        boundPeerId = guestPeerId;
        isHost = false;

        let room = rooms.get(code);
        if (!room) {
          // Create room entry placeholder so guest can wait for host if host is momentarily reconnecting
          room = {
            roomCode: code,
            hostWs: null,
            hostPeerId: '',
            hostName: 'Host',
            hostLastSeen: Date.now(),
            hostPendingPackets: [],
            guests: new Map(),
            latestStateSnapshot: null,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          };
          rooms.set(code, room);
        }

        let guest = room.guests.get(guestPeerId);
        if (!guest) {
          guest = {
            ws,
            peerId: guestPeerId,
            name: guestName,
            character,
            lastSeen: Date.now(),
            pendingPackets: [],
          };
          room.guests.set(guestPeerId, guest);
        } else {
          guest.ws = ws;
          guest.lastSeen = Date.now();
        }

        room.lastActivity = Date.now();

        // Send confirmation to guest
        ws.send(
          JSON.stringify({
            type: 'JOIN_ACCEPTED',
            roomCode: code,
            hostPeerId: room.hostPeerId,
            guestPeerId,
            latestSnapshot: room.latestStateSnapshot,
          })
        );

        // Notify host
        if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
          room.hostWs.send(
            JSON.stringify({
              type: 'CLIENT_CONNECTED',
              peerId: guestPeerId,
              name: guestName,
              character,
            })
          );
        }

        // Flush any pending packets to guest
        if (guest.pendingPackets.length > 0) {
          for (const pkt of guest.pendingPackets) {
            ws.send(JSON.stringify({ type: 'HOST_PACKET', packet: pkt.packet }));
          }
          guest.pendingPackets = [];
        }

        console.log(`[WS Server] Guest ${guestName} (${guestPeerId}) joined room ${code}`);
        return;
      }

      // 3. Guest sending a packet to the host
      if (type === 'GUEST_TO_HOST') {
        if (!boundRoomCode) return;
        const room = rooms.get(boundRoomCode);
        if (room) {
          room.lastActivity = Date.now();
          if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
            room.hostWs.send(
              JSON.stringify({
                type: 'GUEST_PACKET',
                fromPeerId: boundPeerId,
                packet: payload.packet,
              })
            );
          } else {
            // Buffer packet for host reconnection
            room.hostPendingPackets.push({
              id: `pkt_${Date.now()}_${Math.random()}`,
              timestamp: Date.now(),
              fromPeerId: boundPeerId || '',
              packet: payload.packet,
            });
          }
        }
        return;
      }

      // 4. Host sending state or card to specific guest
      if (type === 'HOST_TO_GUEST') {
        if (!boundRoomCode) return;
        const room = rooms.get(boundRoomCode);
        const targetPeerId = payload.targetPeerId;
        if (room && targetPeerId) {
          room.lastActivity = Date.now();
          if (payload.packet?.type === 'SYNC_STATE' && payload.packet?.payload?.maskedState) {
            room.latestStateSnapshot = payload.packet.payload.maskedState;
          }

          const guest = room.guests.get(targetPeerId);
          if (guest) {
            if (guest.ws && guest.ws.readyState === WebSocket.OPEN) {
              guest.ws.send(
                JSON.stringify({
                  type: 'HOST_PACKET',
                  packet: payload.packet,
                })
              );
            } else {
              guest.pendingPackets.push({
                id: `pkt_${Date.now()}_${Math.random()}`,
                timestamp: Date.now(),
                fromPeerId: boundPeerId || '',
                packet: payload.packet,
              });
            }
          }
        }
        return;
      }

      // 5. Host broadcasting packet to all guests in room
      if (type === 'HOST_BROADCAST') {
        if (!boundRoomCode) return;
        const room = rooms.get(boundRoomCode);
        if (room) {
          room.lastActivity = Date.now();
          if (payload.packet?.type === 'SYNC_STATE' && payload.packet?.payload?.maskedState) {
            room.latestStateSnapshot = payload.packet.payload.maskedState;
          }

          const messageStr = JSON.stringify({
            type: 'HOST_PACKET',
            packet: payload.packet,
          });

          for (const guest of room.guests.values()) {
            if (guest.ws && guest.ws.readyState === WebSocket.OPEN) {
              guest.ws.send(messageStr);
            } else {
              guest.pendingPackets.push({
                id: `pkt_${Date.now()}_${Math.random()}`,
                timestamp: Date.now(),
                fromPeerId: boundPeerId || '',
                packet: payload.packet,
              });
            }
          }
        }
        return;
      }
    } catch (err) {
      console.error('[WS Server] Error processing message:', err);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (!boundRoomCode || !boundPeerId) return;

    const room = rooms.get(boundRoomCode);
    if (!room) return;

    if (isHost) {
      console.log(`[WS Server] Host socket closed for room ${boundRoomCode} (holding room in grace period)`);
      room.hostWs = null;
      room.hostLastSeen = Date.now();
    } else {
      console.log(`[WS Server] Guest ${boundPeerId} socket closed for room ${boundRoomCode}`);
      const guest = room.guests.get(boundPeerId);
      if (guest) {
        guest.ws = null;
        guest.lastSeen = Date.now();
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('[WS Server] Socket warning:', err);
  });
});

// Periodic cleanup of abandoned rooms (> 2 hours of inactivity and no recent activity)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const isInactive = now - room.lastActivity > 2 * 60 * 60 * 1000;
    const isHostStale = now - room.hostLastSeen > 30 * 60 * 1000;
    if (isInactive && isHostStale && (!room.hostWs || room.hostWs.readyState !== WebSocket.OPEN)) {
      rooms.delete(code);
      console.log(`[WS Server] Cleaned up inactive room ${code}`);
    }
  }
}, 60 * 1000);

// ----------------------------------------------------
// Vite Middleware / Static Asset Serving
// ----------------------------------------------------
async function bootstrapServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error('Fatal error bootstrapping server:', err);
  process.exit(1);
});

