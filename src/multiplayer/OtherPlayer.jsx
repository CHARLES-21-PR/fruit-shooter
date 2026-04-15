import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function OtherPlayer({ player }) {
  const root = useRef(null);
  const targetPosition = useRef(new THREE.Vector3(player.x, player.y ?? 1.7, player.z));
  const targetRotation = useRef(player.rotationY ?? 0);
  const currentRotation = useRef(player.rotationY ?? 0);

  useEffect(() => {
    targetPosition.current.set(player.x, player.y ?? 1.7, player.z);
    targetRotation.current = player.rotationY ?? 0;
  }, [player.x, player.y, player.z, player.rotationY]);

  useFrame((_, delta) => {
    if (!root.current) return;

    const smoothFactor = Math.min(1, delta * 10);
    root.current.position.lerp(targetPosition.current, smoothFactor);
    currentRotation.current = THREE.MathUtils.lerp(currentRotation.current, targetRotation.current, smoothFactor);
    root.current.rotation.y = currentRotation.current;
  });

  const bodyColor = player.color ?? '#78c7ff';

  return (
    <group ref={root} position={[player.x, player.y ?? 1.7, player.z]}>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.56, 1.05, 0.56]} />
        <meshStandardMaterial color={bodyColor} roughness={0.55} metalness={0.08} />
      </mesh>

      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#f1dcc4" roughness={0.72} metalness={0.02} />
      </mesh>

      <mesh position={[0, 1.83, 0]}>
        <boxGeometry args={[0.34, 0.1, 0.34]} />
        <meshStandardMaterial color="#2a3240" roughness={0.82} metalness={0.06} />
      </mesh>

      <mesh position={[-0.17, 0.18, 0]}>
        <boxGeometry args={[0.14, 0.34, 0.14]} />
        <meshStandardMaterial color="#31465a" roughness={0.78} />
      </mesh>

      <mesh position={[0.17, 0.18, 0]}>
        <boxGeometry args={[0.14, 0.34, 0.14]} />
        <meshStandardMaterial color="#31465a" roughness={0.78} />
      </mesh>
    </group>
  );
}
