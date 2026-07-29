/**
 * Example Graph: Web Development Learning Path
 *
 * A realistic branching graph for learning web development.
 * Used in tests to validate graph engine functionality.
 *
 * Structure:
 *   Web Development (milestone, root)
 *   ├── HTML (skill) → CSS (skill) → JavaScript (skill)
 *   │   ├── JavaScript Basics (sub-skill)
 *   │   ├── DOM Manipulation (sub-skill)
 *   │   └── Async JS (sub-skill)
 *   ├── React (skill)
 *   │   ├── Components (sub-skill)
 *   │   ├── State Management (sub-skill)
 *   │   └── Hooks (sub-skill)
 *   ├── Next.js (skill, goal)
 *   │   ├── Pages & Routing (sub-skill)
 *   │   └── API Routes (sub-skill)
 *   ├── Git (skill)
 *   │   └── Version Control (sub-skill)
 *   │       └── GitHub Project (project, landmark)
 *   └── Node.js (skill)
 *       ├── Express (sub-skill)
 *       └── Databases (sub-skill)
 *
 * @module GraphEngine
 */

import type { GraphData, GraphNode, GraphEdge } from '../types';

// ============================================================================
// Node IDs
// ============================================================================

export const ID = {
  WEB_DEV: 'wd-001',
  HTML: 'wd-002',
  CSS: 'wd-003',
  JS: 'wd-004',
  JS_BASICS: 'wd-005',
  DOM: 'wd-006',
  ASYNC_JS: 'wd-007',
  REACT: 'wd-008',
  REACT_COMPONENTS: 'wd-009',
  STATE_MGMT: 'wd-010',
  HOOKS: 'wd-011',
  NEXT_JS: 'wd-012',
  PAGES_ROUTING: 'wd-013',
  API_ROUTES: 'wd-014',
  GIT: 'wd-015',
  VERSION_CONTROL: 'wd-016',
  GITHUB_PROJECT: 'wd-017',
  NODE_JS: 'wd-018',
  EXPRESS: 'wd-019',
  DATABASES: 'wd-020',
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
// Web Development Graph
// ============================================================================

const nodes: GraphNode[] = [
  // Root milestone
  createNode(ID.WEB_DEV, 'Web Development', 'milestone', 'frontend', 2, 10, 0, 0, 1, 'available'),

  // Core skills
  createNode(ID.HTML, 'HTML', 'skill', 'frontend', 1, 8, 20, 100, 1),
  createNode(ID.CSS, 'CSS', 'skill', 'frontend', 2, 7, 30, 150, 2),
  createNode(ID.JS, 'JavaScript', 'skill', 'frontend', 3, 9, 60, 300, 3),

  // JS sub-skills
  createNode(ID.JS_BASICS, 'JavaScript Basics', 'sub-skill', 'frontend', 2, 5, 15, 80, 1),
  createNode(ID.DOM, 'DOM Manipulation', 'sub-skill', 'frontend', 3, 6, 20, 100, 2),
  createNode(ID.ASYNC_JS, 'Async JavaScript', 'sub-skill', 'frontend', 4, 7, 25, 120, 3),

  // React skill + sub-skills
  createNode(ID.REACT, 'React', 'skill', 'frontend', 3, 8, 60, 400, 4),
  createNode(ID.REACT_COMPONENTS, 'Components', 'sub-skill', 'frontend', 2, 5, 15, 80, 1),
  createNode(ID.STATE_MGMT, 'State Management', 'sub-skill', 'frontend', 4, 6, 20, 100, 2),
  createNode(ID.HOOKS, 'React Hooks', 'sub-skill', 'frontend', 3, 6, 15, 80, 3),

  // Next.js (goal)
  createNode(ID.NEXT_JS, 'Next.js', 'skill', 'frontend', 3, 9, 40, 500, 5),
  createNode(ID.PAGES_ROUTING, 'Pages & Routing', 'sub-skill', 'frontend', 2, 5, 10, 60, 1),
  createNode(ID.API_ROUTES, 'API Routes', 'sub-skill', 'frontend', 3, 5, 10, 60, 2),

  // Git
  createNode(ID.GIT, 'Git', 'skill', 'devops', 2, 7, 15, 100, 1),
  createNode(ID.VERSION_CONTROL, 'Version Control', 'sub-skill', 'devops', 2, 4, 10, 50, 1),

  // GitHub Project (landmark)
  createNode(ID.GITHUB_PROJECT, 'GitHub Portfolio Project', 'project', 'frontend', 5, 10, 40, 800, 5),

  // Node.js
  createNode(ID.NODE_JS, 'Node.js', 'skill', 'backend', 3, 7, 30, 200, 4),
  createNode(ID.EXPRESS, 'Express.js', 'sub-skill', 'backend', 3, 5, 20, 100, 1),
  createNode(ID.DATABASES, 'Databases', 'sub-skill', 'backend', 4, 6, 25, 120, 2),
];

const edges: GraphEdge[] = [
  // Web Dev → Core Skills
  createEdge('e-001', ID.WEB_DEV, ID.HTML),
  createEdge('e-002', ID.WEB_DEV, ID.GIT),
  createEdge('e-003', ID.WEB_DEV, ID.NODE_JS),

  // HTML → CSS → JS
  createEdge('e-004', ID.HTML, ID.CSS),
  createEdge('e-005', ID.CSS, ID.JS),

  // JS → Sub-skills
  createEdge('e-006', ID.JS, ID.JS_BASICS),
  createEdge('e-007', ID.JS, ID.DOM),
  createEdge('e-008', ID.JS, ID.ASYNC_JS),

  // JS → React
  createEdge('e-009', ID.JS, ID.REACT),

  // React → Sub-skills
  createEdge('e-010', ID.REACT, ID.REACT_COMPONENTS),
  createEdge('e-011', ID.REACT, ID.STATE_MGMT),
  createEdge('e-012', ID.REACT, ID.HOOKS),

  // React → Next.js
  createEdge('e-013', ID.REACT, ID.NEXT_JS),

  // Next.js → Sub-skills
  createEdge('e-014', ID.NEXT_JS, ID.PAGES_ROUTING),
  createEdge('e-015', ID.NEXT_JS, ID.API_ROUTES),

  // Git → Version Control → GitHub Project
  createEdge('e-016', ID.GIT, ID.VERSION_CONTROL),
  createEdge('e-017', ID.VERSION_CONTROL, ID.GITHUB_PROJECT),

  // Node.js → Sub-skills
  createEdge('e-018', ID.NODE_JS, ID.EXPRESS),
  createEdge('e-019', ID.NODE_JS, ID.DATABASES),
];

// ============================================================================
// Exported Graph
// ============================================================================

/**
 * Web Development learning graph.
 * 20 nodes, 19 edges, branching structure with multiple categories.
 */
export const WEB_DEV_GRAPH: GraphData = {
  id: 'graph-web-dev',
  userId: 'user-example',
  title: 'Become a Frontend Developer',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  nodes: new Map(nodes.map((n) => [n.id, n])),
  edges,
  rootNodeId: ID.WEB_DEV,
  goalNodeId: ID.NEXT_JS,
};
