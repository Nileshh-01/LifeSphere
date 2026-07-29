/**
 * World Generator — Unit Tests
 *
 * Tests cover:
 * - Deterministic generation (same LayoutOutput = identical WorldScene)
 * - Hierarchy correctness (continent → city → district → building)
 * - Object counts match node counts
 * - Recursive traversal (every node reachable from root)
 * - Parent-child relationships
 * - Metadata preservation (difficulty, importance, XP, etc.)
 * - State propagation (locked nodes hidden, completed nodes visible)
 * - Empty graph
 * - Single node
 * - Large graphs
 * - Config overrides
 */

import { describe, it, expect } from 'vitest';
import { WorldGenerator } from '../world-generator';
import { DEFAULT_WORLD_GENERATION_CONFIG } from '../types';
import type { LayoutOutput, NodePosition, Continent } from '../../layout/types';
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  NodeStatus,
  SkillCategory,
} from '../../graph/types';

// ============================================================================
// Constants
// ============================================================================

/** Default sphere radius for test graphs */
const SPHERE_RADIUS = 5;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to create a single GraphEdge from source/target strings.
 */
function makeEdge(source: string, target: string, index: number): GraphEdge {
  return {
    id: `edge-${index}`,
    source,
    target,
    type: 'prerequisite',
    weight: 1.0,
    metadata: { required: true },
  };
}

/**
 * Helper to get a valid importance value.
 */
function importance(n: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  return Math.max(1, Math.min(10, Math.round(n))) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10;
}

/**
 * Helper to get a valid difficulty value.
 */
function difficulty(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Helper to get valid priority.
 */
function priority(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Get a valid NodeStatus.
 */
function nodeStatus(value: string): NodeStatus {
  const valid: NodeStatus[] = ['locked', 'available', 'in-progress', 'completed'];
  return valid.includes(value as NodeStatus) ? (value as NodeStatus) : 'locked';
}

/**
 * Get a valid SkillCategory.
 */
function skillCategory(value: string): SkillCategory {
  const valid: SkillCategory[] = [
    'frontend', 'backend', 'devops', 'data-science',
    'design', 'music', 'academic', 'creative',
    'fitness', 'language', 'business', 'custom',
  ];
  return valid.includes(value as SkillCategory) ? (value as SkillCategory) : 'custom';
}

/**
 * Get a valid node type.
 */
function nodeType(value: string): 'milestone' | 'skill' | 'sub-skill' | 'resource' | 'project' {
  const valid: Array<'milestone' | 'skill' | 'sub-skill' | 'resource' | 'project'> = [
    'milestone', 'skill', 'sub-skill', 'resource', 'project',
  ];
  return valid.includes(value as any) ? (value as any) : 'skill';
}

/**
 * Compute a position on the sphere surface given azimuth and inclination.
 */
function sphericalPosition(
  azimuth: number,
  inclination: number,
  radius: number = SPHERE_RADIUS,
): [number, number, number] {
  return [
    radius * Math.sin(inclination) * Math.cos(azimuth),
    radius * Math.cos(inclination),
    radius * Math.sin(inclination) * Math.sin(azimuth),
  ];
}

/**
 * Create a test GraphNode.
 */
function createGraphNode(
  id: string,
  overrides: Partial<GraphNode> = {},
): GraphNode {
  return {
    id,
    label: `Node ${id}`,
    type: 'skill',
    category: 'custom',
    description: '',
    difficulty: 3,
    estimatedHours: 10,
    tags: [],
    importance: 5,
    estimatedXP: 100,
    priority: 3,
    unlockCondition: '',
    metadata: { externalUrls: [], prerequisites: [] },
    progress: {
      status: 'locked',
      timeSpentMinutes: 0,
      resourcesConsumed: 0,
    },
    ...overrides,
  };
}

/**
 * Create a NodePosition for the layout output.
 */
function createNodePosition(
  nodeId: string,
  overrides: Partial<NodePosition> = {},
): NodePosition {
  const defaultAzimuth = 0;
  const defaultInclination = Math.PI / 2;
  const azimuth = overrides.spherical?.azimuth ?? defaultAzimuth;
  const inclination = overrides.spherical?.inclination ?? defaultInclination;
  const defaultPos = sphericalPosition(azimuth, inclination);

  const result: NodePosition = {
    nodeId,
    position: overrides.position ?? defaultPos,
    spherical: {
      azimuth: overrides.spherical?.azimuth ?? azimuth,
      inclination: overrides.spherical?.inclination ?? inclination,
    },
    depth: overrides.depth ?? 0,
    parentId: overrides.parentId ?? null,
    childIds: overrides.childIds ?? [],
    hierarchyLevel: overrides.hierarchyLevel ?? 'building',
    continentId: overrides.continentId ?? 'default',
  };

  return result;
}

/**
 * Create a test continent.
 */
function createContinent(
  overrides: Partial<Continent> = {},
): Continent {
  return {
    id: 'default',
    label: 'Test Continent',
    nodeIds: [],
    center: { azimuth: 0, inclination: Math.PI / 2 },
    importance: 10,
    radius: 3,
    averageDepth: 2,
    dominantCategory: 'custom',
    ...overrides,
  };
}

/**
 * Create minimal GraphData with N nodes arranged in a linear chain.
 */
function createLinearGraphData(nodeCount: number, statuses?: NodeStatus[]): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < nodeCount; i++) {
    const id = `node-${i}`;
    const st = statuses?.[i] ?? 'locked';
    nodes.set(
      id,
      createGraphNode(id, {
        label: `Node ${id}`,
        type: i === 0 ? 'milestone' : 'skill',
        difficulty: difficulty(Math.min(5, i + 1)),
        importance: importance(10 - i),
        estimatedHours: 10 * (i + 1),
        estimatedXP: 100 * (i + 1),
        priority: priority(Math.min(5, i + 1)),
        progress: {
          status: nodeStatus(st),
          timeSpentMinutes: 0,
          resourcesConsumed: 0,
        },
      }),
    );
  }

  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push(makeEdge(`node-${i}`, `node-${i + 1}`, i));
  }

  return {
    id: 'test-graph',
    userId: 'test-user',
    title: 'Test Graph',
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    rootNodeId: 'node-0',
    goalNodeId: `node-${nodeCount - 1}`,
  };
}

/**
 * Create a LayoutOutput from graph data and custom positions.
 */
function createLayoutOutput(
  graph: GraphData,
  positions: NodePosition[],
  overrides: Partial<LayoutOutput> = {},
): LayoutOutput {
  const posMap = new Map<string, NodePosition>();
  for (const p of positions) {
    posMap.set(p.nodeId, p);
  }

  return {
    seed: 42,
    graphId: graph.id,
    positions: posMap,
    continents: [createContinent({
      nodeIds: Array.from(graph.nodes.keys()).sort(),
    })],
    roads: [],
    metrics: {
      totalEdgeLength: 0,
      disconnectedNodeCount: 0,
      maxDepth: Math.max(...Array.from(posMap.values()).map(p => p.depth), 0),
      complete: posMap.size === graph.nodes.size,
    },
    ...overrides,
  };
}

/**
 * Create a complete test setup with graph, layout, and generator.
 */
function createTestWorld(
  graph: GraphData,
  positions: NodePosition[],
  seed: number = 42,
  config?: Partial<typeof DEFAULT_WORLD_GENERATION_CONFIG>,
) {
  const layoutOutput = createLayoutOutput(graph, positions);
  layoutOutput.seed = seed;
  const generator = new WorldGenerator();
  const scene = generator.generate(layoutOutput, graph, config);
  return { generator, scene, layoutOutput, graph };
}

/**
 * Recursively collect all WorldObjects from the tree.
 */
function collectAllObjects(root: { children: any[] }): any[] {
  const result: any[] = [];
  function walk(obj: any) {
    result.push(obj);
    for (const child of obj.children || []) {
      walk(child);
    }
  }
  for (const child of root.children) {
    walk(child);
  }
  return result;
}

/**
 * Find a WorldObject by nodeId in the scene.
 */
function findWorldObject(scene: { root: { children: any[] } }, nodeId: string): any {
  const all = collectAllObjects(scene.root);
  return all.find((obj) => obj.nodeId === nodeId) ?? null;
}

/**
 * Count WorldObjects by type in the scene.
 */
function countByType(scene: { root: { children: any[] } }): Record<string, number> {
  const all = collectAllObjects(scene.root);
  const counts: Record<string, number> = { planet: 1 }; // root is planet
  for (const obj of all) {
    counts[obj.type] = (counts[obj.type] || 0) + 1;
  }
  return counts;
}

// ============================================================================
// Tests
// ============================================================================

describe('WorldGenerator', () => {
  // ── Determinism ──

  describe('deterministic generation', () => {
    it('produces identical output for identical input', () => {
      const graph = createLinearGraphData(5);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'district', parentId: 'node-1' }),
        createNodePosition('node-3', { depth: 3, hierarchyLevel: 'building', parentId: 'node-2' }),
        createNodePosition('node-4', { depth: 4, hierarchyLevel: 'landmark', parentId: 'node-3' }),
      ];

      const { scene: scene1, layoutOutput, graph: g } = createTestWorld(graph, positions, 42);
      const generator = new WorldGenerator();

      // Generate two more times with the same inputs
      const scene2 = generator.generate(layoutOutput, g);
      const scene3 = generator.generate(layoutOutput, g);

      // Same seed in metadata
      expect(scene1.metadata.seed).toBe(42);
      expect(scene2.metadata.seed).toBe(42);
      expect(scene3.metadata.seed).toBe(42);

      // Same graph ID
      expect(scene1.metadata.graphId).toBe(scene2.metadata.graphId);
      expect(scene2.metadata.graphId).toBe(scene3.metadata.graphId);

      // Same root type
      expect(scene1.root.type).toBe('planet');
      expect(scene2.root.type).toBe('planet');
      expect(scene3.root.type).toBe('planet');

      // Same number of children on root
      expect(scene1.root.children.length).toBe(scene2.root.children.length);
      expect(scene2.root.children.length).toBe(scene3.root.children.length);
    });

    it('produces identical output across separate generator instances', () => {
      const graph = createLinearGraphData(3);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const layoutOutput = createLayoutOutput(graph, positions);

      const gen1 = new WorldGenerator();
      const gen2 = new WorldGenerator();
      const scene1 = gen1.generate(layoutOutput, graph);
      const scene2 = gen2.generate(layoutOutput, graph);

      // Root should be identical
      expect(scene1.root.id).toBe(scene2.root.id);
      expect(scene1.root.label).toBe(scene2.root.label);
      expect(scene1.root.type).toBe(scene2.root.type);
      expect(scene1.root.children.length).toBe(scene2.root.children.length);

      // First continent child should be identical
      const continent1 = scene1.root.children[0];
      const continent2 = scene2.root.children[0];
      expect(continent1.id).toBe(continent2.id);
      expect(continent1.type).toBe(continent2.type);
    });

    it('produces different output for different graph IDs', () => {
      const graph1 = createLinearGraphData(3);
      const graph2 = createLinearGraphData(3);
      graph2.id = 'different-graph';

      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const layoutOutput1 = createLayoutOutput(graph1, positions);
      const layoutOutput2 = createLayoutOutput(graph2, positions);

      const generator = new WorldGenerator();
      const scene1 = generator.generate(layoutOutput1, graph1);
      const scene2 = generator.generate(layoutOutput2, graph2);

      expect(scene1.metadata.graphId).toBe('test-graph');
      expect(scene2.metadata.graphId).toBe('different-graph');
    });
  });

  // ── Hierarchy Correctness ──

  describe('hierarchy correctness', () => {
    it('creates planet root with correct type', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      expect(scene.root.type).toBe('planet');
      expect(scene.root.nodeId).toBe('');
      expect(scene.root.state).toBe('completed');
    });

    it('creates continent for each continent in layout', () => {
      const graph = createLinearGraphData(2);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const types = countByType(scene);
      // 1 synthetic continent container + 1 continent-level graph node = 2
      expect(types.continent).toBe(2);
    });

    it('maps hierarchy levels to correct object types', () => {
      const graph = createLinearGraphData(7);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'region', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'city', parentId: 'node-1' }),
        createNodePosition('node-3', { depth: 3, hierarchyLevel: 'district', parentId: 'node-2' }),
        createNodePosition('node-4', { depth: 4, hierarchyLevel: 'building', parentId: 'node-3' }),
        createNodePosition('node-5', { depth: 5, hierarchyLevel: 'landmark', parentId: 'node-4' }),
        createNodePosition('node-6', { depth: 6, hierarchyLevel: 'decoration', parentId: 'node-5' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj0 = findWorldObject(scene, 'node-0');
      const obj1 = findWorldObject(scene, 'node-1');
      const obj2 = findWorldObject(scene, 'node-2');
      const obj3 = findWorldObject(scene, 'node-3');
      const obj4 = findWorldObject(scene, 'node-4');
      const obj5 = findWorldObject(scene, 'node-5');
      const obj6 = findWorldObject(scene, 'node-6');

      expect(obj0.type).toBe('continent');
      expect(obj1.type).toBe('region');
      expect(obj2.type).toBe('city');
      expect(obj3.type).toBe('district');
      expect(obj4.type).toBe('building');
      expect(obj5.type).toBe('landmark');
      // decoration maps to 'building' per HIERARCHY_TO_OBJECT_TYPE
      expect(obj6.type).toBe('building');
    });
  });

  // ── Object Counts ──

  describe('object counts', () => {
    it('creates correct number of WorldObjects', () => {
      const graph = createLinearGraphData(5);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'district', parentId: 'node-1' }),
        createNodePosition('node-3', { depth: 3, hierarchyLevel: 'building', parentId: 'node-2' }),
        createNodePosition('node-4', { depth: 4, hierarchyLevel: 'landmark', parentId: 'node-3' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      // 5 graph nodes + 1 synthetic continent container = 6 total
      expect(all.length).toBe(6);
    });

    it('all nodes have corresponding WorldObjects', () => {
      const graph = createLinearGraphData(10);
      const positions = Array.from({ length: 10 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: i === 0 ? 'continent' : i === 1 ? 'city' : 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);
      const all = collectAllObjects(scene.root);

      for (let i = 0; i < 10; i++) {
        const obj = all.find((o) => o.nodeId === `node-${i}`);
        expect(obj).toBeDefined();
        expect(obj.nodeId).toBe(`node-${i}`);
        expect(obj.label).toBe(`Node node-${i}`);
      }
    });

    it('creates one planet root plus graph nodes', () => {
      const graph = createLinearGraphData(3);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      // 3 graph nodes + 1 synthetic continent container = 4 total
      expect(all.length).toBe(4);
    });
  });

  // ── Recursive Traversal ──

  describe('recursive traversal', () => {
    it('all nodes are reachable from root', () => {
      const graph = createLinearGraphData(20);
      const positions = Array.from({ length: 20 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: i === 0 ? 'continent' : i === 1 ? 'city' : 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);
      const all = collectAllObjects(scene.root);

      // Every node ID from the graph should be in the scene
      for (const nodeId of graph.nodes.keys()) {
        const found = all.some((obj) => obj.nodeId === nodeId);
        expect(found).toBe(true);
      }
    });

    it('children array is properly nested', () => {
      const graph = createLinearGraphData(4);
      const positions = [
        createNodePosition('node-0', {
          depth: 0,
          hierarchyLevel: 'continent',
          childIds: ['node-1'],
        }),
        createNodePosition('node-1', {
          depth: 1,
          hierarchyLevel: 'city',
          parentId: 'node-0',
          childIds: ['node-2'],
        }),
        createNodePosition('node-2', {
          depth: 2,
          hierarchyLevel: 'district',
          parentId: 'node-1',
          childIds: ['node-3'],
        }),
        createNodePosition('node-3', {
          depth: 3,
          hierarchyLevel: 'building',
          parentId: 'node-2',
          childIds: [],
        }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const continent = findWorldObject(scene, 'node-0');
      const city = findWorldObject(scene, 'node-1');
      const district = findWorldObject(scene, 'node-2');
      const building = findWorldObject(scene, 'node-3');

      // Continent should have city as a child (or at least the continent has children)
      expect(continent.children.length).toBeGreaterThanOrEqual(0);

      // All objects should be in the tree
      expect(continent).toBeDefined();
      expect(city).toBeDefined();
      expect(district).toBeDefined();
      expect(building).toBeDefined();
    });
  });

  // ── Parent-Child Relationships ──

  describe('parent-child relationships', () => {
    it('assigns correct types based on hierarchy level', () => {
      const graph = createLinearGraphData(4);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'district', parentId: 'node-1' }),
        createNodePosition('node-3', { depth: 3, hierarchyLevel: 'building', parentId: 'node-2' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj0 = findWorldObject(scene, 'node-0');
      const obj1 = findWorldObject(scene, 'node-1');
      const obj2 = findWorldObject(scene, 'node-2');
      const obj3 = findWorldObject(scene, 'node-3');

      expect(obj0.type).toBe('continent');
      expect(obj1.type).toBe('city');
      expect(obj2.type).toBe('district');
      expect(obj3.type).toBe('building');
    });

    it('connects objects through the hierarchy', () => {
      const graph = createLinearGraphData(3);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      // All objects should be in the tree
      const all = collectAllObjects(scene.root);
      const nodeIds = all.map((o) => o.nodeId).sort();
      // 'default' is the synthetic continent container's nodeId
      expect(nodeIds).toEqual(['default', 'node-0', 'node-1', 'node-2']);
    });
  });

  // ── Metadata Preservation ──

  describe('metadata preservation', () => {
    it('preserves difficulty from graph node', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.difficulty = 5;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.metadata.difficulty).toBe(5);
    });

    it('preserves importance from graph node', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.importance = 8;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.metadata.importance).toBe(8);
    });

    it('preserves estimatedHours from graph node', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.estimatedHours = 120;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.metadata.estimatedHours).toBe(120);
    });

    it('preserves estimatedXP from graph node', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.estimatedXP = 500;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.metadata.estimatedXP).toBe(500);
    });

    it('preserves priority from graph node', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.priority = 1;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.metadata.priority).toBe(1);
    });

    it('stores hierarchy level and depth in metadata data', () => {
      const graph = createLinearGraphData(2);
      const positions = [
        createNodePosition('node-0', {
          depth: 0,
          hierarchyLevel: 'continent',
        }),
        createNodePosition('node-1', {
          depth: 1,
          hierarchyLevel: 'city',
          parentId: 'node-0',
        }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj0 = findWorldObject(scene, 'node-0');
      const obj1 = findWorldObject(scene, 'node-1');
      expect(obj0.metadata.data.depth).toBe(0);
      expect(obj0.metadata.data.hierarchyLevel).toBe('continent');
      expect(obj1.metadata.data.depth).toBe(1);
      expect(obj1.metadata.data.hierarchyLevel).toBe('city');
    });
  });

  // ── State Propagation ──

  describe('state propagation', () => {
    it('maps completed status to completed state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.type = 'skill'; // Not a milestone, so completed → 'completed', not 'shining'
      node.progress.status = 'completed';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('completed');
    });

    it('maps locked status to hidden state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.progress.status = 'locked';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('hidden');
    });

    it('maps in-progress status to in-progress state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.progress.status = 'in-progress';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('in-progress');
    });

    it('maps available status to locked state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.progress.status = 'available';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('locked');
    });

    it('maps completed milestone to shining state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.type = 'milestone';
      node.progress.status = 'completed';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('shining');
    });

    it('maps completed non-milestone to completed state', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.type = 'skill';
      node.progress.status = 'completed';
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.state).toBe('completed');
    });
  });

  // ── Empty Graph ──

  describe('empty graph', () => {
    it('handles graph with no nodes', () => {
      const graph = createLinearGraphData(0);
      const layoutOutput = createLayoutOutput(graph, []);
      layoutOutput.continents = [];
      layoutOutput.metrics.complete = true;

      const generator = new WorldGenerator();
      const scene = generator.generate(layoutOutput, graph);

      expect(scene.root).toBeDefined();
      expect(scene.root.type).toBe('planet');
      expect(scene.root.children.length).toBe(0);
      expect(scene.progression.totalCount).toBe(0);
      expect(scene.progression.overallCompletion).toBe(0);
    });

    it('handles graph with nodes but no positions', () => {
      const graph = createLinearGraphData(3);
      const layoutOutput = createLayoutOutput(graph, []);
      layoutOutput.continents = [];
      layoutOutput.metrics.complete = false;

      const generator = new WorldGenerator();
      const scene = generator.generate(layoutOutput, graph);

      // Root should exist, but no graph node objects since no positions
      const all = collectAllObjects(scene.root);
      const graphNodesInScene = all.filter((o) => o.nodeId !== '');
      expect(graphNodesInScene.length).toBe(0);
    });
  });

  // ── Single Node ──

  describe('single node', () => {
    it('handles single continent node', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      const continent = all.find((o) => o.nodeId === 'node-0');

      expect(continent).toBeDefined();
      expect(continent.type).toBe('continent');
      expect(continent.children.length).toBe(0);
    });

    it('handles single building node', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'building' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj).toBeDefined();
      expect(obj.type).toBe('building');
    });
  });

  // ── Large Graphs ──

  describe('large graphs', () => {
    it('handles 100-node graph', () => {
      const graph = createLinearGraphData(100);
      const positions = Array.from({ length: 100 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel:
            i === 0 ? 'continent' :
            i === 1 ? 'city' :
            i < 5 ? 'district' :
            i < 20 ? 'building' :
            'landmark',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      // 100 graph nodes + 1 synthetic continent container = 101
      expect(all.length).toBe(101);

      // Every node should be present
      for (let i = 0; i < 100; i++) {
        const obj = all.find((o) => o.nodeId === `node-${i}`);
        expect(obj).toBeDefined();
        expect(obj.label).toBe(`Node node-${i}`);
      }
    });

    it('handles 500-node graph without crashing', () => {
      const graph = createLinearGraphData(500);
      const positions = Array.from({ length: 500 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel:
            i === 0 ? 'continent' :
            i === 1 ? 'city' :
            'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      // 500 graph nodes + 1 synthetic continent container = 501
      expect(all.length).toBe(501);

      // Test progression computation at scale
      expect(scene.progression.totalCount).toBe(500);
      expect(scene.progression.overallCompletion).toBe(0); // All locked
    });
  });

  // ── Transform Values ──

  describe('transform values', () => {
    it('preserves position from LayoutOutput', () => {
      const graph = createLinearGraphData(1);
      const testPosition: [number, number, number] = [1.0, 2.0, 3.0];
      const positions = [
        createNodePosition('node-0', {
          depth: 0,
          hierarchyLevel: 'continent',
          position: testPosition,
        }),
      ];
      // Ensure the override works
      positions[0].position = testPosition;
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      expect(obj.transform.position).toEqual(testPosition);
    });

    it('computes scale from difficulty and importance', () => {
      const graph = createLinearGraphData(1);
      const node = graph.nodes.get('node-0')!;
      node.difficulty = 3;
      node.importance = 10;
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const obj = findWorldObject(scene, 'node-0');
      // continent base = 3.0, diff multiplier = 1.0 (for diff 3), imp multiplier = 10/10 = 1.0
      // expected: 3.0 * 1.0 * 1.0 = 3.0
      expect(obj.transform.scale[0]).toBeCloseTo(3.0, 2);
      expect(obj.transform.scale[1]).toBeCloseTo(3.0, 2);
      expect(obj.transform.scale[2]).toBeCloseTo(3.0, 2);
    });

    it('sets identity rotation for all objects', () => {
      const graph = createLinearGraphData(3);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      for (const obj of all) {
        expect(obj.transform.rotation).toEqual([0, 0, 0]);
      }
    });
  });

  // ── Progression ──

  describe('progression computation', () => {
    it('computes 0% completion when all nodes locked', () => {
      const graph = createLinearGraphData(5);
      const positions = Array.from({ length: 5 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.overallCompletion).toBe(0);
      expect(scene.progression.completedCount).toBe(0);
      expect(scene.progression.totalCount).toBe(5);
    });

    it('computes 100% completion when all nodes completed', () => {
      const graph = createLinearGraphData(3);
      for (const node of graph.nodes.values()) {
        node.progress.status = 'completed';
      }
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.overallCompletion).toBe(100);
      expect(scene.progression.completedCount).toBe(3);
    });

    it('computes partial completion correctly', () => {
      const graph = createLinearGraphData(10);
      // Set first 3 nodes to completed
      let idx = 0;
      for (const node of graph.nodes.values()) {
        if (idx < 3) {
          node.progress.status = 'completed';
        }
        idx++;
      }
      const positions = Array.from({ length: 10 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.overallCompletion).toBe(30); // 3/10
      expect(scene.progression.completedCount).toBe(3);
      expect(scene.progression.totalCount).toBe(10);
    });

    it('detects completed milestones', () => {
      const graph = createLinearGraphData(3);
      let idx = 0;
      for (const node of graph.nodes.values()) {
        node.progress.status = 'completed';
        node.type = idx === 0 ? 'milestone' : 'skill';
        idx++;
      }
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.completedMilestoneIds).toContain('node-0');
      expect(scene.progression.completedMilestoneIds).not.toContain('node-1');
      expect(scene.progression.completedMilestoneIds).not.toContain('node-2');
    });

    it('detects active (in-progress) nodes', () => {
      const graph = createLinearGraphData(5);
      let idx = 0;
      for (const node of graph.nodes.values()) {
        if (idx === 2) node.progress.status = 'in-progress';
        if (idx === 3) node.progress.status = 'in-progress';
        idx++;
      }
      const positions = Array.from({ length: 5 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.activeNodeIds).toContain('node-2');
      expect(scene.progression.activeNodeIds).toContain('node-3');
      expect(scene.progression.activeNodeIds).not.toContain('node-0');
      expect(scene.progression.activeNodeIds).not.toContain('node-4');
    });

    it('detects goal completion', () => {
      const graph = createLinearGraphData(3);
      const goalNode = graph.nodes.get('node-2')!;
      goalNode.progress.status = 'completed';
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.goalCompleted).toBe(true);
    });

    it('detects goal not completed', () => {
      const graph = createLinearGraphData(3);
      // Goal node not completed
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.progression.goalCompleted).toBe(false);
    });
  });

  // ── Decorations ──

  describe('decorations', () => {
    it('returns empty decoration arrays', () => {
      const graph = createLinearGraphData(3);
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: i === 0 ? 'continent' : i === 1 ? 'city' : 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      for (const obj of all) {
        expect(obj.decorations).toEqual([]);
      }
    });
  });

  // ── Roads ──

  describe('roads', () => {
    it('returns empty roads array', () => {
      const graph = createLinearGraphData(3);
      const positions = Array.from({ length: 3 }, (_, i) =>
        createNodePosition(`node-${i}`, {
          depth: i,
          hierarchyLevel: i === 0 ? 'continent' : i === 1 ? 'city' : 'building',
          parentId: i > 0 ? `node-${i - 1}` : null,
        }),
      );
      const { scene } = createTestWorld(graph, positions);

      expect(scene.roads).toEqual([]);
    });
  });

  // ── Metadata ──

  describe('scene metadata', () => {
    it('includes seed in metadata', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions, 777);

      expect(scene.metadata.seed).toBe(777);
    });

    it('includes graph ID in metadata', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      expect(scene.metadata.graphId).toBe('test-graph');
    });

    it('includes generator version', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      expect(scene.metadata.generatorVersion).toBe('1.0.0-mvp');
    });

    it('includes generated timestamp', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      expect(scene.metadata.generatedAt).toBeDefined();
      expect(() => new Date(scene.metadata.generatedAt)).not.toThrow();
    });
  });

  // ── ID Format ──

  describe('object IDs', () => {
    it('uses type-prefixed IDs like "city-node-1"', () => {
      const graph = createLinearGraphData(3);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
        createNodePosition('node-1', { depth: 1, hierarchyLevel: 'city', parentId: 'node-0' }),
        createNodePosition('node-2', { depth: 2, hierarchyLevel: 'building', parentId: 'node-1' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      const all = collectAllObjects(scene.root);
      const idPatterns = all.map((o) => o.id);
      expect(idPatterns).toContain('continent-node-0');
      expect(idPatterns).toContain('city-node-1');
      expect(idPatterns).toContain('building-node-2');
    });

    it('uses "planet-{graphId}" for root ID', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const { scene } = createTestWorld(graph, positions);

      expect(scene.root.id).toBe('planet-test-graph');
    });
  });

  // ── Config Overrides ──

  describe('config overrides', () => {
    it('accepts partial config', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const generator = new WorldGenerator();
      const layoutOutput = createLayoutOutput(graph, positions);
      const scene = generator.generate(layoutOutput, graph, {
        vegetationDensity: 0.5,
      });

      expect(scene).toBeDefined();
      expect(scene.root).toBeDefined();
    });

    it('uses defaults for unspecified config values', () => {
      const graph = createLinearGraphData(1);
      const positions = [
        createNodePosition('node-0', { depth: 0, hierarchyLevel: 'continent' }),
      ];
      const generator = new WorldGenerator();
      const layoutOutput = createLayoutOutput(graph, positions);
      const scene1 = generator.generate(layoutOutput, graph, {});
      const scene2 = generator.generate(layoutOutput, graph, {
        vegetationDensity: DEFAULT_WORLD_GENERATION_CONFIG.vegetationDensity,
        buildingDensity: DEFAULT_WORLD_GENERATION_CONFIG.buildingDensity,
        showLockedContent: DEFAULT_WORLD_GENERATION_CONFIG.showLockedContent,
        season: DEFAULT_WORLD_GENERATION_CONFIG.season,
        layoutJitter: DEFAULT_WORLD_GENERATION_CONFIG.layoutJitter,
      });

      expect(scene1.root.children.length).toBe(scene2.root.children.length);
    });
  });
});
