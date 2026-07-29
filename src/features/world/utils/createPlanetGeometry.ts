/**
 * Generates procedural planet geometry with noise-based terrain displacement.
 * Deterministic — same config always produces identical geometry.
 * No rendering logic — produces raw geometry data.
 */

import * as THREE from 'three';
import { SimplexNoise } from '@/shared/utils/noise';
import type { PlanetConfig } from '../types';

export interface PlanetGeometry {
  geometry: THREE.BufferGeometry;
  heightData: Float32Array;
}

export function createPlanetGeometry(config: PlanetConfig): PlanetGeometry {
  const { seed, radius, noiseScale, elevation, octaves, resolution } = config;
  const noise = new SimplexNoise(seed);

  const geometry = new THREE.SphereGeometry(radius, resolution, resolution);
  const positions = geometry.attributes.position.array as Float32Array;
  const heightData = new Float32Array(positions.length / 3);

  for (let i = 0; i < positions.length; i += 3) {
    const ix = i / 3;
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // Normalize to unit sphere direction
    const nx = x / radius;
    const ny = y / radius;
    const nz = z / radius;

    // Sample noise at this point
    const noiseVal = noise.fbm(
      nx * noiseScale,
      ny * noiseScale,
      nz * noiseScale,
      octaves
    );

    // Map noise [-1, 1] to elevation [0, 1]
    const elevationFactor = (noiseVal + 1) * 0.5;

    // Displace vertex along normal
    const displacement = elevationFactor * elevation;
    const newRadius = radius + displacement;

    positions[i] = nx * newRadius;
    positions[i + 1] = ny * newRadius;
    positions[i + 2] = nz * newRadius;

    heightData[ix] = elevationFactor;
  }

  geometry.computeVertexNormals();
  geometry.attributes.position.needsUpdate = true;

  return { geometry, heightData };
}
