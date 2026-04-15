import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { KeyboardControls, Sky, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';

const WEAPONS = [
  {
    id: 'platano-glock',
    name: 'Platano-Glock',
    ammo: 12,
    color: '#ffd54f',
    bulletColor: '#ffe88b',
    bulletSize: 0.12,
    bulletSpeed: 24,
    cooldownMs: 220,
    pellets: 1,
    spread: 0.01,
  },
  {
    id: 'sandia-rifle',
    name: 'Sandia-Rifle',
    ammo: 30,
    color: '#66bb6a',
    bulletColor: '#8de98e',
    bulletSize: 0.09,
    bulletSpeed: 32,
    cooldownMs: 90,
    pellets: 1,
    spread: 0.004,
  },
  {
    id: 'coco-shotgun',
    name: 'Coco-Shotgun',
    ammo: 8,
    color: '#8d6e63',
    bulletColor: '#d8c3ac',
    bulletSize: 0.13,
    bulletSpeed: 22,
    cooldownMs: 480,
    pellets: 6,
    spread: 0.08,
  },
];

const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((weapon) => [weapon.id, weapon]));

function createTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createGroundTexture() {
  return createTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#48724a');
    gradient.addColorStop(1, '#2f5336');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const n = Math.sin((x * 0.2 + y * 0.14) * 0.1) * 0.5 + 0.5;
        const shade = Math.floor(25 + n * 45);
        ctx.fillStyle = `rgba(${shade}, ${80 + shade}, ${shade}, 0.17)`;
        ctx.fillRect(x, y, 8, 8);
      }
    }

    ctx.strokeStyle = 'rgba(190, 170, 120, 0.24)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(20, h * 0.2);
    ctx.bezierCurveTo(w * 0.2, h * 0.1, w * 0.42, h * 0.42, w * 0.56, h * 0.4);
    ctx.bezierCurveTo(w * 0.73, h * 0.37, w * 0.82, h * 0.26, w - 20, h * 0.32);
    ctx.stroke();

    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.bezierCurveTo(w * 0.22, h * 0.65, w * 0.5, h * 0.86, w, h * 0.7);
    ctx.stroke();
  });
}

function createWallTexture() {
  return createTexture((ctx, w, h) => {
    ctx.fillStyle = '#8b7c63';
    ctx.fillRect(0, 0, w, h);

    const size = 54;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const odd = ((x / size) + (y / size)) % 2 === 0;
        ctx.fillStyle = odd ? '#9b8a6b' : '#7c6e56';
        ctx.fillRect(x, y, size - 3, size - 3);
      }
    }

    ctx.fillStyle = 'rgba(35, 28, 20, 0.2)';
    for (let i = 0; i < 700; i += 1) {
      const x = (i * 73) % w;
      const y = (i * 53) % h;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createWeaponTexture(weapon) {
  return createTexture((ctx, w, h) => {
    ctx.fillStyle = weapon.color;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 14; i += 1) {
      const alpha = i % 2 === 0 ? 0.2 : 0.08;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, i * 34, w, 12);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(18, 16, w - 36, 26);
  });
}


const useStore = create((set, get) => ({
  playerName: '',
  gameStarted: false,
  isPaused: false,
  weaponId: WEAPONS[0].id,
  ammo: WEAPONS[0].ammo,
  setProfile: (name) => set({ playerName: name.trim(), gameStarted: true, isPaused: false }),
  setLoadout: (weapon) => set({ weaponId: weapon.id, ammo: weapon.ammo }),
  consumeAmmo: (amount = 1) => {
    const currentAmmo = get().ammo;
    if (currentAmmo < amount) return false;
    set({ ammo: currentAmmo - amount });
    return true;
  },
  reload: () => {
    const weapon = WEAPON_BY_ID[get().weaponId];
    set({ ammo: weapon.ammo });
  },
  setPaused: (paused) => set({ isPaused: paused }),
}));

function MouseLookController({ enabled }) {
  const { camera } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const last = useRef(null);

  useEffect(() => {
    const onMove = (event) => {
      if (!enabled) return;

      if (last.current) {
        const deltaX = (event.movementX ?? (event.clientX - last.current.x)) || 0;
        const deltaY = (event.movementY ?? (event.clientY - last.current.y)) || 0;
        yaw.current -= deltaX * 0.0032;
        pitch.current -= deltaY * 0.0032;
        pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current));
      }

      last.current = { x: event.clientX, y: event.clientY };
    };

    const onLeave = () => {
      last.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
  }, -2);

  return null;
}

function Weapon({ shotSignalRef }) {
  const weaponId = useStore((s) => s.weaponId);
  const { camera } = useThree();
  const weapon = WEAPON_BY_ID[weaponId];
  const group = useRef();
  const recoil = useRef(0);
  const flash = useRef(0);
  const lastShotSignal = useRef(0);
  const viewOffset = useRef(new THREE.Vector3());
  const baseOffset = useRef(new THREE.Vector3(0.25, -0.2, -0.46));
  const texture = useMemo(() => createWeaponTexture(weapon), [weapon]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const signal = shotSignalRef?.current ?? 0;
    if (signal !== lastShotSignal.current) {
      lastShotSignal.current = signal;
      recoil.current = 1;
      flash.current = 1;
    }

    const bob = Math.sin(state.clock.elapsedTime * 6.2) * 0.0012;
    recoil.current = Math.max(0, recoil.current - delta * 11);
    flash.current = Math.max(0, flash.current - delta * 22);

    viewOffset.current
      .copy(baseOffset.current)
      .setY(baseOffset.current.y + bob - recoil.current * 0.01)
      .setZ(baseOffset.current.z + recoil.current * 0.045)
      .applyQuaternion(camera.quaternion);

    group.current.position.copy(camera.position).add(viewOffset.current);
    group.current.quaternion.copy(camera.quaternion);
  }, 1);

  const material = <meshStandardMaterial map={texture} metalness={0.12} roughness={0.62} />;

  const renderModel = () => {
    if (weapon.id === 'sandia-rifle') {
      return (
        <group>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.62, 14]} />
            {material}
          </mesh>
          <mesh position={[0.06, -0.05, 0.02]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.09, 0.15, 0.14]} />
            {material}
          </mesh>
        </group>
      );
    }

    if (weapon.id === 'coco-shotgun') {
      return (
        <group>
          <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.46, 16]} />
            {material}
          </mesh>
          <mesh position={[0.07, -0.04, 0.02]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.1, 0.2, 0.12]} />
            {material}
          </mesh>
        </group>
      );
    }

    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 14]} />
          {material}
        </mesh>
        <mesh position={[0.055, -0.045, 0.02]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.08, 0.14, 0.1]} />
          {material}
        </mesh>
      </group>
    );
  };

  return (
    <group ref={group}>
      <group>{renderModel()}</group>
      <mesh position={[0.06, -0.02, -0.34]} visible={flash.current > 0.01}>
        <sphereGeometry args={[0.028 + flash.current * 0.018, 10, 10]} />
        <meshBasicMaterial color="#ffe2a8" transparent opacity={0.35 + flash.current * 0.65} />
      </mesh>
    </group>
  );
}

function PlayerController({ onPositionChange, shotSignalRef }) {
  const { camera } = useThree();
  const isPaused = useStore((s) => s.isPaused);
  const [, getKeys] = useKeyboardControls();

  const position = useRef(new THREE.Vector3(0, 1.8, 0));
  const horizontalVel = useRef(new THREE.Vector3(0, 0, 0));
  const verticalVel = useRef(0);
  const canJump = useRef(true);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const targetMove = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (isPaused) return;

    const {
      moveForward,
      moveBackward,
      moveLeft,
      moveRight,
      jump,
      shift,
    } = getKeys();

    const speed = shift ? 8.5 : 4.9;
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(new THREE.Vector3(0, 1, 0), forward.current).normalize();

    targetMove.current.set(0, 0, 0);
    if (moveForward) targetMove.current.add(forward.current);
    if (moveBackward) targetMove.current.sub(forward.current);
    if (moveLeft) targetMove.current.add(right.current);
    if (moveRight) targetMove.current.sub(right.current);

    if (targetMove.current.lengthSq() > 0) {
      targetMove.current.normalize().multiplyScalar(speed);
    }

    horizontalVel.current.lerp(targetMove.current, 0.18);

    if (jump && canJump.current) {
      verticalVel.current = 6.1;
      canJump.current = false;
    }

    verticalVel.current -= 14.2 * delta;

    position.current.x += horizontalVel.current.x * delta;
    position.current.z += horizontalVel.current.z * delta;
    position.current.y += verticalVel.current * delta;

    const mapRadius = 12;
    const planarDistance = Math.hypot(position.current.x, position.current.z);
    if (planarDistance > mapRadius) {
      const inv = mapRadius / planarDistance;
      position.current.x *= inv;
      position.current.z *= inv;
    }

    if (position.current.y <= 1.8) {
      position.current.y = 1.8;
      verticalVel.current = 0;
      canJump.current = true;
    }

    camera.position.copy(position.current);
    camera.updateMatrixWorld();

    if (onPositionChange) onPositionChange(position.current.x, position.current.z);
  }, -1);

  return <Weapon shotSignalRef={shotSignalRef} />;
}

function BulletVisual({ data, onRef }) {
  if (data.weaponId === 'platano-glock') {
    return (
      <group ref={onRef} position={data.position}>
        <mesh rotation={[0.4, 0.2, 0.1]}>
          <cylinderGeometry args={[data.size * 0.68, data.size * 0.52, data.size * 1.8, 7]} />
          <meshBasicMaterial color="#FFD700" />
        </mesh>
      </group>
    );
  }

  if (data.weaponId === 'sandia-rifle') {
    return (
      <group ref={onRef} position={data.position}>
        <mesh>
          <sphereGeometry args={[data.size * 1.15, 8, 8]} />
          <meshBasicMaterial color="#6cff9f" />
        </mesh>
      </group>
    );
  }

  if (data.weaponId === 'coco-shotgun') {
    return (
      <group ref={onRef} position={data.position}>
        <mesh>
          <sphereGeometry args={[data.size * 1.3, 9, 9]} />
          <meshBasicMaterial color="#9a5a2e" />
        </mesh>
      </group>
    );
  }

  return (
    <mesh ref={onRef} position={data.position} castShadow>
      <sphereGeometry args={[data.size, 12, 12]} />
      <meshBasicMaterial color={data.color} />
    </mesh>
  );
}

function TraceVisual({ data, onRef }) {
  const dir = useMemo(() => new THREE.Vector3(data.dir[0], data.dir[1], data.dir[2]).normalize(), [data.dir]);
  const pos = useMemo(() => {
    const start = new THREE.Vector3(data.start[0], data.start[1], data.start[2]);
    return start.add(dir.clone().multiplyScalar(0.55));
  }, [data.start, dir]);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dir]);

  return (
    <mesh ref={onRef} position={[pos.x, pos.y, pos.z]} quaternion={quat}>
      <cylinderGeometry args={[data.size * 0.14, data.size * 0.2, 0.95, 6]} />
      <meshBasicMaterial color={data.color} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

function BulletsLayer({ bullets, onExpireMany }) {
  const refs = useRef(new Map());
  const ages = useRef(new Map());

  useEffect(() => {
    const activeIds = new Set(bullets.map((b) => b.id));
    refs.current.forEach((_, id) => {
      if (!activeIds.has(id)) {
        refs.current.delete(id);
        ages.current.delete(id);
      }
    });
  }, [bullets]);

  useFrame((_, delta) => {
    if (bullets.length === 0) return;
    const expired = [];

    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      const ref = refs.current.get(bullet.id);
      if (!ref) continue;

      const age = (ages.current.get(bullet.id) ?? 0) + delta;
      ages.current.set(bullet.id, age);

      ref.position.x += bullet.velocity[0] * delta;
      ref.position.y += bullet.velocity[1] * delta;
      ref.position.z += bullet.velocity[2] * delta;

      if (age > 0.95 || Math.abs(ref.position.x) > 18 || Math.abs(ref.position.z) > 18 || ref.position.y < 0.2) {
        expired.push(bullet.id);
      }
    }

    if (expired.length > 0) {
      onExpireMany(expired);
    }
  });

  return (
    <>
      {bullets.map((bullet) => (
        <BulletVisual
          key={bullet.id}
          data={bullet}
          onRef={(node) => {
            if (node) refs.current.set(bullet.id, node);
            else refs.current.delete(bullet.id);
          }}
        />
      ))}
    </>
  );
}

function TracesLayer({ traces, onExpireMany }) {
  const refs = useRef(new Map());
  const ages = useRef(new Map());

  useEffect(() => {
    const activeIds = new Set(traces.map((t) => t.id));
    refs.current.forEach((_, id) => {
      if (!activeIds.has(id)) {
        refs.current.delete(id);
        ages.current.delete(id);
      }
    });
  }, [traces]);

  useFrame((_, delta) => {
    if (traces.length === 0) return;
    const expired = [];

    for (let i = 0; i < traces.length; i += 1) {
      const trace = traces[i];
      const ref = refs.current.get(trace.id);
      if (!ref) continue;

      const age = (ages.current.get(trace.id) ?? 0) + delta;
      ages.current.set(trace.id, age);

      const t = 1 - age / 0.06;
      ref.visible = t > 0;
      if (ref.material) {
        ref.material.opacity = Math.max(0, t);
      }

      if (age > 0.06) {
        expired.push(trace.id);
      }
    }

    if (expired.length > 0) {
      onExpireMany(expired);
    }
  });

  return (
    <>
      {traces.map((trace) => {
        const hasValidData = Array.isArray(trace?.dir) && trace.dir.length === 3 && Array.isArray(trace?.start) && trace.start.length === 3;
        if (!hasValidData) return null;
        return (
          <TraceVisual
            key={trace.id}
            data={trace}
            onRef={(node) => {
              if (node) refs.current.set(trace.id, node);
              else refs.current.delete(trace.id);
            }}
          />
        );
      })}
    </>
  );
}

function ShootingSystem({ onSpawnBullet, onShot }) {
  const { camera } = useThree();
  const gameStarted = useStore((s) => s.gameStarted);
  const isPaused = useStore((s) => s.isPaused);
  const weaponId = useStore((s) => s.weaponId);
  const consumeAmmo = useStore((s) => s.consumeAmmo);
  const reload = useStore((s) => s.reload);
  const lastShot = useRef(0);
  const directionRef = useRef(new THREE.Vector3());
  const startRef = useRef(new THREE.Vector3());
  const muzzleOffsetRef = useRef(new THREE.Vector3(0.24, -0.1, -0.46));
  const tempOffsetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const shoot = (event) => {
      if (event.button !== 0 || !gameStarted || isPaused) return;

      const weapon = WEAPON_BY_ID[weaponId];
      const now = performance.now();
      if (now - lastShot.current < weapon.cooldownMs) return;
      if (!consumeAmmo(1)) return;

      lastShot.current = now;

      const direction = directionRef.current;
      const start = startRef.current;
      const offset = tempOffsetRef.current.copy(muzzleOffsetRef.current).applyQuaternion(camera.quaternion);

      camera.getWorldDirection(direction);
      start.copy(camera.position).add(offset);
      onShot?.({
        start: [start.x, start.y, start.z],
        dir: [direction.x, direction.y, direction.z],
        color: weapon.bulletColor,
        size: weapon.bulletSize,
      });
      for (let i = 0; i < weapon.pellets; i += 1) {
        const spreadDir = direction
          .clone()
          .add(new THREE.Vector3(
            (Math.random() - 0.5) * weapon.spread,
            (Math.random() - 0.5) * weapon.spread,
            (Math.random() - 0.5) * weapon.spread,
          ))
          .normalize();

        onSpawnBullet({
          id: `${now}-${i}-${Math.random().toString(16).slice(2)}`,
          position: [start.x, start.y, start.z],
          velocity: [
            spreadDir.x * weapon.bulletSpeed,
            spreadDir.y * weapon.bulletSpeed,
            spreadDir.z * weapon.bulletSpeed,
          ],
          size: weapon.bulletSize,
          color: weapon.bulletColor,
          weaponId: weaponId,
        });
      }
    };

    const reloadWeapon = (event) => {
      if (event.code !== 'KeyR' || !gameStarted || isPaused) return;
      reload();
    };

    window.addEventListener('mousedown', shoot);
    window.addEventListener('keydown', reloadWeapon);
    return () => {
      window.removeEventListener('mousedown', shoot);
      window.removeEventListener('keydown', reloadWeapon);
    };
  }, [camera, consumeAmmo, gameStarted, isPaused, onShot, onSpawnBullet, reload, weaponId]);

  return null;
}

function Minimap({ playerPosRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const scale = w / 26;
    const centerX = w / 2;
    const centerY = h / 2;

    const obstacles = [
      { pos: [3.2, 1.6], size: [1.0, 0.8] },
      { pos: [-3.8, -3.6], size: [1.4, 1.0] },
      { pos: [-4.2, 3.0], size: [1.6, 1.2] },
      { pos: [4.8, -1.4], size: [1.2, 1.0] },
      { pos: [0.0, -3.8], size: [0.9, 1.2] },
      { pos: [-1.2, 4.2], size: [1.1, 0.9] },
      { pos: [2.0, -1.0], size: [0.8, 0.8] },
      { pos: [-2.0, 1.0], size: [0.8, 0.8] },
    ];

    let rafId;
    let lastPaint = 0;
    const draw = (time) => {
      if (time - lastPaint < 66) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastPaint = time;

      ctx.fillStyle = '#0f1f2a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#3a6a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12 * scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(150, 80, 80, 0.8)';
      obstacles.forEach((obs) => {
        const x = centerX + obs.pos[0] * scale - (obs.size[0] * scale) / 2;
        const y = centerY + obs.pos[1] * scale - (obs.size[1] * scale) / 2;
        ctx.fillRect(x, y, obs.size[0] * scale, obs.size[1] * scale);
      });

      const playerPos = playerPosRef?.current;
      if (playerPos) {
        ctx.fillStyle = '#4ade80';
        const px = centerX + playerPos.x * scale;
        const py = centerY + playerPos.z * scale;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [playerPosRef]);

  return (
    <div className="minimap-container">
      <div className="minimap-label">Mapa</div>
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        style={{ border: '2px solid #3a6a5a', borderRadius: '6px', display: 'block' }}
      />
    </div>
  );
}

function UI({ onContinue, onStartGame, playerPosRef }) {
  const { gameStarted, isPaused, setLoadout, setProfile, weaponId, ammo, playerName } = useStore();
  const [name, setName] = useState('');
  const [selectedWeapon, setSelectedWeapon] = useState(WEAPONS[0]);

  const weapon = WEAPON_BY_ID[weaponId];

  const handleStart = () => {
    if (!name.trim()) return;
    setLoadout(selectedWeapon);
    setProfile(name);
    onStartGame();
  };

  if (!gameStarted) {
    return (
      <div className="menu menu--intro">
        <div className="intro-card">
          <p className="intro-kicker">Arena PvP Tropical</p>
          <h1>FRUIT STRIKE 3D</h1>
          <p className="intro-copy">Configura tu nombre y tu arma antes de entrar al combate.</p>

          <label htmlFor="nickname">Tu apodo</label>
          <input
            id="nickname"
            className="intro-input"
            placeholder="Ej: MangoPro"
            maxLength={16}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <p className="selector-title">Elige tu arma</p>
          <div className="weapon-selector">
            {WEAPONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`weapon-card ${selectedWeapon.id === item.id ? 'weapon-card--active' : ''}`}
                style={{ '--weapon-color': item.color }}
                onClick={() => setSelectedWeapon(item)}
              >
                <span className="weapon-name">{item.name}</span>
                <span className="weapon-ammo">Balas: {item.ammo}</span>
              </button>
            ))}
          </div>

          <button className="start-button" onClick={handleStart}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isPaused && <div className="crosshair" />}
      <div className="weapon-hud">{playerName} | {weapon.name} | Municion: {ammo}</div>
      {!isPaused && (
        <div className="controls-hud">WASD mover | Shift correr | Espacio saltar | Click disparar | R recargar | ESC menu</div>
      )}
      {!isPaused && ammo <= 0 && <div className="ammo-empty">Sin balas! Presiona R para recargar</div>}
      {!isPaused && <Minimap playerPosRef={playerPosRef} />}

      {isPaused && (
        <div className="pause-menu">
          <div className="pause-card">
            <h2>Menu del Juego</h2>
            <p>ESC libero tu cursor. Ahora puedes usar el menu.</p>
            <button className="pause-button pause-button--primary" onClick={onContinue}>Continuar</button>
            <button className="pause-button" onClick={() => window.location.reload()}>Salir</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const gameStarted = useStore((s) => s.gameStarted);
  const isPaused = useStore((s) => s.isPaused);
  const setPaused = useStore((s) => s.setPaused);
  const [bullets, setBullets] = useState([]);
  const [traces, setTraces] = useState([]);
  const playerPosRef = useRef({ x: 0, z: 0 });
  const shotSignalRef = useRef(0);
    const keyboardMap = useMemo(() => ([
      { name: 'moveForward', keys: ['KeyW', 'ArrowUp'] },
      { name: 'moveBackward', keys: ['KeyS', 'ArrowDown'] },
      { name: 'moveLeft', keys: ['KeyA', 'ArrowLeft'] },
      { name: 'moveRight', keys: ['KeyD', 'ArrowRight'] },
      { name: 'jump', keys: ['Space'] },
      { name: 'shift', keys: ['ShiftLeft', 'ShiftRight'] },
    ]), []);

  const pendingBulletAddsRef = useRef([]);
  const pendingTraceAddsRef = useRef([]);
  const pendingBulletRemovesRef = useRef(new Set());
  const pendingTraceRemovesRef = useRef(new Set());
  const flushScheduledRef = useRef(false);

  useEffect(() => {
    const onDown = (event) => {
      const isEsc = event.code === 'Escape' || event.key === 'Escape';
      if (!isEsc) return;

      if (!useStore.getState().gameStarted) return;
      if (event.repeat) return;

      const currentlyPaused = useStore.getState().isPaused;
      useStore.getState().setPaused(!currentlyPaused);
      event.preventDefault();
    };

    window.addEventListener('keydown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
    };
  }, []);

  useEffect(() => {
    document.body.style.cursor = gameStarted && !isPaused ? 'none' : 'default';
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [gameStarted, isPaused]);

  const scheduleEntityFlush = () => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;

    requestAnimationFrame(() => {
      flushScheduledRef.current = false;

      setBullets((prev) => {
        let next = prev;

        if (pendingBulletRemovesRef.current.size > 0) {
          const removeSet = pendingBulletRemovesRef.current;
          next = next.filter((bullet) => !removeSet.has(bullet.id));
          removeSet.clear();
        }

        if (pendingBulletAddsRef.current.length > 0) {
          const adds = pendingBulletAddsRef.current;
          pendingBulletAddsRef.current = [];
          next = [...next, ...adds];
        }

        if (next.length > 80) {
          next = next.slice(next.length - 56);
        }

        return next;
      });

      setTraces((prev) => {
        let next = prev;

        if (pendingTraceRemovesRef.current.size > 0) {
          const removeSet = pendingTraceRemovesRef.current;
          next = next.filter((trace) => !removeSet.has(trace.id));
          removeSet.clear();
        }

        if (pendingTraceAddsRef.current.length > 0) {
          const adds = pendingTraceAddsRef.current;
          pendingTraceAddsRef.current = [];
          next = [...next, ...adds];
        }

        if (next.length > 30) {
          next = next.slice(next.length - 18);
        }

        return next;
      });
    });
  };

  const syncPlayerPos = (x, z) => {
    playerPosRef.current.x = x;
    playerPosRef.current.z = z;
  };

  const startGame = () => {
    setPaused(false);
    setTimeout(() => {
      window.focus();
    }, 0);
  };

  const spawnBullet = (bullet) => {
    pendingBulletAddsRef.current.push(bullet);
    scheduleEntityFlush();
  };

  const removeBullets = (ids) => {
    for (let i = 0; i < ids.length; i += 1) {
      pendingBulletRemovesRef.current.add(ids[i]);
    }
    scheduleEntityFlush();
  };

  const spawnTrace = (trace) => {
    const now = performance.now();
    pendingTraceAddsRef.current.push({ ...trace, id: `${now}-${Math.random().toString(16).slice(2)}` });
    scheduleEntityFlush();
    shotSignalRef.current += 1;
  };

  const removeTraces = (ids) => {
    for (let i = 0; i < ids.length; i += 1) {
      pendingTraceRemovesRef.current.add(ids[i]);
    }
    scheduleEntityFlush();
  };

  return (
    <KeyboardControls map={keyboardMap}>
      <UI onContinue={startGame} onStartGame={startGame} playerPosRef={playerPosRef} />
      <Canvas
        dpr={[1, 1.2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 75, near: 0.1, far: 600, position: [0, 1.8, 0] }}
        style={{ pointerEvents: gameStarted && !isPaused ? 'auto' : 'none' }}
        onPointerDown={() => {
          window.focus();
        }}
      >
        <MouseLookController enabled={gameStarted && !isPaused} />
        <Sky sunPosition={[40, 28, 50]} turbidity={8} rayleigh={1.4} />
        <ambientLight intensity={0.78} />
        <hemisphereLight intensity={0.58} groundColor="#594a2e" />
        <directionalLight position={[25, 35, 12]} intensity={0.68} />
        <fog attach="fog" args={['#87a9b9', 90, 260]} />

        <World />
        {gameStarted && <PlayerController onPositionChange={syncPlayerPos} shotSignalRef={shotSignalRef} />}
        {gameStarted && <ShootingSystem onSpawnBullet={spawnBullet} onShot={spawnTrace} />}
        <BulletsLayer bullets={bullets} onExpireMany={removeBullets} />
        <TracesLayer traces={traces} onExpireMany={removeTraces} />
      </Canvas>
    </KeyboardControls>
  );
}

function World() {
  return (
    <>
      <Floor />
      <RockObstacle pos={[3.2, 1.1, 1.6]} size={[1.0, 1.6, 0.8]} color="#c28756" />
      <RockObstacle pos={[-3.8, 1.2, -3.6]} size={[1.4, 1.8, 1.0]} color="#6f7f95" />
      <RockObstacle pos={[-4.2, 1.0, 3.0]} size={[1.6, 1.4, 1.2]} color="#af8a63" />
      <RockObstacle pos={[4.8, 1.1, -1.4]} size={[1.2, 1.6, 1.0]} color="#7a8a9c" />
      <RockObstacle pos={[0.0, 1.0, -3.8]} size={[0.9, 1.3, 1.2]} color="#a0956a" />
      <RockObstacle pos={[-1.2, 0.9, 4.2]} size={[1.1, 1.2, 0.9]} color="#8b8b7a" />
      <RockObstacle pos={[2.0, 1.05, -1.0]} size={[0.8, 1.4, 0.8]} color="#98845f" />
      <RockObstacle pos={[-2.0, 1.0, 1.0]} size={[0.8, 1.4, 0.8]} color="#88886f" />
      <BoundaryRing />
      <ArenaProps />
    </>
  );
}

function Floor() {
  const texture = useMemo(() => {
    const t = createGroundTexture();
    t.repeat.set(12, 12);
    return t;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 50, 1, 1]} />
      <meshStandardMaterial map={texture} roughness={0.96} metalness={0.02} />
    </mesh>
  );
}

function RockObstacle({ pos, size, color }) {
  const texture = useMemo(() => {
    const t = createWallTexture();
    t.repeat.set(Math.max(1, size[0] / 1.6), Math.max(1, size[1] / 1.8));
    return t;
  }, [size]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={texture} color={color} roughness={0.95} />
    </mesh>
  );
}

function BoundaryRing() {
  const pillars = [];
  const total = 14;
  const radius = 12.5;

  for (let i = 0; i < total; i += 1) {
    const angle = (i / total) * Math.PI * 2;
    pillars.push(
      <mesh key={i} position={[Math.cos(angle) * radius, 1.4, Math.sin(angle) * radius]} castShadow>
        <cylinderGeometry args={[0.4, 0.6, 2.8, 8]} />
        <meshStandardMaterial color="#7a7055" roughness={0.94} />
      </mesh>,
    );
  }

  return <>{pillars}</>;
}

function ArenaProps() {
  return (
    <>
      <mesh position={[1.2, 0.35, -4.4]}>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color="#5b7b5c" roughness={0.9} />
      </mesh>
      <mesh position={[-1.5, 0.3, 4.1]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#4f6950" roughness={0.92} />
      </mesh>
      <mesh position={[4.3, 0.34, 4.3]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color="#60785d" roughness={0.88} />
      </mesh>
      <mesh position={[-4.2, 0.32, -2.1]}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#556b57" roughness={0.91} />
      </mesh>
    </>
  );
}
