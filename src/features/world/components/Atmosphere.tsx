'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlanetConfig } from '../types';

interface AtmosphereProps {
  planetConfig: PlanetConfig;
}

export function Atmosphere({ planetConfig }: AtmosphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const atmosphereRadius = planetConfig.radius * 1.15;

  const geometry = useMemo(
    () => new THREE.SphereGeometry(atmosphereRadius, 64, 64),
    [atmosphereRadius]
  );

  // Slight shimmer animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const shimmer = Math.sin(clock.getElapsedTime() * 0.3) * 0.02 + 0.12;
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.opacity.value = shimmer;
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          opacity: { value: 0.12 },
          glowColor: { value: new THREE.Color(0x4488ff) },
        }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float opacity;
          uniform vec3 glowColor;
          varying vec3 vNormal;
          varying vec3 vPosition;

          void main() {
            vec3 viewDir = normalize(-vPosition);
            float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
            rim = pow(rim, 3.0);
            gl_FragColor = vec4(glowColor, rim * opacity);
          }
        `}
      />
    </mesh>
  );
}
