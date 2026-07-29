/**
 * Graph Editor Page
 *
 * Main page for the Graph Editor feature.
 * Renders the toolbar, canvas, and inspector panel.
 *
 * @route /graph-editor
 */

'use client';

import { GraphToolbar } from '@/features/graph-editor/components/GraphToolbar';
import { GraphCanvas } from '@/features/graph-editor/components/GraphCanvas';
import { InspectorPanel } from '@/features/graph-editor/components/InspectorPanel';

export default function GraphEditorPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Toolbar */}
      <GraphToolbar />

      {/* Main Content: Canvas + Inspector Panel */}
      <div className="flex flex-1 overflow-hidden">
        <GraphCanvas />
        <InspectorPanel />
      </div>
    </div>
  );
}
