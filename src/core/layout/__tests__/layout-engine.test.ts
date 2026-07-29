/**
 * Layout Engine — Unit Tests
 *
 * Tests cover:
 * - Deterministic generation (same graph + seed = identical output)
 * - Every node receives a position
 * - No NaN values in positions
 * - Hierarchy placement correctness
 * - Config overrides
 * - Disconnected nodes
 * - Edge cases (empty graph, single node, linear chain)
 */

import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../layout-engine';
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig } from '../types';
import type { GraphData, GraphNode, GraphEdge } from '../../graph/types';

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
 * Create a simple test graph with a root and N children.
 */
function createSimpleGraph(
  nodeCount: number,
  edgePairs: Array<[string, string]> = [],
): GraphData {
  const nodes = new Map<string, GraphNode>();
  const now = new Date().toISOString();

  for (let i = 0; i < nodeCount; i++) {
    const id = `node-${i}`;
    nodes.set(id, {
      id,
      label: `Node ${i}`,
      type: i === 0 ? 'milestone' : 'skill',
      category: 'custom',
      description: '',
      difficulty: 3 as 1 | 2 | 3 | 4 | 5,
      estimatedHours: 10,
      tags: [],
      importance: 5 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      estimatedXP: 100,
      priority: 3 as 1 | 2 | 3 | 4 | 5,
      unlockCondition: '',
      metadata: { externalUrls: [], prerequisites: [] },
      progress: {
        status: 'locked',
        timeSpentMinutes: 0,
        resourcesConsumed: 0,
      },
    });
  }

  const graphEdges: GraphEdge[] = edgePairs.map(([source, target], i) =>
    makeEdge(source, target, i)
  );

  return {
    id: 'test-graph',
    userId: 'test-user',
    title: 'Test Graph',
    createdAt: now,
    updatedAt: now,
    nodes,
    edges: graphEdges,
    rootNodeId: 'node-0',
    goalNodeId: `node-${nodeCount - 1}`,
  };
}

/**
 * Create a linear chain graph: node-0 → node-1 → node-2 → ... → node-N
 */
function createLinearGraph(nodeCount: number): GraphData {
  const edges: Array<[string, string]> = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push([`node-${i}`, `node-${i + 1}`]);
  }
  return createSimpleGraph(nodeCount, edges);
}

/**
 * Create a tree graph: root has N children, each child has M children.
 */
function createTreeGraph(
  branchingFactor: number,
  depth: number,
): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const now = new Date().toISOString();
  let nodeId = 0;

  function addNode(parentId: string | null, currentDepth: number): string {
    const id = `node-${nodeId}`;
    nodeId++;

    nodes.set(id, {
      id,
      label: `Node ${id}`,
      type: currentDepth === 0 ? 'milestone' : 'skill',
      category: 'custom',
      description: '',
      difficulty: 3 as 1 | 2 | 3 | 4 | 5,
      estimatedHours: 10,
      tags: [],
      importance: Math.max(1, 10 - currentDepth) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      estimatedXP: 100,
      priority: 3 as 1 | 2 | 3 | 4 | 5,
      unlockCondition: '',
      metadata: { externalUrls: [], prerequisites: [] },
      progress: {
        status: 'locked',
        timeSpentMinutes: 0,
        resourcesConsumed: 0,
      },
    });

    if (parentId) {
      edges.push(makeEdge(parentId, id, edges.length));
    }

    if (currentDepth < depth) {
      for (let i = 0; i < branchingFactor; i++) {
        addNode(id, currentDepth + 1);
      }
    }

    return id;
  }

  const rootId = addNode(null, 0);

  return {
    id: 'tree-graph',
    userId: 'test-user',
    title: 'Tree Graph',
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    rootNodeId: rootId,
    goalNodeId: `node-${nodeId - 1}`,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LayoutEngine', () => {
  const engine = new LayoutEngine();

  // ── Determinism ──

  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const graph = createLinearGraph(5);

      const output1 = engine.generate(graph, 42);
      const output2 = engine.generate(graph, 42);
      const output3 = engine.generate(graph, 42);

      // Compare positions
      for (const [nodeId, pos1] of output1.positions) {
        const pos2 = output2.positions.get(nodeId);
        const pos3 = output3.positions.get(nodeId);
        expect(pos2).toBeDefined();
        expect(pos3).toBeDefined();
        expect(pos1.position).toEqual(pos2!.position);
        expect(pos1.position).toEqual(pos3!.position);
        expect(pos1.spherical).toEqual(pos2!.spherical);
        expect(pos1.spherical).toEqual(pos3!.spherical);
      }

      // Compare metrics
      expect(output1.metrics).toEqual(output2.metrics);
      expect(output2.metrics).toEqual(output3.metrics);
    });

    it('produces different output for different seeds', () => {
      const graph = createLinearGraph(5);

      const output1 = engine.generate(graph, 42);
      const output2 = engine.generate(graph, 123);

      // At least some positions should differ
      let allSame = true;
      for (const [nodeId, pos1] of output1.positions) {
        const pos2 = output2.positions.get(nodeId);
        if (pos2) {
          const [x1, y1, z1] = pos1.position;
          const [x2, y2, z2] = pos2.position;
          if (Math.abs(x1 - x2) > 0.001 || Math.abs(y1 - y2) > 0.001 || Math.abs(z1 - z2) > 0.001) {
            allSame = false;
            break;
          }
        }
      }

      expect(allSame).toBe(false);
    });

    it('produces identical output across multiple calls with same seed', () => {
      const graph = createTreeGraph(2, 2); // 1 + 2 + 4 = 7 nodes

      const output1 = engine.generate(graph, 99);
      const output2 = engine.generate(graph, 99);

      expect(output1.positions.size).toBe(output2.positions.size);
      for (const [nodeId, pos1] of output1.positions) {
        const pos2 = output2.positions.get(nodeId);
        expect(pos2).toBeDefined();
        expect(pos1.position).toEqual(pos2!.position);
      }
    });
  });

  // ── Every Node Receives a Position ──

  describe('node coverage', () => {
    it('places every node in a linear graph', () => {
      const graph = createLinearGraph(10);
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(10);
      for (const nodeId of graph.nodes.keys()) {
        expect(output.positions.has(nodeId)).toBe(true);
      }
    });

    it('places every node in a tree graph', () => {
      const graph = createTreeGraph(3, 2); // 1 + 3 + 9 = 13 nodes
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(graph.nodes.size);
      for (const nodeId of graph.nodes.keys()) {
        expect(output.positions.has(nodeId)).toBe(true);
      }
    });

    it('places every node in a single-node graph', () => {
      const graph = createSimpleGraph(1);
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(1);
      expect(output.positions.has('node-0')).toBe(true);
    });

    it('places every node in a two-node graph', () => {
      const graph = createSimpleGraph(2, [['node-0', 'node-1']]);
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(2);
      expect(output.positions.has('node-0')).toBe(true);
      expect(output.positions.has('node-1')).toBe(true);
    });

    it('handles empty graph', () => {
      const graph = createSimpleGraph(0);
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(0);
      expect(output.metrics.complete).toBe(true);
    });
  });

  // ── No NaN Values ──

  describe('no NaN values', () => {
    it('produces no NaN positions for linear graph', () => {
      const graph = createLinearGraph(20);
      const output = engine.generate(graph, 42);

      for (const pos of output.positions.values()) {
        const [x, y, z] = pos.position;
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
        expect(Number.isFinite(pos.spherical.azimuth)).toBe(true);
        expect(Number.isFinite(pos.spherical.inclination)).toBe(true);
      }
    });

    it('produces no NaN positions for tree graph', () => {
      const graph = createTreeGraph(4, 3); // 1 + 4 + 16 + 64 = 85 nodes
      const output = engine.generate(graph, 42);

      for (const pos of output.positions.values()) {
        const [x, y, z] = pos.position;
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
      }
    });

    it('produces no NaN positions for single node', () => {
      const graph = createSimpleGraph(1);
      const output = engine.generate(graph, 42);

      const pos = output.positions.get('node-0')!;
      const [x, y, z] = pos.position;
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
    });
  });

  // ── Hierarchy Placement ──

  describe('hierarchy placement', () => {
    it('places root node at the configured position', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 42);

      const rootPos = output.positions.get('node-0')!;
      expect(rootPos).toBeDefined();
      expect(rootPos.depth).toBe(0);
      expect(rootPos.parentId).toBeNull();
    });

    it('assigns correct depth values', () => {
      const graph = createLinearGraph(5);
      const output = engine.generate(graph, 42);

      for (let i = 0; i < 5; i++) {
        const pos = output.positions.get(`node-${i}`);
        expect(pos).toBeDefined();
        expect(pos!.depth).toBe(i);
      }
    });

    it('assigns correct parent-child relationships', () => {
      const graph = createLinearGraph(4);
      const output = engine.generate(graph, 42);

      // node-0 is root, no parent
      expect(output.positions.get('node-0')!.parentId).toBeNull();

      // node-1's parent is node-0
      expect(output.positions.get('node-1')!.parentId).toBe('node-0');

      // node-2's parent is node-1
      expect(output.positions.get('node-2')!.parentId).toBe('node-1');

      // node-3's parent is node-2
      expect(output.positions.get('node-3')!.parentId).toBe('node-2');
    });

    it('assigns correct childIds for parent nodes', () => {
      const graph = createLinearGraph(4);
      const output = engine.generate(graph, 42);

      // node-0 has child node-1
      expect(output.positions.get('node-0')!.childIds).toContain('node-1');

      // node-1 has child node-2
      expect(output.positions.get('node-1')!.childIds).toContain('node-2');

      // node-3 (leaf) has no children
      expect(output.positions.get('node-3')!.childIds).toEqual([]);
    });

    it('places children at different positions than parent', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 42);

      const parentPos = output.positions.get('node-0')!.position;
      const childPos = output.positions.get('node-1')!.position;

      // Parent and child should not be at the same position
      const [px, py, pz] = parentPos;
      const [cx, cy, cz] = childPos;
      const distance = Math.sqrt(
        (cx - px) ** 2 + (cy - py) ** 2 + (cz - pz) ** 2,
      );
      expect(distance).toBeGreaterThan(0.1);
    });

    it('places all children on the sphere surface', () => {
      const graph = createTreeGraph(3, 2);
      const output = engine.generate(graph, 42);

      for (const pos of output.positions.values()) {
        const [x, y, z] = pos.position;
        const distance = Math.sqrt(x * x + y * y + z * z);
        // Should be approximately on the sphere surface
        expect(Math.abs(distance - DEFAULT_LAYOUT_CONFIG.sphereRadius)).toBeLessThan(0.01);
      }
    });
  });

  // ── Config Overrides ──

  describe('config overrides', () => {
    it('respects custom sphereRadius', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 42, { sphereRadius: 10 });

      for (const pos of output.positions.values()) {
        const [x, y, z] = pos.position;
        const distance = Math.sqrt(x * x + y * y + z * z);
        expect(Math.abs(distance - 10)).toBeLessThan(0.01);
      }
    });

    it('respects rootPlacement = north-pole', () => {
      const graph = createSimpleGraph(1);
      const output = engine.generate(graph, 42, { rootPlacement: 'north-pole' });

      const rootPos = output.positions.get('node-0')!;
      const [x, y, z] = rootPos.position;
      // North pole: x ≈ 0, y ≈ sphereRadius, z ≈ 0
      expect(Math.abs(x)).toBeLessThan(0.01);
      expect(Math.abs(y - DEFAULT_LAYOUT_CONFIG.sphereRadius)).toBeLessThan(0.01);
      expect(Math.abs(z)).toBeLessThan(0.01);
    });

    it('respects rootPlacement = south-pole', () => {
      const graph = createSimpleGraph(1);
      const output = engine.generate(graph, 42, { rootPlacement: 'south-pole' });

      const rootPos = output.positions.get('node-0')!;
      const [x, y, z] = rootPos.position;
      // South pole: x ≈ 0, y ≈ -sphereRadius, z ≈ 0
      expect(Math.abs(x)).toBeLessThan(0.01);
      expect(Math.abs(y + DEFAULT_LAYOUT_CONFIG.sphereRadius)).toBeLessThan(0.01);
      expect(Math.abs(z)).toBeLessThan(0.01);
    });

    it('respects custom childSpacing', () => {
      const graph = createLinearGraph(3);
      const output1 = engine.generate(graph, 42, { childSpacing: 0.2 });
      const output2 = engine.generate(graph, 42, { childSpacing: 0.8 });

      const child1 = output1.positions.get('node-1')!;
      const child2 = output2.positions.get('node-1')!;

      // Different spacing should produce different positions
      const [c1x, c1y, c1z] = child1.position;
      const [c2x, c2y, c2z] = child2.position;
      const diff = Math.sqrt(
        (c2x - c1x) ** 2 + (c2y - c1y) ** 2 + (c2z - c1z) ** 2,
      );
      expect(diff).toBeGreaterThan(0.1);
    });
  });

  // ── Disconnected Nodes ──

  describe('disconnected nodes', () => {
    it('places disconnected nodes at some position', () => {
      // Create graph with edges that don't connect all nodes
      const graph = createSimpleGraph(5, [['node-0', 'node-1']]);
      // node-2, node-3, node-4 are disconnected
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(5);
      expect(output.metrics.disconnectedNodeCount).toBe(3);

      // Disconnected nodes should still have valid positions
      for (let i = 2; i < 5; i++) {
        const pos = output.positions.get(`node-${i}`);
        expect(pos).toBeDefined();
        const [x, y, z] = pos!.position;
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(Number.isFinite(z)).toBe(true);
      }
    });

    it('handles graph with no edges', () => {
      const graph = createSimpleGraph(5); // No edges
      const output = engine.generate(graph, 42);

      expect(output.positions.size).toBe(5);
      // Root is connected, others are disconnected
      expect(output.metrics.disconnectedNodeCount).toBe(4);
    });
  });

  // ── Output Structure ──

  describe('output structure', () => {
    it('returns correct seed and graphId', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 777);

      expect(output.seed).toBe(777);
      expect(output.graphId).toBe('test-graph');
    });

    it('returns a single default continent', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 42);

      expect(output.continents).toHaveLength(1);
      expect(output.continents[0].id).toBe('default');
      expect(output.continents[0].nodeIds).toContain('node-0');
      expect(output.continents[0].nodeIds).toContain('node-1');
      expect(output.continents[0].nodeIds).toContain('node-2');
    });

    it('returns empty roads array', () => {
      const graph = createLinearGraph(3);
      const output = engine.generate(graph, 42);

      expect(output.roads).toEqual([]);
    });

    it('reports complete = true when all nodes placed', () => {
      const graph = createLinearGraph(10);
      const output = engine.generate(graph, 42);

      expect(output.metrics.complete).toBe(true);
    });

    it('reports correct maxDepth', () => {
      const graph = createLinearGraph(5);
      const output = engine.generate(graph, 42);

      expect(output.metrics.maxDepth).toBe(4); // 0-indexed: node-0 to node-4
    });
  });

  // ── Edge Cases ──

  describe('edge cases', () => {
    it('handles graph with self-loop edge', () => {
      const graph = createSimpleGraph(2, [['node-0', 'node-0']]);
      // Should not crash; self-loop should be ignored in BFS
      const output = engine.generate(graph, 42);
      expect(output.positions.size).toBe(2);
    });

    it('handles graph with duplicate edges', () => {
      const graph = createSimpleGraph(3, [
        ['node-0', 'node-1'],
        ['node-0', 'node-1'], // Duplicate
        ['node-1', 'node-2'],
      ]);
      const output = engine.generate(graph, 42);
      expect(output.positions.size).toBe(3);
    });

    it('handles graph with missing root node', () => {
      const graph = createSimpleGraph(3, [['node-0', 'node-1']]);
      // Set root to a non-existent node
      graph.rootNodeId = 'nonexistent';
      const output = engine.generate(graph, 42);
      // All nodes should be placed as disconnected
      expect(output.positions.size).toBe(3);
      expect(output.metrics.disconnectedNodeCount).toBe(3);
    });

    it('handles very large graph without crashing', () => {
      const graph = createLinearGraph(500);
      const output = engine.generate(graph, 42);
      expect(output.positions.size).toBe(500);
      expect(output.metrics.complete).toBe(true);
    });
  });
});
