/**
 * Graph Engine
 *
 * Pure domain-logic module for knowledge graph operations.
 * Zero knowledge of worlds, planets, or rendering.
 *
 * All functions are stateless and deterministic — same input always
 * produces identical output.
 *
 * @module GraphEngine
 */

import type {
  GraphData,
  GraphNode,
  GraphEdge,
  ValidationResult,
  HierarchyLevel,
  HierarchyStrategy,
} from './types';
import { validateGraph } from './validation';
import { HIERARCHY_THRESHOLDS } from './constants';

// ============================================================================
// Default Hierarchy Strategy
// ============================================================================

/**
 * Default hierarchy strategy matching WORLD_RULES.md §1 exactly.
 *
 * Classification rules:
 * - milestone + depth ≤ 1 + importance ≥ 8 → continent
 * - milestone → region
 * - skill + children ≥ 3 + importance ≥ 5 → city
 * - skill + children > 0 → district
 * - sub-skill → building
 * - project → landmark
 * - resource → decoration
 */
export function defaultHierarchyStrategy(
  node: GraphNode,
  graph: GraphData,
): HierarchyLevel {
  const children = getChildNodeIds(node.id, graph);
  const depth = getNodeDepth(node.id, graph);

  // Milestones at root level with high importance are continents
  if (
    node.type === 'milestone' &&
    depth <= HIERARCHY_THRESHOLDS.CONTINENT_MAX_DEPTH &&
    node.importance >= HIERARCHY_THRESHOLDS.CONTINENT_MIN_IMPORTANCE
  ) {
    return 'continent';
  }

  // Deep milestones are regions
  if (node.type === 'milestone') return 'region';

  // High-importance skills with many sub-skills are cities
  if (
    node.type === 'skill' &&
    children.length >= HIERARCHY_THRESHOLDS.CITY_MIN_CHILDREN &&
    node.importance >= HIERARCHY_THRESHOLDS.CITY_MIN_IMPORTANCE
  ) {
    return 'city';
  }

  // Skills with children are districts
  if (node.type === 'skill' && children.length > 0) return 'district';

  // Sub-skills become buildings
  if (node.type === 'sub-skill') return 'building';

  // Projects are landmarks
  if (node.type === 'project') return 'landmark';

  // Resources are decoration
  return 'decoration';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the IDs of all direct children of a node.
 * Children are nodes that have this node as a source in an edge.
 */
function getChildNodeIds(nodeId: string, graph: GraphData): string[] {
  const children: string[] = [];
  for (const edge of graph.edges) {
    if (edge.source === nodeId) {
      children.push(edge.target);
    }
  }
  return children;
}

/**
 * Get the IDs of all direct parents (prerequisites) of a node.
 * Parents are nodes that are sources of edges targeting this node.
 */
function getParentNodeIds(nodeId: string, graph: GraphData): string[] {
  const parents: string[] = [];
  for (const edge of graph.edges) {
    if (edge.target === nodeId) {
      parents.push(edge.source);
    }
  }
  return parents;
}

/**
 * Compute the depth of a node from the root node using BFS.
 * Returns -1 if the node is unreachable from the root.
 */
function getNodeDepth(nodeId: string, graph: GraphData): number {
  if (!graph.nodes.has(graph.rootNodeId)) return -1;
  if (nodeId === graph.rootNodeId) return 0;

  // BFS from root
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: graph.rootNodeId, depth: 0 },
  ];
  visited.add(graph.rootNodeId);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    for (const edge of graph.edges) {
      if (edge.source === id && !visited.has(edge.target)) {
        if (edge.target === nodeId) return depth + 1;
        visited.add(edge.target);
        queue.push({ id: edge.target, depth: depth + 1 });
      }
    }
  }

  return -1; // Unreachable
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate graph integrity.
 *
 * Delegates to the validation module. Returns a ValidationResult
 * with all issues found. The graph is valid only if there are zero errors.
 *
 * Time complexity: O(V + E) — runs 11 validation passes each O(V) or O(E)
 * Space complexity: O(V)
 *
 * @param graph - The graph to validate
 * @returns ValidationResult with all issues
 */
export function validateGraphData(graph: GraphData): ValidationResult {
  return validateGraph(graph);
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect all cycles in the graph using DFS with recursion stack tracking.
 *
 * Algorithm:
 * 1. Perform DFS from every unvisited node.
 * 2. Track nodes in the current recursion stack (path from root).
 * 3. When a back-edge is found (neighbor is in the current stack),
 *    extract the cycle from the stack.
 * 4. Return all unique cycles found.
 *
 * Time complexity: O(V + E) where V = nodes, E = edges
 * Space complexity: O(V)
 *
 * @param graph - The graph to analyze
 * @returns Array of cycles, each cycle is an array of node IDs in order
 */
export function detectCycles(graph: GraphData): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    inStack.add(nodeId);
    stack.push(nodeId);

    // Find all children (outgoing edges)
    for (const edge of graph.edges) {
      if (edge.source !== nodeId) continue;

      if (!visited.has(edge.target)) {
        dfs(edge.target);
      } else if (inStack.has(edge.target)) {
        // Back-edge found — extract cycle from stack
        const cycleStart = stack.indexOf(edge.target);
        const cycle = stack.slice(cycleStart);
        cycle.push(edge.target); // Close the cycle
        cycles.push(cycle);
      }
    }

    stack.pop();
    inStack.delete(nodeId);
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Topologically sort the graph using Kahn's algorithm.
 *
 * Algorithm:
 * 1. Compute in-degree (number of incoming edges) for each node.
 * 2. Enqueue all nodes with in-degree 0.
 * 3. While queue is not empty:
 *    a. Dequeue a node, add it to the result.
 *    b. Decrement in-degree of all its children.
 *    c. If any child's in-degree reaches 0, enqueue it.
 * 4. If not all nodes are processed, a cycle exists.
 *
 * Time complexity: O(V + E)
 * Space complexity: O(V)
 *
 * @param graph - The graph to sort
 * @returns Array of nodes in topological order
 * @throws Error if the graph contains a cycle
 */
export function topologicalSort(graph: GraphData): GraphNode[] {
  // Compute in-degree for each node
  const inDegree = new Map<string, number>();
  for (const nodeId of graph.nodes.keys()) {
    inDegree.set(nodeId, 0);
  }
  for (const edge of graph.edges) {
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  // Enqueue nodes with in-degree 0
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Process queue
  const sorted: GraphNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = graph.nodes.get(nodeId);
    if (node) sorted.push(node);

    // Decrement in-degree of children
    for (const edge of graph.edges) {
      if (edge.source === nodeId) {
        const newDegree = (inDegree.get(edge.target) ?? 1) - 1;
        inDegree.set(edge.target, newDegree);
        if (newDegree === 0) {
          queue.push(edge.target);
        }
      }
    }
  }

  // Check if all nodes were processed
  if (sorted.length !== graph.nodes.size) {
    throw new Error(
      'Graph contains a cycle — topological sort is not possible. ' +
      `Processed ${sorted.length} of ${graph.nodes.size} nodes. ` +
      'Use detectCycles() to find the cycles.',
    );
  }

  return sorted;
}

// ============================================================================
// Learning Path
// ============================================================================

/**
 * Get the complete linear learning path for the graph.
 *
 * This is simply a topological sort of the entire graph, which gives
 * a valid linear order where every prerequisite comes before its dependent.
 *
 * Time complexity: O(V + E) — delegates to topologicalSort (Kahn's algorithm)
 * Space complexity: O(V)
 *
 * @param graph - The graph to analyze
 * @returns Array of nodes in learning order
 * @throws Error if the graph contains a cycle
 */
export function getLearningPath(graph: GraphData): GraphNode[] {
  return topologicalSort(graph);
}

// ============================================================================
// Available Skills
// ============================================================================

/**
 * Get all currently available (unlocked) skills.
 *
 * A node is available if:
 * - It is the root node, OR
 * - All its required prerequisites (edges with required=true) are completed
 *
 * Time complexity: O(V + E) — iterates all nodes, filters edges for each
 * Space complexity: O(V)
 *
 * @param graph - The graph to analyze
 * @returns Array of available nodes
 */
export function getAvailableSkills(graph: GraphData): GraphNode[] {
  const available: GraphNode[] = [];

  for (const node of graph.nodes.values()) {
    // Root node is always available
    if (node.id === graph.rootNodeId) {
      available.push(node);
      continue;
    }

    // Check all incoming required edges
    const incomingEdges = graph.edges.filter((e) => e.target === node.id);
    const requiredEdges = incomingEdges.filter((e) => e.metadata.required);

    // If no required prerequisites, node is available
    if (requiredEdges.length === 0) {
      available.push(node);
      continue;
    }

    // Check if all required prerequisites are completed
    const allCompleted = requiredEdges.every((edge) => {
      const sourceNode = graph.nodes.get(edge.source);
      return sourceNode?.progress.status === 'completed';
    });

    if (allCompleted) {
      available.push(node);
    }
  }

  return available;
}

// ============================================================================
// Path Finding
// ============================================================================

/**
 * Find the shortest path between two nodes using BFS.
 *
 * Algorithm:
 * 1. Perform BFS from the source node.
 * 2. Track the parent of each visited node to reconstruct the path.
 * 3. When the target is found, reconstruct the path by following parents.
 * 4. If the target is unreachable, return an empty array.
 *
 * Time complexity: O(V + E)
 * Space complexity: O(V)
 *
 * @param graph - The graph to search
 * @param from - Source node ID
 * @param to - Target node ID
 * @returns Array of nodes forming the shortest path (inclusive)
 */
export function findPath(
  graph: GraphData,
  from: string,
  to: string,
): GraphNode[] {
  if (from === to) {
    const node = graph.nodes.get(from);
    return node ? [node] : [];
  }

  // BFS
  const visited = new Set<string>([from]);
  const queue: string[] = [from];
  const parent = new Map<string, string | null>();
  parent.set(from, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const edge of graph.edges) {
      if (edge.source !== current) continue;

      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        parent.set(edge.target, current);
        queue.push(edge.target);

        if (edge.target === to) {
          // Reconstruct path
          const path: GraphNode[] = [];
          let nodeId: string | null = to;
          while (nodeId !== null) {
            const node = graph.nodes.get(nodeId);
            if (node) path.unshift(node);
            nodeId = parent.get(nodeId) ?? null;
          }
          return path;
        }
      }
    }
  }

  return []; // No path found
}

// ============================================================================
// Completion Percentage
// ============================================================================

/**
 * Compute the overall completion percentage of the graph.
 *
 * Formula: (completed nodes / total nodes) × 100
 *
 * A node is considered completed if its progress.status is 'completed'.
 *
 * Time complexity: O(V)
 * Space complexity: O(1)
 *
 * @param graph - The graph to analyze
 * @returns Completion percentage (0–100)
 */
export function getCompletionPercent(graph: GraphData): number {
  if (graph.nodes.size === 0) return 0;

  let completedCount = 0;
  for (const node of graph.nodes.values()) {
    if (node.progress.status === 'completed') {
      completedCount++;
    }
  }

  return (completedCount / graph.nodes.size) * 100;
}

// ============================================================================
// Filter by Category
// ============================================================================

/**
 * Filter the graph to include only nodes of a specific category.
 *
 * Returns a new GraphData containing:
 * - Only nodes matching the given category
 * - Only edges where both source and target are in the filtered set
 * - Updated rootNodeId and goalNodeId (nullified if they don't exist in filter)
 *
 * Time complexity: O(V + E)
 * Space complexity: O(V + E) — creates a new GraphData
 *
 * @param graph - The source graph
 * @param category - The category to filter by
 * @returns A new GraphData containing only matching nodes and edges
 */
export function filterByCategory(
  graph: GraphData,
  category: string,
): GraphData {
  const filteredNodes = new Map<string, GraphNode>();

  for (const node of graph.nodes.values()) {
    if (node.category === category) {
      filteredNodes.set(node.id, { ...node });
    }
  }

  const filteredNodeIds = new Set(filteredNodes.keys());

  const filteredEdges = graph.edges.filter(
    (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
  );

  return {
    id: `${graph.id}-${category}`,
    userId: graph.userId,
    title: `${graph.title} (${category})`,
    createdAt: graph.createdAt,
    updatedAt: graph.updatedAt,
    nodes: filteredNodes,
    edges: filteredEdges,
    rootNodeId: filteredNodeIds.has(graph.rootNodeId)
      ? graph.rootNodeId
      : filteredNodes.keys().next().value ?? '',
    goalNodeId: filteredNodeIds.has(graph.goalNodeId)
      ? graph.goalNodeId
      : filteredNodes.keys().next().value ?? '',
  };
}

// ============================================================================
// Hierarchy Inference
// ============================================================================

/**
 * Infer the hierarchy level of a node based on graph topology.
 *
 * Uses a configurable strategy (default matches WORLD_RULES.md §1).
 * The strategy is stateless and deterministic — it relies only on
 * graph topology (edges, types, importance), never on external state.
 *
 * Time complexity: O(V + E) — strategy calls getChildNodeIds and getNodeDepth
 * Space complexity: O(V) — BFS queue for depth calculation
 *
 * @param node - The node to classify
 * @param graph - The full graph for context
 * @param strategy - The hierarchy strategy to use (default: WORLD_RULES)
 * @returns The inferred hierarchy level
 */
export function inferHierarchyLevel(
  node: GraphNode,
  graph: GraphData,
  strategy: HierarchyStrategy = defaultHierarchyStrategy,
): HierarchyLevel {
  return strategy(node, graph);
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a GraphData object to a JSON string.
 *
 * Handles the Map serialization issue by converting `nodes` Map
 * to a plain object before JSON serialization.
 *
 * Time complexity: O(V) — iterates all nodes to convert Map → object
 * Space complexity: O(V + E) — creates a full serializable copy
 *
 * @param graph - The graph to serialize
 * @returns JSON string representation
 */
export function serializeGraph(graph: GraphData): string {
  const nodesObject: Record<string, GraphNode> = {};
  for (const [id, node] of graph.nodes) {
    nodesObject[id] = node;
  }

  const serializable = {
    ...graph,
    nodes: nodesObject,
  };

  return JSON.stringify(serializable);
}

/**
 * Deserialize a JSON string back to a GraphData object.
 *
 * Handles the Map deserialization issue by converting the plain
 * `nodes` object back to a Map.
 *
 * Time complexity: O(V) — iterates all serialized nodes
 * Space complexity: O(V + E) — creates a full GraphData
 *
 * @param json - JSON string representation of a graph
 * @returns The deserialized GraphData object
 */
export function deserializeGraph(json: string): GraphData {
  const parsed = JSON.parse(json);

  // Convert nodes object back to Map
  const nodesMap = new Map<string, GraphNode>();
  for (const [id, node] of Object.entries(parsed.nodes)) {
    nodesMap.set(id, node as GraphNode);
  }

  return {
    ...parsed,
    nodes: nodesMap,
  };
}
