/**
 * SkillNode - Custom React Flow Node
 *
 * Renders a GraphNode as a visual card in the React Flow canvas.
 * Displays node label, type, category, difficulty, and status.
 *
 * Primary visual distinction: hierarchy level (border/accent color).
 * Secondary: category badge.
 */

'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SkillFlowNode } from '../types';

const HIERARCHY_COLORS: Record<string, string> = {
  continent: '#f59e0b',
  region: '#f59e0b',
  city: '#3b82f6',
  district: '#3b82f6',
  building: '#22c55e',
  landmark: '#a855f7',
  decoration: '#6b7280',
};

const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#3b82f6',
  backend: '#22c55e',
  devops: '#ef4444',
  'data-science': '#a855f7',
  design: '#ec4899',
  music: '#f59e0b',
  academic: '#6366f1',
  creative: '#14b8a6',
  fitness: '#f97316',
  language: '#06b6d4',
  business: '#8b5cf6',
  custom: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  locked: '#374151',
  available: '#2563eb',
  'in-progress': '#f59e0b',
  completed: '#22c55e',
};

const TYPE_LABELS: Record<string, string> = {
  milestone: '\u{1F3AF}',
  skill: '\u{1F4D8}',
  'sub-skill': '\u{1F4C4}',
  resource: '\u{1F4CE}',
  project: '\u{1F3D7}\uFE0F',
};

function SkillNodeComponent({ data, selected }: NodeProps<SkillFlowNode>) {
  const { graphNode, validationIssues, hierarchyLevel } = data as SkillFlowNode['data'];
  const hierarchyColor = HIERARCHY_COLORS[hierarchyLevel] ?? '#6b7280';
  const categoryColor = CATEGORY_COLORS[graphNode.category] ?? '#6b7280';
  const statusColor = STATUS_COLORS[graphNode.progress.status] ?? '#374151';
  const typeIcon = TYPE_LABELS[graphNode.type] ?? '\u{1F4C4}';
  const hasErrors = validationIssues.length > 0;

  return (
    <div
      className={`relative rounded-lg border-2 bg-gray-900 px-4 py-3 shadow-lg transition-shadow duration-150 ${
        hasErrors ? 'border-red-500' : ''
      }`}
      style={{
        minWidth: 200,
        maxWidth: 280,
        borderColor: hasErrors ? undefined : selected ? hierarchyColor : 'rgb(55, 65, 81)',
        boxShadow: selected ? `0 0 12px ${hierarchyColor}33` : undefined,
      }}
    >
      <div
        className="absolute -top-0.5 left-2 right-2 h-1 rounded-full"
        style={{ backgroundColor: hierarchyColor }}
      />
      <div
        className="absolute -top-0.5 right-2 w-2 h-2 rounded-full"
        style={{ backgroundColor: statusColor }}
      />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{typeIcon}</span>
        <span className="font-semibold text-white text-sm truncate">
          {graphNode.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: hierarchyColor }}
        >
          {hierarchyLevel}
        </span>
        <span
          className="inline-block rounded px-1.5 py-0.5 text-xs text-white opacity-80"
          style={{ backgroundColor: categoryColor }}
        >
          {graphNode.category}
        </span>
        <span className="text-xs text-gray-400 capitalize">
          {graphNode.type.replace('-', ' ')}
        </span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-gray-400">Difficulty:</span>
        <div className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`text-xs ${
                i < graphNode.difficulty ? 'text-yellow-400' : 'text-gray-600'
              }`}
            >
              {'\u2605'}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">Importance:</span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-700">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(graphNode.importance / 10) * 100}%`,
              backgroundColor: hierarchyColor,
            }}
          />
        </div>
        <span className="text-xs text-gray-400">{graphNode.importance}/10</span>
      </div>
      <div className="text-xs text-gray-500">
        ~{graphNode.estimatedHours}h {'\u00B7'} {graphNode.estimatedXP} XP
      </div>
      {hasErrors && (
        <div className="mt-2 rounded bg-red-900/50 px-2 py-1">
          {validationIssues.map((issue: string, i: number) => (
            <p key={i} className="text-xs text-red-400">
              {'\u26A0'} {issue}
            </p>
          ))}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-gray-600 !bg-gray-900 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-gray-600 !bg-gray-900 !w-3 !h-3"
      />
    </div>
  );
}

export const SkillNode = memo(SkillNodeComponent);
