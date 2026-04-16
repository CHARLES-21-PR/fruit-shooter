import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, KeyboardControls, PointerLockControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import MultiplayerSync from './multiplayer/MultiplayerSync';
import OtherPlayer from './multiplayer/OtherPlayer';

const WEAPONS = [
  {
    id: 'platano-glock',
    name: 'Platano-Glock',
    color: '#ffd54f',
    ammo: 12,
    cooldownMs: 220,
    speed: 52,
    size: 0.11,
    pellets: 1,
    spread: 0.01,
  },
  {
    id: 'sandia-rifle',
    name: 'Sandia-Rifle',
    color: '#66bb6a',
    ammo: 30,
    cooldownMs: 90,
    speed: 68,
    size: 0.09,
    pellets: 1,
    spread: 0.004,
  },
  {
    id: 'coco-shotgun',
    name: 'Coco-Shotgun',
    color: '#8d6e63',
    ammo: 8,
    cooldownMs: 480,
    speed: 46,
    size: 0.12,
    pellets: 6,
    spread: 0.075,
  },
];

const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
const WORLD_RADIUS = 12;
const MAP_OBSTACLES = [
  { id: 'crate-red', type: 'box', x: 5, z: 5, width: 2, depth: 2, color: '#ff7575' },
  { id: 'tower-green', type: 'box', x: 0, z: -6, width: 2.2, depth: 2.2, color: '#35d07f' },
  { id: 'orb-cyan', type: 'circle', x: -3.5, z: -9, radius: 1.2, color: '#8cd9ff' },
  { id: 'block-blue', type: 'box', x: -6, z: -3, width: 1.8, depth: 2.2, color: '#7f9fc9' },
];
const MULTIPLAYER_PREVIEW_PLAYERS = [
  { id: 'ally-1', name: 'Lima', x: 2.8, z: -1.5, color: '#66d9ff' },
  { id: 'ally-2', name: 'Kiwi', x: -4.2, z: 4.6, color: '#ffd166' },
];
const FRUIT_TYPES = ['banana', 'watermelon', 'coconut', 'lime'];
const SOLO_BOTS_TEMPLATE = [
  { id: 'bot-banana-1', fruit: 'banana', x: -8, z: -3, radius: 0.58, speed: 0.65, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.4, attackCooldownMs: 1200, bulletSpeed: 12, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-banana-2', fruit: 'banana', x: 7.2, z: -1.8, radius: 0.58, speed: 0.65, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.4, attackCooldownMs: 1200, bulletSpeed: 12, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-watermelon-1', fruit: 'watermelon', x: 0, z: -8.5, radius: 0.62, speed: 0.55, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.8, attackCooldownMs: 1300, bulletSpeed: 11, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-watermelon-2', fruit: 'watermelon', x: -1.4, z: 8.7, radius: 0.62, speed: 0.55, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.8, attackCooldownMs: 1300, bulletSpeed: 11, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-coconut-1', fruit: 'coconut', x: 8.7, z: 6.2, radius: 0.56, speed: 0.7, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.2, attackCooldownMs: 1150, bulletSpeed: 12, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-coconut-2', fruit: 'coconut', x: -7.2, z: 5.8, radius: 0.56, speed: 0.7, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.2, attackCooldownMs: 1150, bulletSpeed: 12, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-lime-1', fruit: 'lime', x: 2.8, z: 2.8, radius: 0.54, speed: 0.8, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.1, attackCooldownMs: 1000, bulletSpeed: 13, spawnStartedAt: 0, spawnDuration: 780 },
  { id: 'bot-lime-2', fruit: 'lime', x: -3.2, z: -1.2, radius: 0.54, speed: 0.8, damage: 2, hp: 100, maxHp: 100, hitFlashUntil: 0, attackRange: 7.1, attackCooldownMs: 1000, bulletSpeed: 13, spawnStartedAt: 0, spawnDuration: 780 },
];

function createWaveBots(count, waveNumber) {
  const bots = [];
  const maxRadius = WORLD_RADIUS - 1.2;

  for (let i = 0; i < count; i += 1) {
    let x = 0;
    let z = 0;
    let attempts = 0;

    while (attempts < 22) {
      const angle = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * (maxRadius - 3);
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;

      const tooClose = bots.some((b) => Math.hypot(b.x - x, b.z - z) < 1.4);
      if (!tooClose) break;
      attempts += 1;
    }

    const fruit = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    const radius = fruit === 'watermelon' ? 0.62 : fruit === 'banana' ? 0.58 : fruit === 'coconut' ? 0.56 : 0.54;
    const speed = fruit === 'watermelon' ? 0.55 : fruit === 'banana' ? 0.65 : fruit === 'coconut' ? 0.7 : 0.8;

    bots.push({
      id: `wave-${waveNumber}-bot-${i}-${Math.random().toString(16).slice(2, 7)}`,
      fruit,
      x,
      z,
      radius,
      speed,
      damage: 2,
      hp: 100,
      maxHp: 100,
      hitFlashUntil: 0,
      attackRange: fruit === 'watermelon' ? 7.8 : fruit === 'banana' ? 7.4 : fruit === 'coconut' ? 7.2 : 7.1,
      attackCooldownMs: fruit === 'watermelon' ? 1300 : fruit === 'banana' ? 1200 : fruit === 'coconut' ? 1150 : 1000,
      bulletSpeed: fruit === 'watermelon' ? 11 : fruit === 'banana' ? 12 : fruit === 'coconut' ? 12 : 13,
      spawnStartedAt: 0,
      spawnDuration: 780,
    });
  }

  return bots;
}

function stampBotSpawn(bot, startTime = performance.now()) {
  return {
    ...bot,
    spawnStartedAt: startTime,
    spawnDuration: bot.spawnDuration ?? 780,
  };
}

function createGroundTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#11161d';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 580; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = 0.08 + Math.random() * 0.22;
    ctx.fillStyle = `rgba(210, 225, 238, ${alpha})`;
    ctx.fillRect(x, y, 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
  }

  ctx.strokeStyle = 'rgba(120, 142, 164, 0.20)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= size; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x <= size; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createObstacleTexture(base, accent) {
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 3;
  for (let i = -size; i < size * 2; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
    ctx.stroke();
  }

  ctx.fillStyle = `${accent}44`;
  for (let i = 0; i < 26; i += 1) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 4 + Math.random() * 7, 2 + Math.random() * 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createOrbTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.08, size * 0.5, size * 0.5, size * 0.7);
  grad.addColorStop(0, '#f2fbff');
  grad.addColorStop(0.35, '#8cd9ff');
  grad.addColorStop(1, '#29506f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.26})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createArenaPaintTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.08, size * 0.5, size * 0.5, size * 0.56);
  gradient.addColorStop(0, 'rgba(240, 230, 180, 0.9)');
  gradient.addColorStop(0.46, 'rgba(202, 171, 109, 0.78)');
  gradient.addColorStop(1, 'rgba(112, 95, 72, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(248, 231, 190, 0.28)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function resolveObstacleCollisions(x, z, radius = 0.44) {
  let nextX = x;
  let nextZ = z;

  for (let i = 0; i < MAP_OBSTACLES.length; i += 1) {
    const obstacle = MAP_OBSTACLES[i];
    const dx = nextX - obstacle.x;
    const dz = nextZ - obstacle.z;

    if (obstacle.type === 'circle') {
      const avoidRadius = obstacle.radius + radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < avoidRadius * avoidRadius) {
        const dist = Math.sqrt(Math.max(distSq, 0.0001));
        nextX = obstacle.x + (dx / dist) * avoidRadius;
        nextZ = obstacle.z + (dz / dist) * avoidRadius;
      }
      continue;
    }

    const halfW = obstacle.width * 0.5 + radius;
    const halfD = obstacle.depth * 0.5 + radius;
    const insideX = Math.abs(dx) < halfW;
    const insideZ = Math.abs(dz) < halfD;

    if (!insideX || !insideZ) continue;

    const penX = halfW - Math.abs(dx);
    const penZ = halfD - Math.abs(dz);

    if (penX < penZ) {
      nextX += dx > 0 ? penX : -penX;
    } else {
      nextZ += dz > 0 ? penZ : -penZ;
    }
  }

  return { x: nextX, z: nextZ };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeOutBack(value) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function useInput(enabled) {
  const [input, setInput] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    shift: false,
  });

  useEffect(() => {
    if (!enabled) {
      setInput({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        shift: false,
      });
      return;
    }

    const map = {
      KeyW: 'forward',
      ArrowUp: 'forward',
      KeyS: 'backward',
      ArrowDown: 'backward',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      Space: 'jump',
      ShiftLeft: 'shift',
      ShiftRight: 'shift',
    };

    const handle = (event) => {
      const action = map[event.code];
      if (!action) return;
      setInput((prev) => ({ ...prev, [action]: event.type === 'keydown' }));
      event.preventDefault();
    };

    const reset = () => {
      setInput({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        shift: false,
      });
    };

    window.addEventListener('keydown', handle, true);
    window.addEventListener('keyup', handle, true);
    window.addEventListener('blur', reset);

    return () => {
      window.removeEventListener('keydown', handle, true);
      window.removeEventListener('keyup', handle, true);
      window.removeEventListener('blur', reset);
    };
  }, [enabled]);

  return input;
}

function WeaponView({ color, shotSignalRef }) {
  const { camera } = useThree();
  const group = useRef();
  const recoil = useRef(0);
  const lastSignal = useRef(0);
  const offset = useRef(new THREE.Vector3());
  const base = useRef(new THREE.Vector3(0.28, -0.2, -0.5));

  useFrame((state, delta) => {
    if (!group.current) return;

    if (shotSignalRef.current !== lastSignal.current) {
      lastSignal.current = shotSignalRef.current;
      recoil.current = 1;
    }

    recoil.current = Math.max(0, recoil.current - delta * 10);
    const bob = Math.sin(state.clock.elapsedTime * 6) * 0.003;

    offset.current
      .copy(base.current)
      .setY(base.current.y + bob - recoil.current * 0.012)
      .setZ(base.current.z + recoil.current * 0.06)
      .applyQuaternion(camera.quaternion);

    group.current.position.copy(camera.position).add(offset.current);
    group.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.42, 14]} />
        <meshStandardMaterial color={color} metalness={0.12} roughness={0.62} />
      </mesh>
      <mesh position={[0.06, -0.05, 0.02]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.09, 0.15, 0.13]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.68} />
      </mesh>
    </group>
  );
}

function PlayerController({ enabled, onPositionChange, shotSignalRef, weaponColor }) {
  const { camera } = useThree();
  const input = useInput(enabled);

  const position = useRef(new THREE.Vector3(0, 1.7, 0));
  const horizontalVel = useRef(new THREE.Vector3(0, 0, 0));
  const verticalVel = useRef(0);
  const canJump = useRef(true);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const targetMove = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    if (!enabled) return;
    const safeDelta = Math.min(delta, 1 / 45);

    const speed = input.shift ? 8.2 : 5;

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(up.current, forward.current).normalize();

    targetMove.current.set(0, 0, 0);
    if (input.forward) targetMove.current.add(forward.current);
    if (input.backward) targetMove.current.sub(forward.current);
    if (input.left) targetMove.current.add(right.current);
    if (input.right) targetMove.current.sub(right.current);

    if (targetMove.current.lengthSq() > 0) {
      targetMove.current.normalize().multiplyScalar(speed);
    }

    horizontalVel.current.lerp(targetMove.current, 0.22);

    if (input.jump && canJump.current) {
      verticalVel.current = 5.8;
      canJump.current = false;
    }

    verticalVel.current = Math.max(-24, verticalVel.current - 14 * safeDelta);

    const stepX = horizontalVel.current.x * safeDelta;
    const stepZ = horizontalVel.current.z * safeDelta;
    const stepLen = Math.hypot(stepX, stepZ);
    const maxStep = 0.22;
    const stepScale = stepLen > maxStep ? maxStep / stepLen : 1;

    const proposedX = position.current.x + stepX * stepScale;
    const proposedZ = position.current.z + stepZ * stepScale;
    const resolved = resolveObstacleCollisions(proposedX, proposedZ, 0.44);

    position.current.x = resolved.x;
    position.current.z = resolved.z;
    position.current.y += verticalVel.current * safeDelta;

    const mapRadius = 12;
    const planar = Math.hypot(position.current.x, position.current.z);
    if (planar > mapRadius) {
      const inv = (mapRadius - 0.05) / planar;
      position.current.x *= inv;
      position.current.z *= inv;
    }

    if (position.current.y <= 1.7) {
      position.current.y = 1.7;
      verticalVel.current = 0;
      canJump.current = true;
    }

    camera.position.copy(position.current);
    camera.updateMatrixWorld();

    onPositionChange(position.current.x, position.current.z);
  });

  return <WeaponView color={weaponColor} shotSignalRef={shotSignalRef} />;
}

function BulletLayer({ bullets, bots, playerPosRef, onExpireMany, onBotHits, onDamagePlayer }) {
  const refs = useRef(new Map());
  const ages = useRef(new Map());

  useEffect(() => {
    const active = new Set(bullets.map((b) => b.id));
    refs.current.forEach((_, id) => {
      if (!active.has(id)) {
        refs.current.delete(id);
        ages.current.delete(id);
      }
    });
  }, [bullets]);

  useFrame((_, delta) => {
    if (bullets.length === 0) return;
    const expired = [];
    const hitBotCounts = new Map();
    let pendingPlayerDamage = 0;
    const playerX = playerPosRef.current.x;
    const playerZ = playerPosRef.current.z;
    const playerY = 1.35;

    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      const ref = refs.current.get(bullet.id);
      if (!ref) continue;

      const age = (ages.current.get(bullet.id) ?? 0) + delta;
      ages.current.set(bullet.id, age);

      ref.position.x += bullet.vel[0] * delta;
      ref.position.y += bullet.vel[1] * delta;
      ref.position.z += bullet.vel[2] * delta;

      if (bullet.owner === 'bot') {
        const dx = ref.position.x - playerX;
        const dy = ref.position.y - playerY;
        const dz = ref.position.z - playerZ;
        const hitRadius = 0.54 + bullet.size;
        if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
          pendingPlayerDamage += bullet.damage ?? 2;
          expired.push(bullet.id);
          continue;
        }
      } else {
        for (let j = 0; j < bots.length; j += 1) {
          const bot = bots[j];
          const dx = ref.position.x - bot.x;
          const dy = ref.position.y - 1.2;
          const dz = ref.position.z - bot.z;
          const hitRadius = bot.radius + bullet.size;
          if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
            hitBotCounts.set(bot.id, (hitBotCounts.get(bot.id) ?? 0) + 1);
            expired.push(bullet.id);
            break;
          }
        }
      }

      if (age > 0.95 || Math.abs(ref.position.x) > 18 || Math.abs(ref.position.z) > 18 || ref.position.y < 0.2) {
        expired.push(bullet.id);
      }
    }

    if (expired.length > 0) {
      onExpireMany(expired);
    }

    if (hitBotCounts.size > 0) {
      onBotHits(Object.fromEntries(hitBotCounts));
    }

    if (pendingPlayerDamage > 0) {
      onDamagePlayer(pendingPlayerDamage);
    }
  });

  return (
    <>
      {bullets.map((bullet) => (
        <mesh
          ref={(node) => {
            if (node) refs.current.set(bullet.id, node);
            else refs.current.delete(bullet.id);
          }}
          position={bullet.pos}
        >
          <sphereGeometry args={[bullet.size, 8, 8]} />
          <meshBasicMaterial color={bullet.color} />
        </mesh>
      ))}
    </>
  );
}

function FruitBotUnit({ bot, style }) {
  const root = useRef(null);
  const portal = useRef(null);
  const leftArm = useRef(null);
  const rightArm = useRef(null);
  const leftFoot = useRef(null);
  const rightFoot = useRef(null);
  const hpBillboard = useRef(null);

  useFrame((state, delta) => {
    if (!root.current) return;

    const spawnStartedAt = bot.spawnStartedAt ?? 0;
    const spawnDuration = bot.spawnDuration ?? 780;
    const spawnProgress = spawnStartedAt > 0 ? clamp01((performance.now() - spawnStartedAt) / spawnDuration) : 1;
    const spawnScale = 0.2 + 0.8 * easeOutBack(spawnProgress);

    root.current.scale.setScalar(spawnScale);

    if (portal.current) {
      portal.current.visible = spawnProgress < 1;
      portal.current.material.opacity = 0.12 + (1 - spawnProgress) * 0.62;
      portal.current.rotation.z += delta * 1.8;
      portal.current.position.y = 0.06 + Math.sin(state.clock.elapsedTime * 4) * 0.02;
    }

    if (spawnProgress < 1) {
      if (hpBillboard.current) {
        hpBillboard.current.quaternion.copy(state.camera.quaternion);
      }
      return;
    }

    const targetX = bot.x;
    const targetZ = bot.z;
    const dx = targetX - root.current.position.x;
    const dz = targetZ - root.current.position.z;
    const dist = Math.hypot(dx, dz);

    root.current.position.x += dx * Math.min(1, delta * 8);
    root.current.position.z += dz * Math.min(1, delta * 8);

    if (dist > 0.002) {
      const targetYaw = Math.atan2(dx, dz);
      root.current.rotation.y += (targetYaw - root.current.rotation.y) * Math.min(1, delta * 10);
    }

    const movingFactor = dist > 0.008 ? 1 : 0.2;
    const swing = Math.sin(state.clock.elapsedTime * (5 + bot.speed * 3) + bot.x * 0.23) * 0.35 * movingFactor;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;

    const step = Math.sin(state.clock.elapsedTime * (5 + bot.speed * 3) + bot.z * 0.19) * 0.26 * movingFactor;
    if (leftFoot.current) {
      leftFoot.current.position.y = 0.22 + Math.max(0, step * 0.12);
      leftFoot.current.rotation.x = -step * 0.8;
    }
    if (rightFoot.current) {
      rightFoot.current.position.y = 0.22 + Math.max(0, -step * 0.12);
      rightFoot.current.rotation.x = step * 0.8;
    }

    if (hpBillboard.current) {
      hpBillboard.current.quaternion.copy(state.camera.quaternion);
    }
  });

  const hpRatio = THREE.MathUtils.clamp((bot.hp ?? 0) / Math.max(1, bot.maxHp ?? 100), 0, 1);
  const isHit = (bot.hitFlashUntil ?? 0) > performance.now();
  const bodyColor = isHit ? '#ff5f5f' : style.body;

  return (
    <group ref={root} position={[bot.x, 0, bot.z]}>
      <mesh ref={portal} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[bot.radius * 0.34, bot.radius * 1.42, 32]} />
        <meshBasicMaterial color="#7af0ff" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[bot.radius * 0.58, 24]} />
        <meshBasicMaterial color="#59d9ff" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[bot.radius * 0.52, 14, 14]} />
        <meshStandardMaterial color={style.detail} roughness={0.56} metalness={0.09} />
      </mesh>

      <mesh position={[0, 1.28, 0]}>
        <sphereGeometry args={[bot.radius, 18, 18]} />
        <meshStandardMaterial color={bodyColor} emissive={isHit ? '#9a2020' : style.detail} emissiveIntensity={isHit ? 0.5 : 0.1} roughness={0.44} metalness={0.08} />
      </mesh>

      <mesh position={[0, 1.22, bot.radius * 0.88]}>
        <sphereGeometry args={[bot.radius * 0.34, 14, 14]} />
        <meshStandardMaterial color="#fff4dc" roughness={0.48} metalness={0.04} />
      </mesh>

      <mesh ref={leftArm} position={[bot.radius * 0.72, 0.88, 0]}>
        <sphereGeometry args={[bot.radius * 0.2, 10, 10]} />
        <meshStandardMaterial color={style.body} roughness={0.5} metalness={0.06} />
      </mesh>

      <mesh ref={rightArm} position={[-bot.radius * 0.72, 0.88, 0]}>
        <sphereGeometry args={[bot.radius * 0.2, 10, 10]} />
        <meshStandardMaterial color={style.body} roughness={0.5} metalness={0.06} />
      </mesh>

      <mesh ref={leftFoot} position={[bot.radius * 0.35, 0.22, 0.08]}>
        <sphereGeometry args={[bot.radius * 0.22, 10, 10]} />
        <meshStandardMaterial color={style.detail} roughness={0.55} metalness={0.08} />
      </mesh>

      <mesh ref={rightFoot} position={[-bot.radius * 0.35, 0.22, 0.08]}>
        <sphereGeometry args={[bot.radius * 0.22, 10, 10]} />
        <meshStandardMaterial color={style.detail} roughness={0.55} metalness={0.08} />
      </mesh>

      <mesh position={[-bot.radius * 0.24, 1.35, bot.radius * 0.78]}>
        <sphereGeometry args={[bot.radius * 0.08, 8, 8]} />
        <meshBasicMaterial color="#1f2732" />
      </mesh>

      <mesh position={[bot.radius * 0.24, 1.35, bot.radius * 0.78]}>
        <sphereGeometry args={[bot.radius * 0.08, 8, 8]} />
        <meshBasicMaterial color="#1f2732" />
      </mesh>

      <mesh position={[0, 1.78, 0]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.16, 0.28, 10]} />
        <meshStandardMaterial color={style.leaf} roughness={0.7} metalness={0.05} />
      </mesh>

      <group ref={hpBillboard} position={[0, 2.28, 0]}>
        <mesh>
          <planeGeometry args={[1.1, 0.14]} />
          <meshBasicMaterial color="#2f1f1f" transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[-(1.1 * (1 - hpRatio)) / 2, 0, 0.001]}>
          <planeGeometry args={[1.1 * hpRatio, 0.1]} />
          <meshBasicMaterial color={hpRatio > 0.5 ? '#55d775' : hpRatio > 0.25 ? '#f2bf4f' : '#ff6767'} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function FruitBots({ bots }) {
  const palette = {
    banana: { body: '#ffd34d', detail: '#7b4f1d', leaf: '#74b06f' },
    watermelon: { body: '#5bbf5b', detail: '#f16d75', leaf: '#3e8f4f' },
    coconut: { body: '#8f6d4f', detail: '#5a412e', leaf: '#6ea06a' },
    lime: { body: '#9ae86b', detail: '#53b44f', leaf: '#5c9d4f' },
  };

  return (
    <>
      {bots.map((bot) => {
        const style = palette[bot.fruit] ?? palette.lime;
        return <FruitBotUnit key={bot.id} bot={bot} style={style} />;
      })}
    </>
  );
}

function BotDirector({ active, bots, setBots, playerPosRef, onSpawnBullet }) {
  const lastShotByBot = useRef(new Map());

  useEffect(() => {
    if (!active) return undefined;

    const id = window.setInterval(() => {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const now = performance.now();

      setBots((prev) => prev.map((bot) => {
        const dx = px - bot.x;
        const dz = pz - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 0.0001) return bot;

        const spawnStartedAt = bot.spawnStartedAt ?? 0;
        const spawnDuration = bot.spawnDuration ?? 780;
        const spawnProgress = spawnStartedAt > 0 ? clamp01((now - spawnStartedAt) / spawnDuration) : 1;
        if (spawnProgress < 1) {
          return bot;
        }

        const attackRange = bot.attackRange ?? 7.2;
        if (dist <= attackRange) {
          const lastShot = lastShotByBot.current.get(bot.id) ?? 0;
          const cooldownMs = bot.attackCooldownMs ?? 1200;
          if (now - lastShot >= cooldownMs) {
            const shotDirection = new THREE.Vector3(dx, 0.06, dz).normalize();
            onSpawnBullet({
              id: `${now}-${bot.id}-${Math.random().toString(16).slice(2)}`,
              pos: [bot.x, 1.28, bot.z],
              vel: [shotDirection.x * (bot.bulletSpeed ?? 12), shotDirection.y * (bot.bulletSpeed ?? 12), shotDirection.z * (bot.bulletSpeed ?? 12)],
              size: 0.08,
              color: '#ff5f5f',
              owner: 'bot',
              damage: bot.damage ?? 2,
            });
            lastShotByBot.current.set(bot.id, now);
          }
          return bot;
        }

        const step = Math.min(bot.speed * 0.12, Math.max(0, dist - attackRange));
        const nx = bot.x + (dx / dist) * step;
        const nz = bot.z + (dz / dist) * step;
        const resolved = resolveObstacleCollisions(nx, nz, bot.radius);

        const planar = Math.hypot(resolved.x, resolved.z);
        if (planar > WORLD_RADIUS - 0.7) {
          const inv = (WORLD_RADIUS - 0.7) / planar;
          return { ...bot, x: resolved.x * inv, z: resolved.z * inv };
        }

        return { ...bot, x: resolved.x, z: resolved.z };
      }));
    }, 120);

    return () => window.clearInterval(id);
  }, [active, playerPosRef, setBots, onSpawnBullet]);

  useEffect(() => {
    const alive = new Set(bots.map((bot) => bot.id));
    lastShotByBot.current.forEach((_, id) => {
      if (!alive.has(id)) lastShotByBot.current.delete(id);
    });
  }, [bots]);

  return null;
}

function ShootingSystem({ enabled, weapon, onSpawnBullet, onShot }) {
  const { camera } = useThree();
  const lastShotRef = useRef(0);
  const tmpForward = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpMuzzle = useRef(new THREE.Vector3());
  const tmpDirection = useRef(new THREE.Vector3());

  useEffect(() => {
    const onMouseDown = (event) => {
      if (event.button !== 0 || !enabled) return;

      const now = performance.now();
      if (now - lastShotRef.current < weapon.cooldownMs) return;
      if (!onShot()) return;

      lastShotRef.current = now;

      camera.getWorldDirection(tmpForward.current);
      tmpTarget.current.copy(camera.position).add(tmpForward.current.clone().multiplyScalar(120));
      tmpMuzzle.current.copy(camera.position).add(new THREE.Vector3(0.24, -0.1, -0.46).applyQuaternion(camera.quaternion));

      for (let i = 0; i < weapon.pellets; i += 1) {
        const spreadDir = tmpDirection.current
          .copy(tmpTarget.current)
          .sub(tmpMuzzle.current)
          .normalize()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * weapon.spread,
              (Math.random() - 0.5) * weapon.spread,
              (Math.random() - 0.5) * weapon.spread,
            ),
          )
          .normalize();

        onSpawnBullet({
          id: `${now}-${i}-${Math.random().toString(16).slice(2)}`,
          pos: [tmpMuzzle.current.x, tmpMuzzle.current.y, tmpMuzzle.current.z],
          vel: [spreadDir.x * weapon.speed, spreadDir.y * weapon.speed, spreadDir.z * weapon.speed],
          size: weapon.size,
          color: weapon.color,
          owner: 'player',
          damage: 34,
        });
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [camera, enabled, onShot, onSpawnBullet, weapon]);

  return null;
}

function useAudioEngine(play, paused) {
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const musicGainRef = useRef(null);
  const musicFilterRef = useRef(null);
  const musicIntervalRef = useRef(null);
  const musicStepRef = useRef(0);

  const ensureContext = () => {
    const existingContext = audioContextRef.current;
    if (existingContext) {
      if (existingContext.state === 'suspended') {
        void existingContext.resume();
      }
      return existingContext;
    }

    const context = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.24;
    masterGain.connect(context.destination);

    const musicFilter = context.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 720;

    const musicGain = context.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(musicFilter);
    musicFilter.connect(masterGain);

    audioContextRef.current = context;
    masterGainRef.current = masterGain;
    musicGainRef.current = musicGain;
    musicFilterRef.current = musicFilter;
    return context;
  };

  const stopMusic = () => {
    if (musicIntervalRef.current) {
      window.clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
    musicStepRef.current = 0;
    const context = audioContextRef.current;
    if (context) {
      try {
        context.suspend();
      } catch {
        // No-op.
      }
    }
  };

  const startMusic = () => {
    if (!play) return;
    const context = ensureContext();
    if (!context || musicIntervalRef.current) return;
    if (context.state === 'suspended') {
      void context.resume();
    }

    const chords = [
      [196, 247, 294],
      [174, 220, 262],
      [185, 233, 277],
      [164, 207, 247],
    ];
    const melody = [440, 494, 523, 494, 392, 440, 349, 392];
    const tempoMs = 420;

    musicIntervalRef.current = window.setInterval(() => {
      const currentContext = audioContextRef.current;
      const musicGain = musicGainRef.current;
      if (!currentContext || !musicGain) return;

      const time = currentContext.currentTime;
      const chord = chords[musicStepRef.current % chords.length];
      chord.forEach((frequency, index) => {
        const oscillator = currentContext.createOscillator();
        const gain = currentContext.createGain();
        oscillator.type = index === 0 ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.05, time + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
        oscillator.connect(gain);
        gain.connect(musicGain);
        oscillator.start(time);
        oscillator.stop(time + 0.45);
      });

      const melodyOsc = currentContext.createOscillator();
      const melodyGain = currentContext.createGain();
      melodyOsc.type = 'sine';
      melodyOsc.frequency.value = melody[musicStepRef.current % melody.length];
      melodyGain.gain.setValueAtTime(0.0001, time);
      melodyGain.gain.exponentialRampToValueAtTime(0.024, time + 0.04);
      melodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
      melodyOsc.connect(melodyGain);
      melodyGain.connect(musicGain);
      melodyOsc.start(time);
      melodyOsc.stop(time + 0.3);

      musicStepRef.current += 1;
    }, tempoMs);
  };

  const playShot = (isEnemy = false) => {
    const context = ensureContext();
    if (!context || !masterGainRef.current) return;
    const time = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = isEnemy ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(isEnemy ? 180 : 320, time);
    oscillator.frequency.exponentialRampToValueAtTime(isEnemy ? 110 : 180, time + 0.08);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(isEnemy ? 0.08 : 0.12, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    oscillator.connect(gain);
    gain.connect(masterGainRef.current);
    oscillator.start(time);
    oscillator.stop(time + 0.16);
  };

  useEffect(() => {
    if (play) {
      startMusic();
    } else {
      stopMusic();
    }

    return () => {
      stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return { playShot, ensureContext };
}

function MiniMapRadar({ playerPosRef, bots }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => (n + 1) % 10000);
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  const px = playerPosRef.current.x;
  const pz = playerPosRef.current.z;

  const radarSize = 116;
  const radarCenter = radarSize / 2;

  const toRadar = (x, z) => {
    const relX = x - px;
    const relZ = z - pz;
    const range = WORLD_RADIUS * 1.35;
    const clampedX = THREE.MathUtils.clamp(relX / range, -1, 1);
    const clampedZ = THREE.MathUtils.clamp(relZ / range, -1, 1);
    const radius = radarSize * 0.42;
    return {
      left: radarCenter + clampedX * radius,
      top: radarCenter + clampedZ * radius,
    };
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 14,
        top: 14,
        zIndex: 10,
        display: 'block',
      }}
    >
      <div
        style={{
          width: radarSize,
          background: 'rgba(7, 13, 22, 0.78)',
          border: '1px solid rgba(126, 173, 255, 0.7)',
          borderRadius: 10,
          padding: 8,
          color: '#cce5ff',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Radar</div>
        <div style={{ position: 'relative', width: radarSize, height: radarSize, borderRadius: '50%', overflow: 'hidden', background: 'radial-gradient(circle, rgba(88,123,173,0.2), rgba(10,16,24,0.95))', border: '1px solid rgba(157, 194, 255, 0.4)' }}>
          <div style={{ position: 'absolute', inset: '14%', borderRadius: '50%', border: '1px solid rgba(197, 221, 255, 0.25)' }} />
          <div style={{ position: 'absolute', inset: '30%', borderRadius: '50%', border: '1px solid rgba(197, 221, 255, 0.2)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%)' }} />

          {bots.map((bot) => {
            const pos = toRadar(bot.x, bot.z);
            return (
              <div
                key={`radar-bot-${bot.id}`}
                style={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ff5353',
                  border: '1px solid #ffd0d0',
                  boxShadow: '0 0 10px rgba(255, 70, 70, 0.95)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}

          <div
            style={{
              position: 'absolute',
              left: radarCenter,
              top: radarCenter,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ffffff',
              border: '2px solid #49b3ff',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ObstacleField({ obstacleTextureRed, obstacleTextureGreen, obstacleTextureBlue, orbTexture }) {
  const textureById = {
    'crate-red': obstacleTextureRed,
    'tower-green': obstacleTextureGreen,
    'block-blue': obstacleTextureBlue,
  };

  return (
    <>
      {MAP_OBSTACLES.map((obstacle) => {
        if (obstacle.type === 'circle') {
          return (
            <group key={obstacle.id} position={[obstacle.x, 0, obstacle.z]}>
              <mesh position={[0, 0.26, 0]}>
                <cylinderGeometry args={[obstacle.radius + 0.2, obstacle.radius + 0.2, 0.36, 28]} />
                <meshStandardMaterial color="#2d4154" roughness={0.85} metalness={0.16} />
              </mesh>
              <mesh position={[0, 2.2, 0]}>
                <sphereGeometry args={[obstacle.radius, 24, 24]} />
                <meshStandardMaterial map={orbTexture} color="#9ce0ff" emissive="#2a4f6b" emissiveIntensity={0.2} roughness={0.32} metalness={0.25} />
              </mesh>
            </group>
          );
        }

        const texture = textureById[obstacle.id] ?? obstacleTextureBlue;
        const height = obstacle.id === 'tower-green' ? 3 : 2;

        return (
          <group key={obstacle.id} position={[obstacle.x, 0, obstacle.z]}>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[Math.max(obstacle.width, obstacle.depth) * 0.58, Math.max(obstacle.width, obstacle.depth) * 0.58, 0.28, 20]} />
              <meshStandardMaterial color="#32465d" roughness={0.82} metalness={0.18} />
            </mesh>
            <mesh position={[0, height * 0.5, 0]} castShadow>
              <boxGeometry args={[obstacle.width, height, obstacle.depth]} />
              <meshStandardMaterial map={texture} color="#c8d6e6" roughness={0.72} metalness={0.14} />
            </mesh>
            <mesh position={[0, height + 0.08, 0]}>
              <boxGeometry args={[obstacle.width * 0.82, 0.12, obstacle.depth * 0.82]} />
              <meshStandardMaterial color="#e0e7ef" emissive="#425a74" emissiveIntensity={0.12} roughness={0.58} metalness={0.2} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Overlay({
  play,
  paused,
  pointerLocked,
  selectedMode,
  setSelectedMode,
  modeMessage,
  botsRemaining,
  playerHealth,
  playerName,
  weapon,
  ammo,
  remotePlayers,
  socketId,
  connectionStatus,
  onStart,
  onContinue,
  onBackToStart,
  onRestartGame,
  selectedWeaponId,
  setSelectedWeaponId,
  draftName,
  setDraftName,
  playerPosRef,
  bots,
}) {
  if (!play) {
    return (
      <div className="menu" style={{ zIndex: 20 }}>
        <div className="intro-card" style={{ maxWidth: 640 }}>
          <p className="intro-kicker">Arcade Survival</p>
          <h1>Fruit Strike 3D</h1>
          <p className="intro-copy">Entra, captura el mouse y sobrevive con la mejor fruta-arma.</p>

          <p className="selector-title" style={{ marginTop: 0 }}>Modo de Juego</p>
          <div className="mode-selector" style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setSelectedMode('solo')}
              className={`mode-card ${selectedMode === 'solo' ? 'mode-card--active-solo' : ''}`}
            >
              <span className="mode-card__kicker">Disponible</span>
              <span className="mode-card__title">Jugar Solo</span>
              <span className="mode-card__desc">Entra a la arena y elimina todos los bots de frutas.</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('multiplayer')}
              className={`mode-card ${selectedMode === 'multiplayer' ? 'mode-card--active-multi' : ''}`}
            >
              <span className="mode-card__kicker">Online</span>
              <span className="mode-card__title">Multijugador</span>
              <span className="mode-card__desc">Hasta 4 jugadores en la misma arena con estado sincronizado.</span>
            </button>
          </div>
          {selectedMode === 'multiplayer' && (
            <p className="mode-message mode-message--warn" style={{ marginTop: 0 }}>
              Sala online activa. Se conectará al servidor configurado y admitirá hasta 4 jugadores.
            </p>
          )}
          {modeMessage && (
            <p className="mode-message mode-message--error" style={{ marginTop: 0 }}>
              {modeMessage}
            </p>
          )}

          <label htmlFor="nickname">Tu apodo</label>
          <input
            id="nickname"
            className="intro-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={16}
            placeholder="Ej: MangoPro"
          />

          <p className="selector-title">Elige arma</p>
          <div className="weapon-selector" style={{ marginBottom: 12 }}>
            {WEAPONS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeaponId(w.id)}
                className={`weapon-card ${selectedWeaponId === w.id ? 'weapon-card--active' : ''}`}
                style={{ '--weapon-color': w.color }}
              >
                <span className="weapon-name">{w.name}</span>
                <span className="weapon-ammo">Balas: {w.ammo} · Cadencia: {Math.round(1000 / w.cooldownMs)}ps</span>
              </button>
            ))}
          </div>

          <button type="button" className="start-button" onClick={onStart}>
            {selectedMode === 'multiplayer' ? 'Entrar Online' : 'Entrar a la Arena'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!paused && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            border: '2px solid white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: selectedMode === 'multiplayer' ? '50%' : 12,
          transform: selectedMode === 'multiplayer' ? 'translateX(-50%)' : 'none',
          zIndex: 10,
          color: '#f2fff4',
          background: 'rgba(8, 14, 20, 0.65)',
          border: '1px solid #3f6a59',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 13,
        }}
      >
        {playerName} | {weapon.name} | Municion: {ammo} | Vida: {playerHealth} | Bots restantes: {botsRemaining}
      </div>

      <div style={{ position: 'absolute', top: selectedMode === 'multiplayer' ? 56 : 45, left: 12, zIndex: 10, width: 286, background: 'rgba(8, 14, 20, 0.78)', border: '1px solid rgba(126, 173, 255, 0.45)', borderRadius: 12, padding: '10px 12px', boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, color: '#eaf4ff' }}>
          <span style={{ fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', opacity: 0.85 }}>Vida</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{Math.max(0, Math.round(playerHealth))}/100</span>
        </div>
        <div style={{ position: 'relative', width: '100%', height: 18, borderRadius: 999, background: 'rgba(30, 42, 60, 0.95)', border: '1px solid rgba(160, 190, 220, 0.35)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, playerHealth))}%`, height: '100%', background: playerHealth > 55 ? 'linear-gradient(90deg, #43c77f, #71dd95)' : playerHealth > 25 ? 'linear-gradient(90deg, #d8a644, #f0c06a)' : 'linear-gradient(90deg, #c14949, #eb6464)', transition: 'width 120ms linear' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#f8fbff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)', letterSpacing: 0.45 }}>
            Combate activo
          </div>
        </div>
      </div>

      {selectedMode === 'multiplayer' && play && (
        <div style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 10, width: 240, background: 'rgba(8, 14, 20, 0.82)', border: '1px solid rgba(126, 173, 255, 0.45)', borderRadius: 10, padding: '10px 12px', color: '#d9ebff', boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28)' }}>
          <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, opacity: 0.9 }}>
            Jugadores conectados {remotePlayers.length}/4
          </div>
          <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.85, color: connectionStatus === 'connected' ? '#8ff0a4' : connectionStatus === 'error' || connectionStatus === 'full' ? '#ffb3b3' : '#d9ebff' }}>
            {connectionStatus === 'connected' && 'Sala conectada'}
            {connectionStatus === 'connecting' && 'Buscando sala...'}
            {connectionStatus === 'disconnected' && 'Desconectado, reintentando'}
            {connectionStatus === 'full' && 'Sala llena'}
            {connectionStatus === 'error' && 'No se pudo conectar'}
            {connectionStatus === 'idle' && 'Esperando conexión'}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {remotePlayers.map((player) => {
              const isSelf = player.id === socketId;
              return (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isSelf ? '#ffffff' : '#d9ebff' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: player.color ?? '#78c7ff', boxShadow: `0 0 8px ${player.color ?? '#78c7ff'}` }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.name ?? 'Jugador'}
                  </span>
                  {isSelf && <span style={{ fontSize: 10, opacity: 0.7 }}>tú</span>}
                </div>
              );
            })}
            {remotePlayers.length === 0 && connectionStatus === 'connected' && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Esperando jugadores...</div>
            )}
            {remotePlayers.length === 0 && (connectionStatus === 'connecting' || connectionStatus === 'idle' || connectionStatus === 'disconnected') && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Conectando sala...</div>
            )}
            {remotePlayers.length === 0 && connectionStatus === 'error' && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Revisa que el servidor Socket.io esté activo.</div>
            )}
            {remotePlayers.length === 0 && connectionStatus === 'full' && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>La sala ya tiene 4 jugadores.</div>
            )}
          </div>
        </div>
      )}

      {selectedMode === 'solo' && botsRemaining === 0 && (
        <div style={{ position: 'absolute', top: 54, left: 12, zIndex: 10, color: '#e9ffd7', background: 'rgba(22, 53, 31, 0.76)', border: '1px solid #5fb17e', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          Arena limpia. Has eliminado todos los bots de frutas.
        </div>
      )}

      {playerHealth <= 0 && (
        <div style={{ position: 'absolute', top: 54, left: 12, zIndex: 10, color: '#ffe2e2', background: 'rgba(88, 24, 24, 0.8)', border: '1px solid #d07b7b', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          Te han derrotado. Puedes jugar de nuevo ahora.
        </div>
      )}

      {playerHealth <= 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              minWidth: 260,
              padding: '18px 24px',
              borderRadius: 14,
              border: '1px solid rgba(255, 160, 160, 0.45)',
              background: 'linear-gradient(180deg, rgba(82, 20, 20, 0.82), rgba(43, 12, 12, 0.86))',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.48)',
              textAlign: 'center',
              color: '#ffe3e3',
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, letterSpacing: 1.2 }}>PERDISTE</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Elige una opcion para continuar.</div>
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="pause-button pause-button--primary"
                onClick={onRestartGame}
              >
                Jugar de Nuevo
              </button>
              <button
                type="button"
                className="pause-button"
                onClick={onBackToStart}
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}

      {!paused && (
        <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10, color: '#dff7e6', fontSize: 12 }}>
          WASD mover | Shift correr | Espacio saltar | Click disparar | R recargar | ESC menu
        </div>
      )}

      {!paused && <MiniMapRadar playerPosRef={playerPosRef} bots={bots} />}

      {paused && playerHealth > 0 && (
        <div className="pause-menu" style={{ zIndex: 25 }}>
          <div className="pause-card" style={{ width: 'min(90vw, 460px)' }}>
            <h2>Juego en Pausa</h2>
            <p>{pointerLocked ? 'Cursor capturado.' : 'Cursor libre. Usa Continuar para volver al juego.'}</p>
            <button
              type="button"
              className="pause-button pause-button--primary"
              onClick={onContinue}
            >
              Continuar
            </button>
            <button
              type="button"
              className="pause-button"
              onClick={onBackToStart}
            >
              Volver al Inicio
            </button>
            <button
              type="button"
              className="pause-button"
              onClick={onRestartGame}
            >
              Reiniciar Juego
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const controlsRef = useRef(null);
  const waveRef = useRef(1);
  const waveSpawnTimeoutRef = useRef(null);
  const [play, setPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [selectedMode, setSelectedMode] = useState('solo');
  const [modeMessage, setModeMessage] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [selectedWeaponId, setSelectedWeaponId] = useState(WEAPONS[0].id);
  const [weaponId, setWeaponId] = useState(WEAPONS[0].id);
  const [ammo, setAmmo] = useState(WEAPONS[0].ammo);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [bullets, setBullets] = useState([]);
  const [bots, setBots] = useState([]);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [socketId, setSocketId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const ammoRef = useRef(WEAPONS[0].ammo);

  const playerPosRef = useRef({ x: 0, z: 0 });
  const shotSignalRef = useRef(0);

  const weapon = WEAPON_BY_ID[weaponId] ?? WEAPONS[0];
  const groundTexture = useMemo(() => createGroundTexture(), []);
  const obstacleTextureRed = useMemo(() => createObstacleTexture('#45272b', '#ff9a9a'), []);
  const obstacleTextureGreen = useMemo(() => createObstacleTexture('#1f3b2a', '#8cf2a9'), []);
  const obstacleTextureBlue = useMemo(() => createObstacleTexture('#2b3548', '#b7cff6'), []);
  const orbTexture = useMemo(() => createOrbTexture(), []);
  const arenaPaintTexture = useMemo(() => createArenaPaintTexture(), []);
  const { playShot, ensureContext } = useAudioEngine(play, paused);

  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);

  useEffect(() => {
    return () => {
      groundTexture.dispose();
      obstacleTextureRed.dispose();
      obstacleTextureGreen.dispose();
      obstacleTextureBlue.dispose();
      orbTexture.dispose();
      arenaPaintTexture.dispose();
    };
  }, [groundTexture, obstacleTextureRed, obstacleTextureGreen, obstacleTextureBlue, orbTexture, arenaPaintTexture]);

  const lockPointer = () => {
    controlsRef.current?.lock();
  };

  const forceCursorDefault = () => {
    document.body.style.cursor = 'default';
    document.documentElement.style.cursor = 'default';
  };

  const unlockPointer = () => {
    controlsRef.current?.unlock();
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    forceCursorDefault();
  };

  const ensureMenuCursorVisible = () => {
    forceCursorDefault();
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    window.setTimeout(() => {
      forceCursorDefault();
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }, 40);
  };

  const keyboardMap = useMemo(
    () => [
      { name: 'moveForward', keys: ['KeyW', 'ArrowUp'] },
      { name: 'moveBackward', keys: ['KeyS', 'ArrowDown'] },
      { name: 'moveLeft', keys: ['KeyA', 'ArrowLeft'] },
      { name: 'moveRight', keys: ['KeyD', 'ArrowRight'] },
      { name: 'jump', keys: ['Space'] },
      { name: 'shift', keys: ['ShiftLeft', 'ShiftRight'] },
    ],
    [],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyR' && play && !paused) {
        const reloaded = WEAPON_BY_ID[weaponId].ammo;
        ammoRef.current = reloaded;
        setAmmo(reloaded);
      }

      if (event.code !== 'Escape' && event.key !== 'Escape') return;
      if (!play || event.repeat) return;

      const locked = Boolean(document.pointerLockElement);

      if (locked) {
        unlockPointer();
        setPaused(true);
        return;
      }

      if (paused) {
        setPaused(false);
        requestAnimationFrame(() => lockPointer());
      } else {
        setPaused(true);
      }

      event.preventDefault();
    };

    const onPointerLockChange = () => {
      const locked = Boolean(document.pointerLockElement);
      setPointerLocked(locked);
      if (!locked) {
        forceCursorDefault();
      }
      if (play && !locked && !paused) {
        setPaused(true);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [play, paused, weaponId]);

  useEffect(() => {
    document.body.style.cursor = play && !paused ? 'none' : 'default';
    document.documentElement.style.cursor = play && !paused ? 'none' : 'default';
    return () => {
      document.body.style.cursor = 'default';
      document.documentElement.style.cursor = 'default';
    };
  }, [play, paused]);

  const onStart = () => {
    const cleanName = draftName.trim();
    if (!cleanName) return;

    setModeMessage('');

    setPlayerName(cleanName);
    setWeaponId(selectedWeaponId);
    const startAmmo = WEAPON_BY_ID[selectedWeaponId].ammo;
    ammoRef.current = startAmmo;
    setAmmo(startAmmo);
    setPlayerHealth(100);
    waveRef.current = 1;
    if (waveSpawnTimeoutRef.current) {
      window.clearTimeout(waveSpawnTimeoutRef.current);
      waveSpawnTimeoutRef.current = null;
    }
    void ensureContext();
    setRemotePlayers([]);
    setSocketId(null);
    setConnectionStatus('idle');
    setBots(selectedMode === 'solo' ? SOLO_BOTS_TEMPLATE.map((bot) => stampBotSpawn({ ...bot })) : []);
    setPlay(true);
    setPaused(false);
    window.focus();
    requestAnimationFrame(() => lockPointer());
  };

  const onContinue = () => {
    setPaused(false);
    window.focus();
    requestAnimationFrame(() => lockPointer());
  };

  const onBackToStart = () => {
    unlockPointer();
    setPaused(false);
    setPlay(false);
    setBullets([]);
    setBots([]);
    setRemotePlayers([]);
    setSocketId(null);
    setConnectionStatus('idle');
    setPlayerHealth(100);
    if (waveSpawnTimeoutRef.current) {
      window.clearTimeout(waveSpawnTimeoutRef.current);
      waveSpawnTimeoutRef.current = null;
    }
    waveRef.current = 1;
    const resetAmmo = WEAPON_BY_ID[selectedWeaponId].ammo;
    ammoRef.current = resetAmmo;
    setAmmo(resetAmmo);
    setPlayerName('');
    setModeMessage('');
    setConnectionStatus('idle');
    ensureMenuCursorVisible();
  };

  const onRestartGame = () => {
    unlockPointer();
    setPaused(false);
    setPlay(true);
    setBullets([]);
    setPlayerHealth(100);
    waveRef.current = 1;
    if (waveSpawnTimeoutRef.current) {
      window.clearTimeout(waveSpawnTimeoutRef.current);
      waveSpawnTimeoutRef.current = null;
    }
    const resetAmmo = WEAPON_BY_ID[weaponId].ammo;
    ammoRef.current = resetAmmo;
    setAmmo(resetAmmo);
    void ensureContext();
    setConnectionStatus('idle');
    setBots(selectedMode === 'solo' ? SOLO_BOTS_TEMPLATE.map((bot) => stampBotSpawn({ ...bot })) : []);
    window.focus();
    requestAnimationFrame(() => lockPointer());
  };

  const onShot = () => {
    if (!play || paused) return false;
    if (ammoRef.current <= 0) return false;
    const nextAmmo = ammoRef.current - 1;
    ammoRef.current = nextAmmo;
    setAmmo(nextAmmo);
    shotSignalRef.current += 1;
    playShot(false);
    return true;
  };

  const onSpawnBullet = (bullet) => {
    if (bullet.owner === 'bot') {
      playShot(true);
    }
    setBullets((prev) => {
      const next = [...prev, bullet];
      if (next.length > 80) return next.slice(next.length - 56);
      return next;
    });
  };

  const removeBullets = (ids) => {
    if (ids.length === 0) return;
    const removeSet = new Set(ids);
    setBullets((prev) => prev.filter((bullet) => !removeSet.has(bullet.id)));
  };

  const onPositionChange = (x, z) => {
    playerPosRef.current.x = x;
    playerPosRef.current.z = z;
  };

  const onBotHits = (hitMap) => {
    const entries = Object.entries(hitMap ?? {});
    if (entries.length === 0) return;

    setBots((prev) => prev
      .map((bot) => {
        const hits = hitMap[bot.id] ?? 0;
        if (hits <= 0) return bot;
        const damagePerHit = 34;
        const nextHp = Math.max(0, (bot.hp ?? bot.maxHp ?? 100) - hits * damagePerHit);
        return {
          ...bot,
          hp: nextHp,
          hitFlashUntil: performance.now() + 120,
        };
      })
      .filter((bot) => (bot.hp ?? 0) > 0));
  };

  const onDamagePlayer = (amount) => {
    if (!play || paused) return;
    setPlayerHealth((current) => Math.max(0, current - amount));
  };

  useEffect(() => {
    if (!play) return;
    if (playerHealth > 0) return;
    unlockPointer();
    setPaused(true);
  }, [play, playerHealth]);

  useEffect(() => {
    if (!play || paused || selectedMode !== 'solo' || playerHealth <= 0) return;
    if (bots.length > 0) return;
    if (waveSpawnTimeoutRef.current) return;

    waveRef.current += 1;
    waveSpawnTimeoutRef.current = window.setTimeout(() => {
      setBots(createWaveBots(5, waveRef.current).map((bot) => stampBotSpawn(bot)));
      waveSpawnTimeoutRef.current = null;
    }, 850);

    return () => {
      if (waveSpawnTimeoutRef.current) {
        window.clearTimeout(waveSpawnTimeoutRef.current);
        waveSpawnTimeoutRef.current = null;
      }
    };
  }, [play, paused, selectedMode, playerHealth, bots.length]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#05070b', position: 'relative', overflow: 'hidden' }}>
      <Overlay
        play={play}
        paused={paused}
        pointerLocked={pointerLocked}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        modeMessage={modeMessage}
        botsRemaining={bots.length}
        playerHealth={playerHealth}
        playerName={playerName}
        weapon={weapon}
        ammo={ammo}
        remotePlayers={remotePlayers}
        socketId={socketId}
        connectionStatus={connectionStatus}
        onStart={onStart}
        onContinue={onContinue}
        onBackToStart={onBackToStart}
        onRestartGame={onRestartGame}
        selectedWeaponId={selectedWeaponId}
        setSelectedWeaponId={setSelectedWeaponId}
        draftName={draftName}
        setDraftName={setDraftName}
        playerPosRef={playerPosRef}
        bots={bots}
      />

      <KeyboardControls map={keyboardMap}>
        <Canvas
          dpr={[1, 1.2]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          camera={{ fov: 75, near: 0.1, far: 600, position: [0, 1.7, 8] }}
          style={{ pointerEvents: 'auto' }}
          onCreated={({ camera }) => {
            camera.lookAt(0, 1.7, 0);
          }}
        >
          {play && <PointerLockControls ref={controlsRef} enabled={!paused} />}

          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <directionalLight position={[15, 25, 10]} intensity={0.65} />

          <Grid infiniteGrid fadeDistance={50} cellColor="#444" sectionColor="#666" />

          <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[WORLD_RADIUS + 0.7, WORLD_RADIUS + 0.7, 3.6, 56, 1, true]} />
            <meshStandardMaterial color="#354860" roughness={0.78} metalness={0.22} side={THREE.DoubleSide} />
          </mesh>

          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[WORLD_RADIUS * 0.78, WORLD_RADIUS * 0.95, 64]} />
            <meshStandardMaterial map={arenaPaintTexture} color="#d6b36f" transparent opacity={0.76} roughness={0.9} metalness={0.02} />
          </mesh>

          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[WORLD_RADIUS * 0.96, WORLD_RADIUS, 64]} />
            <meshStandardMaterial color="#f0d089" emissive="#7a6230" emissiveIntensity={0.2} roughness={0.76} metalness={0.05} />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial map={groundTexture} color="#6d7f91" roughness={0.92} metalness={0.03} />
          </mesh>

          <ObstacleField
            obstacleTextureRed={obstacleTextureRed}
            obstacleTextureGreen={obstacleTextureGreen}
            obstacleTextureBlue={obstacleTextureBlue}
            orbTexture={orbTexture}
          />

          <FruitBots bots={bots} />
          {play && selectedMode === 'multiplayer' && (
            <MultiplayerSync
              enabled={!paused && playerHealth > 0}
              playerName={playerName}
              playerPosRef={playerPosRef}
              onSocketId={setSocketId}
              onPlayers={setRemotePlayers}
              onStatus={setConnectionStatus}
              onSelfHealth={setPlayerHealth}
            />
          )}
          {remotePlayers
            .filter((player) => player.id !== socketId)
            .map((player) => (
              <OtherPlayer key={player.id} player={player} />
            ))}
          <BotDirector active={play && !paused && selectedMode === 'solo' && playerHealth > 0 && bots.length > 0} bots={bots} setBots={setBots} playerPosRef={playerPosRef} onSpawnBullet={onSpawnBullet} />

          {play && (
            <>
              <PlayerController enabled={!paused} onPositionChange={onPositionChange} shotSignalRef={shotSignalRef} weaponColor={weapon.color} />
              <ShootingSystem enabled={!paused} weapon={weapon} onSpawnBullet={onSpawnBullet} onShot={onShot} />
            </>
          )}

          <BulletLayer bullets={bullets} bots={bots} playerPosRef={playerPosRef} onExpireMany={removeBullets} onBotHits={onBotHits} onDamagePlayer={onDamagePlayer} />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
