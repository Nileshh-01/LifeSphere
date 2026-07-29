/**
 * DependencyEdge — Custom React Flow Edge
 *
 * Renders a GraphEdge as a styled path in the React Flow canvas.
 * Displays edge type, weight, and required status.
 *
 * @module GraphEditor
 */

'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { DependencyFlowEdge } from '../types';

// ============================================================================
// Edge Color Mapping
// ============================================================================

const EDGE_COLORS: Record<string, string> = {
  prerequisite: '#6366f1',
  recommended: '#22c55e',
  related: '#f59e0b',
  'leads-to': '#ec4899',
};

const EDGE_LABELS: Record<string, string> = {
  prerequisite: 'requires',
  recommended: 'recommends',
  related: 'relates to',
  'leads-to': 'leads to',
};

// ============================================================================
// Component
// ============================================================================

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<DependencyFlowEdge>) {
  const typedData = data as DependencyFlowEdge['data'] | undefined;
  const graphEdge = typedData?.graphEdge;
  const edgeType = graphEdge?.type ?? 'prerequisite';
  const edgeWeight = graphEdge?.weight ?? 1.0;
  const isRequired = graphEdge?.metadata?.required ?? true;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = EDGE_COLORS[edgeType] ?? '#6b7280';
  const label = EDGE_LABELS[edgeType] ?? edgeType;
  const strokeWidth = Math.max(1, edgeWeight * 3);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#60a5fa' : color,
          strokeWidth: selected ? strokeWidth + 1 : strokeWidth,
          strokeDasharray: isRequired ? 'none' : '5 5',
          opacity: 0.8,
        }}
      />

      {/* Edge label */}
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-none px-2 py-0.5 rounded text-xs font-medium
            transition-opacity duration-150
            ${selected ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-800/80 text-gray-400'}
          `}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <span>{label}</span>
          {!isRequired && (
            <span className="ml-1 text-gray-500">(optional)</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
