import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const MAX_PLAYERS = 4;
const SPAWN_POINTS = [
  { x: -5.5, z: -5.5 },
  { x: 5.5, z: -5.5 },
  { x: 5.5, z: 5.5 },
  { x: -5.5, z: 5.5 },
];
const PLAYER_COLORS = ['#78c7ff', '#ffd54f', '#66bb6a', '#ff8a80'];

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? '*',
    methods: ['GET', 'POST'],
  },
});

const players = new Map();

app.get('/health', (_req, res) => {
  res.json({ ok: true, players: players.size, maxPlayers: MAX_PLAYERS });
});

io.on('connection', (socket) => {
  socket.on('join', (payload = {}) => {
    const existingPlayer = players.get(socket.id);
    if (!existingPlayer && players.size >= MAX_PLAYERS) {
      socket.emit('room-full', { maxPlayers: MAX_PLAYERS });
      socket.disconnect(true);
      return;
    }

    const slotIndex = players.size % MAX_PLAYERS;
    const spawnPoint = SPAWN_POINTS[slotIndex];
    const color = PLAYER_COLORS[slotIndex];
    const name = String(payload.name ?? 'Player').slice(0, 16);

    players.set(socket.id, {
      id: socket.id,
      name,
      x: spawnPoint.x,
      y: 1.7,
      z: spawnPoint.z,
      rotationY: 0,
      hp: 100,
      color,
      lastSeen: Date.now(),
    });

    socket.emit('welcome', {
      id: socket.id,
      maxPlayers: MAX_PLAYERS,
    });
  });

  socket.on('move', (payload = {}) => {
    const player = players.get(socket.id);
    if (!player) return;

    const nextX = Number(payload.x);
    const nextY = Number(payload.y);
    const nextZ = Number(payload.z);
    const nextRotationY = Number(payload.rotationY);

    if (Number.isFinite(nextX)) player.x = nextX;
    if (Number.isFinite(nextY)) player.y = nextY;
    if (Number.isFinite(nextZ)) player.z = nextZ;
    if (Number.isFinite(nextRotationY)) player.rotationY = nextRotationY;

    player.lastSeen = Date.now();
    players.set(socket.id, player);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
  });
});

setInterval(() => {
  io.emit('state', {
    players: Array.from(players.values()),
    serverTime: Date.now(),
  });
}, 30);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Multiplayer server running on http://localhost:${PORT}`);
});
