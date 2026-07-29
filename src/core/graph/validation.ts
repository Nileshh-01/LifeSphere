/**
 * Graph Validation
 *
 * Pure validation functions for GraphData. These functions check graph
 * integrity without performing traversal, search, or topology operations.
 * The Graph Engine calls `validateGraph()` before any traversal to ensure
 * the graph is well-formed.
 *
 * All functions are stateless and deterministic.
 *
 * @module GraphEngine
 */

import type {
  GraphData,
  GraphNode,
  GraphEdge,
  ValidationResult,
  ValidationIssue,
  NodeStatus,
} from './types';
import { MAX_NODES, MAX_EDGES, MAX_GRAPH_DEPTH } from './constants';

// ============================================================================
// Individual Validation Rules
// ============================================================================

/**
 * Check for duplicate node IDs.
 * Returns issues for any node ID that appears more than once.
 */
export function validateDuplicateNodeIds(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const nodeId of graph.nodes.keys()) {
    if (seen.has(nodeId)) {
      issues.push({
        severity: 'error',
        message: `Duplicate node ID: "${nodeId}"`,
        rule: 'duplicate-node-ids',
        ids: [nodeId],
      });
    }
    seen.add(nodeId);
  }

  return issues;
}

/**
 * Check for duplicate edge IDs.
 * Returns issues for any edge ID that appears more than once.
 */
export function validateDuplicateEdgeIds(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const edge of graph.edges) {
    if (seen.has(edge.id)) {
      issues.push({
        severity: 'error',
        message: `Duplicate edge ID: "${edge.id}"`,
        rule: 'duplicate-edge-ids',
        ids: [edge.id],
      });
    }
    seen.add(edge.id);
  }

  return issues;
}

/**
 * Check that all edge source/target references point to existing nodes.
 */
export function validateMissingNodeReferences(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const edge of graph.edges) {
    if (!graph.nodes.has(edge.source)) {
      issues.push({
        severity: 'error',
        message: `Edge "${edge.id}" references non-existent source node: "${edge.source}"`,
        rule: 'missing-node-reference',
        ids: [edge.id, edge.source],
      });
    }
    if (!graph.nodes.has(edge.target)) {
      issues.push({
        severity: 'error',
        message: `Edge "${edge.id}" references non-existent target node: "${edge.target}"`,
        rule: 'missing-node-reference',
        ids: [edge.id, edge.target],
      });
    }
  }

  return issues;
}

/**
 * Check for self-loop edges (source === target).
 */
export function validateSelfLoops(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const edge of graph.edges) {
    if (edge.source === edge.target) {
      issues.push({
        severity: 'error',
        message: `Edge "${edge.id}" is a self-loop (source === target: "${edge.source}")`,
        rule: 'self-loop',
        ids: [edge.id],
      });
    }
  }

  return issues;
}

/**
 * Check for duplicate edges (same source, target, and type).
 */
export function validateDuplicateEdges(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const edge of graph.edges) {
    const key = `${edge.source}→${edge.target}:${edge.type}`;
    if (seen.has(key)) {
      issues.push({
        severity: 'warning',
        message: `Duplicate edge from "${edge.source}" to "${edge.target}" (type: ${edge.type})`,
        rule: 'duplicate-edge',
        ids: [edge.id],
      });
    }
    seen.add(key);
  }

  return issues;
}

/**
 * Check that rootNodeId and goalNodeId exist in the graph.
 */
export function validateRootAndGoalNodes(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!graph.nodes.has(graph.rootNodeId)) {
    issues.push({
      severity: 'error',
      message: `Root node "${graph.rootNodeId}" does not exist in the graph`,
      rule: 'missing-root-node',
      ids: [graph.rootNodeId],
    });
  }

  if (!graph.nodes.has(graph.goalNodeId)) {
    issues.push({
      severity: 'error',
      message: `Goal node "${graph.goalNodeId}" does not exist in the graph`,
      rule: 'missing-goal-node',
      ids: [graph.goalNodeId],
    });
  }

  return issues;
}

/**
 * Check for orphan nodes (nodes not connected to any edge and not root/goal).
 */
export function validateOrphanNodes(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const connectedNodes = new Set<string>();

  // All nodes referenced in edges are connected
  for (const edge of graph.edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }

  // Root and goal are always considered connected
  connectedNodes.add(graph.rootNodeId);
  connectedNodes.add(graph.goalNodeId);

  for (const nodeId of graph.nodes.keys()) {
    if (!connectedNodes.has(nodeId)) {
      issues.push({
        severity: 'warning',
        message: `Node "${nodeId}" ("${graph.nodes.get(nodeId)!.label}") is an orphan — not connected to any edge`,
        rule: 'orphan-node',
        ids: [nodeId],
      });
    }
  }

  return issues;
}

/**
 * Check that the graph is not empty.
 */
export function validateEmptyGraph(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (graph.nodes.size === 0) {
    issues.push({
      severity: 'error',
      message: 'Graph has no nodes',
      rule: 'empty-graph',
    });
  }

  return issues;
}

/**
 * Check that the graph does not exceed maximum size limits.
 */
export function validateGraphSize(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (graph.nodes.size > MAX_NODES) {
    issues.push({
      severity: 'error',
      message: `Graph exceeds maximum node count: ${graph.nodes.size} > ${MAX_NODES}`,
      rule: 'graph-too-large',
    });
  }

  if (graph.edges.length > MAX_EDGES) {
    issues.push({
      severity: 'error',
      message: `Graph exceeds maximum edge count: ${graph.edges.length} > ${MAX_EDGES}`,
      rule: 'graph-too-large',
    });
  }

  return issues;
}

/**
 * Check that progress states are valid.
 * Rules:
 * - 'locked' nodes must have no time spent or resources consumed.
 * - 'completed' nodes must have a completedAt date.
 * - 'in-progress' nodes must have timeSpentMinutes > 0.
 */
export function validateProgressStates(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of graph.nodes.values()) {
    const { status, completedAt, timeSpentMinutes, resourcesConsumed } = node.progress;

    if (status === 'locked') {
      if (timeSpentMinutes > 0) {
        issues.push({
          severity: 'warning',
          message: `Node "${node.id}" is "locked" but has ${timeSpentMinutes} minutes logged`,
          rule: 'invalid-progress-state',
          ids: [node.id],
        });
      }
      if (resourcesConsumed > 0) {
        issues.push({
          severity: 'warning',
          message: `Node "${node.id}" is "locked" but has ${resourcesConsumed} resources consumed`,
          rule: 'invalid-progress-state',
          ids: [node.id],
        });
      }
    }

    if (status === 'completed' && !completedAt) {
      issues.push({
        severity: 'warning',
        message: `Node "${node.id}" is "completed" but has no completion date`,
        rule: 'invalid-progress-state',
        ids: [node.id],
      });
    }

    if (status === 'in-progress' && timeSpentMinutes === 0) {
      issues.push({
        severity: 'warning',
        message: `Node "${node.id}" is "in-progress" but has 0 minutes logged`,
        rule: 'invalid-progress-state',
        ids: [node.id],
      });
    }
  }

  return issues;
}

/**
 * Check that the graph depth from root does not exceed the maximum.
 * Uses BFS to compute depth.
 */
export function validateGraphDepth(graph: GraphData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!graph.nodes.has(graph.rootNodeId)) {
    // Root missing is reported by validateRootAndGoalNodes
    return issues;
  }

  // BFS to compute depth
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: graph.rootNodeId, depth: 0 },
  ];
  visited.add(graph.rootNodeId);

  let maxDepth = 0;

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    // Find all children (nodes that have this node as a prerequisite)
    for (const edge of graph.edges) {
      if (edge.source === id && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push({ id: edge.target, depth: depth + 1 });
      }
    }
  }

  if (maxDepth > MAX_GRAPH_DEPTH) {
    issues.push({
      severity: 'error',
      message: `Graph depth (${maxDepth}) exceeds maximum (${MAX_GRAPH_DEPTH})`,
      rule: 'graph-too-deep',
    });
  }

  return issues;
}

// ============================================================================
// Aggregate Validation
// ============================================================================

/**
 * Run all validation checks on a graph and return the aggregated result.
 *
 * This is the primary entry point for graph validation. It runs every
 * validation rule and collects all issues. The graph is considered
 * valid only if there are zero errors (warnings are allowed).
 *
 * @param graph - The graph to validate
 * @returns ValidationResult containing all issues found
 */
export function validateGraph(graph: GraphData): ValidationResult {
  const allIssues: ValidationIssue[] = [
    ...validateEmptyGraph(graph),
    ...validateDuplicateNodeIds(graph),
    ...validateDuplicateEdgeIds(graph),
    ...validateMissingNodeReferences(graph),
    ...validateSelfLoops(graph),
    ...validateDuplicateEdges(graph),
    ...validateRootAndGoalNodes(graph),
    ...validateOrphanNodes(graph),
    ...validateGraphSize(graph),
    ...validateProgressStates(graph),
    ...validateGraphDepth(graph),
  ];

  const errors = allIssues.filter((i) => i.severity === 'error');

  return {
    valid: errors.length === 0,
    issues: allIssues,
  };
}
