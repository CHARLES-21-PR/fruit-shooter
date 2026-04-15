import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, KeyboardControls, PointerLockControls, Sky } from '@react-three/drei';
import * as THREE from 'three';

const WEAPONS = [
  {
    id: 'platano-glock',
    name: 'Platano-Glock',
    color: '#ffd54f',
    ammo: 12,
    cooldownMs: 220,
    speed: 24,
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
    speed: 32,
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
    speed: 22,
    size: 0.12,
    pellets: 6,
    spread: 0.075,
  },
];

const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

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

  useFrame((_, delta) => {
    if (!enabled) return;

    const speed = input.shift ? 8.2 : 5;

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(new THREE.Vector3(0, 1, 0), forward.current).normalize();

    targetMove.current.set(0, 0, 0);
    if (input.forward) targetMove.current.add(forward.current);
    if (input.backward) targetMove.current.sub(forward.current);
    if (input.left) targetMove.current.add(right.current);
    if (input.right) targetMove.current.sub(right.current);

    if (targetMove.current.lengthSq() > 0) {
      targetMove.current.normalize().multiplyScalar(speed);
    }

    horizontalVel.current.lerp(targetMove.current, 0.2);

    if (input.jump && canJump.current) {
      verticalVel.current = 5.8;
      canJump.current = false;
    }

    verticalVel.current -= 14 * delta;

    position.current.x += horizontalVel.current.x * delta;
    position.current.z += horizontalVel.current.z * delta;
    position.current.y += verticalVel.current * delta;

    const mapRadius = 12;
    const planar = Math.hypot(position.current.x, position.current.z);
    if (planar > mapRadius) {
      const inv = mapRadius / planar;
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

function BulletLayer({ bullets, onExpireMany }) {
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

    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      const ref = refs.current.get(bullet.id);
      if (!ref) continue;

      const age = (ages.current.get(bullet.id) ?? 0) + delta;
      ages.current.set(bullet.id, age);

      ref.position.x += bullet.vel[0] * delta;
      ref.position.y += bullet.vel[1] * delta;
      ref.position.z += bullet.vel[2] * delta;

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
        <mesh
          key={bullet.id}
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

function ShootingSystem({ enabled, weapon, onSpawnBullet, onShot }) {
  const { camera } = useThree();
  const lastShotRef = useRef(0);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (event.button !== 0 || !enabled) return;

      const now = performance.now();
      if (now - lastShotRef.current < weapon.cooldownMs) return;
      if (!onShot()) return;

      lastShotRef.current = now;

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const start = camera.position.clone().add(new THREE.Vector3(0.24, -0.1, -0.46).applyQuaternion(camera.quaternion));

      for (let i = 0; i < weapon.pellets; i += 1) {
        const spreadDir = dir
          .clone()
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
          pos: [start.x, start.y, start.z],
          vel: [spreadDir.x * weapon.speed, spreadDir.y * weapon.speed, spreadDir.z * weapon.speed],
          size: weapon.size,
          color: weapon.color,
        });
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [camera, enabled, onShot, onSpawnBullet, weapon]);

  return null;
}

function MiniMap({ playerPosRef }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        zIndex: 10,
        background: 'rgba(6, 12, 20, 0.72)',
        border: '1px solid #355a46',
        borderRadius: 8,
        padding: '8px 10px',
        color: '#8ae3a6',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      X: {playerPosRef.current.x.toFixed(2)} | Z: {playerPosRef.current.z.toFixed(2)}
    </div>
  );
}

function Overlay({
  play,
  paused,
  playerName,
  weapon,
  ammo,
  onStart,
  onContinue,
  selectedWeaponId,
  setSelectedWeaponId,
  draftName,
  setDraftName,
  playerPosRef,
}) {
  if (!play) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 20 }}>
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(17,30,22,0.95), rgba(8,14,12,0.95))',
            border: '1px solid #3e6b53',
            borderRadius: 14,
            padding: 24,
            width: 'min(92vw, 560px)',
            color: '#e8f8e7',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>FRUIT STRIKE 3D</h1>
          <p style={{ marginTop: 0, opacity: 0.9 }}>Configura tu nombre y el arma para entrar.</p>

          <label htmlFor="nickname" style={{ display: 'block', marginBottom: 6 }}>Tu apodo</label>
          <input
            id="nickname"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={16}
            placeholder="Ej: MangoPro"
            style={{ width: '100%', marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #4e7a63' }}
          />

          <p style={{ marginBottom: 8 }}>Elige arma</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
            {WEAPONS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeaponId(w.id)}
                style={{
                  borderRadius: 8,
                  border: selectedWeaponId === w.id ? '2px solid #9ff3b8' : '1px solid #4e7a63',
                  background: '#132118',
                  color: '#e8f8e7',
                  padding: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700 }}>{w.name}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Balas: {w.ammo}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="start-button"
            onClick={onStart}
            style={{ padding: '12px 18px', fontSize: 16, borderRadius: 9, border: 'none', background: '#8ae3a6', cursor: 'pointer' }}
          >
            Entrar
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
          left: 12,
          zIndex: 10,
          color: '#f2fff4',
          background: 'rgba(8, 14, 20, 0.65)',
          border: '1px solid #3f6a59',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 13,
        }}
      >
        {playerName} | {weapon.name} | Municion: {ammo}
      </div>

      {!paused && (
        <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10, color: '#dff7e6', fontSize: 12 }}>
          WASD mover | Shift correr | Espacio saltar | Click disparar | R recargar | ESC menu
        </div>
      )}

      {!paused && <MiniMap playerPosRef={playerPosRef} />}

      {paused && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 25 }}>
          <div style={{ background: 'rgba(10, 16, 24, 0.94)', border: '1px solid #476b5a', borderRadius: 12, padding: 24, width: 'min(90vw, 420px)', color: '#f3fff5' }}>
            <h2 style={{ marginTop: 0 }}>Menu del Juego</h2>
            <p>ESC libera el cursor y abre este menu.</p>
            <button
              type="button"
              className="pause-button--primary"
              onClick={onContinue}
              style={{ width: '100%', padding: '12px 10px', borderRadius: 9, border: 'none', background: '#8ae3a6', cursor: 'pointer', marginBottom: 8 }}
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ width: '100%', padding: '12px 10px', borderRadius: 9, border: '1px solid #5b7366', background: '#1a2420', color: '#f3fff5', cursor: 'pointer' }}
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const controlsRef = useRef(null);
  const [play, setPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [selectedWeaponId, setSelectedWeaponId] = useState(WEAPONS[0].id);
  const [weaponId, setWeaponId] = useState(WEAPONS[0].id);
  const [ammo, setAmmo] = useState(WEAPONS[0].ammo);
  const [bullets, setBullets] = useState([]);

  const playerPosRef = useRef({ x: 0, z: 0 });
  const shotSignalRef = useRef(0);

  const weapon = WEAPON_BY_ID[weaponId] ?? WEAPONS[0];

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
        setAmmo(WEAPON_BY_ID[weaponId].ammo);
      }

      if (event.code !== 'Escape' && event.key !== 'Escape') return;
      if (!play || event.repeat) return;

      const locked = Boolean(document.pointerLockElement);

      if (locked) {
        controlsRef.current?.unlock();
        return;
      }

      if (paused) {
        setPaused(false);
        setTimeout(() => controlsRef.current?.lock(), 0);
      } else {
        setPaused(true);
      }

      event.preventDefault();
    };

    const onPointerLockChange = () => {
      const locked = Boolean(document.pointerLockElement);
      if (play && !locked) {
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
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [play, paused]);

  const onStart = () => {
    const cleanName = draftName.trim();
    if (!cleanName) return;

    setPlayerName(cleanName);
    setWeaponId(selectedWeaponId);
    setAmmo(WEAPON_BY_ID[selectedWeaponId].ammo);
    setPlay(true);
    setPaused(false);

    setTimeout(() => {
      window.focus();
      controlsRef.current?.lock();
    }, 0);
  };

  const onContinue = () => {
    setPaused(false);
    setTimeout(() => {
      window.focus();
      controlsRef.current?.lock();
    }, 0);
  };

  const onShot = () => {
    if (!play || paused) return false;
    let ok = false;
    setAmmo((current) => {
      if (current <= 0) return current;
      ok = true;
      return current - 1;
    });
    if (ok) shotSignalRef.current += 1;
    return ok;
  };

  const onSpawnBullet = (bullet) => {
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

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#05070b', position: 'relative', overflow: 'hidden' }}>
      <Overlay
        play={play}
        paused={paused}
        playerName={playerName}
        weapon={weapon}
        ammo={ammo}
        onStart={onStart}
        onContinue={onContinue}
        selectedWeaponId={selectedWeaponId}
        setSelectedWeaponId={setSelectedWeaponId}
        draftName={draftName}
        setDraftName={setDraftName}
        playerPosRef={playerPosRef}
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
          {play && <PointerLockControls ref={controlsRef} enabled={!paused} selector=".start-button, .pause-button--primary" />}

          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <directionalLight position={[15, 25, 10]} intensity={0.65} />

          <Grid infiniteGrid fadeDistance={50} cellColor="#444" sectionColor="#666" />

          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#111" />
          </mesh>

          <mesh position={[5, 1, 5]} castShadow>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="red" />
          </mesh>

          <mesh position={[0, 1.5, -6]} castShadow>
            <boxGeometry args={[2.2, 3, 2.2]} />
            <meshStandardMaterial color="#35d07f" emissive="#1e5a38" emissiveIntensity={0.35} />
          </mesh>

          <mesh position={[-3.5, 2.2, -9]}>
            <sphereGeometry args={[1.2, 20, 20]} />
            <meshStandardMaterial color="#8cd9ff" emissive="#2a4f6b" emissiveIntensity={0.3} />
          </mesh>

          <mesh position={[-6, 1.5, -3]} castShadow>
            <boxGeometry args={[1.8, 3, 2.2]} />
            <meshStandardMaterial color="#5d6f90" />
          </mesh>

          {play && (
            <>
              <PlayerController enabled={!paused} onPositionChange={onPositionChange} shotSignalRef={shotSignalRef} weaponColor={weapon.color} />
              <ShootingSystem enabled={!paused} weapon={weapon} onSpawnBullet={onSpawnBullet} onShot={onShot} />
            </>
          )}

          <BulletLayer bullets={bullets} onExpireMany={removeBullets} />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
