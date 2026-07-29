/**
 * World Generator Types
 *
 * Pure data model for a hierarchical 3D world generated from a LayoutOutput.
 * No rendering, no themes, no meshes — only abstract world structure.
 *
 * @module WorldGenerator
 */

import type { LayoutOutput } from '../layout/types';

// ============================================================================
// ObjectType
// ============================================================================

/**
 * Type of world object.
 * Determines how the Theme Engine and Renderer process this object.
 */
export type ObjectType =
  // Core hierarchy (from graph)
  | 'planet'
  | 'continent'
  | 'region'
  | 'city'
  | 'district'
  | 'building'
  | 'landmark'
  // Infrastructure
  | 'road'
  | 'bridge'
  | 'tunnel'
  | 'sky-bridge'
  // Environment
  | 'terrain'
  | 'water'
  | 'atmosphere'
  // Decoration
  | 'vegetation'
  | 'rock'
  | 'cloud'
  | 'particle';

// ============================================================================
// WorldObjectState
// ============================================================================

/**
 * Visual state of a world object.
 * States are monotonic — they only move forward.
 */
export type WorldObjectState =
  | 'hidden'       // Not rendered at all
  | 'locked'       // Visible but obscured (fog, chains, rubble overlay)
  | 'available'    // Visible and interactive
  | 'in-progress'  // Construction animation active
  | 'completed'    // Fully built, normal lighting
  | 'shining';     // Completed milestone with glow/aurora

// ============================================================================
// Transform
// ============================================================================

/**
 * Spatial transform for a WorldObject.
 * Position, rotation, and scale in 3D space on the sphere surface.
 * All values are in world units relative to the sphere center.
 */
export interface Transform {
  /** Position on/near the sphere surface (x, y, z) */
  position: [number, number, number];
  /** Rotation in Euler angles (radians) */
  rotation: [number, number, number];
  /** Scale (uniform or per-axis) */
  scale: [number, number, number];
}

// ============================================================================
// ObjectMetadata
// ============================================================================

/**
 * Type-specific metadata for a WorldObject.
 * Contains all numeric properties from the source GraphNode
 * that the Theme Engine and Renderer may need.
 */
export interface ObjectMetadata {
  /** Difficulty (1–5). Affects visual detail level. */
  difficulty: number;
  /** Importance (1–10). Affects scale and prominence. */
  importance: number;
  /** Estimated hours. Affects building density. */
  estimatedHours: number;
  /** XP reward. Affects vegetation density around this object. */
  estimatedXP: number;
  /** Priority (1–5). Affects construction order. */
  priority: number;
  /** Type-specific metadata (empty in MVP, extensible for future use) */
  data: Record<string, unknown>;
}

// ============================================================================
// Decoration
// ============================================================================

/**
 * A decorative element attached to a WorldObject.
 * Empty decoration arrays are generated in the MVP.
 * Future sprints will implement procedural vegetation and props.
 */
export interface Decoration {
  /** Type of decoration */
  type: 'tree' | 'bush' | 'flower' | 'rock' | 'grass' | 'mushroom' | 'crystal';
  /** Position relative to the parent object */
  localPosition: [number, number, number];
  /** Scale */
  scale: number;
  /** Random rotation for variety */
  rotation: number;
  /** Color tint (applied by Theme Engine) */
  colorTint?: [number, number, number];
}

// ============================================================================
// WorldObject
// ============================================================================

/**
 * A single object in the world hierarchy.
 * Every entity — planet, continent, city, building, tree, landmark —
 * is a WorldObject. There is no separate class for different entity types.
 */
export interface WorldObject {
  /** Unique identifier for this object */
  id: string;
  /** Back-reference to source GraphNode (empty string for synthetic objects like planet) */
  nodeId: string;
  /** Human-readable label */
  label: string;
  /** Type of world object */
  type: ObjectType;
  /** Spatial transform */
  transform: Transform;
  /** Visual state */
  state: WorldObjectState;
  /** Child objects (recursive hierarchy) */
  children: WorldObject[];
  /** Object-specific metadata */
  metadata: ObjectMetadata;
  /** Decoration/vegetation objects attached to this object */
  decorations: Decoration[];
}

// ============================================================================
// Road
// ============================================================================

/**
 * A road connecting two world objects.
 * Roads are stored as a flat array alongside the hierarchy.
 * Empty in the MVP — will be implemented in a future sprint.
 */
export interface Road {
  /** Unique identifier */
  id: string;
  /** Source object ID */
  sourceId: string;
  /** Target object ID */
  targetId: string;
  /** Edge type from graph */
  edgeType: 'prerequisite' | 'recommended' | 'related' | 'leads-to';
  /** Road width (world units) */
  width: number;
  /** Geodesic path waypoints */
  path: [number, number, number][];
  /** Visual state (derived from endpoint completion) */
  state: 'dirt' | 'paved' | 'glowing';
}

// ============================================================================
// GlobalProgression
// ============================================================================

/**
 * Global progression state derived from the entire graph.
 * Computed from GraphNode progress data during world generation.
 */
export interface GlobalProgression {
  /** Overall completion percentage (0–100) */
  overallCompletion: number;
  /** Number of completed nodes */
  completedCount: number;
  /** Total number of nodes */
  totalCount: number;
  /** IDs of nodes currently in-progress */
  activeNodeIds: string[];
  /** IDs of milestone nodes that are completed (cause shine effect) */
  completedMilestoneIds: string[];
  /** Whether the final goal milestone is completed */
  goalCompleted: boolean;
}

// ============================================================================
// WorldScene
// ============================================================================

/**
 * The complete generated world.
 * Single root node representing the planet, containing a recursive tree of WorldObjects.
 * This is the output of the World Generator and input to the Theme Engine.
 */
export interface WorldScene {
  /** Metadata about this generation */
  metadata: {
    /** Seed used for generation (from LayoutOutput) */
    seed: number;
    /** Graph ID this world was generated from */
    graphId: string;
    /** ISO timestamp of generation */
    generatedAt: string;
    /** Version of the World Generator that produced this output */
    generatorVersion: string;
  };
  /** The root WorldObject (the planet itself) */
  root: WorldObject;
  /** Roads connecting world objects (empty array in MVP) */
  roads: Road[];
  /** Global progression data */
  progression: GlobalProgression;
}

// ============================================================================
// WorldGenerationConfig
// ============================================================================

/**
 * Configuration for world generation.
 * All values have sensible defaults.
 */
export interface WorldGenerationConfig {
  /** Density multiplier for vegetation (0 = barren, 2 = lush). Default: 1.0 */
  vegetationDensity: number;
  /** Building density multiplier (0 = empty, 2 = crowded). Default: 1.0 */
  buildingDensity: number;
  /** Whether to show locked/hidden objects or skip them. Default: true */
  showLockedContent: boolean;
  /** Seasonal overlay: 'none' | 'spring' | 'summer' | 'autumn' | 'winter'. Default: 'none' */
  season: string;
  /** Randomization strength (0 = minimal jitter, 1 = full). Default: 0.5 */
  layoutJitter: number;
}

export const DEFAULT_WORLD_GENERATION_CONFIG: WorldGenerationConfig = {
  vegetationDensity: 1.0,
  buildingDensity: 1.0,
  showLockedContent: true,
  season: 'none',
  layoutJitter: 0.5,
};

// ============================================================================
// Hierarchy Level Mapping
// ============================================================================

/**
 * Map from graph HierarchyLevel to WorldObject ObjectType.
 * Defines how the graph's inferred hierarchy maps to the 3D world.
 */
export const HIERARCHY_TO_OBJECT_TYPE: Record<string, ObjectType> = {
  continent: 'continent',
  region: 'region',
  city: 'city',
  district: 'district',
  building: 'building',
  landmark: 'landmark',
  decoration: 'building', // Resources become tiny buildings
};
