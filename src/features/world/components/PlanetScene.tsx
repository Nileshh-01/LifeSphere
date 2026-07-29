'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Planet } from './Planet';
import { Atmosphere } from './Atmosphere';
import { Stars } from './Stars';
import { LoadingScreen } from './LoadingScreen';
import { DEFAULT_PLANET_CONFIG, DEFAULT_CAMERA_CONFIG } from '../types';
import type { CameraConfig, PlanetConfig } from '../types';

interface PlanetSceneProps {
  planetConfig?: PlanetConfig;
  cameraConfig?: CameraConfig;
}

export function PlanetScene({
  planetConfig = DEFAULT_PLANET_CONFIG,
  cameraConfig = DEFAULT_CAMERA_CONFIG,
}: PlanetSceneProps) {
  // Compute camera position from spherical coordinates
  const cameraPosition = useMemo(() => {
    const distance = planetConfig.radius * cameraConfig.initialDistanceMultiplier;
    const x = distance * Math.sin(cameraConfig.initialPolarAngle) * Math.sin(cameraConfig.initialAzimuthalAngle);
    const y = distance * Math.cos(cameraConfig.initialPolarAngle);
    const z = distance * Math.sin(cameraConfig.initialPolarAngle) * Math.cos(cameraConfig.initialAzimuthalAngle);
    return new THREE.Vector3(x, y, z);
  }, [planetConfig.radius, cameraConfig]);

  // Compute zoom limits from planet radius
  const minDistance = planetConfig.radius * cameraConfig.minDistanceMultiplier;
  const maxDistance = planetConfig.radius * cameraConfig.maxDistanceMultiplier;

  return (
    <div className="w-full h-screen bg-black">
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          camera={{
            position: cameraPosition.toArray(),
            fov: cameraConfig.fov,
            near: cameraConfig.near,
            far: cameraConfig.far,
          }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000');
          }}
        >
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.5}
            castShadow={false}
          />
          <directionalLight
            position={[-5, -5, -10]}
            intensity={0.2}
            color="#4488ff"
          />
          <Stars />
          <Planet config={planetConfig} />
          <Atmosphere planetConfig={planetConfig} />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={minDistance}
            maxDistance={maxDistance}
            autoRotate={false}
            rotateSpeed={cameraConfig.rotateSpeed}
            zoomSpeed={cameraConfig.zoomSpeed}
            dampingFactor={cameraConfig.dampingFactor}
            enableDamping
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
