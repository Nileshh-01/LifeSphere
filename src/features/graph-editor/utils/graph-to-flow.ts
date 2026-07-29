/**
 * Graph-to-Flow Conversion
 *
 * Converts canonical GraphData from the Graph Engine into
 * React Flow nodes and edges for visualization.
 *
 * This is the ONLY place where Graph Engine types are mapped
 * to React Flow types. If the visualization library changes,
 * only this file and flow-to-graph.ts need modification.
 *
 * @module GraphEditor
 */

import { MarkerType } from '@xyflow/react';
import type { GraphData, GraphNode, GraphEdge } from '@/core/graph/types';
import { inferHierarchyLevel, defaultHierarchyStrategy } from '@/core/graph/graph-engine';
import type { SkillFlowNode, DependencyFlowEdge, SkillNodeData, DependencyEdgeData } from '../types';

// ============================================================================
// Default Layout
// ============================================================================

/**
 * Default spacing constants for node positioning.
 * These are temporary — the Layout Engine will eventually
 * determine canonical positions.
 */
const SPACING = {
  /** Horizontal spacing between sibling nodes */
  X: 250,
  /** Vertical spacing between parent and child */
  Y: 150,
  /** Initial X offset for the root node */
  START_X: 400,
  /** Initial Y offset for the root node */
  START_Y: 50,
};

// ============================================================================
// Layout Algorithm
// ============================================================================

/**
 * Compute a simple tree layout for the graph.
 *
 * This is a basic top-down tree layout used for initial rendering.
 * It does NOT replace the Layout Engine — it's a fallback for the
 * Graph Editor when no layout data is available.
 *
 * Algorithm:
 * 1. Place the root node at (START_X, START_Y).
 * 2. For each child, place it below its parent, offset horizontally.
 * 3. Use BFS to ensure siblings are evenly spaced.
 *
 * @param graph - The graph to lay out
 * @returns Map of node ID → { x, y } position
 */
function computeTreeLayout(graph: GraphData): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  // Track horizontal offset per depth level
  const depthCounters = new Map<number, number>();
  const depthPositions = new Map<number, number[]>();

  // BFS to compute depth of each node
  const depthMap = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [];

  if (graph.nodes.has(graph.rootNodeId)) {
    queue.push({ id: graph.rootNodeId, depth: 0 });
    depthMap.set(graph.rootNodeId, 0);
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    // Count nodes at this depth
    depthCounters.set(depth, (depthCounters.get(depth) ?? 0) + 1);

    // Find children
    for (const edge of graph.edges) {
      if (edge.source === id && !depthMap.has(edge.target)) {
        depthMap.set(edge.target, depth + 1);
        queue.push({ id: edge.target, depth: depth + 1 });
      }
    }
  }

  // Compute positions using BFS
  visited.clear();
  const levelCounters = new Map<number, number>();

  if (graph.nodes.has(graph.rootNodeId)) {
    const rootQueue: Array<{ id: string; depth: number }> = [
      { id: graph.rootNodeId, depth: 0 },
    ];
    visited.add(graph.rootNodeId);

    // Place root
    const rootCount = depthCounters.get(0) ?? 1;
    positions.set(graph.rootNodeId, {
      x: SPACING.START_X + (rootCount - 1) * SPACING.X * 0.5,
      y: SPACING.START_Y,
    });

    while (rootQueue.length > 0) {
      const { id, depth } = rootQueue.shift()!;
      const parentPos = positions.get(id);
      if (!parentPos) continue;

      // Get children sorted by ID for deterministic order
      const children: string[] = [];
      for (const edge of graph.edges) {
        if (edge.source === id && !visited.has(edge.target)) {
          children.push(edge.target);
          visited.add(edge.target);
        }
      }
      children.sort();

      const childDepth = depth + 1;
      const totalAtDepth = depthCounters.get(childDepth) ?? children.length;
      const counter = levelCounters.get(childDepth) ?? 0;

      children.forEach((childId, index) => {
        const childIndex = counter + index;
        const offset = childIndex - (totalAtDepth - 1) / 2;

        positions.set(childId, {
          x: SPACING.START_X + offset * SPACING.X,
          y: SPACING.START_Y + childDepth * SPACING.Y,
        });

        rootQueue.push({ id: childId, depth: childDepth });
      });

      levelCounters.set(childDepth, counter + children.length);
    }
  }

  // Place any remaining nodes (disconnected components)
  for (const nodeId of graph.nodes.keys()) {
    if (!positions.has(nodeId)) {
      const depth = depthMap.get(nodeId) ?? 0;
      const totalAtDepth = depthCounters.get(depth) ?? 1;
      const counter = levelCounters.get(depth) ?? 0;

      const offset = counter - (totalAtDepth - 1) / 2;
      positions.set(nodeId, {
        x: SPACING.START_X + offset * SPACING.X,
        y: SPACING.START_Y + depth * SPACING.Y,
      });

      levelCounters.set(depth, counter + 1);
    }
  }

  return positions;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a GraphData object to React Flow nodes and edges.
 *
 * @param graph - The canonical graph data
 * @returns Object containing React Flow nodes and edges
 */
export function graphToFlow(graph: GraphData): {
  nodes: SkillFlowNode[];
  edges: DependencyFlowEdge[];
} {
  const positions = computeTreeLayout(graph);
  const flowNodes: SkillFlowNode[] = [];
  const flowEdges: DependencyFlowEdge[] = [];

  // Convert GraphNodes to React Flow nodes
  for (const [nodeId, graphNode] of graph.nodes) {
    const pos = graphNode.position ?? positions.get(nodeId) ?? { x: 0, y: 0 };

    // Compute hierarchy level using Graph Engine's default strategy
    const hierarchyLevel = inferHierarchyLevel(graphNode, graph, defaultHierarchyStrategy);

    const flowNode: SkillFlowNode = {
      id: nodeId,
      type: 'skillNode',
      position: { x: pos.x, y: pos.y },
      data: {
        graphNode,
        selected: false,
        validationIssues: [],
        hierarchyLevel,
      },
    };

    flowNodes.push(flowNode);
  }

  // Convert GraphEdges to React Flow edges
  for (const graphEdge of graph.edges) {
    const flowEdge: DependencyFlowEdge = {
      id: graphEdge.id,
      source: graphEdge.source,
      target: graphEdge.target,
      type: 'dependencyEdge',
      data: {
        graphEdge,
        selected: false,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: {
        strokeWidth: graphEdge.weight * 3,
        stroke: getEdgeColor(graphEdge.type),
      },
      label: graphEdge.type,
    };

    flowEdges.push(flowEdge);
  }

  return { nodes: flowNodes, edges: flowEdges };
}

// ============================================================================
// Edge Color Mapping
// ============================================================================

/**
 * Get the color for an edge type.
 * Used for visual distinction in the editor.
 */
function getEdgeColor(type: GraphEdge['type']): string {
  switch (type) {
    case 'prerequisite':
      return '#6366f1'; // Indigo
    case 'recommended':
      return '#22c55e'; // Green
    case 'related':
      return '#f59e0b'; // Amber
    case 'leads-to':
      return '#ec4899'; // Pink
    default:
      return '#6b7280'; // Gray
  }
}
