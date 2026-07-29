'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarsProps {
  count?: number;
  radius?: number;
}

export function Stars({ count = 3000, radius = 200 }: StarsProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, sizes, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Uniform distribution on sphere surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.5 + Math.random() * 0.5);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      siz[i] = 0.5 + Math.random() * 1.5;

      // Slight color variation: white to warm/cool
      const warmth = Math.random();
      col[i * 3] = 0.8 + warmth * 0.2;
      col[i * 3 + 1] = 0.8 + (1 - warmth) * 0.2;
      col[i * 3 + 2] = 0.9 + (1 - warmth) * 0.1;
    }

    return { positions: pos, sizes: siz, colors: col };
  }, [count, radius]);

  // Subtle parallax rotation
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.003;
      pointsRef.current.rotation.x += delta * 0.001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[sizes, 1]} attach="attributes-size" />
        <bufferAttribute args={[colors, 3]} attach="attributes-color" />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
