/**
 * Graph Types — Domain-agnostic knowledge graph data model.
 *
 * These types represent a learning dependency graph. They know nothing
 * about worlds, planets, rendering, or visual themes. The graph is the
 * single source of truth for what the user needs to learn.
 *
 * @module GraphEngine
 */

// ============================================================================
// Node Types
// ============================================================================

/** Domain classification for a skill node. */
export type SkillCategory =
  | 'frontend' | 'backend' | 'devops' | 'data-science'
  | 'design' | 'music' | 'academic' | 'creative'
  | 'fitness' | 'language' | 'business' | 'custom';

/** Semantic type used for hierarchy inference. */
export type NodeType = 'milestone' | 'skill' | 'sub-skill' | 'resource' | 'project';

/** Progress status of a single node in the graph. */
export type NodeStatus = 'locked' | 'available' | 'in-progress' | 'completed';

// ============================================================================
// GraphNode
// ============================================================================

/**
 * A single node in the knowledge graph.
 *
 * Design notes:
 * - `hierarchyLevel` is deliberately NOT stored here — it is computed
 *   dynamically by `inferHierarchyLevel()` in the Graph Engine.
 * - `visualTheme` is deliberately absent — visual decisions belong
 *   to the Theme Engine, not the knowledge graph.
 */
export interface GraphNode {
  /** UUID — unique identifier */
  id: string;

  /** Human-readable name (e.g. "React Hooks") */
  label: string;

  /** Semantic type for hierarchy inference */
  type: NodeType;

  /** Domain classification */
  category: SkillCategory;

  /** What this node teaches */
  description: string;

  /** Subjective difficulty (1 = easy, 5 = expert) */
  difficulty: 1 | 2 | 3 | 4 | 5;

  /** Estimated time to complete (hours) */
  estimatedHours: number;

  /** Searchable keywords (promoted from metadata) */
  tags: string[];

  /** Criticality of this skill (10 = core, 1 = optional) */
  importance: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  /** XP reward on completion — drives vegetation density */
  estimatedXP: number;

  /** Suggested ordering when multiple skills are in-progress (1 = build first) */
  priority: 1 | 2 | 3 | 4 | 5;

  /**
   * Optional unlock condition string.
   * Stored as opaque string — the Graph Engine does not parse it.
   * Example: "complete:node-123", "date:2025-06-01", "team_size:3"
   */
  unlockCondition: string;

  /** Metadata and extended properties */
  metadata: {
    /** Links to courses, docs, resources */
    externalUrls: string[];
    /** Node IDs that must be completed first */
    prerequisites: string[];
    /** Emoji or icon name (UI hint only) */
    icon?: string;
  };

  /** Progress tracking for this node */
  progress: {
    /** Current status */
    status: NodeStatus;
    /** ISO date of completion (undefined if not completed) */
    completedAt?: string;
    /** Total time logged (minutes) */
    timeSpentMinutes: number;
    /** Resources/materials used */
    resourcesConsumed: number;
  };

  /** 2D layout position (for graph editor only — not used by Graph Engine) */
  position?: {
    x: number;
    y: number;
  };
}

// ============================================================================
// GraphEdge
// ============================================================================

/** Semantic type for a dependency edge. */
export type EdgeType = 'prerequisite' | 'recommended' | 'related' | 'leads-to';

/**
 * A directed edge between two nodes in the knowledge graph.
 * Direction: source → target (source must be completed before target).
 */
export interface GraphEdge {
  /** Unique identifier for this edge */
  id: string;

  /** Source node ID (prerequisite) */
  source: string;

  /** Target node ID (dependent) */
  target: string;

  /** Semantic type of this dependency */
  type: EdgeType;

  /** Importance weight (0.0 – 1.0) */
  weight: number;

  /** Edge metadata */
  metadata: {
    /** Optional human-readable description */
    description?: string;
    /** If true, source must be completed before target is available */
    required: boolean;
  };
}

// ============================================================================
// Graph Container
// ============================================================================

/**
 * The complete knowledge graph.
 *
 * - `nodes` is a Map for O(1) lookups by ID.
 * - `edges` is an array (edges are enumerated, not keyed).
 * - `rootNodeId` is the entry point (first node to learn).
 * - `goalNodeId` is the final milestone (ultimate objective).
 */
export interface GraphData {
  /** Unique identifier for this graph */
  id: string;

  /** Owner user ID */
  userId: string;

  /** Human-readable title (e.g. "Become a Frontend Developer") */
  title: string;

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** All nodes, keyed by node ID */
  nodes: Map<string, GraphNode>;

  /** All directed edges */
  edges: GraphEdge[];

  /** Entry point node ID */
  rootNodeId: string;

  /** Final milestone node ID */
  goalNodeId: string;
}

// ============================================================================
// Validation
// ============================================================================

/** Severity level of a validation issue. */
export type ValidationSeverity = 'error' | 'warning';

/** A single validation issue found in the graph. */
export interface ValidationIssue {
  /** Severity level */
  severity: ValidationSeverity;
  /** Human-readable description of the issue */
  message: string;
  /** The validation rule that was violated */
  rule: string;
  /** IDs of affected nodes/edges (if applicable) */
  ids?: string[];
}

/** Result of graph validation. */
export interface ValidationResult {
  /** True if the graph has no errors (may still have warnings) */
  valid: boolean;
  /** All issues found during validation */
  issues: ValidationIssue[];
}

// ============================================================================
// Hierarchy
// ============================================================================

/**
 * Hierarchy level for world generation.
 * The Graph Engine infers this from graph topology — it does NOT
 * store it on the node. The World Generator uses this to place
 * the node at the correct level in the WorldObject tree.
 */
export type HierarchyLevel =
  | 'continent'
  | 'region'
  | 'city'
  | 'district'
  | 'building'
  | 'landmark'
  | 'decoration';

/**
 * Strategy function for inferring a node's hierarchy level.
 * The Graph Engine accepts any strategy, but provides a default
 * that matches WORLD_RULES.md exactly.
 */
export type HierarchyStrategy = (
  node: GraphNode,
  graph: GraphData,
) => HierarchyLevel;
