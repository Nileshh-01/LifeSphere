/**
 * Layout Engine Types
 *
 * Pure data model for spatial layout of graph nodes on a sphere.
 * No rendering, no themes, no world generation — only positions and topology.
 *
 * @module LayoutEngine
 */

import type { HierarchyLevel } from '../graph/types';

// ============================================================================
// LayoutConfig
// ============================================================================

/**
 * Configuration parameters for the Layout Engine.
 *
 * The MVP implements recursive hierarchy placement only:
 * - Parent nodes are placed first (distributed on the sphere).
 * - Children are recursively placed around their parent on the sphere surface.
 * - All positions are deterministic given the same graph + seed.
 */
export interface LayoutConfig {
  /** Determinism seed. Same seed + same graph = identical layout. */
  seed: number;

  /** Radius of the sphere in world units. Default: 5 */
  sphereRadius: number;

  /** Angular distance from parent to child (radians). Default: 0.4 */
  childSpacing: number;

  /** Angular spread of children around parent (radians, 0–2π). Default: 2π */
  childSpread: number;

  /**
   * Root node placement strategy.
   * - 'north-pole': Place root at inclination=0 (Y-up)
   * - 'south-pole': Place root at inclination=π
   * - 'equator': Place root at inclination=π/2
   * - 'random': Place root at a seeded random position
   * Default: 'equator'
   */
  rootPlacement: 'north-pole' | 'south-pole' | 'equator' | 'random';

  /** Random jitter applied to child positions (radians). Default: 0.05 */
  jitter: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  seed: 42,
  sphereRadius: 5,
  childSpacing: 0.4,
  childSpread: 2 * Math.PI,
  rootPlacement: 'equator',
  jitter: 0.05,
};

// ============================================================================
// NodePosition
// ============================================================================

/**
 * Spatial position of a single node on the sphere surface.
 * No rendering information — pure spatial data.
 */
export interface NodePosition {
  /** The node ID this position corresponds to */
  nodeId: string;

  /** 3D coordinate on the sphere surface (x, y, z) */
  position: [number, number, number];

  /** Spherical coordinates for reference */
  spherical: {
    /** Azimuth (θ) — longitude in radians, 0 at +X, 0–2π */
    azimuth: number;
    /** Inclination (φ) — latitude from north pole in radians, 0–π */
    inclination: number;
  };

  /** Depth from root node (number of edges in shortest path) */
  depth: number;

  /** Parent node ID (closest ancestor in graph topology) */
  parentId: string | null;

  /** Child node IDs (direct descendants in graph topology) */
  childIds: string[];

  /** Hierarchy level inferred by Graph Engine */
  hierarchyLevel: HierarchyLevel;

  /** The continent this node belongs to (always 'default' in MVP) */
  continentId: string;
}

// ============================================================================
// Continent
// ============================================================================

/**
 * Continent metadata.
 * In the MVP, all nodes belong to a single default continent.
 * Future sprints will implement community detection for multi-continent layout.
 */
export interface Continent {
  id: string;
  label: string;
  nodeIds: string[];
  center: { azimuth: number; inclination: number };
  importance: number;
  radius: number;
  averageDepth: number;
  dominantCategory: string;
}

// ============================================================================
// LayoutOutput
// ============================================================================

/**
 * The complete output of the Layout Engine.
 * Consumed by the World Generator to build the 3D world.
 */
export interface LayoutOutput {
  /** The seed used to produce this layout */
  seed: number;
  /** The graph ID this layout was computed from */
  graphId: string;
  /** Positions for every node in the graph, keyed by node ID */
  positions: Map<string, NodePosition>;
  /** Continent metadata (single default continent in MVP) */
  continents: Continent[];
  /** Road geometry (empty in MVP) */
  roads: [];
  /** Quality metrics */
  metrics: LayoutMetrics;
}

// ============================================================================
// LayoutMetrics
// ============================================================================

/**
 * Quality metrics for the generated layout.
 * Used for debugging and validation.
 */
export interface LayoutMetrics {
  /** Sum of all road geodesic distances (always 0 in MVP) */
  totalEdgeLength: number;
  /** Number of nodes not connected to the root */
  disconnectedNodeCount: number;
  /** Maximum depth of any node from root */
  maxDepth: number;
  /** Whether all nodes received valid positions */
  complete: boolean;
}
