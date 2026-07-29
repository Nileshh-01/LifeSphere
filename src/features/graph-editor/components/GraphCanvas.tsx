/**
 * GraphCanvas — Main React Flow Canvas
 *
 * Wraps the React Flow component and connects it to the Graph Editor store.
 * Supports both edit and read-only modes.
 *
 * The canonical GraphData is the single source of truth. React Flow nodes/edges
 * are derived from it via graph-to-flow conversion, and changes are synced back
 * via flow-to-graph conversion.
 *
 * @module GraphEditor
 */

'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  SelectionMode,
  type Connection,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SkillNode } from './SkillNode';
import { DependencyEdge } from './DependencyEdge';
import { graphToFlow } from '../utils/graph-to-flow';
import { flowToGraph } from '../utils/flow-to-graph';
import { useGraphEditorStore } from '../stores/graph-editor-store';
import type { EditorMode, SkillFlowNode, DependencyFlowEdge } from '../types';

// ============================================================================
// Node & Edge Types
// ============================================================================

const nodeTypes = {
  skillNode: SkillNode,
};

const edgeTypes = {
  dependencyEdge: DependencyEdge,
};

// ============================================================================
// Props
// ============================================================================

interface GraphCanvasProps {
  /** Editor mode — 'edit' or 'read-only' */
  mode?: EditorMode;
}

// ============================================================================
// GraphCanvas Component
// ============================================================================

export function GraphCanvas({ mode: propMode }: GraphCanvasProps) {
  const graphData = useGraphEditorStore((s) => s.graphData);
  const storeMode = useGraphEditorStore((s) => s.editorMode);
  const setGraphData = useGraphEditorStore((s) => s.setGraphData);
  const setSelectedNodeId = useGraphEditorStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId = useGraphEditorStore((s) => s.setSelectedEdgeId);
  const setViewport = useGraphEditorStore((s) => s.setViewport);

  const editorMode = propMode ?? storeMode;
  const isEditable = editorMode === 'edit';
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Convert GraphData → React Flow nodes/edges
  const initialFlow = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };
    return graphToFlow(graphData);
  }, [graphData]);

  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DependencyFlowEdge>(initialFlow.edges);

  // Sync React Flow state when GraphData changes
  useEffect(() => {
    if (!graphData) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const flow = graphToFlow(graphData);
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [graphData, setNodes, setEdges]);

  // ==========================================================================
  // Node Selection Handler
  // ==========================================================================

  const handleNodesChange = useCallback(
    (changes: any[]) => {
      if (!isEditable) {
        const filteredChanges = changes.filter(
          (c: any) => c.type === 'select' || c.type === 'position',
        );
        (onNodesChange as (changes: any[]) => void)(filteredChanges);
        return;
      }

      (onNodesChange as (changes: any[]) => void)(changes);

      for (const change of changes) {
        if (change.type === 'select') {
          if (change.selected) {
            setSelectedNodeId(change.id);
          } else {
            setSelectedNodeId(null);
          }
        }
      }
    },
    [isEditable, onNodesChange, setSelectedNodeId],
  );

  // ==========================================================================
  // Edge Selection Handler
  // ==========================================================================

  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      if (!isEditable) {
        const filteredChanges = changes.filter((c: any) => c.type === 'select');
        (onEdgesChange as (changes: any[]) => void)(filteredChanges);
        return;
      }

      (onEdgesChange as (changes: any[]) => void)(changes);

      for (const change of changes) {
        if (change.type === 'select') {
          if (change.selected) {
            setSelectedEdgeId(change.id);
          } else {
            setSelectedEdgeId(null);
          }
        }
      }
    },
    [isEditable, onEdgesChange, setSelectedEdgeId],
  );

  // ==========================================================================
  // Connect Handler (Add Edge)
  // ==========================================================================

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!isEditable || !graphData) return;

      const newEdgeId = `e-${connection.source}-${connection.target}-${Date.now()}`;
      const newEdge = {
        id: newEdgeId,
        source: connection.source,
        target: connection.target,
        type: 'prerequisite' as const,
        weight: 1.0,
        metadata: {
          required: true,
        },
      };

      const updatedEdges = [...graphData.edges, newEdge];
      setGraphData({
        ...graphData,
        edges: updatedEdges,
        updatedAt: new Date().toISOString(),
      });
    },
    [isEditable, graphData, setGraphData],
  );

  // ==========================================================================
  // Node Drag Handler (Sync Positions)
  // ==========================================================================

  const handleNodeDragStop = useCallback(() => {
    if (!isEditable || !graphData) return;

    // Sync positions back to GraphData
    const updatedGraph = flowToGraph(graphData, nodes, edges);
    setGraphData(updatedGraph);
  }, [isEditable, graphData, nodes, edges, setGraphData]);

  // ==========================================================================
  // Viewport Change Handler
  // ==========================================================================

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport({
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      });
    },
    [setViewport],
  );

  // ==========================================================================
  // Click on Canvas (Deselect)
  // ==========================================================================

  const handlePaneClick = useCallback(() => {
    useGraphEditorStore.getState().clearSelection();
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (!graphData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">No graph loaded</p>
          <p className="text-gray-600 text-xs">
            Load an example graph or import a JSON file to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={reactFlowWrapper} className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        selectionMode={SelectionMode.Partial}
        nodesDraggable={isEditable}
        nodesConnectable={isEditable}
        elementsSelectable={true}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'dependencyEdge',
          animated: false,
        }}
        deleteKeyCode={isEditable ? ['Backspace', 'Delete'] : []}
        multiSelectionKeyCode="Shift"
      >
        <Background color="#1f2937" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-gray-900 !border-gray-800 !rounded-lg"
        />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor="#1f2937"
          nodeBorderRadius={4}
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-gray-900 !border-gray-800 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
