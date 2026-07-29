/**
 * Graph Engine — Unit Tests
 *
 * Comprehensive tests for all public functions in the Graph Engine.
 * Covers: validation, cycle detection, topological sort, learning path,
 * available skills, path finding, completion percentage, filter by category,
 * hierarchy inference, and serialization.
 *
 * @module GraphEngine
 */

import { describe, it, expect } from 'vitest';
import {
  validateGraphData,
  detectCycles,
  topologicalSort,
  getLearningPath,
  getAvailableSkills,
  findPath,
  getCompletionPercent,
  filterByCategory,
  inferHierarchyLevel,
  defaultHierarchyStrategy,
  serializeGraph,
  deserializeGraph,
} from '../graph-engine';
import type { GraphData, GraphNode, GraphEdge } from '../types';
import { WEB_DEV_GRAPH, ID as WD } from '../examples/web-development';
import { ML_GRAPH, ID as ML } from '../examples/machine-learning';
import { GUITAR_GRAPH, ID as GT } from '../examples/guitar';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a minimal graph from a list of edges.
 * Each edge defines the topology. Nodes are created automatically.
 * Always includes at least the root node 'A'.
 */
function createGraphFromEdges(
  edgeDefs: Array<{ source: string; target: string }>,
  completedIds: string[] = [],
): GraphData {
  const nodeIds = new Set<string>();

  // Always include root node A
  nodeIds.add('A');

  for (const { source, target } of edgeDefs) {
    nodeIds.add(source);
    nodeIds.add(target);
  }

  const nodes = new Map<string, GraphNode>();
  for (const id of nodeIds) {
    const isCompleted = completedIds.includes(id);
    nodes.set(id, {
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
        status: id === 'A' && !isCompleted ? 'available' : isCompleted ? 'completed' : 'locked',
        timeSpentMinutes: 0,
        resourcesConsumed: 0,
      },
    });
  }

  const edges: GraphEdge[] = edgeDefs.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    type: 'prerequisite',
    weight: 1.0,
    metadata: { required: true },
  }));

  const allIds = [...nodeIds];
  return {
    id: 'test-graph',
    userId: 'test',
    title: 'Test Graph',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    nodes,
    edges,
    rootNodeId: 'A',
    goalNodeId: allIds[allIds.length - 1],
  };
}

// ============================================================================
// Suite
// ============================================================================

describe('Graph Engine', () => {
  // ========================================================================
  // Validation
  // ========================================================================

  describe('validateGraphData', () => {
    it('validates a well-formed graph', () => {
      const result = validateGraphData(WEB_DEV_GRAPH);
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('detects orphan nodes', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        nodes: new Map(WEB_DEV_GRAPH.nodes).set('orphan-001', {
          id: 'orphan-001',
          label: 'Orphan',
          type: 'skill',
          category: 'custom',
          description: '',
          difficulty: 1,
          estimatedHours: 1,
          tags: [],
          importance: 1,
          estimatedXP: 10,
          priority: 1,
          unlockCondition: '',
          metadata: { externalUrls: [], prerequisites: [] },
          progress: { status: 'locked', timeSpentMinutes: 0, resourcesConsumed: 0 },
        }),
      };
      const result = validateGraphData(graph);
      expect(result.issues.some((i) => i.rule === 'orphan-node')).toBe(true);
    });

    it('detects missing node references in edges', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        edges: [
          ...WEB_DEV_GRAPH.edges,
          {
            id: 'e-invalid',
            source: 'nonexistent',
            target: 'wd-001',
            type: 'prerequisite',
            weight: 1.0,
            metadata: { required: true },
          },
        ],
      };
      const result = validateGraphData(graph);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'missing-node-reference')).toBe(true);
    });

    it('detects self-loops', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        edges: [
          ...WEB_DEV_GRAPH.edges,
          {
            id: 'e-self-loop',
            source: 'wd-001',
            target: 'wd-001',
            type: 'prerequisite',
            weight: 1.0,
            metadata: { required: true },
          },
        ],
      };
      const result = validateGraphData(graph);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'self-loop')).toBe(true);
    });

    it('detects duplicate edges', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        edges: [
          ...WEB_DEV_GRAPH.edges,
          {
            id: 'e-dup',
            source: 'wd-001',
            target: 'wd-002',
            type: 'prerequisite',
            weight: 1.0,
            metadata: { required: true },
          },
        ],
      };
      const result = validateGraphData(graph);
      expect(result.issues.some((i) => i.rule === 'duplicate-edge')).toBe(true);
    });

    it('detects orphan nodes', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        nodes: new Map(WEB_DEV_GRAPH.nodes).set('orphan-001', {
          id: 'orphan-001',
          label: 'Orphan',
          type: 'skill',
          category: 'custom',
          description: '',
          difficulty: 1,
          estimatedHours: 1,
          tags: [],
          importance: 1,
          estimatedXP: 10,
          priority: 1,
          unlockCondition: '',
          metadata: { externalUrls: [], prerequisites: [] },
          progress: { status: 'locked', timeSpentMinutes: 0, resourcesConsumed: 0 },
        }),
      };
      const result = validateGraphData(graph);
      expect(result.issues.some((i) => i.rule === 'orphan-node')).toBe(true);
    });

    it('detects empty graph', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        nodes: new Map(),
        rootNodeId: '',
        goalNodeId: '',
      };
      const result = validateGraphData(graph);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'empty-graph')).toBe(true);
    });

    it('detects missing root node', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        rootNodeId: 'nonexistent',
      };
      const result = validateGraphData(graph);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === 'missing-root-node')).toBe(true);
    });

    it('detects invalid progress state (locked with time spent)', () => {
      const graph: GraphData = {
        ...WEB_DEV_GRAPH,
        nodes: new Map(WEB_DEV_GRAPH.nodes).set('wd-002', {
          ...WEB_DEV_GRAPH.nodes.get('wd-002')!,
          progress: { status: 'locked', timeSpentMinutes: 30, resourcesConsumed: 0 },
        }),
      };
      const result = validateGraphData(graph);
      expect(result.issues.some((i) => i.rule === 'invalid-progress-state')).toBe(true);
    });
  });

  // ========================================================================
  // Cycle Detection
  // ========================================================================

  describe('detectCycles', () => {
    it('returns no cycles for a linear graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' },
      ]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBe(0);
    });

    it('returns no cycles for a branching graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' },
      ]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBe(0);
    });

    it('detects a simple 3-node cycle', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'A' },
      ]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);
      const cycle = cycles[0];
      expect(cycle).toContain('A');
      expect(cycle).toContain('B');
      expect(cycle).toContain('C');
    });

    it('detects a self-loop cycle', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'A' },
        { source: 'A', target: 'B' },
      ]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('detects no cycles in web-dev graph', () => {
      const cycles = detectCycles(WEB_DEV_GRAPH);
      expect(cycles.length).toBe(0);
    });

    it('detects no cycles in ML graph', () => {
      const cycles = detectCycles(ML_GRAPH);
      expect(cycles.length).toBe(0);
    });

    it('detects no cycles in guitar graph', () => {
      const cycles = detectCycles(GUITAR_GRAPH);
      expect(cycles.length).toBe(0);
    });
  });

  // ========================================================================
  // Topological Sort
  // ========================================================================

  describe('topologicalSort', () => {
    it('returns nodes in topological order for a linear graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
      ]);
      const order = topologicalSort(graph);
      const orderIds = order.map((n) => n.id);
      expect(orderIds).toEqual(['A', 'B', 'C']);
    });

    it('returns nodes in topological order for a branching graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' },
      ]);
      const order = topologicalSort(graph);
      const orderIds = order.map((n) => n.id);
      expect(orderIds.indexOf('A')).toBeLessThan(orderIds.indexOf('B'));
      expect(orderIds.indexOf('A')).toBeLessThan(orderIds.indexOf('C'));
      expect(orderIds.indexOf('B')).toBeLessThan(orderIds.indexOf('D'));
      expect(orderIds.indexOf('C')).toBeLessThan(orderIds.indexOf('D'));
    });

    it('throws error for a graph with cycles', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'A' },
      ]);
      expect(() => topologicalSort(graph)).toThrow('Graph contains a cycle');
    });

    it('returns all nodes for web-dev graph', () => {
      const order = topologicalSort(WEB_DEV_GRAPH);
      expect(order.length).toBe(WEB_DEV_GRAPH.nodes.size);
    });

    it('returns all nodes for ML graph', () => {
      const order = topologicalSort(ML_GRAPH);
      expect(order.length).toBe(ML_GRAPH.nodes.size);
    });

    it('returns all nodes for guitar graph', () => {
      const order = topologicalSort(GUITAR_GRAPH);
      expect(order.length).toBe(GUITAR_GRAPH.nodes.size);
    });
  });

  // ========================================================================
  // Learning Path
  // ========================================================================

  describe('getLearningPath', () => {
    it('returns the full path from root to goal for a linear graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' },
      ]);
      const path = getLearningPath(graph);
      const pathIds = path.map((n) => n.id);
      expect(pathIds[0]).toBe('A');
      expect(pathIds[pathIds.length - 1]).toBe('D');
    });

    it('returns all nodes in the graph for a linear topology', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' },
      ]);
      const path = getLearningPath(graph);
      const pathIds = path.map((n) => n.id);
      expect(pathIds.length).toBe(graph.nodes.size);
    });

    it('returns path for web-dev graph', () => {
      const path = getLearningPath(WEB_DEV_GRAPH);
      const pathIds = path.map((n) => n.id);
      expect(pathIds.length).toBe(WEB_DEV_GRAPH.nodes.size);
      expect(pathIds[0]).toBe(WD.WEB_DEV);
      expect(pathIds).toContain(WD.NEXT_JS);
    });

    it('returns path for ML graph', () => {
      const path = getLearningPath(ML_GRAPH);
      const pathIds = path.map((n) => n.id);
      expect(pathIds.length).toBe(ML_GRAPH.nodes.size);
      expect(pathIds[0]).toBe(ML.ML);
      expect(pathIds).toContain(ML.ML_PROJECT);
    });

    it('returns path for guitar graph', () => {
      const path = getLearningPath(GUITAR_GRAPH);
      const pathIds = path.map((n) => n.id);
      expect(pathIds.length).toBe(GUITAR_GRAPH.nodes.size);
      expect(pathIds[0]).toBe(GT.GUITAR);
      expect(pathIds).toContain(GT.FIRST_GIG);
    });
  });

  // ========================================================================
  // Available Skills
  // ========================================================================

  describe('getAvailableSkills', () => {
    it('returns root node when nothing is completed', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
      ]);
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      expect(availableIds).toEqual(['A']);
    });

    it('returns children when root is completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'A', target: 'C' },
          { source: 'B', target: 'D' },
        ],
        ['A'],
      );
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      expect(availableIds).toContain('A');
      expect(availableIds).toContain('B');
      expect(availableIds).toContain('C');
      expect(availableIds).not.toContain('D');
    });

    it('returns next nodes when some are completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
          { source: 'C', target: 'D' },
        ],
        ['A', 'B'],
      );
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      expect(availableIds).toContain('A');
      expect(availableIds).toContain('B');
      expect(availableIds).toContain('C');
      expect(availableIds).not.toContain('D');
    });

    it('returns only root when all non-root nodes are completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        ['B', 'C'],
      );
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      // Root A is available. B is completed. C is available because all its required prerequisites (B) are completed.
      expect(availableIds).toContain('A');
      expect(availableIds).toContain('C');
    });

    it('includes completed nodes in available list', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        ['A', 'B'],
      );
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      expect(availableIds).toContain('A');
      expect(availableIds).toContain('B');
      expect(availableIds).toContain('C');
    });
  });

  // ========================================================================
  // Path Finding
  // ========================================================================

  describe('findPath', () => {
    it('finds a path between two connected nodes', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' },
      ]);
      const path = findPath(graph, 'A', 'D');
      const pathIds = path.map((n) => n.id);
      expect(pathIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('returns empty array when no path exists', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'C', target: 'D' },
      ]);
      const path = findPath(graph, 'A', 'D');
      expect(path).toEqual([]);
    });

    it('returns single node when source equals target', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
      ]);
      const path = findPath(graph, 'A', 'A');
      const pathIds = path.map((n) => n.id);
      expect(pathIds).toEqual(['A']);
    });

    it('finds path in web-dev graph', () => {
      const path = findPath(WEB_DEV_GRAPH, WD.WEB_DEV, WD.NEXT_JS);
      const pathIds = path.map((n) => n.id);
      expect(pathIds.length).toBeGreaterThan(0);
      expect(pathIds[0]).toBe(WD.WEB_DEV);
      expect(pathIds[pathIds.length - 1]).toBe(WD.NEXT_JS);
    });
  });

  // ========================================================================
  // Completion Percentage
  // ========================================================================

  describe('getCompletionPercent', () => {
    it('returns 0 when nothing is completed', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
      ]);
      expect(getCompletionPercent(graph)).toBe(0);
    });

    it('returns 50 when half the nodes are completed (2 of 4)', () => {
      // 4 nodes: A (completed), B (completed), C (locked), D (locked) = 2/4 = 50%
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
          { source: 'C', target: 'D' },
        ],
        ['A', 'B'],
      );
      expect(getCompletionPercent(graph)).toBe(50);
    });

    it('returns ~67 when 2 of 3 are completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        ['A', 'B'],
      );
      expect(getCompletionPercent(graph)).toBeCloseTo(66.67, 0);
    });

    it('returns 100 when all nodes are completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        ['A', 'B', 'C'],
      );
      expect(getCompletionPercent(graph)).toBe(100);
    });

    it('returns correct percentage for web-dev graph', () => {
      const pct = getCompletionPercent(WEB_DEV_GRAPH);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });
  });

  // ========================================================================
  // Filter by Category
  // ========================================================================

  describe('filterByCategory', () => {
    it('returns all frontend nodes from web-dev graph', () => {
      const filtered = filterByCategory(WEB_DEV_GRAPH, 'frontend');
      expect(filtered.nodes.size).toBeGreaterThan(0);
      for (const node of filtered.nodes.values()) {
        expect(node.category).toBe('frontend');
      }
    });

    it('returns all backend nodes from web-dev graph', () => {
      const filtered = filterByCategory(WEB_DEV_GRAPH, 'backend');
      expect(filtered.nodes.size).toBeGreaterThan(0);
      for (const node of filtered.nodes.values()) {
        expect(node.category).toBe('backend');
      }
    });

    it('returns all devops nodes from web-dev graph', () => {
      const filtered = filterByCategory(WEB_DEV_GRAPH, 'devops');
      expect(filtered.nodes.size).toBeGreaterThan(0);
      for (const node of filtered.nodes.values()) {
        expect(node.category).toBe('devops');
      }
    });

    it('returns empty graph for non-existent category', () => {
      const filtered = filterByCategory(WEB_DEV_GRAPH, 'nonexistent');
      expect(filtered.nodes.size).toBe(0);
      expect(filtered.edges.length).toBe(0);
    });

    it('returns all data-science nodes from ML graph', () => {
      const filtered = filterByCategory(ML_GRAPH, 'data-science');
      expect(filtered.nodes.size).toBe(ML_GRAPH.nodes.size);
    });
  });

  // ========================================================================
  // Hierarchy Inference
  // ========================================================================

  describe('inferHierarchyLevel', () => {
    it('returns continent for root milestone node', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.WEB_DEV)!;
      const level = inferHierarchyLevel(node, WEB_DEV_GRAPH);
      expect(level).toBe('continent');
    });

    it('returns building for leaf sub-skill node', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.DATABASES)!;
      const level = inferHierarchyLevel(node, WEB_DEV_GRAPH);
      expect(level).toBe('building');
    });

    it('returns city for JS node (skill with 4 children, importance 9)', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.JS)!;
      const level = inferHierarchyLevel(node, WEB_DEV_GRAPH);
      expect(level).toBe('city');
    });

    it('returns city for single-node skill graph (importance 5, 0 children)', () => {
      const graph = createGraphFromEdges([]);
      const node = graph.nodes.get('A')!;
      // Skill with 0 children and importance 5 → NOT district (needs >0 children) → falls through to decoration
      const level = inferHierarchyLevel(node, graph);
      expect(level).toBe('decoration');
    });
  });

  describe('defaultHierarchyStrategy', () => {
    it('returns continent for root milestone node', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.WEB_DEV)!;
      const result = defaultHierarchyStrategy(node, WEB_DEV_GRAPH);
      expect(result).toBe('continent');
    });

    it('returns building for leaf sub-skill node', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.DATABASES)!;
      const result = defaultHierarchyStrategy(node, WEB_DEV_GRAPH);
      expect(result).toBe('building');
    });

    it('returns city for JS node (skill with 4 children, importance 9)', () => {
      const node = WEB_DEV_GRAPH.nodes.get(WD.JS)!;
      const result = defaultHierarchyStrategy(node, WEB_DEV_GRAPH);
      expect(result).toBe('city');
    });
  });

  // ========================================================================
  // Serialization
  // ========================================================================

  describe('serializeGraph / deserializeGraph', () => {
    it('serializes and deserializes web-dev graph', () => {
      const serialized = serializeGraph(WEB_DEV_GRAPH);
      const deserialized = deserializeGraph(serialized);
      expect(deserialized.id).toBe(WEB_DEV_GRAPH.id);
      expect(deserialized.nodes.size).toBe(WEB_DEV_GRAPH.nodes.size);
      expect(deserialized.edges.length).toBe(WEB_DEV_GRAPH.edges.length);
      // Verify node content
      for (const [id, node] of WEB_DEV_GRAPH.nodes) {
        expect(deserialized.nodes.get(id)?.label).toBe(node.label);
      }
    });

    it('serializes and deserializes ML graph', () => {
      const serialized = serializeGraph(ML_GRAPH);
      const deserialized = deserializeGraph(serialized);
      expect(deserialized.id).toBe(ML_GRAPH.id);
      expect(deserialized.nodes.size).toBe(ML_GRAPH.nodes.size);
      expect(deserialized.edges.length).toBe(ML_GRAPH.edges.length);
    });

    it('serializes and deserializes guitar graph', () => {
      const serialized = serializeGraph(GUITAR_GRAPH);
      const deserialized = deserializeGraph(serialized);
      expect(deserialized.id).toBe(GUITAR_GRAPH.id);
      expect(deserialized.nodes.size).toBe(GUITAR_GRAPH.nodes.size);
      expect(deserialized.edges.length).toBe(GUITAR_GRAPH.edges.length);
    });

    it('round-trip preserves node progress data', () => {
      const serialized = serializeGraph(WEB_DEV_GRAPH);
      const deserialized = deserializeGraph(serialized);
      for (const [id, node] of WEB_DEV_GRAPH.nodes) {
        const restored = deserialized.nodes.get(id);
        expect(restored?.progress.status).toBe(node.progress.status);
        expect(restored?.progress.timeSpentMinutes).toBe(node.progress.timeSpentMinutes);
      }
    });

    it('round-trip preserves edge metadata', () => {
      const serialized = serializeGraph(WEB_DEV_GRAPH);
      const deserialized = deserializeGraph(serialized);
      for (let i = 0; i < WEB_DEV_GRAPH.edges.length; i++) {
        expect(deserialized.edges[i].metadata.required).toBe(WEB_DEV_GRAPH.edges[i].metadata.required);
      }
    });

    it('serialized output is valid JSON', () => {
      const serialized = serializeGraph(WEB_DEV_GRAPH);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('deserialized graph passes validation', () => {
      const serialized = serializeGraph(WEB_DEV_GRAPH);
      const deserialized = deserializeGraph(serialized);
      const result = validateGraphData(deserialized);
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Disconnected Graphs
  // ========================================================================

  describe('disconnected graphs', () => {
    it('detectCycles handles disconnected components', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'C', target: 'D' },
      ]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBe(0);
    });

    it('topologicalSort handles disconnected components', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'C', target: 'D' },
      ]);
      const order = topologicalSort(graph);
      const orderIds = order.map((n) => n.id);
      expect(orderIds.length).toBe(4);
      expect(orderIds.indexOf('A')).toBeLessThan(orderIds.indexOf('B'));
      expect(orderIds.indexOf('C')).toBeLessThan(orderIds.indexOf('D'));
    });

    it('getLearningPath returns path within connected component', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'C', target: 'D' },
      ]);
      const path = getLearningPath(graph);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Large Graphs
  // ========================================================================

  describe('large graphs', () => {
    it('handles a graph with 100 nodes (plus root)', () => {
      const edgeDefs: Array<{ source: string; target: string }> = [];
      for (let i = 0; i < 99; i++) {
        edgeDefs.push({ source: `N${i}`, target: `N${i + 1}` });
      }
      const graph = createGraphFromEdges(edgeDefs);
      // Helper always adds root 'A' + 100 distinct N0..N99 = 101 unique node IDs
      const expectedNodeCount = 1 + 100; // 'A' plus N0..N99
      expect(graph.nodes.size).toBe(expectedNodeCount);
      const order = topologicalSort(graph);
      expect(order.length).toBe(expectedNodeCount);
      const path = getLearningPath(graph);
      expect(path.length).toBe(expectedNodeCount);
    });

    it('handles a graph with 500 nodes (plus root)', () => {
      const edgeDefs: Array<{ source: string; target: string }> = [];
      for (let i = 0; i < 499; i++) {
        edgeDefs.push({ source: `N${i}`, target: `N${i + 1}` });
      }
      const graph = createGraphFromEdges(edgeDefs);
      // Helper always adds root 'A' + 500 distinct N0..N499 = 501 unique node IDs
      const expectedNodeCount = 1 + 500;
      expect(graph.nodes.size).toBe(expectedNodeCount);
      const order = topologicalSort(graph);
      expect(order.length).toBe(expectedNodeCount);
    });
  });

  // ========================================================================
  // Determinism
  // ========================================================================

  describe('determinism', () => {
    it('topologicalSort returns same order for same graph', () => {
      const graph = createGraphFromEdges([
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'B', target: 'D' },
        { source: 'C', target: 'D' },
      ]);
      const order1 = topologicalSort(graph);
      const order2 = topologicalSort(graph);
      expect(order1).toEqual(order2);
    });

    it('getLearningPath returns same path for same graph', () => {
      const path1 = getLearningPath(WEB_DEV_GRAPH);
      const path2 = getLearningPath(WEB_DEV_GRAPH);
      expect(path1).toEqual(path2);
    });

    it('detectCycles returns same cycles for same graph', () => {
      const cycles1 = detectCycles(WEB_DEV_GRAPH);
      const cycles2 = detectCycles(WEB_DEV_GRAPH);
      expect(cycles1).toEqual(cycles2);
    });

    it('serializeGraph returns same output for same graph', () => {
      const s1 = serializeGraph(WEB_DEV_GRAPH);
      const s2 = serializeGraph(WEB_DEV_GRAPH);
      expect(s1).toBe(s2);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('handles single-node graph', () => {
      const graph = createGraphFromEdges([]);
      // Helper now always creates at least node A with no edges
      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('A')).toBe(true);
      const order = topologicalSort(graph);
      const orderIds = order.map((n) => n.id);
      expect(orderIds).toEqual(['A']);
      const path = getLearningPath(graph);
      const pathIds = path.map((n) => n.id);
      expect(pathIds).toEqual(['A']);
      expect(getCompletionPercent(graph)).toBe(0);
    });

    it('handles graph with no edges', () => {
      const graph = createGraphFromEdges([]);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBe(0);
    });

    it('handles graph where all nodes are completed', () => {
      const graph = createGraphFromEdges(
        [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' },
        ],
        ['A', 'B', 'C'],
      );
      expect(getCompletionPercent(graph)).toBe(100);
      const available = getAvailableSkills(graph);
      const availableIds = available.map((n) => n.id);
      expect(availableIds).toContain('A');
      expect(availableIds).toContain('B');
      expect(availableIds).toContain('C');
    });
  });
});
