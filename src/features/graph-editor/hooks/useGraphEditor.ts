/**
 * useGraphEditor — Editor Hook
 *
 * Provides a clean API for interacting with the Graph Editor.
 * Wraps store access and Graph Engine operations.
 *
 * @module GraphEditor
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useGraphEditorStore } from '../stores/graph-editor-store';
import {
  validateGraphData,
  getLearningPath,
  getAvailableSkills,
  getCompletionPercent,
  detectCycles,
  serializeGraph,
  deserializeGraph,
} from '@/core/graph/graph-engine';
import type { GraphNode, GraphEdge, GraphData } from '@/core/graph/types';

// ============================================================================
// Hook
// ============================================================================

export function useGraphEditor() {
  const store = useGraphEditorStore();

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const nodeCount = useMemo(
    () => store.graphData?.nodes.size ?? 0,
    [store.graphData],
  );

  const edgeCount = useMemo(
    () => store.graphData?.edges.length ?? 0,
    [store.graphData],
  );

  const completionPercent = useMemo(() => {
    if (!store.graphData) return 0;
    return getCompletionPercent(store.graphData);
  }, [store.graphData]);

  const learningPath = useMemo(() => {
    if (!store.graphData) return [];
    try {
      return getLearningPath(store.graphData);
    } catch {
      return [];
    }
  }, [store.graphData]);

  const availableSkills = useMemo(() => {
    if (!store.graphData) return [];
    return getAvailableSkills(store.graphData);
  }, [store.graphData]);

  const cycles = useMemo(() => {
    if (!store.graphData) return [];
    return detectCycles(store.graphData);
  }, [store.graphData]);

  const selectedNode = useMemo(() => {
    if (!store.graphData || !store.selectedNodeId) return null;
    return store.graphData.nodes.get(store.selectedNodeId) ?? null;
  }, [store.graphData, store.selectedNodeId]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Validate the current graph and update the store with results.
   */
  const validate = useCallback(() => {
    if (!store.graphData) return;
    const result = validateGraphData(store.graphData);
    store.setValidationResult(result);
    return result;
  }, [store.graphData, store.setValidationResult]);

  /**
   * Export the current graph as a JSON string.
   */
  const exportGraph = useCallback((): string | null => {
    if (!store.graphData) return null;
    return serializeGraph(store.graphData);
  }, [store.graphData]);

  /**
   * Import a graph from a JSON string.
   */
  const importGraph = useCallback(
    (json: string): boolean => {
      try {
        const graph = deserializeGraph(json);
        store.setGraphData(graph);
        return true;
      } catch {
        return false;
      }
    },
    [store.setGraphData],
  );

  /**
   * Add a new node to the graph.
   */
  const addNode = useCallback(
    (partial: Partial<GraphNode> & { label: string }) => {
      if (!store.graphData) return;

      const newNodeId = `node-${Date.now()}`;
      const newNode: GraphNode = {
        id: newNodeId,
        label: partial.label,
        type: partial.type ?? 'skill',
        category: partial.category ?? 'custom',
        description: partial.description ?? '',
        difficulty: partial.difficulty ?? 1,
        estimatedHours: partial.estimatedHours ?? 10,
        tags: partial.tags ?? [],
        importance: partial.importance ?? 5,
        estimatedXP: partial.estimatedXP ?? 100,
        priority: partial.priority ?? 3,
        unlockCondition: partial.unlockCondition ?? '',
        metadata: {
          externalUrls: partial.metadata?.externalUrls ?? [],
          prerequisites: partial.metadata?.prerequisites ?? [],
          icon: partial.metadata?.icon,
        },
        progress: {
          status: partial.progress?.status ?? 'locked',
          timeSpentMinutes: partial.progress?.timeSpentMinutes ?? 0,
          resourcesConsumed: partial.progress?.resourcesConsumed ?? 0,
        },
        position: partial.position ?? {
          x: 200 + Math.random() * 200,
          y: 200 + Math.random() * 200,
        },
      };

      const updatedNodes = new Map(store.graphData.nodes);
      updatedNodes.set(newNodeId, newNode);

      store.setGraphData({
        ...store.graphData,
        nodes: updatedNodes,
        updatedAt: new Date().toISOString(),
      });

      return newNode;
    },
    [store.graphData, store.setGraphData],
  );

  /**
   * Update a node's properties.
   */
  const updateNode = useCallback(
    (nodeId: string, updates: Partial<GraphNode>) => {
      if (!store.graphData) return;

      const node = store.graphData.nodes.get(nodeId);
      if (!node) return;

      const updatedNode: GraphNode = {
        ...node,
        ...updates,
        // Ensure nested objects are merged, not replaced
        metadata: updates.metadata
          ? { ...node.metadata, ...updates.metadata }
          : node.metadata,
        progress: updates.progress
          ? { ...node.progress, ...updates.progress }
          : node.progress,
      };

      const updatedNodes = new Map(store.graphData.nodes);
      updatedNodes.set(nodeId, updatedNode);

      store.setGraphData({
        ...store.graphData,
        nodes: updatedNodes,
        updatedAt: new Date().toISOString(),
      });
    },
    [store.graphData, store.setGraphData],
  );

  /**
   * Remove a node and all its connected edges.
   */
  const removeNode = useCallback(
    (nodeId: string) => {
      if (!store.graphData) return;

      const updatedNodes = new Map(store.graphData.nodes);
      updatedNodes.delete(nodeId);

      const updatedEdges = store.graphData.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      );

      store.setGraphData({
        ...store.graphData,
        nodes: updatedNodes,
        edges: updatedEdges,
        updatedAt: new Date().toISOString(),
      });
    },
    [store.graphData, store.setGraphData],
  );

  /**
   * Add an edge between two nodes.
   */
  const addEdge = useCallback(
    (source: string, target: string, type?: GraphEdge['type'], weight?: number) => {
      if (!store.graphData) return;

      const newEdge: GraphEdge = {
        id: `e-${source}-${target}-${Date.now()}`,
        source,
        target,
        type: type ?? 'prerequisite',
        weight: weight ?? 1.0,
        metadata: {
          required: (type ?? 'prerequisite') === 'prerequisite',
        },
      };

      store.setGraphData({
        ...store.graphData,
        edges: [...store.graphData.edges, newEdge],
        updatedAt: new Date().toISOString(),
      });

      return newEdge;
    },
    [store.graphData, store.setGraphData],
  );

  /**
   * Remove an edge.
   */
  const removeEdge = useCallback(
    (edgeId: string) => {
      if (!store.graphData) return;

      store.setGraphData({
        ...store.graphData,
        edges: store.graphData.edges.filter((e) => e.id !== edgeId),
        updatedAt: new Date().toISOString(),
      });
    },
    [store.graphData, store.setGraphData],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    graphData: store.graphData,
    selectedNodeId: store.selectedNodeId,
    selectedEdgeId: store.selectedEdgeId,
    viewport: store.viewport,
    editorMode: store.editorMode,
    validationResult: store.validationResult,

    // Derived
    nodeCount,
    edgeCount,
    completionPercent,
    learningPath,
    availableSkills,
    cycles,
    selectedNode,

    // Store Actions
    setGraphData: store.setGraphData,
    setSelectedNodeId: store.setSelectedNodeId,
    setSelectedEdgeId: store.setSelectedEdgeId,
    setViewport: store.setViewport,
    setEditorMode: store.setEditorMode,
    clearSelection: store.clearSelection,

    // Editor Actions
    validate,
    exportGraph,
    importGraph,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
  };
}
