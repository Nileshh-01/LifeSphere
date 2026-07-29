/**
 * Example Graph: Guitar Learning Path
 *
 * A small linear graph for learning guitar.
 * Used in tests to validate graph engine functionality.
 *
 * Structure:
 *   Guitar (milestone, root)
 *   ├── Basics (skill)
 *   │   ├── Parts of Guitar (sub-skill)
 *   │   ├── Tuning (sub-skill)
 *   │   └── Proper Posture (sub-skill)
 *   ├── Chords (skill)
 *   │   ├── Open Chords (sub-skill)
 *   │   └── Barre Chords (sub-skill)
 *   ├── Strumming (skill)
 *   ├── Music Theory (skill)
 *   ├── Lead Guitar (skill, goal)
 *   │   ├── Scales (sub-skill)
 *   │   └── Bending & Vibrato (sub-skill)
 *   └── First Gig (project, landmark)
 *
 * @module GraphEngine
 */

import type { GraphData, GraphNode, GraphEdge } from '../types';

// ============================================================================
// Node IDs
// ============================================================================

export const ID = {
  GUITAR: 'gt-001',
  BASICS: 'gt-002',
  PARTS: 'gt-003',
  TUNING: 'gt-004',
  POSTURE: 'gt-005',
  CHORDS: 'gt-006',
  OPEN_CHORDS: 'gt-007',
  BARRE_CHORDS: 'gt-008',
  STRUMMING: 'gt-009',
  MUSIC_THEORY: 'gt-010',
  LEAD: 'gt-011',
  SCALES: 'gt-012',
  BENDING: 'gt-013',
  FIRST_GIG: 'gt-014',
} as const;

// ============================================================================
// Node Factory
// ============================================================================

function createNode(
  id: string,
  label: string,
  type: GraphNode['type'],
  category: GraphNode['category'],
  difficulty: GraphNode['difficulty'],
  importance: GraphNode['importance'],
  estimatedHours: number,
  estimatedXP: number,
  priority: GraphNode['priority'],
  status: GraphNode['progress']['status'] = 'locked',
): GraphNode {
  return {
    id,
    label,
    type,
    category,
    description: `Learn ${label}`,
    difficulty,
    estimatedHours,
    tags: [label.toLowerCase(), category],
    importance,
    estimatedXP,
    priority,
    unlockCondition: '',
    metadata: {
      externalUrls: [],
      prerequisites: [],
    },
    progress: {
      status,
      timeSpentMinutes: 0,
      resourcesConsumed: 0,
    },
  };
}

// ============================================================================
// Edge Factory
// ============================================================================

function createEdge(
  id: string,
  source: string,
  target: string,
  type: GraphEdge['type'] = 'prerequisite',
  weight: number = 1.0,
): GraphEdge {
  return {
    id,
    source,
    target,
    type,
    weight,
    metadata: {
      required: type === 'prerequisite',
    },
  };
}

// ============================================================================
// Guitar Graph
// ============================================================================

const nodes: GraphNode[] = [
  createNode(ID.GUITAR, 'Play Guitar', 'milestone', 'music', 1, 10, 0, 0, 1, 'available'),
  createNode(ID.BASICS, 'Guitar Basics', 'skill', 'music', 1, 7, 5, 50, 1),
  createNode(ID.PARTS, 'Parts of Guitar', 'sub-skill', 'music', 1, 3, 1, 10, 1),
  createNode(ID.TUNING, 'Tuning', 'sub-skill', 'music', 1, 4, 2, 20, 2),
  createNode(ID.POSTURE, 'Proper Posture', 'sub-skill', 'music', 1, 4, 2, 20, 3),
  createNode(ID.CHORDS, 'Chords', 'skill', 'music', 2, 8, 20, 150, 2),
  createNode(ID.OPEN_CHORDS, 'Open Chords', 'sub-skill', 'music', 1, 5, 5, 50, 1),
  createNode(ID.BARRE_CHORDS, 'Barre Chords', 'sub-skill', 'music', 3, 6, 15, 100, 2),
  createNode(ID.STRUMMING, 'Strumming Patterns', 'skill', 'music', 2, 6, 10, 80, 3),
  createNode(ID.MUSIC_THEORY, 'Music Theory', 'skill', 'music', 3, 7, 20, 150, 4),
  createNode(ID.LEAD, 'Lead Guitar', 'skill', 'music', 4, 9, 40, 400, 5),
  createNode(ID.SCALES, 'Scales', 'sub-skill', 'music', 3, 6, 15, 100, 1),
  createNode(ID.BENDING, 'Bending & Vibrato', 'sub-skill', 'music', 4, 6, 15, 100, 2),
  createNode(ID.FIRST_GIG, 'First Gig', 'project', 'music', 5, 10, 30, 600, 5),
];

const edges: GraphEdge[] = [
  createEdge('e-gt-001', ID.GUITAR, ID.BASICS),
  createEdge('e-gt-002', ID.BASICS, ID.PARTS),
  createEdge('e-gt-003', ID.BASICS, ID.TUNING),
  createEdge('e-gt-004', ID.BASICS, ID.POSTURE),
  createEdge('e-gt-005', ID.BASICS, ID.CHORDS),
  createEdge('e-gt-006', ID.CHORDS, ID.OPEN_CHORDS),
  createEdge('e-gt-007', ID.CHORDS, ID.BARRE_CHORDS),
  createEdge('e-gt-008', ID.CHORDS, ID.STRUMMING),
  createEdge('e-gt-009', ID.BASICS, ID.MUSIC_THEORY),
  createEdge('e-gt-010', ID.STRUMMING, ID.LEAD),
  createEdge('e-gt-011', ID.MUSIC_THEORY, ID.LEAD),
  createEdge('e-gt-012', ID.LEAD, ID.SCALES),
  createEdge('e-gt-013', ID.LEAD, ID.BENDING),
  createEdge('e-gt-014', ID.LEAD, ID.FIRST_GIG),
];

// ============================================================================
// Exported Graph
// ============================================================================

/**
 * Guitar learning graph.
 * 14 nodes, 14 edges, music category.
 */
export const GUITAR_GRAPH: GraphData = {
  id: 'graph-guitar',
  userId: 'user-example',
  title: 'Learn to Play Guitar',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  nodes: new Map(nodes.map((n) => [n.id, n])),
  edges,
  rootNodeId: ID.GUITAR,
  goalNodeId: ID.FIRST_GIG,
};
