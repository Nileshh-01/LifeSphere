/**
 * Flow-to-Graph Conversion
 *
 * Converts React Flow nodes and edges back into canonical GraphData
 * from the Graph Engine. This is the reverse of graph-to-flow.ts.
 *
 * IMPORTANT: React Flow state is a VIEW of the graph, not the source of truth.
 * This function extracts only the changes (positions, new connections) and
 * applies them back to the canonical GraphData, preserving all unknown fields.
 *
 * @module GraphEditor
 */

import type { Node, Edge } from '@xyflow/react';
import type { GraphData, GraphNode, GraphEdge } from '@/core/graph/types';
import type { SkillFlowNode, DependencyFlowEdge } from '../types';

/**
 * Extract position updates from React Flow nodes and apply them to GraphData.
 *
 * Only updates the `position` field on each GraphNode — all other fields
 * remain unchanged. This ensures unknown/preserved fields are never lost.
 *
 * @param graph - The original GraphData (will NOT be mutated)
 * @param flowNodes - React Flow nodes with current positions
 * @returns A new GraphData with updated positions
 */
export function applyPositionUpdates(
  graph: GraphData,
  flowNodes: Node[],
): GraphData {
  const updatedNodes = new Map<string, GraphNode>();

  for (const [nodeId, node] of graph.nodes) {
    const flowNode = flowNodes.find((n) => n.id === nodeId);

    if (flowNode) {
      // Clone the node and update its position
      updatedNodes.set(nodeId, {
        ...node,
        position: {
          x: flowNode.position.x,
          y: flowNode.position.y,
        },
      });
    } else {
      // Node not in flow — keep original
      updatedNodes.set(nodeId, { ...node });
    }
  }

  return {
    ...graph,
    nodes: updatedNodes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extract edge changes from React Flow and apply them to GraphData.
 *
 * This handles:
 * - Edge deletions (edges in GraphData but not in Flow)
 * - Edge additions (edges in Flow but not in GraphData)
 * - Edge modifications (updated metadata, weight, type)
 *
 * @param graph - The original GraphData (will NOT be mutated)
 * @param flowEdges - React Flow edges with current state
 * @returns A new GraphData with updated edges
 */
export function applyEdgeUpdates(
  graph: GraphData,
  flowEdges: Edge[],
): GraphData {
  const existingEdgeIds = new Set(graph.edges.map((e) => e.id));
  const flowEdgeIds = new Set(flowEdges.map((e) => e.id));

  // Edge deletions
  const remainingEdges = graph.edges.filter((e) => flowEdgeIds.has(e.id));

  // Edge additions (from flow but not in graph — new connections)
  for (const flowEdge of flowEdges) {
    if (!existingEdgeIds.has(flowEdge.id)) {
      const data = flowEdge.data as { graphEdge?: GraphEdge } | undefined;

      if (data?.graphEdge) {
        // Preserve the full edge data from the drag-connect operation
        remainingEdges.push(data.graphEdge);
      } else {
        // Create a minimal edge (should not happen — edge creation
        // should always include graphEdge in data)
        remainingEdges.push({
          id: flowEdge.id,
          source: flowEdge.source,
          target: flowEdge.target,
          type: 'prerequisite',
          weight: 1.0,
          metadata: {
            required: true,
          },
        });
      }
    }
  }

  // Edge modifications (metadata updates from flow)
  for (let i = 0; i < remainingEdges.length; i++) {
    const flowEdge = flowEdges.find((e) => e.id === remainingEdges[i].id);
    if (flowEdge?.data) {
      const data = flowEdge.data as { graphEdge?: GraphEdge } | undefined;
      if (data?.graphEdge) {
        // Preserve any updates made to the edge metadata
        remainingEdges[i] = {
          ...remainingEdges[i],
          weight: data.graphEdge.weight ?? remainingEdges[i].weight,
          type: data.graphEdge.type ?? remainingEdges[i].type,
          metadata: {
            ...remainingEdges[i].metadata,
            ...data.graphEdge.metadata,
          },
        };
      }
    }
  }

  return {
    ...graph,
    edges: remainingEdges,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge React Flow state back into canonical GraphData.
 *
 * This is the main entry point for flow → graph conversion.
 * It updates positions and edges while preserving all node data
 * (including unknown/preserved fields).
 *
 * @param graph - The canonical GraphData
 * @param flowNodes - Current React Flow nodes
 * @param flowEdges - Current React Flow edges
 * @returns Updated GraphData with positions and edges from Flow
 */
export function flowToGraph(
  graph: GraphData,
  flowNodes: Node[],
  flowEdges: Edge[],
): GraphData {
  const withPositions = applyPositionUpdates(graph, flowNodes);
  return applyEdgeUpdates(withPositions, flowEdges);
}
