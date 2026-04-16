import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { onChildAdded, onDisconnect, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';
import { getFirebaseDatabase, hasFirebaseConfig } from './firebaseClient';

const ROOM_ID = import.meta.env.VITE_FIREBASE_ROOM_ID ?? 'arena-main';
const MAX_PLAYERS = 4;
const RESPAWN_DELAY_MS = 3000;
const SPAWN_POINTS = [
  { x: -5.5, z: -5.5 },
  { x: 5.5, z: -5.5 },
  { x: 5.5, z: 5.5 },
  { x: -5.5, z: 5.5 },
];
const PLAYER_ID_STORAGE_KEY = `fruit-shooter-player-id-${ROOM_ID}`;

function createPlayerId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `player-${window.crypto.randomUUID()}`;
  }
  return `player-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getOrCreateTabPlayerId() {
  if (typeof window === 'undefined') return createPlayerId();
  try {
    const existing = window.sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = createPlayerId();
    window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return createPlayerId();
  }
}

function pickSpawnPoint(playerId) {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash << 5) - hash + playerId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SPAWN_POINTS.length;
  return SPAWN_POINTS[index];
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

export default function MultiplayerSync({ enabled, playerName, playerPosRef, onSocketId, onPlayers, onStatus, onSelfHealth, onRemoteShot, onRespawnReady }) {
  const { camera } = useThree();
  const databaseRef = useRef(null);
  const playerIdRef = useRef(null);
  const playerRefRef = useRef(null);
  const slotRefRef = useRef(null);
  const playersByIdRef = useRef({});
  const playersUnsubscribeRef = useRef(null);
  const shotsUnsubscribeRef = useRef(null);
  const respawnTimeoutRef = useRef(null);
  const lastSentRef = useRef('');
  const joinedRef = useRef(false);
  const attackCooldownRef = useRef(0);
  const localHpRef = useRef(100);

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
    const roomShotsRef = ref(database, `rooms/${ROOM_ID}/shots`);
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
        playersByIdRef.current = rawPlayers;
        const selfPlayer = rawPlayers[playerId];
        if (selfPlayer && Number.isFinite(selfPlayer.hp)) {
          const selfHp = Math.max(0, Math.round(selfPlayer.hp));
          const previousHp = localHpRef.current;
          localHpRef.current = selfHp;
          onSelfHealth?.(selfHp);

          if (selfHp <= 0 && !respawnTimeoutRef.current) {
            respawnTimeoutRef.current = window.setTimeout(() => {
              const currentPlayerRef = playerRefRef.current;
              const currentPlayerId = playerIdRef.current;
              if (!currentPlayerRef || !currentPlayerId) {
                respawnTimeoutRef.current = null;
                return;
              }

              const spawn = pickSpawnPoint(currentPlayerId);
              void update(currentPlayerRef, {
                hp: 100,
                x: spawn.x,
                y: 1.7,
                z: spawn.z,
                rotationY: 0,
                updatedAt: Date.now(),
              });
              respawnTimeoutRef.current = null;
            }, RESPAWN_DELAY_MS);
          }

          if (selfHp > 0 && respawnTimeoutRef.current) {
            window.clearTimeout(respawnTimeoutRef.current);
            respawnTimeoutRef.current = null;
          }

          if (previousHp <= 0 && selfHp > 0) {
            onRespawnReady?.();
          }
        }
        onPlayers?.(players);
      });
      playersUnsubscribeRef.current = unsubscribePlayers;

      const unsubscribeShots = onChildAdded(roomShotsRef, (snapshot) => {
        const payload = snapshot.val();
        if (!payload || payload.ownerId === playerId) return;
        onRemoteShot?.(payload);
      });
      shotsUnsubscribeRef.current = unsubscribeShots;

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
      if (shotsUnsubscribeRef.current) {
        shotsUnsubscribeRef.current();
        shotsUnsubscribeRef.current = null;
      }
      if (respawnTimeoutRef.current) {
        window.clearTimeout(respawnTimeoutRef.current);
        respawnTimeoutRef.current = null;
      }
      playersByIdRef.current = {};
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
  }, [playerName, camera, onPlayers, onSocketId, onStatus, onSelfHealth, playerPosRef]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      if (!enabled || !joinedRef.current) return;

      const now = performance.now();
      if (now < attackCooldownRef.current) return;
      attackCooldownRef.current = now + 220;

      const database = databaseRef.current;
      const playerId = playerIdRef.current;
      if (!database || !playerId) return;

      const origin = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction).normalize();

      const shotsRef = ref(database, `rooms/${ROOM_ID}/shots`);
      const shotRef = push(shotsRef);
      const shotPayload = {
        ownerId: playerId,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        dx: direction.x,
        dy: direction.y,
        dz: direction.z,
        createdAt: Date.now(),
      };
      void set(shotRef, shotPayload);
      window.setTimeout(() => {
        void remove(shotRef);
      }, 2200);

      const playersById = playersByIdRef.current;
      let selectedTargetId = null;
      let selectedDistance = Number.POSITIVE_INFINITY;

      Object.entries(playersById).forEach(([targetId, target]) => {
        if (!target || targetId === playerId) return;
        const targetHp = Number(target.hp ?? 100);
        if (!Number.isFinite(targetHp) || targetHp <= 0) return;

        const targetCenter = new THREE.Vector3(
          Number(target.x ?? 0),
          Number(target.y ?? 1.7) - 0.85,
          Number(target.z ?? 0),
        );
        const toTarget = targetCenter.sub(origin);
        const projection = toTarget.dot(direction);
        if (projection <= 0 || projection > 35) return;

        const closestPoint = direction.clone().multiplyScalar(projection);
        const missDistance = toTarget.sub(closestPoint).length();
        if (missDistance > 0.68) return;

        if (projection < selectedDistance) {
          selectedDistance = projection;
          selectedTargetId = targetId;
        }
      });

      if (!selectedTargetId) return;

      const targetHpRef = ref(database, `rooms/${ROOM_ID}/players/${selectedTargetId}/hp`);
      void runTransaction(targetHpRef, (current) => {
        const hp = Number(current ?? 100);
        if (!Number.isFinite(hp)) return 100;
        if (hp <= 0) return 0;
        return Math.max(0, hp - 20);
      });
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [camera, enabled]);

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
