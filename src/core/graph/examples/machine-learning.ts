/**
 * Example Graph: Machine Learning Learning Path
 *
 * A linear-progression graph for machine learning.
 * Used in tests to validate graph engine functionality.
 *
 * Structure:
 *   Machine Learning (milestone, root)
 *   ├── Python (skill)
 *   │   ├── Python Basics (sub-skill)
 *   │   └── NumPy & Pandas (sub-skill)
 *   ├── Linear Algebra (skill)
 *   ├── Statistics (skill)
 *   ├── ML Fundamentals (skill)
 *   │   ├── Supervised Learning (sub-skill)
 *   │   └── Unsupervised Learning (sub-skill)
 *   ├── Deep Learning (skill, goal)
 *   │   ├── Neural Networks (sub-skill)
 *   │   └── TensorFlow (sub-skill)
 *   └── ML Project (project, landmark)
 *
 * @module GraphEngine
 */

import type { GraphData, GraphNode, GraphEdge } from '../types';

// ============================================================================
// Node IDs
// ============================================================================

export const ID = {
  ML: 'ml-001',
  PYTHON: 'ml-002',
  PYTHON_BASICS: 'ml-003',
  NUMPY_PANDAS: 'ml-004',
  LINEAR_ALGEBRA: 'ml-005',
  STATISTICS: 'ml-006',
  ML_FUNDAMENTALS: 'ml-007',
  SUPERVISED: 'ml-008',
  UNSUPERVISED: 'ml-009',
  DEEP_LEARNING: 'ml-010',
  NEURAL_NETS: 'ml-011',
  TENSORFLOW: 'ml-012',
  ML_PROJECT: 'ml-013',
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
// Machine Learning Graph
// ============================================================================

const nodes: GraphNode[] = [
  createNode(ID.ML, 'Machine Learning', 'milestone', 'data-science', 2, 10, 0, 0, 1, 'available'),
  createNode(ID.PYTHON, 'Python', 'skill', 'data-science', 2, 8, 30, 200, 1),
  createNode(ID.PYTHON_BASICS, 'Python Basics', 'sub-skill', 'data-science', 1, 4, 10, 50, 1),
  createNode(ID.NUMPY_PANDAS, 'NumPy & Pandas', 'sub-skill', 'data-science', 2, 5, 15, 80, 2),
  createNode(ID.LINEAR_ALGEBRA, 'Linear Algebra', 'skill', 'data-science', 3, 7, 25, 150, 2),
  createNode(ID.STATISTICS, 'Statistics', 'skill', 'data-science', 3, 7, 25, 150, 3),
  createNode(ID.ML_FUNDAMENTALS, 'ML Fundamentals', 'skill', 'data-science', 3, 9, 40, 300, 4),
  createNode(ID.SUPERVISED, 'Supervised Learning', 'sub-skill', 'data-science', 3, 6, 20, 100, 1),
  createNode(ID.UNSUPERVISED, 'Unsupervised Learning', 'sub-skill', 'data-science', 3, 6, 20, 100, 2),
  createNode(ID.DEEP_LEARNING, 'Deep Learning', 'skill', 'data-science', 4, 9, 50, 500, 5),
  createNode(ID.NEURAL_NETS, 'Neural Networks', 'sub-skill', 'data-science', 4, 6, 25, 120, 1),
  createNode(ID.TENSORFLOW, 'TensorFlow', 'sub-skill', 'data-science', 3, 5, 20, 100, 2),
  createNode(ID.ML_PROJECT, 'ML Capstone Project', 'project', 'data-science', 5, 10, 60, 1000, 5),
];

const edges: GraphEdge[] = [
  createEdge('e-ml-001', ID.ML, ID.PYTHON),
  createEdge('e-ml-002', ID.ML, ID.LINEAR_ALGEBRA),
  createEdge('e-ml-003', ID.ML, ID.STATISTICS),
  createEdge('e-ml-004', ID.PYTHON, ID.PYTHON_BASICS),
  createEdge('e-ml-005', ID.PYTHON, ID.NUMPY_PANDAS),
  createEdge('e-ml-006', ID.PYTHON, ID.ML_FUNDAMENTALS),
  createEdge('e-ml-007', ID.LINEAR_ALGEBRA, ID.ML_FUNDAMENTALS),
  createEdge('e-ml-008', ID.STATISTICS, ID.ML_FUNDAMENTALS),
  createEdge('e-ml-009', ID.ML_FUNDAMENTALS, ID.SUPERVISED),
  createEdge('e-ml-010', ID.ML_FUNDAMENTALS, ID.UNSUPERVISED),
  createEdge('e-ml-011', ID.ML_FUNDAMENTALS, ID.DEEP_LEARNING),
  createEdge('e-ml-012', ID.DEEP_LEARNING, ID.NEURAL_NETS),
  createEdge('e-ml-013', ID.DEEP_LEARNING, ID.TENSORFLOW),
  createEdge('e-ml-014', ID.DEEP_LEARNING, ID.ML_PROJECT),
];

// ============================================================================
// Exported Graph
// ============================================================================

/**
 * Machine Learning learning graph.
 * 13 nodes, 14 edges, data-science category.
 */
export const ML_GRAPH: GraphData = {
  id: 'graph-ml',
  userId: 'user-example',
  title: 'Master Machine Learning',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  nodes: new Map(nodes.map((n) => [n.id, n])),
  edges,
  rootNodeId: ID.ML,
  goalNodeId: ID.ML_PROJECT,
};
