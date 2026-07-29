'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createPlanetGeometry } from '../utils/createPlanetGeometry';
import type { PlanetConfig } from '../types';

interface PlanetProps {
  config: PlanetConfig;
}

export function Planet({ config }: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, heightData } = useMemo(
    () => createPlanetGeometry(config),
    [config]
  );

  // Color gradient based on elevation
  const colors = useMemo(() => {
    const pos = geometry.attributes.position.array as Float32Array;
    const colorArray = new Float32Array(pos.length);

    for (let i = 0; i < heightData.length; i++) {
      const h = heightData[i];
      const idx = i * 3;

      // Deep ocean → shallow water → lowland → highland → peak
      if (h < 0.3) {
        // Ocean: deep blue to teal
        const t = h / 0.3;
        colorArray[idx] = 0.02 + t * 0.05;
        colorArray[idx + 1] = 0.05 + t * 0.15;
        colorArray[idx + 2] = 0.2 + t * 0.3;
      } else if (h < 0.45) {
        // Coast/shallow: teal to sand
        const t = (h - 0.3) / 0.15;
        colorArray[idx] = 0.07 + t * 0.3;
        colorArray[idx + 1] = 0.2 + t * 0.25;
        colorArray[idx + 2] = 0.5 - t * 0.3;
      } else if (h < 0.6) {
        // Lowland: sand to green
        const t = (h - 0.45) / 0.15;
        colorArray[idx] = 0.37 - t * 0.15;
        colorArray[idx + 1] = 0.45 + t * 0.2;
        colorArray[idx + 2] = 0.2 - t * 0.1;
      } else if (h < 0.8) {
        // Highland: green to brown
        const t = (h - 0.6) / 0.2;
        colorArray[idx] = 0.22 + t * 0.2;
        colorArray[idx + 1] = 0.65 - t * 0.3;
        colorArray[idx + 2] = 0.1 + t * 0.05;
      } else {
        // Peak: brown to white
        const t = (h - 0.8) / 0.2;
        colorArray[idx] = 0.42 + t * 0.3;
        colorArray[idx + 1] = 0.35 + t * 0.4;
        colorArray[idx + 2] = 0.15 + t * 0.5;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    return colorArray;
  }, [geometry, heightData]);

  // Slow rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.7}
        metalness={0.1}
        flatShading={false}
      />
    </mesh>
  );
}
