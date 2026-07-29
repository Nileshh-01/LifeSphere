/**
 * Graph Engine Constants
 *
 * Default values, enumerations, and configuration constants
 * for the Graph Engine module.
 *
 * @module GraphEngine
 */

import type { SkillCategory, NodeType, EdgeType, HierarchyLevel } from './types';

// ============================================================================
// Identifiers
// ============================================================================

/** Default graph ID used when none is provided. */
export const DEFAULT_GRAPH_ID = 'graph-default';

/** Default user ID used when none is provided. */
export const DEFAULT_USER_ID = 'user-default';

// ============================================================================
// Enumerations
// ============================================================================

/** All valid skill categories. */
export const SKILL_CATEGORIES: SkillCategory[] = [
  'frontend',
  'backend',
  'devops',
  'data-science',
  'design',
  'music',
  'academic',
  'creative',
  'fitness',
  'language',
  'business',
  'custom',
];

/** All valid node types. */
export const NODE_TYPES: NodeType[] = [
  'milestone',
  'skill',
  'sub-skill',
  'resource',
  'project',
];

/** All valid edge types. */
export const EDGE_TYPES: EdgeType[] = [
  'prerequisite',
  'recommended',
  'related',
  'leads-to',
];

/** All valid hierarchy levels. */
export const HIERARCHY_LEVELS: HierarchyLevel[] = [
  'continent',
  'region',
  'city',
  'district',
  'building',
  'landmark',
  'decoration',
];

// ============================================================================
// Validation Limits
// ============================================================================

/** Maximum number of nodes allowed in a single graph. */
export const MAX_NODES = 10_000;

/** Maximum number of edges allowed in a single graph. */
export const MAX_EDGES = 50_000;

/** Maximum depth of the graph from root (to prevent pathological graphs). */
export const MAX_GRAPH_DEPTH = 100;

// ============================================================================
// Hierarchy Strategy Defaults
// ============================================================================

/**
 * Thresholds used by the default hierarchy strategy.
 * These match WORLD_RULES.md §1 exactly.
 */
export const HIERARCHY_THRESHOLDS = {
  /** Minimum children for a skill to be considered a city. */
  CITY_MIN_CHILDREN: 3,
  /** Minimum importance for a skill to be considered a city. */
  CITY_MIN_IMPORTANCE: 5,
  /** Minimum importance for a milestone to be considered a continent. */
  CONTINENT_MIN_IMPORTANCE: 8,
  /** Maximum depth for a milestone to be considered a continent. */
  CONTINENT_MAX_DEPTH: 1,
} as const;
