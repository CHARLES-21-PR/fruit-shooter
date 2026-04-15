import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

export default function MultiplayerSync({ enabled, playerName, playerPosRef, onSocketId, onPlayers }) {
  const { camera } = useThree();
  const socketRef = useRef(null);
  const lastSentRef = useRef('');

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      onSocketId?.(socket.id);
      socket.emit('join', { name: playerName });
    });

    socket.on('state', (payload) => {
      onPlayers?.(Array.isArray(payload?.players) ? payload.players : []);
    });

    socket.on('room-full', () => {
      onSocketId?.(null);
      onPlayers?.([]);
    });

    socket.on('disconnect', () => {
      onSocketId?.(null);
      onPlayers?.([]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      lastSentRef.current = '';
      onSocketId?.(null);
      onPlayers?.([]);
    };
  }, [playerName, onPlayers, onSocketId]);

  useEffect(() => {
    if (!enabled) {
      lastSentRef.current = '';
    }
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;

    const socket = socketRef.current;
    if (!socket?.connected) return;

    const x = playerPosRef.current.x;
    const y = camera.position.y ?? 1.7;
    const z = playerPosRef.current.z;
    const rotationY = camera.rotation.y ?? 0;
    const signature = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}|${rotationY.toFixed(3)}`;

    if (signature === lastSentRef.current) return;

    lastSentRef.current = signature;
    socket.emit('move', {
      x,
      y,
      z,
      rotationY,
    });
  });

  return null;
}
