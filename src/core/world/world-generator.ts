/**
 * World Generator — MVP Implementation
 *
 * Transforms a LayoutOutput into a deterministic hierarchical WorldScene.
 * The WorldScene is a pure data model with no rendering dependencies.
 *
 * Algorithm:
 * 1. Create root planet WorldObject
 * 2. For each continent in LayoutOutput, create a continent WorldObject
 * 3. For each node position, determine its parent continent and hierarchy level
 * 4. Build the recursive WorldObject tree: Continent → City → District → Building
 * 5. Compute metadata and state for every WorldObject
 * 6. Compute global progression from graph node statuses
 *
 * This MVP does NOT implement:
 * - Procedural vegetation / decorations
 * - Road generation
 * - Terrain / biomes
 * - Theme Engine integration
 * - Rendering
 *
 * @module WorldGenerator
 */

import type { LayoutOutput, NodePosition } from '../layout/types';
import type { GraphData, GraphNode, NodeStatus } from '../graph/types';
import {
  DEFAULT_WORLD_GENERATION_CONFIG,
  HIERARCHY_TO_OBJECT_TYPE,
  type ObjectType,
  type ObjectMetadata,
  type Transform,
  type WorldGenerationConfig,
  type WorldObject,
  type WorldObjectState,
  type WorldScene,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Version string for generated worlds */
const GENERATOR_VERSION = '1.0.0-mvp';

/** Default planet radius in world units (matches LayoutConfig default) */
const DEFAULT_PLANET_RADIUS = 5;

/** Default scale for the planet root object */
const PLANET_BASE_SCALE = 5;

/** Difficulty-to-scale multipliers (indexed by difficulty 1–5) */
const DIFFICULTY_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.5,
  5: 2.5,
};

/** Base scale for each object type */
const BASE_SCALE: Record<ObjectType, number> = {
  planet: 1.0,
  continent: 3.0,
  region: 2.0,
  city: 1.5,
  district: 1.0,
  building: 0.5,
  landmark: 0.8,
  road: 1.0,
  bridge: 1.0,
  tunnel: 1.0,
  'sky-bridge': 1.0,
  terrain: 1.0,
  water: 1.0,
  atmosphere: 1.0,
  vegetation: 0.1,
  rock: 0.05,
  cloud: 0.3,
  particle: 0.01,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute the scale for a WorldObject based on difficulty, importance, and type.
 *
 * Formula: baseScale × difficultyMultiplier × (importance / 10)
 */
function computeScale(
  difficulty: number,
  importance: number,
  objectType: ObjectType,
): [number, number, number] {
  const diffMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] ?? 1.0;
  const impMultiplier = Math.max(0.1, importance / 10);
  const base = BASE_SCALE[objectType] ?? 1.0;
  const scale = base * diffMultiplier * impMultiplier;
  return [scale, scale, scale];
}

/**
 * Map a GraphNode's progress status to a WorldObjectState.
 *
 * States are monotonic: hidden → locked → in-progress → completed → shining.
 * Milestone nodes get 'shining' on completion; all others stop at 'completed'.
 */
function mapStatusToState(
  status: NodeStatus,
  isMilestone: boolean,
  parentState: WorldObjectState,
): WorldObjectState {
  // If parent is hidden, this object is also hidden
  if (parentState === 'hidden') return 'hidden';

  switch (status) {
    case 'locked':
      return 'hidden';
    case 'available':
      return 'locked';
    case 'in-progress':
      return 'in-progress';
    case 'completed':
      return isMilestone ? 'shining' : 'completed';
    default:
      return 'hidden';
  }
}

/**
 * Recursively convert absolute (world-space) positions to parent-relative
 * (local) positions so that the Theme Engine and Renderer can compose them
 * correctly as a scene-graph hierarchy.
 *
 * Rotation and scale are left unchanged — rotation is already [0,0,0] in the
 * MVP, and scale values are independent visual sizes per object (not nested
 * TRS compositions).
 */
function localizeTransforms(
  obj: WorldObject,
  parentPosition: [number, number, number] = [0, 0, 0],
): void {
  const oldPos = obj.transform.position as [number, number, number];
  const localPos: [number, number, number] = [
    oldPos[0] - parentPosition[0],
    oldPos[1] - parentPosition[1],
    oldPos[2] - parentPosition[2],
  ];
  obj.transform.position = localPos;
  for (const child of obj.children) {
    localizeTransforms(child, oldPos);
  }
}

/**
 * Build a lookup of node ID → GraphNode from the graph.
 */
function buildNodeLookup(graph: GraphData): Map<string, GraphNode> {
  return graph.nodes;
}

/**
 * Build a lookup of node ID → parent ID from graph edges.
 * A node's parent is the source of the first incoming edge.
 */
function buildParentLookup(graph: GraphData): Map<string, string> {
  const parents = new Map<string, string>();
  for (const edge of graph.edges) {
    // Only set parent if not already set (first incoming edge wins)
    if (!parents.has(edge.target)) {
      parents.set(edge.target, edge.source);
    }
  }
  return parents;
}

/**
 * Build a lookup of node ID → child IDs from graph edges.
 */
function buildChildrenLookup(graph: GraphData): Map<string, string[]> {
  const children = new Map<string, string[]>();
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
 * Determine if a node is a milestone type.
 */
function isMilestoneNode(node: GraphNode): boolean {
  return node.type === 'milestone';
}

/**
 * Build a map of continent ID → continent WorldObject for quick lookup.
 */
function buildContinentMap(
  layoutOutput: LayoutOutput,
  graph: GraphData,
  parentState: WorldObjectState,
): Map<string, WorldObject> {
  const continentMap = new Map<string, WorldObject>();

  for (const continent of layoutOutput.continents) {
    const continentId = continent.id;
    const continentNode = graph.nodes.get(continentId);

    const worldObject: WorldObject = {
      id: `continent-${continentId}`,
      nodeId: continentId,
      label: continent.label,
      type: 'continent',
      transform: {
        position: [0, 0, 0], // Will be refined by city positions
        rotation: [0, 0, 0],
        scale: computeScale(4, continent.importance, 'continent'),
      },
      state: parentState,
      children: [],
      metadata: {
        difficulty: 4,
        importance: continent.importance,
        estimatedHours: 0,
        estimatedXP: 0,
        priority: 5,
        data: {
          continentId: continent.id,
          nodeIds: continent.nodeIds,
          dominantCategory: continent.dominantCategory,
        },
      },
      decorations: [],
    };

    continentMap.set(continentId, worldObject);
  }

  return continentMap;
}

/**
 * Build a lookup of node ID → continent ID.
 * In the MVP, all nodes belong to the default continent.
 */
function buildNodeContinentLookup(
  layoutOutput: LayoutOutput,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const continent of layoutOutput.continents) {
    for (const nodeId of continent.nodeIds) {
      lookup.set(nodeId, continent.id);
    }
  }
  return lookup;
}

// ============================================================================
// WorldGenerator Class
// ============================================================================

/**
 * WorldGenerator — transforms LayoutOutput into a hierarchical WorldScene.
 *
 * Usage:
 * 
```typescript
 * const generator = new WorldGenerator();
 * const scene = generator.generate(layoutOutput, graphData, config);
 * 
```
 *
 * The generator is stateless — each call to `generate()` produces an
 * independent output from the same inputs.
 */
export class WorldGenerator {
  /**
   * Generate a complete hierarchical WorldScene from layout data.
   *
   * @param layoutOutput - Positions, continents, roads from Layout Engine
   * @param graph - The original graph data (for node properties)
   * @param config - Optional generation configuration
   * @returns WorldScene - Complete hierarchical world ready for Theme Engine
   */
  generate(
    layoutOutput: LayoutOutput,
    graph: GraphData,
    config?: Partial<WorldGenerationConfig>,
  ): WorldScene {
    // Merge config with defaults
    const resolvedConfig: WorldGenerationConfig = {
      ...DEFAULT_WORLD_GENERATION_CONFIG,
      ...config,
    };

    // Build lookups
    const nodeLookup = buildNodeLookup(graph);
    const parentLookup = buildParentLookup(graph);
    const childrenLookup = buildChildrenLookup(graph);
    const nodeContinentLookup = buildNodeContinentLookup(layoutOutput);

    // Stage 1: Create root planet WorldObject
    const root = this.createRootWorldObject(layoutOutput, graph);

    // Stage 2: Build continent map
    const continentMap = buildContinentMap(
      layoutOutput,
      graph,
      root.state,
    );

    // Stage 3: Build hierarchy tree from node positions
    // We process nodes by depth (BFS order) so parents are always created before children
    const processedNodes = new Set<string>();
    const worldObjectsByNodeId = new Map<string, WorldObject>();

    // Sort positions by depth for deterministic processing order
    const sortedPositions = Array.from(layoutOutput.positions.entries())
      .sort(([aId], [bId]) => aId.localeCompare(bId))
      .sort(([, aPos], [, bPos]) => aPos.depth - bPos.depth);

    for (const [nodeId, nodePos] of sortedPositions) {
      if (processedNodes.has(nodeId)) continue;
      processedNodes.add(nodeId);

      const graphNode = nodeLookup.get(nodeId);
      if (!graphNode) continue;

      // Determine parent continent
      const continentId = nodeContinentLookup.get(nodeId) ?? 'default';
      const continentObj = continentMap.get(continentId) ?? null;

      // Determine parent WorldObject
      const parentNodeId = parentLookup.get(nodeId);
      const parentWorldObj = parentNodeId
        ? worldObjectsByNodeId.get(parentNodeId) ?? null
        : null;

      // Determine the parent object to attach to
      const attachParent = this.findAttachParent(
        nodePos,
        parentWorldObj,
        continentObj,
        root,
      );

      // Determine parent state for state propagation
      const parentState = attachParent ? attachParent.state : root.state;

      // Create the WorldObject
      const worldObject = this.createWorldObject(
        nodeId,
        graphNode,
        nodePos,
        parentState,
      );

      // Add to parent's children
      if (attachParent) {
        attachParent.children.push(worldObject);
      } else if (continentObj) {
        continentObj.children.push(worldObject);
      } else {
        root.children.push(worldObject);
      }

      worldObjectsByNodeId.set(nodeId, worldObject);
    }

    // Add continents to root
    for (const continent of continentMap.values()) {
      root.children.push(continent);
    }

    // Stage 4: Compute global progression
    const progression = this.computeGlobalProgression(graph);

    // Stage 5: Assemble WorldScene
    // Convert absolute positions to parent-relative local positions so
    // downstream stages (Theme Engine, Renderer) can compose the tree
    // correctly as a scene graph without compounding offsets.
    localizeTransforms(root);

    const scene: WorldScene = {
      metadata: {
        seed: layoutOutput.seed,
        graphId: layoutOutput.graphId,
        generatedAt: new Date().toISOString(),
        generatorVersion: GENERATOR_VERSION,
      },
      root,
      roads: [], // Empty in MVP
      progression,
    };

    return scene;
  }

  /**
   * Create the root planet WorldObject.
   */
  private createRootWorldObject(
    layoutOutput: LayoutOutput,
    graph: GraphData,
  ): WorldObject {
    return {
      id: `planet-${layoutOutput.graphId}`,
      nodeId: '',
      label: graph.title,
      type: 'planet',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [PLANET_BASE_SCALE, PLANET_BASE_SCALE, PLANET_BASE_SCALE],
      },
      state: 'completed',
      children: [],
      metadata: {
        difficulty: 1,
        importance: 10,
        estimatedHours: 0,
        estimatedXP: 0,
        priority: 1,
        data: {
          sphereRadius: DEFAULT_PLANET_RADIUS,
        },
      },
      decorations: [],
    };
  }

  /**
   * Create a WorldObject from a GraphNode and its position.
   */
  private createWorldObject(
    nodeId: string,
    graphNode: GraphNode,
    nodePos: NodePosition,
    parentState: WorldObjectState,
  ): WorldObject {
    const objectType = this.mapHierarchyToObjectType(nodePos.hierarchyLevel);
    const isMilestone = isMilestoneNode(graphNode);
    const state = mapStatusToState(graphNode.progress.status, isMilestone, parentState);

    const transform: Transform = {
      position: [...nodePos.position],
      rotation: [0, 0, 0],
      scale: computeScale(
        graphNode.difficulty,
        graphNode.importance,
        objectType,
      ),
    };

    const metadata: ObjectMetadata = {
      difficulty: graphNode.difficulty,
      importance: graphNode.importance,
      estimatedHours: graphNode.estimatedHours,
      estimatedXP: graphNode.estimatedXP,
      priority: graphNode.priority,
      data: {
        nodeType: graphNode.type,
        category: graphNode.category,
        tags: graphNode.tags,
        depth: nodePos.depth,
        hierarchyLevel: nodePos.hierarchyLevel,
        continentId: nodePos.continentId,
      },
    };

    return {
      id: `${objectType}-${nodeId}`,
      nodeId,
      label: graphNode.label,
      type: objectType,
      transform,
      state,
      children: [],
      metadata,
      decorations: [],
    };
  }

  /**
   * Map a graph HierarchyLevel to a WorldObject ObjectType.
   */
  private mapHierarchyToObjectType(
    hierarchyLevel: string,
  ): ObjectType {
    return HIERARCHY_TO_OBJECT_TYPE[hierarchyLevel] ?? 'building';
  }

  /**
   * Find the appropriate parent WorldObject for a node.
   *
   * Priority:
   * 1. If the node has a parent in the graph that is already a WorldObject, use that
   * 2. If the node belongs to a continent, use the continent
   * 3. Fall back to root (planet)
   */
  private findAttachParent(
    nodePos: NodePosition,
    parentWorldObj: WorldObject | null,
    continentObj: WorldObject | null,
    root: WorldObject,
  ): WorldObject | null {
    // If the node has a parent WorldObject, attach to it
    if (parentWorldObj) {
      return parentWorldObj;
    }

    // If the node belongs to a continent, attach to continent
    if (continentObj) {
      return continentObj;
    }

    // Fall back to root
    return root;
  }

  /**
   * Compute global progression from graph node statuses.
   */
  private computeGlobalProgression(graph: GraphData): {
    overallCompletion: number;
    completedCount: number;
    totalCount: number;
    activeNodeIds: string[];
    completedMilestoneIds: string[];
    goalCompleted: boolean;
  } {
    let totalCount = 0;
    let completedCount = 0;
    const activeNodeIds: string[] = [];
    const completedMilestoneIds: string[] = [];

    for (const node of graph.nodes.values()) {
      totalCount++;

      if (node.progress.status === 'completed') {
        completedCount++;
        if (isMilestoneNode(node)) {
          completedMilestoneIds.push(node.id);
        }
      }

      if (node.progress.status === 'in-progress') {
        activeNodeIds.push(node.id);
      }
    }

    const overallCompletion = totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

    const goalNode = graph.nodes.get(graph.goalNodeId);
    const goalCompleted = goalNode?.progress.status === 'completed';

    return {
      overallCompletion,
      completedCount,
      totalCount,
      activeNodeIds,
      completedMilestoneIds,
      goalCompleted,
    };
  }
}
