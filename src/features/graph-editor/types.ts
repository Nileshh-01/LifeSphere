/**
 * Graph Editor Types
 *
 * Editor-specific types that bridge the domain-agnostic Graph Engine
 * with the React Flow visualization layer.
 *
 * These types do NOT duplicate GraphNode/GraphEdge from core/graph/types.
 * They only add editor-specific concerns (selection, viewport, etc.).
 *
 * @module GraphEditor
 */

import type { Node, Edge, Viewport } from '@xyflow/react';
import type { GraphNode, GraphEdge, ValidationResult } from '@/core/graph/types';

// ============================================================================
// React Flow Node Data
// ============================================================================

/**
 * Data payload for a custom React Flow node representing a GraphNode.
 * The `graphNode` field holds the canonical domain object.
 */
export interface SkillNodeData extends Record<string, unknown> {
  /** The canonical GraphNode from the Graph Engine */
  graphNode: GraphNode;
  /** Whether this node is selected */
  selected: boolean;
  /** Validation issues affecting this node (if any) */
  validationIssues: string[];
  /** Hierarchy level inferred by the Graph Engine */
  hierarchyLevel: import('@/core/graph/types').HierarchyLevel;
}

/**
 * A React Flow node wrapping a GraphNode.
 */
export type SkillFlowNode = Node<SkillNodeData, 'skillNode'>;

// ============================================================================
// React Flow Edge Data
// ============================================================================

/**
 * Data payload for a custom React Flow edge representing a GraphEdge.
 * The `graphEdge` field holds the canonical domain object.
 */
export interface DependencyEdgeData extends Record<string, unknown> {
  /** The canonical GraphEdge from the Graph Engine */
  graphEdge: GraphEdge;
  /** Whether this edge is selected */
  selected: boolean;
}

/**
 * A React Flow edge wrapping a GraphEdge.
 */
export type DependencyFlowEdge = Edge<DependencyEdgeData>;

// ============================================================================
// Editor State
// ============================================================================

/** Editor mode for the GraphCanvas component. */
export type EditorMode = 'edit' | 'read-only';

/** Viewport state for persistence and restore. */
export interface EditorViewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// Inspector
// ============================================================================

/** Property display entry for the Inspector Panel. */
export interface InspectorProperty {
  label: string;
  value: string | number | boolean | string[];
  editable: boolean;
  field?: string; // Field name for inline editing
}

// ============================================================================
// Editor Store
// ============================================================================

/**
 * UI-focused editor store state.
 *
 * This store manages only editor UI concerns.
 * Graph data, validation, and algorithms remain in the Graph Engine.
 */
export interface GraphEditorState {
  // Graph data (canonical source of truth)
  graphData: import('@/core/graph/types').GraphData | null;

  // UI state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: EditorViewport;
  editorMode: EditorMode;
  validationResult: import('@/core/graph/types').ValidationResult | null;

  // Actions
  setGraphData: (graph: import('@/core/graph/types').GraphData) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setViewport: (viewport: Partial<EditorViewport>) => void;
  setEditorMode: (mode: EditorMode) => void;
  setValidationResult: (result: import('@/core/graph/types').ValidationResult | null) => void;
  clearSelection: () => void;
}
