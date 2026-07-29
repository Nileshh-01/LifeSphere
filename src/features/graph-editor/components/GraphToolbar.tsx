/**
 * GraphToolbar — Editor Action Bar
 *
 * Provides actions for editing, validating, loading examples,
 * and importing/exporting graphs.
 *
 * @module GraphEditor
 */

'use client';

import { useCallback, useRef } from 'react';
import { useGraphEditorStore } from '../stores/graph-editor-store';
import { validateGraphData, serializeGraph, deserializeGraph } from '@/core/graph/graph-engine';
import { WEB_DEV_GRAPH } from '@/core/graph/examples/web-development';
import { ML_GRAPH } from '@/core/graph/examples/machine-learning';
import { GUITAR_GRAPH } from '@/core/graph/examples/guitar';

// ============================================================================
// Toolbar Button
// ============================================================================

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  title?: string;
}

function ToolbarButton({ label, onClick, variant = 'default', disabled, title }: ToolbarButtonProps) {
  const variantStyles: Record<string, string> = {
    default: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700',
    danger: 'bg-red-900/50 hover:bg-red-800/50 text-red-300 border-red-800/50',
    success: 'bg-green-900/50 hover:bg-green-800/50 text-green-300 border-green-800/50',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        px-3 py-1.5 rounded text-xs font-medium border
        transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantStyles[variant]}
      `}
    >
      {label}
    </button>
  );
}

// ============================================================================
// GraphToolbar Component
// ============================================================================

export function GraphToolbar() {
  const graphData = useGraphEditorStore((s) => s.graphData);
  const setGraphData = useGraphEditorStore((s) => s.setGraphData);
  const setValidationResult = useGraphEditorStore((s) => s.setValidationResult);
  const clearSelection = useGraphEditorStore((s) => s.clearSelection);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // Add Node
  // ==========================================================================

  const handleAddNode = useCallback(() => {
    if (!graphData) return;

    const nodeCount = graphData.nodes.size;
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      label: `New Skill ${nodeCount + 1}`,
      type: 'skill' as const,
      category: 'custom' as const,
      description: '',
      difficulty: 1 as const,
      estimatedHours: 10,
      tags: [],
      importance: 5 as const,
      estimatedXP: 100,
      priority: 3 as const,
      unlockCondition: '',
      metadata: {
        externalUrls: [],
        prerequisites: [],
      },
      progress: {
        status: 'locked' as const,
        timeSpentMinutes: 0,
        resourcesConsumed: 0,
      },
      position: {
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200,
      },
    };

    const updatedNodes = new Map(graphData.nodes);
    updatedNodes.set(newNodeId, newNode);

    setGraphData({
      ...graphData,
      nodes: updatedNodes,
      updatedAt: new Date().toISOString(),
    });
  }, [graphData, setGraphData]);

  // ==========================================================================
  // Delete Selected
  // ==========================================================================

  const handleDeleteSelected = useCallback(() => {
    const state = useGraphEditorStore.getState();
    if (!state.graphData) return;

    const selectedId = state.selectedNodeId ?? state.selectedEdgeId;
    if (!selectedId) return;

    if (state.selectedNodeId) {
      // Delete node and all connected edges
      const updatedNodes = new Map(state.graphData.nodes);
      updatedNodes.delete(selectedId);

      const updatedEdges = state.graphData.edges.filter(
        (e) => e.source !== selectedId && e.target !== selectedId,
      );

      setGraphData({
        ...state.graphData,
        nodes: updatedNodes,
        edges: updatedEdges,
        updatedAt: new Date().toISOString(),
      });
    } else if (state.selectedEdgeId) {
      // Delete edge only
      const updatedEdges = state.graphData.edges.filter(
        (e) => e.id !== selectedId,
      );

      setGraphData({
        ...state.graphData,
        edges: updatedEdges,
        updatedAt: new Date().toISOString(),
      });
    }

    clearSelection();
  }, [setGraphData, clearSelection]);

  // ==========================================================================
  // Validate
  // ==========================================================================

  const handleValidate = useCallback(() => {
    if (!graphData) return;

    const result = validateGraphData(graphData);
    setValidationResult(result);

    // Show alert with summary
    const errorCount = result.issues.filter((i) => i.severity === 'error').length;
    const warningCount = result.issues.filter((i) => i.severity === 'warning').length;

    if (result.valid) {
      alert('✅ Graph is valid!');
    } else {
      alert(
        `⚠️ Validation complete\n` +
        `Errors: ${errorCount}\n` +
        `Warnings: ${warningCount}\n\n` +
        result.issues.map((i) => `[${i.severity}] ${i.message}`).join('\n'),
      );
    }
  }, [graphData, setValidationResult]);

  // ==========================================================================
  // Load Example
  // ==========================================================================

  const handleLoadExample = useCallback((example: 'web-dev' | 'ml' | 'guitar') => {
    let graph;
    switch (example) {
      case 'web-dev':
        graph = WEB_DEV_GRAPH;
        break;
      case 'ml':
        graph = ML_GRAPH;
        break;
      case 'guitar':
        graph = GUITAR_GRAPH;
        break;
    }

    // Deep clone to avoid mutation
    const clonedNodes = new Map<string, import('@/core/graph/types').GraphNode>();
    for (const [id, node] of graph.nodes) {
      clonedNodes.set(id, { ...node, position: undefined });
    }

    setGraphData({
      ...graph,
      nodes: clonedNodes,
      updatedAt: new Date().toISOString(),
    });
    clearSelection();
  }, [setGraphData, clearSelection]);

  // ==========================================================================
  // Export
  // ==========================================================================

  const handleExport = useCallback(() => {
    if (!graphData) return;

    const json = serializeGraph(graphData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${graphData.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graphData]);

  // ==========================================================================
  // Import
  // ==========================================================================

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const graph = deserializeGraph(json);
        setGraphData(graph);
        clearSelection();
        alert('✅ Graph imported successfully!');
      } catch (err) {
        alert(`❌ Failed to import graph: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [setGraphData, clearSelection]);

  // ==========================================================================
  // Clear
  // ==========================================================================

  const handleClear = useCallback(() => {
    if (!graphData) return;
    if (!window.confirm('Clear the entire graph? This cannot be undone.')) return;

    setGraphData({
      ...graphData,
      nodes: new Map(),
      edges: [],
      rootNodeId: '',
      goalNodeId: '',
      updatedAt: new Date().toISOString(),
    });
    clearSelection();
  }, [graphData, setGraphData, clearSelection]);

  // ==========================================================================
  // Render
  // ==========================================================================

  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphEditorStore((s) => s.selectedEdgeId);
  const hasSelection = !!(selectedNodeId ?? selectedEdgeId);

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-800">
      {/* Edit Actions */}
      <ToolbarButton
        label="+ Add Node"
        onClick={handleAddNode}
        disabled={!graphData}
        title="Add a new skill node"
      />
      <ToolbarButton
        label="🗑 Delete Selected"
        onClick={handleDeleteSelected}
        variant="danger"
        disabled={!hasSelection}
        title="Delete the selected node or edge"
      />

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Validation */}
      <ToolbarButton
        label="✓ Validate"
        onClick={handleValidate}
        variant="success"
        disabled={!graphData}
        title="Validate the graph using the Graph Engine"
      />

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Example Graphs */}
      <span className="text-xs text-gray-500 mr-1">Load:</span>
      <ToolbarButton
        label="Web Dev"
        onClick={() => handleLoadExample('web-dev')}
        title="Load the Web Development example graph"
      />
      <ToolbarButton
        label="ML"
        onClick={() => handleLoadExample('ml')}
        title="Load the Machine Learning example graph"
      />
      <ToolbarButton
        label="Guitar"
        onClick={() => handleLoadExample('guitar')}
        title="Load the Guitar example graph"
      />

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Import / Export */}
      <ToolbarButton
        label="📥 Import"
        onClick={handleImportClick}
        disabled={!graphData}
        title="Import a graph from a JSON file"
      />
      <ToolbarButton
        label="📤 Export"
        onClick={handleExport}
        disabled={!graphData}
        title="Export the graph as a JSON file"
      />

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Clear */}
      <ToolbarButton
        label="Clear"
        onClick={handleClear}
        variant="danger"
        disabled={!graphData}
        title="Clear the entire graph"
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
