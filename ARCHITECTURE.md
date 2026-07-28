# LifeSphere — Software Architecture

## 1. System Architecture Overview

LifeSphere is organized into **four strict layers** with unidirectional dependencies:

```
┌──────────────────────────────────────────────────────────────┐
│                       UI Layer                                │
│  (React Components, Pages, Layouts, Overlays)                │
├──────────────────────────────────────────────────────────────┤
│                     State Layer                               │
│  (Zustand Stores — Graph, World, Layout, Progress, UI)       │
├──────────────────────────────────────────────────────────────┤
│                   Domain / Logic Layer                        │
│  ┌──────────┐ ┌───────────────┐ ┌───────────────┐           │
│  │  Graph   │ │    Layout     │ │     AI        │           │
│  │  Engine  │ │    Engine     │ │  Integration  │           │
│  └──────────┘ └───────────────┘ └───────────────┘           │
│       │              │                                       │
│       ▼              ▼                                       │
│  ┌──────────────────────────────────────┐                    │
│  │         World Generator              │                    │
│  │  (Uses WorldRules to map graph →     │                    │
│  │   hierarchy of WorldObjects)         │                    │
│  └────────────┬─────────────────────────┘                    │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────────────────┐                    │
│  │         WorldConfig                  │                    │
│  │  (Pure data — no rendering info)     │                    │
│  └────────────┬─────────────────────────┘                    │
├───────────────┼──────────────────────────────────────────────┤
│               ▼                                              │
│  ┌──────────────────────────────────────┐                    │
│  │         Theme Engine                  │                    │
│  │  (Converts WorldConfig → themed      │                    │
│  │   visual config based on active      │                    │
│  │   theme: fantasy, cyberpunk, etc.)   │                    │
│  └────────────┬─────────────────────────┘                    │
├───────────────┼──────────────────────────────────────────────┤
│               ▼                                              │
│  ┌──────────────────────────────────────┐                    │
│  │         Rendering Layer               │                    │
│  │  (R3F Scene Graph, Three.js, GSAP)   │                    │
│  └──────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

**Rules:**
- **UI Layer** never imports from Rendering Layer directly.
- **Rendering Layer** reads from State Layer only (WorldConfig after Theme Engine processing).
- **AI Layer** produces generic graph data only — no rendering, no spatial, no visual logic.
- **Graph Engine** is domain-agnostic — knows nothing about worlds, planets, or visuals.
- **Layout Engine** is the bridge — converts abstract graph topology into deterministic spatial geometry using a seed.
- **World Generator** applies WorldRules to convert graph + layout into a hierarchical WorldConfig.
- **Theme Engine** is the only layer that knows about visual styles — it converts generic WorldConfig into themed render data.
- **WorldRules** is a static mapping document — it defines logical relationships (e.g. "Skill → City") that the World Generator uses. It contains no code logic itself — the World Generator reads and applies these rules programmatically.

### Pipeline Flow (End-to-End)

```
User Goal Text
    │
    ▼
┌─────────────────────┐
│    AI Integration   │  ← Produces: GraphData (nodes, edges, dependencies)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    Graph Engine     │  ← Validates, topo-sorts, computes paths
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    Layout Engine    │  ← GraphData + Seed → 2D/3D node positions
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   World Generator   │  ← GraphData + Positions + WorldRules → WorldConfig
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Theme Engine      │  ← WorldConfig + Theme → ThemedWorldConfig
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    Renderer         │  ← Renders recursively from WorldObject hierarchy
└─────────────────────┘
```

---

## 2. Feature-Based Folder Structure (MVP)

The folder structure is organized for the **MVP only**. Future features (auth, multiplayer, integrations, AI coach, achievements) are documented in the Future Roadmap section — they are not part of the source tree until needed.

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Main world view
│   ├── onboarding/
│   │   └── page.tsx
│   └── graph-editor/
│       └── page.tsx
│
├── core/                         # Framework-agnostic domain logic
│   ├── graph/
│   │   ├── types.ts              # GraphNode, GraphEdge, GraphData
│   │   ├── graph-engine.ts       # Traversal, validation, topology ops
│   │   └── constants.ts
│   │
│   ├── layout-engine/            # NEW — Deterministic spatial layout
│   │   ├── types.ts              # LayoutConfig, NodePosition, Cluster
│   │   ├── layout-engine.ts      # Orchestrator: graph + seed → positions
│   │   ├── force-directed.ts     # Force-directed placement on sphere
│   │   ├── continent-cluster.ts  # Group nodes into continents
│   │   ├── collision-avoidance.ts# Resolve overlapping positions
│   │   ├── road-topology.ts      # Edge → spherical path geometry
│   │   └── density-balancer.ts   # Ensure even distribution
│   │
│   ├── world-generation/
│   │   ├── types.ts              # WorldConfig, WorldObject, BiomeConfig
│   │   ├── world-generator.ts    # Graph + Layout + WorldRules → WorldConfig
│   │   ├── world-rules.ts        # Programmatic mapping: graph → world hierarchy
│   │   ├── terrain-generator.ts  # Heightmap → terrain params
│   │   ├── city-planner.ts       # Graph nodes → city positions
│   │   ├── road-network.ts       # Graph edges → road/path geometry
│   │   ├── biome-assigner.ts     # Skill type → biome/color palette
│   │   └── progression-rules.ts  # Completion → visual state mapping
│   │
│   ├── theme-engine/             # NEW — Theme-aware visual conversion
│   │   ├── types.ts              # Theme, ThemedWorldConfig, VisualStyle
│   │   ├── theme-engine.ts       # WorldConfig + Theme → ThemedWorldConfig
│   │   ├── themes/
│   │   │   ├── fantasy.ts
│   │   │   ├── cyberpunk.ts
│   │   │   ├── voxel.ts
│   │   │   ├── sci-fi.ts
│   │   │   └── minimal.ts
│   │   └── theme-registry.ts     # Theme lookup and validation
│   │
│   ├── ai/
│   │   ├── types.ts              # AIGoal, AIGraphResponse
│   │   ├── ai-service.ts         # API client for LLM
│   │   ├── prompt-templates.ts   # Prompt engineering
│   │   └── response-parser.ts    # LLM output → GraphData
│   │
│   └── animation/
│       ├── types.ts              # AnimationSequence, TransitionDef
│       ├── animation-engine.ts   # GSAP orchestration
│       └── easings.ts
│
├── features/                     # Feature modules (each ≤300 lines per file)
│   ├── onboarding/
│   │   ├── components/
│   │   │   ├── GoalInput.tsx
│   │   │   └── GoalList.tsx
│   │   ├── hooks/
│   │   │   └── useOnboarding.ts
│   │   ├── stores/
│   │   │   └── onboarding-store.ts
│   │   └── types.ts
│   │
│   ├── world/
│   │   ├── components/
│   │   │   ├── PlanetScene.tsx        # Root R3F scene
│   │   │   ├── WorldObjectRenderer.tsx# NEW — Recursive hierarchy renderer
│   │   │   ├── Terrain.tsx            # Planet surface mesh
│   │   │   ├── Water.tsx              # Oceans, rivers
│   │   │   ├── Atmosphere.tsx         # Sky, clouds, lighting
│   │   │   ├── ConstructionEffect.tsx # Building animation
│   │   │   └── WorldCamera.tsx        # Camera controls
│   │   ├── hooks/
│   │   │   ├── useWorldConfig.ts      # Subscribe to graph → compute config
│   │   │   ├── usePlanetInteraction.ts
│   │   │   └── useConstructionAnimation.ts
│   │   ├── stores/
│   │   │   └── world-store.ts
│   │   ├── generators/
│   │   │   ├── world-object-mesh.ts   # NEW — Generic mesh from WorldObject
│   │   │   └── terrain-shader.ts      # Custom shader materials
│   │   └── types.ts
│   │
│   ├── graph-editor/
│   │   ├── components/
│   │   │   ├── GraphCanvas.tsx        # React Flow wrapper
│   │   │   ├── SkillNode.tsx          # Custom React Flow node
│   │   │   ├── DependencyEdge.tsx     # Custom React Flow edge
│   │   │   └── GraphToolbar.tsx
│   │   ├── hooks/
│   │   │   └── useGraphEditor.ts
│   │   ├── stores/
│   │   │   └── graph-editor-store.ts
│   │   └── types.ts
│   │
│   └── progress/
│       ├── components/
│       │   ├── ProgressPanel.tsx
│       │   └── SkillCard.tsx
│       ├── hooks/
│       │   └── useProgress.ts
│       ├── stores/
│       │   └── progress-store.ts
│       └── types.ts
│
├── shared/                       # Shared utilities
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Tooltip.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts
│   ├── types/
│   │   └── common.ts
│   └── utils/
│       ├── cn.ts                 # clsx + tailwind-merge
│       ├── color.ts              # Color manipulation
│       ├── math.ts               # Vector math helpers
│       └── seed.ts               # Seeded PRNG for determinism
│
├── styles/
│   ├── globals.css
│   └── theme.ts                  # Design tokens
│
└── config/
    ├── world-defaults.ts         # Default world generation params
    ├── ai-config.ts              # AI model settings
    └── feature-flags.ts          # Feature toggles
```

### Key Structural Changes from Previous Version

| Change | Rationale |
|--------|-----------|
| Removed `integration/`, `ai-coach/`, `auth/` from source tree | These are future features, not MVP. They belong in the roadmap only. |
| Added `core/layout-engine/` | The Layout Engine is now a first-class system with 6 dedicated modules. |
| Added `core/theme-engine/` | Theme Engine separates visual styling from world generation. Ships with 5 theme presets. |
| Added `core/world-generation/world-rules.ts` | Programmatic implementation of WORLD_RULES.md mappings. |
| Replaced `City.tsx`, `Building.tsx`, `Road.tsx` with `WorldObjectRenderer.tsx` | Single recursive renderer that consumes generic WorldObject hierarchy — no hardcoded level components. |
| Removed `building-blueprints.ts`, `city-mesh.ts` | Replaced by `world-object-mesh.ts` which generates geometry from WorldObject.visualType. |
| Removed `AchievementBadge.tsx` | Achievements are future scope. |
| Added `shared/utils/seed.ts` | Seeded PRNG is critical for deterministic world generation. |

---

## 3. Graph Data Model

### Design Principle

The graph is **completely domain-agnostic**. It represents knowledge and learning only — not rendering, not spatial positioning, not visual themes. A GraphNode does not know whether it will become a city, a district, a building, or a landmark. That decision belongs entirely to the World Generator using WORLD_RULES.md.

The graph is the **single source of truth for what the user needs to learn**. Everything else (spatial layout, visual representation, theme) is derived downstream.

### Core Types (in `core/graph/types.ts`)

```typescript
// === Node Types ===

type SkillCategory =
  | 'frontend' | 'backend' | 'devops' | 'data-science'
  | 'design' | 'music' | 'academic' | 'creative'
  | 'fitness' | 'language' | 'business' | 'custom';

type NodeType = 'milestone' | 'skill' | 'sub-skill' | 'resource' | 'project';

interface GraphNode {
  id: string;                    // UUID — unique identifier
  label: string;                 // Human-readable name (e.g. "React Hooks")
  type: NodeType;                // Semantic type for hierarchy inference
  category: SkillCategory;       // Domain classification
  description: string;           // What this node teaches
  difficulty: 1 | 2 | 3 | 4 | 5;// Subjective difficulty (1=easy, 5=expert)
  estimatedHours: number;        // Estimated time to complete
  tags: string[];                // Searchable keywords (promoted from metadata)
  importance: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;  // NEW — Criticality of this skill (10=core, 1=optional)
  estimatedXP: number;           // NEW — XP reward on completion (drives vegetation density)
  priority: 1 | 2 | 3 | 4 | 5;  // NEW — Suggested ordering when multiple skills are in-progress
  unlockCondition: string;       // NEW — Optional condition string for future use (e.g. "complete:node-123", "date:2025-06-01")
  metadata: {
    externalUrls: string[];      // Links to courses, docs, resources
    prerequisites: string[];     // Node IDs that must be completed first
    icon?: string;               // Emoji or icon name (UI hint only)
  };
  progress: {
    status: 'locked' | 'available' | 'in-progress' | 'completed';
    completedAt?: string;        // ISO date of completion
    timeSpentMinutes: number;    // Total time logged
    resourcesConsumed: number;   // Resources/materials used
  };
  position?: {                   // 2D layout position (for graph editor only)
    x: number;
    y: number;
  };
}

// === Edge Types ===

type EdgeType = 'prerequisite' | 'recommended' | 'related' | 'leads-to';

interface GraphEdge {
  id: string;
  source: string;                // Source node ID
  target: string;                // Target node ID
  type: EdgeType;
  weight: number;                // 0.0 – 1.0 (importance)
  metadata: {
    description?: string;
    required: boolean;           // Must complete source before target
  };
}

// === Graph Container ===

interface GraphData {
  id: string;
  userId: string;
  title: string;                 // e.g., "Become a Frontend Developer"
  createdAt: string;
  updatedAt: string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  rootNodeId: string;            // Entry point
  goalNodeId: string;            // Final milestone
}
```

#### Why Each New Field Exists

| Field | Why It's Needed | Who Uses It |
|-------|-----------------|-------------|
| `tags` (promoted from metadata) | Enables search/filter without digging into metadata. The graph editor needs quick tag access for grouping and filtering. | UI, Graph Engine |
| `importance: 1-10` | Determines rendering priority in the 3D world. A milestone skill (importance=10) should be a prominent landmark. An optional skill (importance=2) should be a small side building. | Layout Engine (clustering), World Generator (hierarchy level) |
| `estimatedXP: number` | Drives vegetation density around the node's city. More XP = more vibrant environment. Provides gamification without hardcoding game logic into the graph. | World Generator (biome assigner) |
| `priority: 1-5` | Affects construction ordering when multiple skills are in progress. Pre-computed by AI so the engine doesn't need to guess which skill to build first. | Progress System, Animation Engine |
| `unlockCondition: string` | Future-proofing for multiplayer (e.g. "complete:node-456" or "team_size:3") and time-gated content. Stored as opaque string — the graph engine doesn't parse it, just stores and returns it. | Future: Multiplayer, AI Coach |

**Fields deliberately NOT added:**
- `visualTheme` — This would couple the graph to rendering. Visual overrides belong in the Theme Engine or future per-user customization layer, not in the knowledge graph.
- `hierarchyLevel` — The graph is domain-agnostic. A skill is a skill. Whether it becomes a city, district, or building is determined by the World Generator based on graph topology (number of children, depth, importance, type), not by a hardcoded field.
- `color` — Removed from metadata. Color assignment is the Theme Engine's responsibility.

### Graph Engine (`core/graph/graph-engine.ts`)

The Graph Engine is a pure domain-logic module. It has zero knowledge of worlds, planets, or rendering.

```typescript
interface GraphEngine {
  // Topological sort for linear learning path
  getLearningPath(graph: GraphData): GraphNode[];
  
  // Get currently available (unlocked) skills
  getAvailableSkills(graph: GraphData): GraphNode[];
  
  // Validate graph integrity (no orphans, valid edges)
  validateGraph(graph: GraphData): ValidationResult;
  
  // Find shortest path between any two nodes
  findPath(graph: GraphData, from: string, to: string): GraphNode[];
  
  // Detect and report cycles
  detectCycles(graph: GraphData): string[][];
  
  // Compute overall completion percentage
  getCompletionPercent(graph: GraphData): number;
  
  // Filter graph to a single category
  filterByCategory(graph: GraphData, category: SkillCategory): GraphData;
  
  // NEW — Infer hierarchy level based on graph topology
  // Uses: node type, number of children, depth from root, importance
  // Returns a suggested level (1=continent ... 7=landmark)
  // Does NOT store this on the node — it's computed on-the-fly
  inferHierarchyLevel(node: GraphNode, graph: GraphData): number;
}
```

#### Why `inferHierarchyLevel` Exists

The World Generator needs to know whether a GraphNode becomes a continent, region, city, or building. Instead of hardcoding this in the node, the Graph Engine provides a **stateless, deterministic function** that infers the level based on:

- **Node type**: `milestone` → likely continent, `sub-skill` → likely building
- **Number of children**: More children → higher in hierarchy
- **Depth from root**: Deeper → smaller scale
- **Importance**: Higher importance → larger in world

This keeps the graph clean while giving the World Generator everything it needs.

---

## 4. Layout Engine

### 4.1 Design Philosophy

The Layout Engine is the bridge between abstract graph topology and concrete spatial geometry. It is one of the most architecturally critical systems because every downstream system depends on its output — the World Generator needs node positions to place cities, the Road Network needs edge paths to connect them, and the Renderer needs spatial clusters to optimize LOD and culling.

**Core Principles:**

| Principle | Rationale |
|-----------|-----------|
| Deterministic | Same graph + same seed → identical layout every time. Enables reproducible worlds, debugging, and collaborative editing. |
| Domain-Agnostic | The Layout Engine knows nothing about skills, categories, or learning. It operates purely on graph topology (nodes, edges, weights) and produces geometric positions. |
| Seeded Randomness | All stochastic decisions use a seeded PRNG (see `shared/utils/seed.ts`). No `Math.random()` calls. This enables controlled variation without sacrificing determinism. |
| Progressive Refinement | Layout is computed in passes — each pass refines the previous output. No single algorithm produces final positions in one step. |
| Readability-Preserving | The output must be visually interpretable by a human. Clusters must be distinguishable, nodes must not overlap, and connected nodes must be spatially near each other. |

### 4.2 Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Deterministic Node Positioning | Assign 3D coordinates (on sphere surface) to every GraphNode such that position is fully determined by graph topology + seed. |
| Continent Clustering | Group topologically-related nodes into spatial clusters (continents). Clusters should be spatially separated on the sphere surface. |
| Road Topology | For every graph edge, compute a geodesic path along the sphere surface connecting source and target node positions. |
| Spatial Optimization | Minimize total edge length (sum of all road distances) while maintaining cluster separation. Equivalent to a constrained graph layout problem on a spherical manifold. |
| Collision Avoidance | Ensure no two nodes occupy overlapping positions. Resolve overlaps by perturbing positions within their cluster region. |
| Density Balancing | Prevent overcrowding in any cluster. If a continent has too many nodes, either split the cluster or redistribute within the cluster area. |
| Readability Preservation | Ensure that graph topology is visually apparent from spatial layout — connected nodes are proximal, disconnected clusters are distant, hierarchy depth maps to radial distance from cluster center. |
| Seeded Procedural Randomness | All variation (jitter, perturbation, noise) must be seeded so the entire layout is reproducible. |

### 4.3 Algorithm Pipeline

The Layout Engine processes graph → positions in 8 sequential stages. Each stage receives the output of the previous stage and refines it.

```
GraphData + Seed
    │
    ▼
┌─────────────────────────────┐
│ 1. Seed Initialization      │  ← Initialize PRNG from seed
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Topology Analysis        │  ← Compute centrality, depth, clustering coefficient
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Continent Clustering     │  ← Community detection on graph
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Force-Directed Placement │  ← Spring-electric layout on sphere surface
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Collision Avoidance      │  ← Push apart overlapping nodes
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 6. Density Balancing        │  ← Evenly distribute within clusters
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 7. Sphere Projection        │  ← Map 2D positions → 3D sphere surface
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 8. Road Topology Generation │  ← Compute geodesic paths for edges
└─────────────┬───────────────┘
              │
              ▼
    NodePositions[] + RoadPaths[]
```

#### Stage 1 — Seed Initialization
A seeded PRNG (xoshiro128** or MurmurHash3-based) is initialized from the world seed. This PRNG is then used for all stochastic decisions in subsequent stages. **No source of randomness other than this PRNG is permitted.**

```typescript
// Pseudocode
function initializePRNG(seed: number): PRNG {
  const state = splitmix32(seed);  // Seed the state
  return xoshiro128starstar(state);
}
```

#### Stage 2 — Topology Analysis
Analyze the graph to compute metrics needed for layout decisions:

- **Centrality**: Betweenness centrality identifies which nodes are hubs (multiple connections → center of continent)
- **Depth from root**: Number of edges from the root node → determines radial distance from continent center
- **Node importance** (from GraphNode.importance): Adjusts attraction/repulsion forces — more important nodes have larger repulsion radius
- **Clustering coefficient**: Identifies highly-connected subgraphs → natural continents
- **Degree centrality**: Number of connections → affects node spacing (high-degree nodes need more space)

These metrics are computed once and cached. They do not change during layout refinement.

#### Stage 3 — Continent Clustering
Community detection on the graph to identify natural clusters. The algorithm choice depends on graph size:

| Graph Size | Algorithm | Rationale |
|------------|-----------|-----------|
| < 100 nodes | Girvan–Newman | High quality, acceptable O(n²) cost |
| 100–1000 nodes | Louvain | Fast O(n log n), good quality |
| > 1000 nodes | Label Propagation | Linear O(n), approximate clusters |

Each detected community becomes a continent. If the graph has no natural communities (e.g., a linear chain), fall back to hierarchical clustering based on depth from root.

**Continent metadata** produced:
```typescript
interface Continent {
  id: string;
  nodeIds: string[];       // All nodes in this continent
  center: [number, number]; // Latitude/longitude on sphere (before projection)
  importance: number;       // Aggregate importance of all nodes (determines continent size)
  radius: number;           // Angular radius on sphere surface
}
```

#### Stage 4 — Force-Directed Placement (on Sphere)
A modified Fruchterman-Reingold algorithm adapted for spherical geometry:

- **Repulsive force**: Every node repels every other node. Force inversely proportional to geodesic distance on sphere surface. Magnitude scaled by node importance.
- **Attractive force**: Every edge pulls its two nodes together. Force proportional to edge weight and geodesic distance. Only along edges.
- **Gravity**: All nodes are attracted toward their continent center. Prevents continents from overlapping.
- **Damping**: Force magnitude decreases with each iteration (temperature cooling). Initial temperature based on graph size.
- **Convergence**: Stop when max displacement < threshold or max iterations reached.

**Key adaptation for spherical geometry**: Forces are computed in 3D tangent space, not 2D. Positions are normalized to sphere radius after each iteration. This preserves spherical topology.

```typescript
// Pseudocode
function forceDirectedPlacement(
  nodes: GraphNode[],
  edges: GraphEdge[],
  continents: Continent[],
  prng: PRNG,
  config: LayoutConfig
): NodePosition[] {
  // Initialize positions randomly within continent bounds
  let positions = initializeRandomPositions(nodes, continents, prng);
  
  for (let iter = 0; iter < config.maxIterations; iter++) {
    const temperature = coolingSchedule(iter, config.maxIterations);
    
    // Compute forces
    const forces = new Map<string, Vector3>();
    for (const node of nodes) {
      const repulsion = computeRepulsion(node, positions, config.repulsionStrength);
      const attraction = computeAttraction(node, edges, positions, config.attractionStrength);
      const gravity = computeGravity(node, continents, positions, config.gravityStrength);
      forces.set(node.id, add(replace, attract, grav));
    }
    
    // Apply forces
    for (const node of nodes) {
      const force = forces.get(node.id)!;
      const displacement = scale(clampMagnitude(force, temperature), temperature);
      positions.set(node.id, add(positions.get(node.id)!, displacement));
      // Normalize to sphere surface
      positions.set(node.id, normalize(positions.get(node.id)!));
    }
  }
  
  return positions;
}
```

#### Stage 5 — Collision Avoidance
After force-directed placement, nodes may still overlap (especially high-degree nodes with many connections). Collision avoidance resolves this:

1. **Detect overlaps**: Compute geodesic distance between every pair of nodes within the same continent. If distance < minSpacing (based on node size), flag as collision.
2. **Resolve**: For each colliding pair, push both nodes apart along the great circle arc connecting them. Push distance = (minSpacing - actualDistance) / 2 per node.
3. **Iterate**: Repeat until no collisions remain or max iterations reached.
4. **Fallback**: If collisions persist (very dense cluster), increase continent radius and re-run force-directed placement for that continent only.

#### Stage 6 — Density Balancing
Ensure uniform distribution within each continent region:

1. **Compute density map**: Divide continent region into a grid (in spherical coordinates). Count nodes per grid cell.
2. **Identify hotspots**: Grid cells with significantly above-average node count.
3. **Redistribute**: Move outermost nodes from hotspots toward the continent periphery. Move direction is outward from continent center along great circle arc.
4. **Balance metric**: Coefficient of variation of node density across grid cells. Stop when CV < threshold (default 0.3).

This stage is critical for readability — without it, nodes cluster too tightly around the continent center, making individual nodes indistinguishable.

#### Stage 7 — Sphere Projection
The force-directed layout operates in 3D space but is constrained to the sphere surface. This stage finalizes the 3D coordinates:

```typescript
interface NodePosition {
  nodeId: string;
  position: [number, number, number]; // 3D coordinate on sphere surface
  continentId: string;
  angle: [number, number];            // Azimuth, inclination (for reference)
}
```

The projection is a simple normalization to sphere radius:
```
x = sphereRadius * sin(inclination) * cos(azimuth)
y = sphereRadius * cos(inclination)
z = sphereRadius * sin(inclination) * sin(azimuth)
```

#### Stage 8 — Road Topology Generation
For every graph edge, compute the visual path between its two node positions:

1. **Great circle arc**: The shortest path on a sphere between two points.
2. **Waypoints**: Subdivide the arc into segments (segment count based on edge weight — heavier edges get more waypoints for smoother curves).
3. **Elevation modulation**: Slightly perturb waypoint altitude above the sphere surface (sinusoidal modulation) to create visual road elevation. Amplitude based on edge weight.
4. **Output**: Series of 3D points along the sphere surface forming the road geometry.

```typescript
interface RoadSegment {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  path: [number, number, number][];  // 3D waypoints on sphere
  width: number;                       // Based on edge weight (0.1–2.0)
  curvature: number;                   // Perturbation amplitude for visual variety
}
```

### 4.4 Core Types

```typescript
// core/layout-engine/types.ts

interface LayoutConfig {
  seed: number;
  sphereRadius: number;
  
  // Force-directed parameters
  repulsionStrength: number;     // Default: 100
  attractionStrength: number;    // Default: 0.1
  gravityStrength: number;       // Default: 0.01
  maxIterations: number;         // Default: 500
  coolingRate: number;           // Default: 0.95
  
  // Continent clustering parameters
  minContinentSize: number;      // Minimum nodes per continent. Default: 3
  maxContinents: number;         // Maximum continents. Default: 7
  
  // Collision avoidance parameters
  minNodeSpacing: number;        // Minimum angular distance. Default: 0.05 rad
  collisionMaxIterations: number;// Default: 50
  
  // Density balancing parameters
  densityGridResolution: number; // Grid cells per continent. Default: 10×10
  densityThreshold: number;      // Coefficient of variation target. Default: 0.3
  
  // Road parameters
  roadSegmentCount: number;      // Waypoints per road. Default: 20
  roadElevationAmplitude: number;// Default: 0.02 × sphereRadius
}

interface LayoutOutput {
  seed: number;
  graphId: string;
  
  // Node positions (one per GraphNode)
  positions: Map<string, NodePosition>;
  
  // Continent metadata
  continents: Continent[];
  
  // Road geometry (one per GraphEdge)
  roads: RoadSegment[];
  
  // Spatial metrics (for debugging and quality assessment)
  metrics: {
    totalEdgeLength: number;         // Sum of all road distances
    averageNodeDistance: number;     // Mean distance between connected nodes
    clusterSeparation: number;       // Minimum distance between continents
    densityVariance: number;         // Coefficient of variation of density
    collisionCount: number;          // Remaining collisions (should be 0)
    convergenceIterations: number;   // Actual iterations used
  };
}
```

### 4.5 Design Rationale

**Why force-directed layout on a sphere instead of 2D plane?**
A sphere eliminates edge effects (nodes don't have a "border" to cluster against), naturally groups continents on opposite sides, and provides a more visually engaging 3D world. However, force-directed placement on a sphere is computationally more expensive due to geodesic distance calculations. For very large graphs (>1000 nodes), a hybrid approach is used: cluster in 2D first, then project each cluster to a distinct region on the sphere.

**Why community detection before force-directed placement?**
Pure force-directed placement can get stuck in local minima where continents overlap or are poorly separated. By pre-computing communities and initializing positions within continent boundaries, we give the force-directed algorithm a much better starting point, reducing iterations by ~60% and producing more readable layouts.

**Why 8 separate stages instead of a single algorithm?**
Each stage addresses a specific constraint (topology, separation, collision, density, readability). A single algorithm that optimizes all constraints simultaneously is complex to tune and debug. Sequential stages with well-defined interfaces enable:
- Independent testing and validation of each constraint
- Early termination if any stage fails (with meaningful error context)
- Swapping individual algorithm implementations without affecting other stages
- Progressive refinement that is observable and debuggable

**Why road topology is computed last?**
Road paths depend on final node positions. Computing roads earlier would require re-computation after collision avoidance and density balancing modify positions. Since road computation is O(E × segments) where E = edges, it is intentionally deferred to avoid redundant work.

### 4.6 Integration with World Generator

The Layout Engine produces `LayoutOutput` which the World Generator consumes:

```
LayoutOutput
├── positions       → WorldGenerator.cityPlanner(nodeId → 3D position)
├── continents      → WorldGenerator.biomeAssigner(continent → biome)
├── roads           → WorldGenerator.roadNetwork(edgeId → road geometry)
└── metrics         → WorldGenerator.qualityCheck(metrics → warn/retry)
```

The World Generator does **not** call the Layout Engine directly. Instead, the pipeline is:

1. AI produces GraphData
2. Graph Engine validates and computes metadata
3. Graph Engine calls `inferHierarchyLevel()` for each node
4. Layout Engine consumes GraphData + seed → LayoutOutput
5. World Generator consumes GraphData + LayoutOutput + WorldRules → WorldConfig

This strict separation ensures that the Layout Engine can be tested, optimized, or replaced independently of world generation.

---

## 5. World Generation Pipeline

### 5.1 Design Philosophy

The World Generator is the central translator in the LifeSphere architecture. It consumes three inputs — GraphData (what to learn), LayoutOutput (where things go), and WorldRules (how to map) — and produces a single `WorldConfig` that describes the entire 3D world as a hierarchy of generic `WorldObject` instances.

**Key design constraints:**

| Constraint | Rationale |
|------------|-----------|
| No rendering logic | The World Generator produces pure data. It does not create meshes, materials, or shaders. All visual decisions are deferred to the Theme Engine and Renderer. |
| No spatial computation | The World Generator does not compute positions, paths, or clusters. It receives finalized spatial data from the Layout Engine. |
| Lossless graph traceability | Every `WorldObject` must be traceable back to its source `GraphNode` via `nodeId`. This enables the Progress System to update the world when a skill is completed. |
| Deterministic output | Same GraphData + same LayoutOutput + same WorldRules → identical WorldConfig every time. |
| Hierarchy depth | The World Generator constructs a tree of WorldObjects (continent → region → city → building → landmark) based on `inferHierarchyLevel()` from the Graph Engine. |

### 5.2 Pipeline Stages with Design Rationale

The World Generator processes graph → world in 5 sequential stages. Each stage is independently testable and swappable.

```
GraphData + LayoutOutput + WorldRules
    │
    ▼
┌─────────────────────────────┐
│ 1. Hierarchy Construction   │
│    (Graph topology →        │
│     WorldObject tree)       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Terrain Generation        │
│    (Graph density →         │
│     elevation map)          │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. City Planning             │
│    (GraphNode → City         │
│     with buildings)          │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Road Network              │
│    (GraphEdge → Road         │
│     geometry)                │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Biome & Progression       │
│    (Category → biome,        │
│     Status → visual state)   │
└─────────────┬───────────────┘
              │
              ▼
        WorldConfig
```

#### Stage 1 — Hierarchy Construction

**What it does**: Iterates over all GraphNodes, calls `graphEngine.inferHierarchyLevel()` for each, and constructs a tree of `WorldObject` instances. The root is a `WorldObject` of type `planet`, which contains continents, which contain regions, which contain cities, which contain buildings, which contain landmarks.

**Why this stage exists first**: Before we can place anything spatially, we need to know what each node represents in the world. A milestone skill at depth 1 with importance 10 should be a continent. A sub-skill at depth 4 with importance 2 should be a building. This classification informs every subsequent stage — terrain elevation (continents are higher), city size (more important nodes get larger cities), and biome assignment (different categories map to different biomes).

**Design tradeoff**: We could have stored `hierarchyLevel` on the GraphNode itself, which would simplify this stage. We chose not to because it would couple the graph to world generation. The graph should never know it's being rendered as a planet. Computing hierarchy on-the-fly keeps the graph clean and allows the World Generator to change its mapping strategy without modifying graph data.

**Algorithm**:
```typescript
function buildHierarchy(graph: GraphData, layout: LayoutOutput, rules: WorldRules): WorldObject {
  // 1. Classify each node
  const classifications = new Map<string, HierarchyLevel>();
  for (const node of graph.nodes.values()) {
    classifications.set(node.id, graphEngine.inferHierarchyLevel(node, graph));
  }
  
  // 2. Build tree: assign children to parents based on edge direction + hierarchy level
  const root = createWorldObject('planet', 'root', graph.title);
  const continents = new Map<string, WorldObject>();
  
  for (const node of graph.nodes.values()) {
    const level = classifications.get(node.id)!;
    const parent = findParent(node, classifications, graph, root, continents);
    const worldObject = createWorldObject(level, node.id, node.label);
    worldObject.nodeId = node.id; // Lossless traceability
    parent.children.push(worldObject);
  }
  
  return root;
}
```

#### Stage 2 — Terrain Generation

**What it does**: Generates the planet's surface elevation data (heightmap) based on continent positions from the Layout Engine and node density per continent. Continents with more nodes get larger landmasses. Higher-importance nodes get higher elevation (mountains vs plains).

**Why this stage exists second**: Terrain is the canvas on which everything else is painted. Cities are placed on terrain, roads traverse terrain, and biomes modulate terrain appearance. Generating terrain before cities ensures that city placement can account for elevation (cities prefer flat coastal areas, landmarks prefer hilltops).

**Design rationale for approach**: Using Perlin/Simplex noise seeded by the world seed produces natural-looking terrain deterministically. We modulate noise amplitude by continent importance — more important continents get more dramatic terrain (tall mountains, deep valleys) to visually convey their significance. This creates an implicit visual hierarchy that the user can perceive without reading labels.

**Key design decisions**:
- Heightmap resolution is adaptive: more nodes → higher resolution (more terrain detail). This prevents wasted computation on small graphs.
- Elevation is normalized to 0–1 range, with the Theme Engine responsible for mapping elevation to visual height. This keeps terrain data renderer-independent.
- Ocean basins are placed where no continent exists (at least `minContinentSpacing` radians from any continent center).

```typescript
interface TerrainConfig {
  heightMap: Float32Array;       // 2D heightmap (normalized 0–1)
  resolution: number;            // Adaptive based on node count
  noiseOctaves: number;          // Default: 6
  elevationScale: number;        // Normalized 0–1 (actual scale applied by Theme Engine)
  continentCount: number;        // Matches LayoutEngine continent count
}
```

#### Stage 3 — City Planning

**What it does**: For each GraphNode classified as a city (level 3) or higher, creates a `CityConfig` with position (from LayoutOutput), size (from difficulty × importance), and a set of buildings (from sub-skills).

**Why this stage exists third**: Cities depend on terrain (flat land is preferred) and hierarchy (a continent city is larger than a region city). By this stage we have both terrain data and hierarchy, so we can make informed decisions about city layout.

**Design rationale**: City size is computed as:
```
citySize = baseSize × (difficulty / 5) × (importance / 10)
```
This means a difficulty-5, importance-10 skill creates a city 10× larger than a difficulty-1, importance-1 skill. This creates a clear visual hierarchy where the user can instantly identify which skills are core vs. optional.

**Building generation**: Each sub-skill (children of the city node) becomes a building within the city. Building type is determined pseudorandomly from the city's biome palette (seeded by node ID). Building position within the city is arranged in a radial layout around the city center, with more important buildings closer to center.

```typescript
function generateCity(node: GraphNode, position: NodePosition, terrain: TerrainConfig, biome: BiomeConfig): CityConfig {
  const size = BASE_SIZE * (node.difficulty / 5) * (node.importance / 10);
  const buildings: BuildingConfig[] = [];
  
  // Arrange children as buildings in radial pattern
  const children = getChildNodes(node.id); // from hierarchy
  for (let i = 0; i < children.length; i++) {
    const angle = (2 * Math.PI * i) / children.length;
    const distance = size * 0.3 + (children[i].importance / 10) * size * 0.2;
    buildings.push({
      type: pickBuildingType(children[i], biome, prng),
      position: radialToPosition(angle, distance),
      scale: computeScale(children[i]),
      rotation: prng.next() * Math.PI * 2,
    });
  }
  
  return {
    nodeId: node.id,
    position: position.position,
    size,
    buildings,
    biome: biome.name,
    visualState: mapStatusToState(node.progress.status),
    completion: node.progress.status === 'completed' ? 1.0 : 0.0,
  };
}
```

#### Stage 4 — Road Network

**What it does**: For every GraphEdge, creates a `RoadConfig` using the pre-computed road path from LayoutOutput. Road width is proportional to edge weight. Road visual state is derived from the minimum completion status of its two endpoint nodes.

**Why this stage exists fourth**: Roads connect cities, and cities must exist before roads can connect them. Roads also depend on terrain (they should follow valleys rather than crossing mountains), but this optimization is deferred to the Layout Engine's road topology stage to keep the World Generator focused on data assembly, not spatial computation.

**Design rationale**: Road width = `edge.weight × MAX_WIDTH`. A prerequisite edge (weight 1.0) becomes a wide highway. A recommended edge (weight 0.3) becomes a narrow path. This gives the user an immediate visual sense of dependency strength.

**Road visual state logic**:
```typescript
function computeRoadState(source: CityConfig, target: CityConfig): RoadConfig['visualState'] {
  if (source.completion >= 1.0 && target.completion >= 1.0) return 'glowing';
  if (source.completion > 0 || target.completion > 0) return 'paved';
  return 'dirt';
}
```

#### Stage 5 — Biome & Progression Assignment

**What it does**: Assigns biome properties to each continent based on the categories of nodes within it. Computes progression state from the aggregate of all node completion statuses. This is the final stage because it needs access to all previously computed data (hierarchy, terrain, cities, roads) to produce consistent results.

**Why this stage exists last**: Biome assignment and progression are metadata layers that depend on fully resolved spatial and hierarchical data. Assigning biomes earlier would require re-computation when cities are placed or hierarchies change.

**Biome assignment algorithm**:
```
continentBiome = mode({node.category for node in continent.nodes})
```
The most common `SkillCategory` in a continent determines its biome. For example:
- `frontend` → Lush forest biome (green, vibrant, dense vegetation)
- `backend` → Mountain biome (grey, rocky, sparse vegetation)
- `devops` → Volcanic biome (red, black, minimal vegetation)
- `design` → Crystal biome (pastel, glowing, geometric vegetation)
- `data-science` → Tundra biome (white, blue, geometric structures)

**Progression computation**:
```typescript
function computeProgression(graph: GraphData, cities: CityConfig[]): ProgressionState {
  const completed = [...graph.nodes.values()].filter(n => n.progress.status === 'completed').length;
  const total = graph.nodes.size;
  
  return {
    overallCompletion: completed / total,
    unlockedRegions: [...graph.nodes.values()]
      .filter(n => n.progress.status !== 'locked')
      .map(n => n.category),
    activeConstructions: cities
      .filter(c => c.visualState === 'construction' || c.visualState === 'partial')
      .map(c => c.nodeId),
    weather: computeWeather(completed / total),
    timeOfDay: computeTimeOfDay(completed / total),
    specialEffects: completed / total >= 0.8 ? ['aurora', 'shooting-stars'] : [],
  };
}
```

**Design rationale**: Weather and time-of-day are derived from overall completion, not randomly assigned. This creates a visual narrative: the world starts in stormy darkness (0% complete) and progresses toward calm daylight (100% complete). The Theme Engine can interpret these settings differently per theme — "stormy" in fantasy means dark clouds, while in cyberpunk it means neon-lit rain.

### 5.3 WorldObject Hierarchy

The World Generator produces a tree of generic `WorldObject` instances. This is the core output type.

```typescript
// core/world-generation/types.ts

interface WorldObject {
  id: string;                    // Unique identifier
  nodeId: string;                // Back-reference to source GraphNode (empty for synthetic objects like terrain)
  label: string;                 // Human-readable name
  level: 'planet' | 'continent' | 'region' | 'city' | 'district' | 'building' | 'landmark';
  
  // Spatial
  transform: Transform3D;        // Position, rotation, scale
  children: WorldObject[];       // Recursive hierarchy
  
  // Visual (renderer-independent)
  visualType: VisualType;        // 'terrain' | 'water' | 'city' | 'road' | 'building' | 'vegetation' | 'atmosphere' | 'landmark'
  state: WorldObjectState;       // 'hidden' | 'locked' | 'available' | 'in-progress' | 'completed' | 'shining'
  
  // Metadata
  completion: number;            // 0.0 – 1.0
  difficulty: number;            // 1–5 (from GraphNode)
  importance: number;            // 1–10 (from GraphNode)
  biome: string;                 // Biome name (for Theme Engine)
  
  // Data
  data: Record<string, unknown>; // Extra data for specific types (heightmap for terrain, waypoints for roads, etc.)
}

interface Transform3D {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles
  scale: [number, number, number];
}

type VisualType = 
  | 'terrain' | 'water' | 'atmosphere'
  | 'city-base' | 'building' | 'road' | 'bridge'
  | 'vegetation' | 'landmark' | 'particle';

type WorldObjectState = 
  | 'hidden'    // Locked — not rendered at all
  | 'locked'    // Visible but obscured (fog, rubble, chains)
  | 'available' // Visible and interactive
  | 'in-progress' // Construction animation active
  | 'completed' // Fully built
  | 'shining';  // Completed + special effect (milestone)

interface WorldConfig {
  seed: number;
  planetRadius: number;
  root: WorldObject;             // The entire world as a recursive hierarchy
  progression: ProgressionState; // Aggregate progression data
}
```

**Design rationale for WorldObject as the universal type**: Every entity in the world — from a continent to a single blade of grass — is represented as a `WorldObject`. This uniform representation enables:
- The Renderer to process the hierarchy recursively with a single `WorldObjectRenderer` component
- The Theme Engine to apply visual overrides at any level (e.g., "all buildings in the Fantasy theme use thatched roofs")
- The Progress System to update any object by `nodeId` without knowing its type
- Future hierarchy changes (e.g., adding "planet" level) without modifying any rendering or generation code

### 5.4 Contrast with Previous Design

| Aspect | Previous Design | Current Design |
|--------|----------------|----------------|
| Output type | Flat WorldConfig with separate arrays (cities[], roads[], biomes[]) | Single recursive WorldObject tree |
| Building types | Hardcoded enum with 7 types | Dynamic — biome + theme determine building mesh |
| Progression | Separate ProgressionState | Encoded in each WorldObject.state |
| Renderer contract | Fixed component per type (City.tsx, Road.tsx, etc.) | Single recursive WorldObjectRenderer.tsx |
| Terrain data | Float32Array heightmap | WorldObject with visualType='terrain' and data.heightMap |

---

## 7. State Management (Zustand Stores)

### Store Architecture

```typescript
// === Graph Store ===
interface GraphStore {
  // State
  graphs: Map<string, GraphData>;
  activeGraphId: string | null;
  
  // Actions
  setGraph: (graph: GraphData) => void;
  addNode: (node: GraphNode) => void;
  updateNode: (id: string, partial: Partial<GraphNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  markComplete: (nodeId: string) => void;
  loadGraph: (id: string) => Promise<void>;
  saveGraph: () => Promise<void>;
}

// === World Store ===
interface WorldStore {
  // State
  worldConfig: WorldConfig | null;
  isGenerating: boolean;
  generationProgress: number;
  cameraTarget: string | null;    // Focus on a specific city
  
  // Actions
  generateWorld: (graph: GraphData) => WorldConfig;
  regenerateTerrain: () => void;
  focusOnCity: (cityId: string) => void;
  resetCamera: () => void;
  setWorldConfig: (config: WorldConfig) => void;
}

// === Progress Store ===
interface ProgressStore {
  // State
  totalHoursLogged: number;
  currentStreak: number;
  achievements: Achievement[];
  weeklyGoal: number;
  
  // Actions
  logTime: (nodeId: string, minutes: number) => void;
  completeSkill: (nodeId: string) => void;
  checkAchievements: () => Achievement[];
  setWeeklyGoal: (hours: number) => void;
}

// === UI Store ===
interface UIStore {
  // State
  activePanel: 'none' | 'graph' | 'progress' | 'coach' | 'settings';
  isOnboarding: boolean;
  showMinimap: boolean;
  theme: 'light' | 'dark' | 'planet';
  
  // Actions
  openPanel: (panel: string) => void;
  closePanel: () => void;
  toggleMinimap: () => void;
  setTheme: (theme: string) => void;
}

// === Auth Store ===
interface AuthStore {
  // State
  user: User | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  signup: (data: SignupData) => Promise<void>;
}
```

### Store Interaction Rules

```
UI Component
    │
    ├── reads from → Store (useStore selector)
    │
    ├── dispatches → Store action
    │       │
    │       ▼
    │   Store action calls → Core service (e.g., graph-engine)
    │       │
    │       ▼
    │   Store updates state
    │       │
    │       ▼
    └── React re-renders
```

**No store calls another store directly.** Cross-store communication happens through React components or a thin orchestrator layer.

---

## 8. Rendering Pipeline

### Scene Graph Structure

```
<Canvas>                          // R3F Canvas
  ├── <WorldCamera />             // OrbitControls + custom logic
  ├── <ambientLight />
  ├── <directionalLight />
  │
  ├── <PlanetGroup>               // Rotating planet
  │   ├── <Terrain />             // SphereGeometry with heightmap
  │   ├── <Water />               // Animated water shader
  │   │
  │   ├── <CityGroup>             // For each city in WorldConfig
  │   │   ├── <City />            // City base platform
  │   │   ├── <Building />        // Multiple buildings
  │   │   ├── <ConstructionEffect /> // If in progress
  │   │   └── <GlowEffect />      // If completed
  │   │
  │   ├── <RoadGroup>             // For each road
  │   │   └── <Road />            // Curved tube geometry
  │   │
  │   └── <VegetationGroup>       // Trees, grass patches
  │       └── <Tree />            // Instanced mesh
  │
  ├── <Atmosphere />              // Sky dome, clouds
  ├── <ParticleSystem />          // Stars, dust, magic effects
  └── <PostProcessing />          // Bloom, DOF, color grading
```

### Rendering Rules

1. **Every R3F component reads from `world-store`** — never directly from `graph-store`.
2. **WorldConfig is the single source of truth for the scene.**
3. **Animations are triggered by state changes** — components subscribe to specific world config properties.
4. **No business logic in R3F components** — all computation happens in generators.
5. **Instanced meshes** for repeated geometry (trees, small buildings) for performance.

### Animation System

```typescript
// Animation triggers based on state changes
const ANIMATION_TRIGGERS = {
  'skill-completed': {
    target: 'city',
    effect: 'construction-complete',
    duration: 2.0,
    easing: 'power3.out',
  },
  'skill-unlocked': {
    target: 'city',
    effect: 'reveal',
    duration: 1.5,
    easing: 'expo.out',
  },
  'milestone-reached': {
    target: 'planet',
    effect: 'atmosphere-flash',
    duration: 3.0,
    easing: 'elastic.out',
  },
  'graph-generated': {
    target: 'planet',
    effect: 'big-bang',
    duration: 5.0,
    easing: 'power4.inOut',
  },
};
```

---

## 9. AI Integration

### Flow

```
User Input: "Become a Frontend Developer"
    │
    ▼
┌─────────────────────┐
│  Prompt Builder     │
│  (Structured prompt │
│   with examples)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  AI Service         │
│  (LLM API call)     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Response Parser    │
│  (JSON → GraphData) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Graph Validator    │
│  (GraphEngine)      │
└─────────┬───────────┘
          │
          ▼
    GraphStore.setGraph()
```

### Prompt Template Structure

```typescript
interface AIPrompt {
  system: string;      // System prompt defining the AI's role
  examples: Example[]; // Few-shot examples
  userGoal: string;    // The user's learning goal
  constraints: {
    maxNodes: number;
    maxDepth: number;
    categories: SkillCategory[];
  };
}
```

### Response Format

```typescript
interface AIGraphResponse {
  title: string;
  description: string;
  estimatedTotalHours: number;
  nodes: Array<{
    id: string;
    label: string;
    type: NodeType;
    category: SkillCategory;
    description: string;
    difficulty: 1 | 2 | 3 | 4 | 5;
    estimatedHours: number;
    prerequisites: string[];  // Node IDs
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: EdgeType;
    weight: number;
  }>;
  rootNodeId: string;
  goalNodeId: string;
}
```

---

## 10. Project Roadmap

The MVP is scoped to exactly **8 systems**. Everything else is explicitly documented as Future Scope to prevent scope creep.

### MVP (Current)

| # | System | Deliverable | Dependencies |
|---|--------|-------------|--------------|
| 1 | **Graph Engine** | Core graph types (GraphNode, GraphEdge, GraphData), validation, topological sort, pathfinding, hierarchy inference | None |
| 2 | **Layout Engine** | 8-stage pipeline: seed init → topology analysis → continent clustering → force-directed placement → collision avoidance → density balancing → sphere projection → road topology | Graph Engine |
| 3 | **World Generator** | Hierarchy construction, terrain generation, city planning, road network, biome & progression assignment. Consumes GraphData + LayoutOutput + WorldRules → WorldConfig | Graph Engine, Layout Engine |
| 4 | **Theme Engine** | 5 themes (fantasy, cyberpunk, voxel, sci-fi, minimal). Converts WorldObject tree → themed visual config. Registry for theme lookup. | World Generator |
| 5 | **Renderer** | R3F scene with recursive WorldObjectRenderer, terrain/water/atmosphere shaders, camera controls, instanced meshes, LOD | Theme Engine |
| 6 | **Progress System** | Zustand store, time tracking, skill completion → WorldObject.state updates, construction animations, weekly goal tracking | Graph Engine |
| 7 | **Graph Editor** | React Flow canvas, custom SkillNode/DependencyEdge components, drag-and-drop editing, sync with Graph Store | Graph Engine |
| 8 | **AI Goal → Graph** | Prompt builder, LLM API client, response parser (JSON → GraphData), graph validator, fallback manual creation | Graph Engine |

### Build Order

```
Week 1-2:   Graph Engine + Layout Engine
Week 3-4:   World Generator + Theme Engine (basic)
Week 5-6:   Renderer (recursive WorldObjectRenderer)
Week 7-8:   Progress System + Animations
Week 9-10:  Graph Editor
Week 11-12: AI Integration + Polish
```

### Future Scope (Explicitly Out of MVP)

The following features are intentionally excluded from the MVP to maintain focus on the core pipeline. They are documented here for architectural awareness — the system is designed to accommodate them without restructuring.

| Feature | Architectural Impact | When to Add |
|---------|---------------------|-------------|
| **Auth System** | New store, login/signup pages, session management | Post-MVP, when multi-user needed |
| **Cloud Persistence** | Sync engine between IndexedDB and Supabase | Post-MVP, when user data needs to survive device loss |
| **GitHub Integration** | New `core/integration/github/` module, webhook handlers | When commit → progress mapping is feasible |
| **LeetCode Integration** | New `core/integration/leetcode/` module, problem parsing | When specific platform integration is needed |
| **AI Coach** | Conversational UI, chat store, RAG pipeline, context management | Major feature — requires separate design doc |
| **Multiplayer** | WebSocket sync, shared world state, collaborative editing, presence | Major feature — requires separate design doc |
| **Achievement System** | New store, achievement definitions, badge rendering | Post-MVP gamification layer |
| **Mobile App** | React Native or PWA, touch controls, responsive layout | Post-MVP platform expansion |
| **Public API** | REST/gRPC endpoints, rate limiting, API keys, documentation | Post-MVP third-party integrations |
| **Analytics** | Event tracking, heatmaps, usage dashboards | Post-MVP product optimization |
| **AI Coach (Conversational)** | Chat interface, RAG pipeline, memory system | Post-MVP — complex feature dependency |

**Design note**: The folder structure in Section 2 reflects the MVP scope. Future features are NOT represented as empty directories or stubs. They will be added only when actively developed, following the same feature-module pattern established by the MVP systems.

---

## 11. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State Management | Zustand | Lightweight, TypeScript-friendly, no boilerplate |
| 3D Library | React Three Fiber | Declarative, React-native, good ecosystem |
| Animation | GSAP | Better timeline control than Framer Motion for 3D |
| Graph Editor | React Flow | Mature, customizable, handles DAGs well |
| AI | OpenAI API + custom prompts | Flexible, can swap models later |
| Styling | Tailwind CSS | Utility-first, fast iteration, small bundle |
| Persistence | IndexedDB (local) + Supabase (cloud) | Offline-first, scalable backend |
| Build | Next.js App Router | SSR, API routes, file-based routing |

---

## 12. Performance Considerations

- **Instanced meshes** for trees, small buildings, particles
- **LOD (Level of Detail)** — reduce polygon count for distant cities
- **Frustum culling** — don't render objects behind the planet
- **Texture atlases** — single texture for all building types
- **Worker threads** — terrain generation off the main thread
- **Debounced world regeneration** — don't regenerate on every keystroke
- **Memoized selectors** — prevent unnecessary re-renders in R3F

---

## 13. Error Handling Strategy

```
Layer              Error Type              Handling
──────────────────────────────────────────────────────────
AI Layer           Invalid response        Retry with fallback prompt
                   Rate limiting           Queue + exponential backoff
                   Timeout                 Show cached/default graph

Graph Engine       Cycle detected          Auto-fix by removing weakest edge
                   Orphan nodes            Warn user, offer auto-connect
                   Invalid graph           Show validation UI

World Generation   Invalid config          Fall back to default biome
                   Missing node            Skip city, log warning
                   Performance budget      Reduce LOD, simplify geometry

Rendering          WebGL context loss      Show fallback 2D view
                   Low FPS                 Auto-reduce quality
                   Memory pressure         Dispose unused geometries
```

---

## 14. Testing Strategy

```
Unit Tests (Jest)
├── core/graph/*.test.ts
├── core/world-generation/*.test.ts
├── core/ai/*.test.ts
└── shared/utils/*.test.ts

Integration Tests (Jest + RTL)
├── features/onboarding/*.test.tsx
├── features/graph-editor/*.test.tsx
└── features/progress/*.test.tsx

E2E Tests (Playwright)
├── onboarding-flow.spec.ts
├── world-interaction.spec.ts
└── graph-editing.spec.ts

Visual Regression (Storybook + Chromatic)
├── shared/components/*.stories.tsx
├── features/world/components/*.stories.tsx
└── features/graph-editor/components/*.stories.tsx
```

---

## 15. Extensibility Points

| Extension Point | How to Add |
|-----------------|------------|
| New biome | Add to `BiomeConfig` + `biome-assigner.ts` |
| New building type | Add to `BuildingConfig.type` + `building-blueprints.ts` |
| New integration | Add to `core/integration/` + create store |
| New animation | Add to `ANIMATION_TRIGGERS` + create GSAP timeline |
| New AI model | Implement `AIService` interface |
| Multiplayer | Add WebSocket sync in `core/integration/multiplayer/` |
| Mobile | Responsive Tailwind + touch controls in `WorldCamera` |
