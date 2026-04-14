import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, Stars, Box, Sphere, Plane } from '@react-three/drei';
import { Physics, useSphere, useBox, usePlane } from '@react-three/cannon';
import * as THREE from 'three';
import { create } from 'zustand';

// 1. ESTADO DEL JUEGO (Zustand)
const useStore = create((set) => ({
  health: 100,
  playerName: '',
  playerColor: 'hotpink',
  isDead: false,
  setProfile: (name, color) => set({ playerName: name, playerColor: color }),
  damage: (amt) => set((s) => ({ health: Math.max(0, s.health - amt), isDead: s.health - amt <= 0 })),
  respawn: () => set({ health: 100, isDead: false })
}));

// 2. JUGADOR Y MOVIMIENTO
function Player() {
  const { camera } = useThree();
  const [ref, api] = useSphere(() => ({ mass: 1, type: 'Dynamic', position: [0, 2, 0], args: [1] }));
  const velocity = useRef([0, 0, 0]);
  useEffect(() => api.velocity.subscribe(v => velocity.current = v), [api.velocity]);

  useFrame(() => {
    camera.position.copy(ref.current.position);
    // Aquí podrías añadir lógica de teclado WASD para mover 'api.velocity'
  });

  return <mesh ref={ref} />;
}

// 3. MAPA Y OBSTÁCULOS
function Arena() {
  usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] }));
  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <Stars />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} castShadow />
      
      {/* Obstáculos tipo CS */}
      <Obstacle pos={[5, 1, -5]} size={[2, 2, 2]} color="orange" />
      <Obstacle pos={[-5, 1, 5]} size={[4, 2, 1]} color="cyan" />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </>
  );
}

function Obstacle({ pos, size, color }) {
  const [ref] = useBox(() => ({ type: 'Static', position: pos, args: size }));
  return (
    <Box ref={ref} args={size} castShadow receiveShadow>
      <meshStandardMaterial color={color} />
    </Box>
  );
}

// 4. INTERFAZ (UI)
function UI() {
  const { health, isDead, respawn, playerName, setProfile } = useStore();
  const [input, setInput] = useState("");

  if (!playerName) return (
    <div className="menu">
      <h1>FRUIT STRIKE 3D</h1>
      <input placeholder="Nombre" onChange={e => setInput(e.target.value)} />
      <button onClick={() => setProfile(input, 'hotpink')}>ENTRAR</button>
    </div>
  );

  return (
    <>
      <div className="crosshair" />
      <div className="hud">
        <p>Jugador: {playerName}</p>
        <div className="health-bar-bg"><div className="health-bar-fill" style={{ width: `${health}%` }} /></div>
      </div>
      {isDead && (
        <div className="death-screen">
          <h1>¡HAS MUERTO!</h1>
          <button onClick={respawn}>REAPARECER</button>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <>
      <UI />
      <Canvas shadows>
        <Physics gravity={[0, -9.8, 0]}>
          <Player />
          <Arena />
        </Physics>
        <PointerLockControls />
      </Canvas>
    </>
  );
}