import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Enable JSON body parsing for standard APIs
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    activeRooms: rooms.size,
  });
});

// Room query endpoint
app.get('/api/rooms/:roomCode', (req, res) => {
  const code = (req.params.roomCode || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return res.json({ exists: false });
  }
  return res.json({
    exists: true,
    roomCode: code,
    hasHost: room.hostWs !== null && room.hostWs.readyState === WebSocket.OPEN,
    guestCount: room.guests.size,
  });
});

// ----------------------------------------------------
// Global Real-time Room Coordinator & WebSocket Relay
// ----------------------------------------------------
interface GuestConnection {
  ws: WebSocket;
  peerId: string;
  name: string;
  character?: string;
  connectedAt: number;
}

interface RoomSession {
  roomCode: string;
  hostWs: WebSocket | null;
  hostPeerId: string;
  guests: Map<string, GuestConnection>;
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, RoomSession>();

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname : '';
  
  if (pathname === '/ws' || pathname === '/ws/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Let other upgrade requests (e.g. Vite HMR if any) pass or close
    // Note: Do not destroy socket immediately if Vite needs it
  }
});

wss.on('connection', (ws: WebSocket) => {
  let boundRoomCode: string | null = null;
  let boundPeerId: string | null = null;
  let isHost = false;

  // Heartbeat ping/pong
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 25000);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, roomCode, payload } = data;

      if (type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }

      // 1. Host registers new or existing room
      if (type === 'HOST_REGISTER') {
        const cleanCode = (roomCode || '').toUpperCase().trim();
        boundRoomCode = cleanCode;
        boundPeerId = payload.hostPeerId;
        isHost = true;

        let room = rooms.get(cleanCode);
        if (!room) {
          room = {
            roomCode: cleanCode,
            hostWs: ws,
            hostPeerId: boundPeerId,
            guests: new Map(),
            createdAt: Date.now(),
            lastActivity: Date.now(),
          };
          rooms.set(cleanCode, room);
        } else {
          room.hostWs = ws;
          room.hostPeerId = boundPeerId;
          room.lastActivity = Date.now();
        }

        ws.send(
          JSON.stringify({
            type: 'HOST_REGISTERED',
            roomCode: cleanCode,
            hostPeerId: boundPeerId,
          })
        );
        console.log(`[WS Server] Host registered for room ${cleanCode} (${boundPeerId})`);
        return;
      }

      // 2. Guest connects and joins a room
      if (type === 'GUEST_JOIN') {
        const cleanCode = (roomCode || '').toUpperCase().trim();
        const guestPeerId = payload.guestPeerId;
        const guestName = payload.name || 'Guest';
        const character = payload.character;

        boundRoomCode = cleanCode;
        boundPeerId = guestPeerId;
        isHost = false;

        const room = rooms.get(cleanCode);
        if (!room || !room.hostWs || room.hostWs.readyState !== WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'JOIN_ERROR',
              message: `Room "${cleanCode}" was not found or the host is currently unreachable.`,
            })
          );
          return;
        }

        room.guests.set(guestPeerId, {
          ws,
          peerId: guestPeerId,
          name: guestName,
          character,
          connectedAt: Date.now(),
        });
        room.lastActivity = Date.now();

        // Notify guest that connection accepted
        ws.send(
          JSON.stringify({
            type: 'JOIN_ACCEPTED',
            roomCode: cleanCode,
            hostPeerId: room.hostPeerId,
            guestPeerId,
          })
        );

        // Notify host that guest connected
        room.hostWs.send(
          JSON.stringify({
            type: 'CLIENT_CONNECTED',
            peerId: guestPeerId,
            name: guestName,
            character,
          })
        );

        console.log(`[WS Server] Guest ${guestName} (${guestPeerId}) joined room ${cleanCode}`);
        return;
      }

      // 3. Guest sending a packet to the host
      if (type === 'GUEST_TO_HOST') {
        if (!boundRoomCode) return;
        const room = rooms.get(boundRoomCode);
        if (room && room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
          room.lastActivity = Date.now();
          room.hostWs.send(
            JSON.stringify({
              type: 'GUEST_PACKET',
              fromPeerId: boundPeerId,
              packet: payload.packet,
            })
          );
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
          const guest = room.guests.get(targetPeerId);
          if (guest && guest.ws.readyState === WebSocket.OPEN) {
            guest.ws.send(
              JSON.stringify({
                type: 'HOST_PACKET',
                packet: payload.packet,
              })
            );
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
          const messageStr = JSON.stringify({
            type: 'HOST_PACKET',
            packet: payload.packet,
          });

          for (const guest of room.guests.values()) {
            if (guest.ws.readyState === WebSocket.OPEN) {
              guest.ws.send(messageStr);
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
      console.log(`[WS Server] Host disconnected from room ${boundRoomCode}`);
      room.hostWs = null;
      // Notify all guests
      const disconnectNotice = JSON.stringify({
        type: 'HOST_DISCONNECTED',
        message: 'The host has disconnected from this room.',
      });
      for (const guest of room.guests.values()) {
        if (guest.ws.readyState === WebSocket.OPEN) {
          guest.ws.send(disconnectNotice);
        }
      }
    } else {
      console.log(`[WS Server] Guest ${boundPeerId} disconnected from room ${boundRoomCode}`);
      room.guests.delete(boundPeerId);
      if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
        room.hostWs.send(
          JSON.stringify({
            type: 'CLIENT_DISCONNECTED',
            peerId: boundPeerId,
          })
        );
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[WS Server] Socket error:', err);
  });
});

// Periodic cleanup of abandoned rooms (> 4 hours of inactivity)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 4 * 60 * 60 * 1000 && (!room.hostWs || room.hostWs.readyState !== WebSocket.OPEN)) {
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
