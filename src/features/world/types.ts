/**
 * Planet configuration parameters.
 * All values are configurable and renderer-independent.
 * No business logic — pure data for the rendering layer.
 */

export interface PlanetConfig {
  /** Seed for deterministic terrain generation */
  seed: number;
  /** Planet radius in world units */
  radius: number;
  /** Noise scale — higher values create more frequent terrain features */
  noiseScale: number;
  /** Elevation multiplier — higher values create more dramatic terrain */
  elevation: number;
  /** Number of noise octaves for FBM */
  octaves: number;
  /** Sphere geometry resolution (segments) */
  resolution: number;
}

export const DEFAULT_PLANET_CONFIG: PlanetConfig = {
  seed: 42,
  radius: 5,
  noiseScale: 1.5,
  elevation: 0.3,
  octaves: 6,
  resolution: 128,
};

/**
 * Camera configuration parameters.
 * All values are configurable and renderer-independent.
 * Camera position is computed dynamically from planet radius using spherical coordinates.
 */
export interface CameraConfig {
  /** Field of view in degrees */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;
  /** OrbitControls damping factor (0 = no damping, 1 = max damping) */
  dampingFactor: number;
  /** OrbitControls rotation speed */
  rotateSpeed: number;
  /** OrbitControls zoom speed */
  zoomSpeed: number;
  /** Minimum zoom distance as a multiplier of planet radius */
  minDistanceMultiplier: number;
  /** Maximum zoom distance as a multiplier of planet radius */
  maxDistanceMultiplier: number;
  /** Initial camera distance as a multiplier of planet radius */
  initialDistanceMultiplier: number;
  /** Initial polar angle in radians (0 = top-down, PI/2 = equator, PI = bottom-up) */
  initialPolarAngle: number;
  /** Initial azimuthal angle in radians (rotation around Y axis) */
  initialAzimuthalAngle: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 45,
  near: 0.1,
  far: 1000,
  dampingFactor: 0.08,
  rotateSpeed: 0.5,
  zoomSpeed: 0.8,
  minDistanceMultiplier: 1.2,
  maxDistanceMultiplier: 8,
  initialDistanceMultiplier: 3.8,
  initialPolarAngle: Math.PI / 4, // 45° from top — more dramatic cinematic angle
  initialAzimuthalAngle: Math.PI / 4, // 45° around Y axis — not on Z axis
};
