/**
 * Layout Engine — MVP Implementation
 *
 * Transforms a GraphData into deterministic 3D positions on a sphere
 * using recursive hierarchy placement.
 *
 * Algorithm:
 * 1. Place root node at a configurable position on the sphere.
 * 2. For each node in BFS order, distribute its children around it
 *    on the sphere surface with configurable angular spacing.
 * 3. Apply seeded jitter for natural variation while maintaining determinism.
 *
 * This MVP does NOT implement:
 * - Force-directed layout
 * - Community detection / continent clustering
 * - Collision resolution
 * - Road topology
 * - Density balancing
 *
 * Future layout algorithms can replace this implementation without
 * changing the public API (LayoutEngine.generate).
 *
 * @module LayoutEngine
 */

import type { GraphData } from '../graph/types';
import {
  DEFAULT_LAYOUT_CONFIG,
  type LayoutConfig,
  type LayoutOutput,
  type LayoutMetrics,
  type NodePosition,
} from './types';
import { SeededRandom } from '../../shared/utils/seed';

// ============================================================================
// Constants
// ============================================================================

/** Small epsilon for floating-point comparisons */
const EPSILON = 1e-10;

// ============================================================================
// Coordinate System Helpers
// ============================================================================

/**
 * Convert spherical coordinates to cartesian 3D.
 *
 * Y-up right-hand coordinate system:
 *   azimuth (θ): 0 at +X, increasing CCW when viewed from +Y, range 0–2π
 *   inclination (φ): 0 at +Y (north pole), π at -Y (south pole), range 0–π
 *   radius (r): distance from origin
 */
function sphericalToCartesian(
  azimuth: number,
  inclination: number,
  radius: number,
): [number, number, number] {
  const x = radius * Math.sin(inclination) * Math.cos(azimuth);
  const y = radius * Math.cos(inclination);
  const z = radius * Math.sin(inclination) * Math.sin(azimuth);
  return [x, y, z];
}

/**
 * Compute the root position based on config.
 */
function getRootSphericalPosition(
  config: LayoutConfig,
  prng: SeededRandom,
): { azimuth: number; inclination: number } {
  switch (config.rootPlacement) {
    case 'north-pole':
      return { azimuth: 0, inclination: 0 };
    case 'south-pole':
      return { azimuth: 0, inclination: Math.PI };
    case 'random':
      return {
        azimuth: prng.range(0, 2 * Math.PI),
        inclination: prng.range(0, Math.PI),
      };
    case 'equator':
    default:
      return { azimuth: prng.range(0, 2 * Math.PI), inclination: Math.PI / 2 };
  }
}

/**
 * Normalize an angle to the range [0, 2π).
 */
function normalizeAngle(angle: number): number {
  const twoPi = 2 * Math.PI;
  let result = angle % twoPi;
  if (result < 0) result += twoPi;
  return result;
}

/**
 * Clamp inclination to [0, π].
 */
function clampInclination(inclination: number): number {
  return Math.max(0, Math.min(Math.PI, inclination));
}

// ============================================================================
// Topology Analysis (BFS)
// ============================================================================

/**
 * Compute depth of each node from root using BFS.
 * Returns a map of node ID → depth. Nodes unreachable from root get depth -1.
 */
function computeDepths(graph: GraphData): Map<string, number> {
  const depths = new Map<string, number>();

  if (!graph.nodes.has(graph.rootNodeId)) {
    // No valid root; all nodes are disconnected
    for (const nodeId of graph.nodes.keys()) {
      depths.set(nodeId, -1);
    }
    return depths;
  }

  // Initialize all nodes as unreachable
  for (const nodeId of graph.nodes.keys()) {
    depths.set(nodeId, -1);
  }

  // BFS from root
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: graph.rootNodeId, depth: 0 },
  ];
  visited.add(graph.rootNodeId);
  depths.set(graph.rootNodeId, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    for (const edge of graph.edges) {
      if (edge.source === id && !visited.has(edge.target)) {
        const childDepth = depth + 1;
        visited.add(edge.target);
        depths.set(edge.target, childDepth);
        queue.push({ id: edge.target, depth: childDepth });
      }
    }
  }

  return depths;
}

/**
 * Build a map of parent → children from graph edges.
 * Children are nodes reachable via outgoing edges from the parent.
 */
function buildParentChildMap(
  graph: GraphData,
): Map<string, string[]> {
  const children = new Map<string, string[]>();

  // Initialize empty arrays for all nodes
  for (const nodeId of graph.nodes.keys()) {
    children.set(nodeId, []);
  }

  for (const edge of graph.edges) {
    const existing = children.get(edge.source) ?? [];
    existing.push(edge.target);
    children.set(edge.source, existing);
  }

  return children;
}

/**
 * Get the IDs of all direct parents (prerequisites) of a node.
 */
function getParents(nodeId: string, graph: GraphData): string[] {
  const parents: string[] = [];
  for (const edge of graph.edges) {
    if (edge.target === nodeId) {
      parents.push(edge.source);
    }
  }
  return parents;
}

// ============================================================================
// Hierarchy Level Inference
// ============================================================================

/**
 * Infer hierarchy level from graph topology.
 *
 * Simplified version for MVP layout — uses depth and child count
 * to determine placement priority. Deeper nodes get smaller spacing.
 */
function inferLevelFromTopology(
  nodeId: string,
  graph: GraphData,
  depths: Map<string, number>,
  childCounts: Map<string, number>,
): 'continent' | 'region' | 'city' | 'district' | 'building' | 'landmark' | 'decoration' {
  const depth = depths.get(nodeId) ?? -1;
  const children = childCounts.get(nodeId) ?? 0;
  const node = graph.nodes.get(nodeId);

  if (!node) return 'decoration';

  // Root node or direct children of root
  if (depth === 0) return 'continent';
  if (depth === 1 && children >= 3) return 'city';
  if (depth === 1) return 'region';

  // Mid-depth nodes with many children
  if (children >= 5) return 'city';
  if (children >= 2) return 'district';

  // Deep nodes
  if (depth >= 4) return 'decoration';
  if (depth === 3) return 'landmark';

  return 'building';
}

// ============================================================================
// Child Placement
// ============================================================================

/**
 * Place children of a parent node around it on the sphere surface.
 *
 * Children are distributed evenly in azimuth around the parent,
 * at a fixed angular distance (childSpacing) along the inclination axis.
 * Each child receives a small seeded jitter for natural variation.
 */
function placeChildren(
  parentSpherical: { azimuth: number; inclination: number },
  children: string[],
  graph: GraphData,
  depths: Map<string, number>,
  config: LayoutConfig,
  prng: SeededRandom,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const childCount = children.length;

  if (childCount === 0) return positions;

  // Compute parent's position on the sphere (for childIds tracking)
  const parentPos = sphericalToCartesian(
    parentSpherical.azimuth,
    parentSpherical.inclination,
    config.sphereRadius,
  );

  // Build a lookup of child counts for topology inference
  const childCountMap = new Map<string, number>();
  for (const childId of children) {
    const grandChildren = graph.edges.filter((e) => e.source === childId).length;
    childCountMap.set(childId, grandChildren);
  }

  // Distribute children evenly in azimuth around the parent
  for (let i = 0; i < childCount; i++) {
    const childId = children[i];

    // Base angle: evenly distributed around the circle
    const baseAzimuth = parentSpherical.azimuth + (2 * Math.PI * i) / childCount;

    // Apply seeded jitter for natural variation
    const jitterAzimuth = prng.range(-config.jitter, config.jitter);
    const jitterInclination = prng.range(-config.jitter * 0.5, config.jitter * 0.5);

    // Move outward from parent by childSpacing along the inclination axis
    const childInclination = clampInclination(
      parentSpherical.inclination + config.childSpacing + jitterInclination,
    );
    const childAzimuth = normalizeAngle(baseAzimuth + jitterAzimuth);

    // Compute depth
    const depth = depths.get(childId) ?? -1;

    const childSpherical = {
      azimuth: childAzimuth,
      inclination: childInclination,
    };

    const childPos = sphericalToCartesian(
      childAzimuth,
      childInclination,
      config.sphereRadius,
    );

    // Get child's children (grandchildren) for the NodePosition
    const grandChildren = graph.edges
      .filter((e) => e.source === childId)
      .map((e) => e.target);

    const hierarchyLevel = inferLevelFromTopology(
      childId,
      graph,
      depths,
      childCountMap,
    );

    positions.set(childId, {
      nodeId: childId,
      position: childPos,
      spherical: childSpherical,
      depth,
      parentId: null, // Will be set by caller
      childIds: grandChildren,
      hierarchyLevel,
      continentId: 'default',
    });
  }

  return positions;
}

// ============================================================================
// LayoutEngine Class
// ============================================================================

/**
 * LayoutEngine — generates deterministic 3D positions for graph nodes.
 *
 * Usage:
 * 
```typescript
 * const engine = new LayoutEngine();
 * const output = engine.generate(graphData, 42, customConfig);
 * 
```
 *
 * The engine is stateless — each call to `generate()` produces an
 * independent output from the same inputs.
 */
export class LayoutEngine {
  /**
   * Generate a deterministic spatial layout for the given graph.
   *
   * @param graph - The graph to lay out
   * @param seed - Determinism seed (overrides config.seed if provided)
   * @param config - Optional layout configuration (defaults used if omitted)
   * @returns LayoutOutput with positions for every node
   */
  generate(
    graph: GraphData,
    seed?: number,
    config?: Partial<LayoutConfig>,
  ): LayoutOutput {
    // Merge config with defaults
    const resolvedConfig: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      ...config,
    };

    // Override seed if explicitly provided
    if (seed !== undefined) {
      resolvedConfig.seed = seed;
    }

    // Initialize seeded PRNG
    const prng = new SeededRandom(resolvedConfig.seed);

    // Stage 1: Compute depths via BFS from root
    const depths = computeDepths(graph);

    // Stage 2: Build parent-child relationship map
    const parentChildMap = buildParentChildMap(graph);

    // Build child count map for hierarchy inference
    const childCountMap = new Map<string, number>();
    for (const [nodeId, children] of parentChildMap) {
      childCountMap.set(nodeId, children.length);
    }

    const allPositions = new Map<string, NodePosition>();

    // Stage 3: Place root node (if it exists in the graph)
    const rootExists = graph.nodes.has(graph.rootNodeId);

    if (rootExists) {
      const rootSpherical = getRootSphericalPosition(resolvedConfig, prng);
      const rootPos = sphericalToCartesian(
        rootSpherical.azimuth,
        rootSpherical.inclination,
        resolvedConfig.sphereRadius,
      );

      // Root's children
      const rootChildren = parentChildMap.get(graph.rootNodeId) ?? [];

      // Infer root's hierarchy level
      const rootDepth = depths.get(graph.rootNodeId) ?? 0;
      const rootHierarchyLevel = inferLevelFromTopology(
        graph.rootNodeId,
        graph,
        depths,
        childCountMap,
      );

      // Build root NodePosition
      allPositions.set(graph.rootNodeId, {
        nodeId: graph.rootNodeId,
        position: rootPos,
        spherical: rootSpherical,
        depth: rootDepth,
        parentId: null,
        childIds: rootChildren,
        hierarchyLevel: rootHierarchyLevel,
        continentId: 'default',
      });
    }

    // Stage 4: BFS to place all children recursively
    // We process nodes level by level so parents are always placed before children
    const queue: string[] = rootExists ? [graph.rootNodeId] : [];
    const processed = new Set<string>(rootExists ? [graph.rootNodeId] : []);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentPos = allPositions.get(currentId);
      if (!currentPos) continue;

      const children = parentChildMap.get(currentId) ?? [];

      // Sort children by node ID for deterministic iteration order
      const sortedChildren = [...children].sort();

      // Place children around this parent
      const childPositions = placeChildren(
        currentPos.spherical,
        sortedChildren,
        graph,
        depths,
        resolvedConfig,
        prng,
      );

      // Assign parentId and add to allPositions
      for (const [childId, childPos] of childPositions) {
        childPos.parentId = currentId;
        allPositions.set(childId, childPos);

        // Enqueue child for processing its own children
        if (!processed.has(childId)) {
          processed.add(childId);
          queue.push(childId);
        }
      }
    }

    // Stage 5: Ensure ALL nodes have a position (handle disconnected nodes)
    let disconnectedCount = 0;
    for (const nodeId of graph.nodes.keys()) {
      if (!allPositions.has(nodeId)) {
        disconnectedCount++;

        // Place disconnected nodes at random positions on the sphere
        const az = prng.range(0, 2 * Math.PI);
        const inc = prng.range(0, Math.PI);
        const pos = sphericalToCartesian(az, inc, resolvedConfig.sphereRadius);
        const depth = depths.get(nodeId) ?? -1;
        const childIds = parentChildMap.get(nodeId) ?? [];

        const hierarchyLevel = inferLevelFromTopology(
          nodeId,
          graph,
          depths,
          childCountMap,
        );

        allPositions.set(nodeId, {
          nodeId,
          position: pos,
          spherical: { azimuth: az, inclination: inc },
          depth,
          parentId: null,
          childIds,
          hierarchyLevel,
          continentId: 'default',
        });
      }
    }

    // Build metrics
    const metrics: LayoutMetrics = {
      totalEdgeLength: 0,
      disconnectedNodeCount: disconnectedCount,
      maxDepth: Math.max(...Array.from(depths.values()).filter((d) => d >= 0), 0),
      complete: allPositions.size === graph.nodes.size,
    };

    // Build continent center (use root position or default to equator)
    const continentCenter = rootExists
      ? {
          azimuth: (allPositions.get(graph.rootNodeId)?.spherical.azimuth ?? 0),
          inclination: (allPositions.get(graph.rootNodeId)?.spherical.inclination ?? Math.PI / 2),
        }
      : { azimuth: 0, inclination: Math.PI / 2 };

    // Build continent
    const continent: import('./types').Continent = {
      id: 'default',
      label: graph.title,
      nodeIds: Array.from(graph.nodes.keys()).sort(),
      center: continentCenter,
      importance: 10,
      radius: resolvedConfig.sphereRadius * 0.6,
      averageDepth: metrics.maxDepth / 2,
      dominantCategory: 'custom',
    };

    // Assemble output
    const output: LayoutOutput = {
      seed: resolvedConfig.seed,
      graphId: graph.id,
      positions: allPositions,
      continents: [continent],
      roads: [],
      metrics,
    };

    return output;
  }
}
