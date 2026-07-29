/**
 * Graph Editor Store
 *
 * UI-focused Zustand store for the Graph Editor.
 *
 * This store manages ONLY editor UI concerns:
 * - Selected node/edge
 * - Viewport state
 * - Editor mode (edit / read-only)
 * - Validation results (display only)
 *
 * Graph data, validation, serialization, and algorithms
 * remain in the Graph Engine (core/graph/).
 *
 * @module GraphEditor
 */

import { create } from 'zustand';
import type { GraphData, ValidationResult } from '@/core/graph/types';
import type { EditorMode, EditorViewport } from '../types';

// ============================================================================
// Store Interface
// ============================================================================

export interface GraphEditorStore {
  // Graph data (canonical source of truth)
  graphData: GraphData | null;

  // UI state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: EditorViewport;
  editorMode: EditorMode;
  validationResult: ValidationResult | null;

  // Actions
  setGraphData: (graph: GraphData) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setViewport: (viewport: Partial<EditorViewport>) => void;
  setEditorMode: (mode: EditorMode) => void;
  setValidationResult: (result: ValidationResult | null) => void;
  clearSelection: () => void;
}

// ============================================================================
// Default Viewport
// ============================================================================

const DEFAULT_VIEWPORT: EditorViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useGraphEditorStore = create<GraphEditorStore>((set) => ({
  // Initial state
  graphData: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  viewport: DEFAULT_VIEWPORT,
  editorMode: 'edit',
  validationResult: null,

  // Actions
  setGraphData: (graph: GraphData) =>
    set({
      graphData: graph,
      // Clear selection when graph changes
      selectedNodeId: null,
      selectedEdgeId: null,
      validationResult: null,
    }),

  setSelectedNodeId: (id: string | null) =>
    set({
      selectedNodeId: id,
      // Deselect edge when selecting a node
      selectedEdgeId: id ? null : undefined,
    }),

  setSelectedEdgeId: (id: string | null) =>
    set({
      selectedEdgeId: id,
      // Deselect node when selecting an edge
      selectedNodeId: id ? null : undefined,
    }),

  setViewport: (viewport: Partial<EditorViewport>) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  setEditorMode: (mode: EditorMode) =>
    set({ editorMode: mode }),

  setValidationResult: (result: ValidationResult | null) =>
    set({ validationResult: result }),

  clearSelection: () =>
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
    }),
}));
