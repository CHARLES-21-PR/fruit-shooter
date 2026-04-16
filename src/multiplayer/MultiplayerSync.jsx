import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { onDisconnect, onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { getFirebaseDatabase, hasFirebaseConfig } from './firebaseClient';

const ROOM_ID = import.meta.env.VITE_FIREBASE_ROOM_ID ?? 'arena-main';
const MAX_PLAYERS = 4;
const PLAYER_ID_STORAGE_KEY = `fruit-shooter-player-id-${ROOM_ID}`;

function createPlayerId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `player-${window.crypto.randomUUID()}`;
  }
  return `player-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getOrCreateTabPlayerId() {
  if (typeof window === 'undefined') return createPlayerId();
  const existing = window.sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const created = createPlayerId();
  window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
  return created;
}

function buildPlayerPayload(playerId, playerName, playerPosRef, camera) {
  return {
    id: playerId,
    name: String(playerName ?? 'Player').slice(0, 16),
    x: playerPosRef.current.x,
    y: camera.position.y ?? 1.7,
    z: playerPosRef.current.z,
    rotationY: camera.rotation.y ?? 0,
    hp: 100,
    color: '#78c7ff',
    updatedAt: Date.now(),
  };
}

async function claimSlot(database, roomId, playerId) {
  for (let slotIndex = 0; slotIndex < MAX_PLAYERS; slotIndex += 1) {
    const slotRef = ref(database, `rooms/${roomId}/slots/${slotIndex}`);
    const result = await runTransaction(slotRef, (current) => {
      if (current == null) {
        return {
          playerId,
          claimedAt: Date.now(),
        };
      }
      return current;
    });

    if (result.committed && result.snapshot.val()?.playerId === playerId) {
      return { slotIndex, slotRef };
    }
  }

  return null;
}

export default function MultiplayerSync({ enabled, playerName, playerPosRef, onSocketId, onPlayers, onStatus }) {
  const { camera } = useThree();
  const databaseRef = useRef(null);
  const playerIdRef = useRef(null);
  const playerRefRef = useRef(null);
  const slotRefRef = useRef(null);
  const playersUnsubscribeRef = useRef(null);
  const lastSentRef = useRef('');
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      onStatus?.('error');
      onSocketId?.(null);
      onPlayers?.([]);
      return () => {};
    }

    const database = getFirebaseDatabase();
    if (!database) {
      onStatus?.('error');
      onSocketId?.(null);
      onPlayers?.([]);
      return () => {};
    }

    databaseRef.current = database;
    const roomPlayersRef = ref(database, `rooms/${ROOM_ID}/players`);
    const playerId = playerIdRef.current ?? getOrCreateTabPlayerId();
    playerIdRef.current = playerId;
    let cancelled = false;

    const joinRoom = async () => {
      onStatus?.('connecting');

      const slotClaim = await claimSlot(database, ROOM_ID, playerId);
      if (cancelled) return;

      if (!slotClaim) {
        onStatus?.('full');
        onSocketId?.(null);
        onPlayers?.([]);
        return;
      }

      const slotRef = slotClaim.slotRef;
      const playerRef = ref(database, `rooms/${ROOM_ID}/players/${playerId}`);
      slotRefRef.current = slotRef;
      playerRefRef.current = playerRef;

      await set(playerRef, buildPlayerPayload(playerId, playerName, playerPosRef, camera));
      if (cancelled) return;

      await onDisconnect(playerRef).remove();
      await onDisconnect(slotRef).remove();

      const unsubscribePlayers = onValue(roomPlayersRef, (snapshot) => {
        const rawPlayers = snapshot.val() ?? {};
        const players = Object.entries(rawPlayers)
          .map(([id, player]) => ({ id, ...(player ?? {}) }))
          .filter((player) => Boolean(player?.id));
        onPlayers?.(players);
      });
      playersUnsubscribeRef.current = unsubscribePlayers;

      joinedRef.current = true;
      onSocketId?.(playerId);
      onStatus?.('connected');
    };

    void joinRoom().catch(() => {
      if (!cancelled) {
        onStatus?.('error');
        onSocketId?.(null);
        onPlayers?.([]);
      }
    });

    return () => {
      cancelled = true;
      joinedRef.current = false;
      lastSentRef.current = '';
      if (playersUnsubscribeRef.current) {
        playersUnsubscribeRef.current();
        playersUnsubscribeRef.current = null;
      }
      if (playerRefRef.current) {
        void remove(playerRefRef.current);
        playerRefRef.current = null;
      }
      if (slotRefRef.current) {
        void remove(slotRefRef.current);
        slotRefRef.current = null;
      }
      onSocketId?.(null);
      onPlayers?.([]);
      onStatus?.('idle');
    };
  }, [playerName, camera, onPlayers, onSocketId, onStatus, playerPosRef]);

  useEffect(() => {
    if (!enabled) {
      lastSentRef.current = '';
    }
  }, [enabled]);

  useFrame(() => {
    if (!enabled || !joinedRef.current) return;
    const database = databaseRef.current;
    const playerRef = playerRefRef.current;
    if (!database || !playerRef) return;

    const x = playerPosRef.current.x;
    const y = camera.position.y ?? 1.7;
    const z = playerPosRef.current.z;
    const rotationY = camera.rotation.y ?? 0;
    const signature = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}|${rotationY.toFixed(3)}`;

    if (signature === lastSentRef.current) return;

    lastSentRef.current = signature;
    void update(playerRef, {
      x,
      y,
      z,
      rotationY,
      updatedAt: Date.now(),
    });
  });

  return null;
}
