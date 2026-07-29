/**
 * InspectorPanel — Node Property Inspector
 *
 * Displays detailed properties of the currently selected node.
 * Allows inline editing of key fields.
 *
 * @module GraphEditor
 */

'use client';

import { useCallback, useMemo } from 'react';
import type { GraphNode, GraphData } from '@/core/graph/types';
import type { SkillCategory } from '@/core/graph/types';
import { useGraphEditorStore } from '../stores/graph-editor-store';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the IDs of prerequisite nodes for a given node.
 */
function getPrerequisiteIds(node: GraphNode, graph: GraphData): string[] {
  return graph.edges
    .filter((e) => e.target === node.id)
    .map((e) => e.source);
}

/**
 * Get the IDs of dependent nodes (nodes that depend on this node).
 */
function getDependentIds(node: GraphNode, graph: GraphData): string[] {
  return graph.edges
    .filter((e) => e.source === node.id)
    .map((e) => e.target);
}

/**
 * Get the label of a node by ID.
 */
function getNodeLabel(graph: GraphData, nodeId: string): string {
  return graph.nodes.get(nodeId)?.label ?? nodeId;
}

// ============================================================================
// Property Row
// ============================================================================

interface PropertyRowProps {
  label: string;
  value: string | number | boolean;
  editable?: boolean;
  onChange?: (value: string) => void;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}

function PropertyRow({ label, value, editable, onChange, type = 'text', options }: PropertyRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-b-0">
      <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
      {editable && onChange ? (
        type === 'select' && options ? (
          <select
            className="flex-1 bg-gray-800 text-xs text-gray-200 rounded px-1.5 py-0.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            className="flex-1 bg-gray-800 text-xs text-gray-200 rounded px-1.5 py-0.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      ) : (
        <span className="flex-1 text-xs text-gray-200 truncate text-right">
          {String(value)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Category Options
// ============================================================================

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'devops', label: 'DevOps' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'design', label: 'Design' },
  { value: 'music', label: 'Music' },
  { value: 'academic', label: 'Academic' },
  { value: 'creative', label: 'Creative' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'language', label: 'Language' },
  { value: 'business', label: 'Business' },
  { value: 'custom', label: 'Custom' },
];

// ============================================================================
// Inspector Panel
// ============================================================================

export function InspectorPanel() {
  const graphData = useGraphEditorStore((s) => s.graphData);
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const validationResult = useGraphEditorStore((s) => s.validationResult);
  const setGraphData = useGraphEditorStore((s) => s.setGraphData);

  const selectedNode = useMemo(() => {
    if (!graphData || !selectedNodeId) return null;
    return graphData.nodes.get(selectedNodeId) ?? null;
  }, [graphData, selectedNodeId]);

  const prerequisites = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return getPrerequisiteIds(selectedNode, graphData);
  }, [selectedNode, graphData]);

  const dependents = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return getDependentIds(selectedNode, graphData);
  }, [selectedNode, graphData]);

  const nodeValidationIssues = useMemo(() => {
    if (!validationResult || !selectedNodeId) return [];
    return validationResult.issues.filter(
      (issue) => issue.ids?.includes(selectedNodeId),
    );
  }, [validationResult, selectedNodeId]);

  const handleUpdate = useCallback(
    (field: keyof GraphNode, value: string | number) => {
      if (!graphData || !selectedNodeId) return;

      const node = graphData.nodes.get(selectedNodeId);
      if (!node) return;

      const updatedNode: GraphNode = { ...node };

      if (field === 'label') {
        updatedNode.label = String(value);
      } else if (field === 'category') {
        updatedNode.category = value as SkillCategory;
      } else if (field === 'difficulty') {
        updatedNode.difficulty = Math.max(1, Math.min(5, Number(value))) as 1 | 2 | 3 | 4 | 5;
      } else if (field === 'importance') {
        updatedNode.importance = Math.max(1, Math.min(10, Number(value))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
      } else if (field === 'estimatedHours') {
        updatedNode.estimatedHours = Math.max(0, Number(value));
      }

      const updatedNodes = new Map(graphData.nodes);
      updatedNodes.set(selectedNodeId, updatedNode);

      setGraphData({
        ...graphData,
        nodes: updatedNodes,
        updatedAt: new Date().toISOString(),
      });
    },
    [graphData, selectedNodeId, setGraphData],
  );

  // Empty state
  if (!selectedNode) {
    return (
      <div className="w-72 bg-gray-900 border-l border-gray-800 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500 text-center">
          Select a node to inspect its properties
        </p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Node Inspector</h3>
        <p className="text-xs text-gray-500 mt-0.5">{selectedNode.id}</p>
      </div>

      {/* Properties */}
      <div className="p-3">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Properties
        </h4>

        <PropertyRow
          label="Name"
          value={selectedNode.label}
          editable
          onChange={(v) => handleUpdate('label', v)}
        />

        <PropertyRow
          label="Category"
          value={selectedNode.category}
          editable
          type="select"
          options={CATEGORY_OPTIONS}
          onChange={(v) => handleUpdate('category', v)}
        />

        <PropertyRow
          label="Difficulty"
          value={selectedNode.difficulty}
          editable
          type="number"
          onChange={(v) => handleUpdate('difficulty', v)}
        />

        <PropertyRow
          label="Importance"
          value={selectedNode.importance}
          editable
          type="number"
          onChange={(v) => handleUpdate('importance', v)}
        />

        <PropertyRow
          label="Est. Hours"
          value={selectedNode.estimatedHours}
          editable
          type="number"
          onChange={(v) => handleUpdate('estimatedHours', v)}
        />

        <PropertyRow label="Type" value={selectedNode.type} />
        <PropertyRow label="Status" value={selectedNode.progress.status} />
        <PropertyRow label="XP" value={selectedNode.estimatedXP} />
        <PropertyRow label="Priority" value={selectedNode.priority} />
      </div>

      {/* Prerequisites */}
      {prerequisites.length > 0 && (
        <div className="p-3 border-t border-gray-800">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Prerequisites ({prerequisites.length})
          </h4>
          <div className="space-y-1">
            {prerequisites.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-xs text-gray-300 truncate">
                  {graphData ? getNodeLabel(graphData, id) : id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependents */}
      {dependents.length > 0 && (
        <div className="p-3 border-t border-gray-800">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Dependents ({dependents.length})
          </h4>
          <div className="space-y-1">
            {dependents.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs text-gray-300 truncate">
                  {graphData ? getNodeLabel(graphData, id) : id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Issues */}
      {nodeValidationIssues.length > 0 && (
        <div className="p-3 border-t border-gray-800">
          <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
            Validation Issues
          </h4>
          {nodeValidationIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span className="text-red-400 text-xs mt-0.5">⚠</span>
              <span className="text-xs text-red-300">{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
