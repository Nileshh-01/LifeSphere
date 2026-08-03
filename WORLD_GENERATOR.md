# World Generator — Architecture Design

**Status**: Design Only  
**Sprint**: MVP System #3  
**Dependencies**: Graph Engine (System #1), Layout Engine (System #2)  
**Consumed By**: Theme Engine (System #4)  

---

## 1. Responsibilities

### 1.1 Inputs

| Input | Type | Source | Description |
|-------|------|--------|-------------|
| LayoutOutput | `LayoutOutput` | Layout Engine | Node positions, continents, roads, metrics |
| WorldRules | Static mapping rules | WORLD_RULES.md | Logical mapping: GraphNode → WorldObject properties |
| GraphData | `GraphData` | Graph Engine | (Accessed via node IDs in LayoutOutput) |

The World Generator accesses GraphData indirectly — it receives node IDs from LayoutOutput and queries the original graph for node-level properties (difficulty, importance, category, type, progress status, etc.).

### 1.2 Outputs

| Output | Type | Consumer | Description |
|--------|------|----------|-------------|
| WorldScene | `WorldScene` | Theme Engine | Complete hierarchical world data |

### 1.3 Ownership

The World Generator owns:

- **Hierarchy construction** — Converts flat graph topology into a recursive WorldObject tree (planet → continents → cities → districts → buildings → landmarks).
- **Object property computation** — Applies WORLD_RULES mappings to derive WorldObject properties from GraphNode properties (e.g., city size from difficulty, building count from estimatedHours, vegetation density from XP).
- **Spatial layout refinement** — Uses LayoutOutput positions as anchors, then computes object-scale positioning (building arrangement within a city, landmark elevation, vegetation distribution).
- **State propagation** — Computes each WorldObject's visual state (hidden, locked, in-progress, completed, shining) based on GraphNode progress status and WORLD_RULES §8 monotonic state rules.
- **Construction ordering** — Assigns build queue priority based on GraphNode.priority and dependency resolution.

### 1.4 Non-Ownership

The World Generator explicitly does NOT own:

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Graph validation | Graph Engine | World Generator assumes valid, cycle-free graph |
| Hierarchy level inference | Graph Engine | `inferHierarchyLevel()` is a pure function on the graph |
| Spatial position computation | Layout Engine | World Generator receives finalized positions |
| Road path geometry | Layout Engine | Geodesic paths come from LayoutOutput |
| Visual styling | Theme Engine | Colors, materials, glow effects are rendering concerns |
| Mesh generation | Renderer | Three.js meshes, geometry, shaders |
| Animation timelines | Animation Engine | GSAP sequences for construction, transitions |
| Terrain heightmap | World Generator (owns) | But only as elevation data, not mesh |

---

## 2. Public API

```typescript
/**
 * World Generator — transforms LayoutOutput into a complete WorldScene.
 *
 * Stateless and deterministic: same LayoutOutput + same WorldRules → identical WorldScene.
 * The single entry point is `generate()`.
 */
interface WorldGenerator {
  /**
   * Generate a complete hierarchical WorldScene from layout data.
   *
   * @param layoutOutput - Positions, continents, roads from Layout Engine
   * @param config - Generation configuration (seasons, density, etc.)
   * @returns WorldScene - Complete hierarchical world ready for Theme Engine
   */
  generate(
    layoutOutput: LayoutOutput,
    config?: Partial<WorldGenerationConfig>,
  ): WorldScene;
}

/**
 * Configuration for world generation.
 * All values have sensible defaults.
 */
interface WorldGenerationConfig {
  /** Density multiplier for vegetation (0 = barren, 2 = lush). Default: 1.0 */
  vegetationDensity: number;
  /** Building density multiplier (0 = empty, 2 = crowded). Default: 1.0 */
  buildingDensity: number;
  /** Whether to show locked/hidden objects or skip them. Default: true */
  showLockedContent: boolean;
  /** Seasonal overlay: 'none' | 'spring' | 'summer' | 'autumn' | 'winter'. Default: 'none' */
  season: string;
  /** Randomization strength (0 = minimal jitter, 1 = full). Default: 0.5 */
  layoutJitter: number;
}

const DEFAULT_WORLD_GENERATION_CONFIG: WorldGenerationConfig = {
  vegetationDensity: 1.0,
  buildingDensity: 1.0,
  showLockedContent: true,
  season: 'none',
  layoutJitter: 0.5,
};
```

### 2.1 Usage

```
// Orchestrator (conceptual)
const layout = layoutEngine.generate(graph, seed);
const world = worldGenerator.generate(layout, { vegetationDensity: 1.2 });
const themedWorld = themeEngine.apply(world, 'fantasy');
renderer.render(themedWorld);
```

---

## 3. Core Data Structures

### 3.1 WorldScene

The top-level output of the World Generator. Contains the complete world as a recursive tree.

```typescript
/**
 * The complete generated world.
 * Single root node representing the planet, containing a recursive tree of WorldObjects.
 */
interface WorldScene {
  /** Metadata about this generation */
  metadata: {
    /** Seed used for generation */
    seed: number;
    /** Graph ID this world was generated from */
    graphId: string;
    /** ISO timestamp of generation */
    generatedAt: string;
    /** Version of the World Generator that produced this output */
    generatorVersion: string;
  };

  /** The root WorldObject (the planet itself) */
  root: WorldObject;

  /** Global progression data */
  progression: GlobalProgression;
}

/**
 * Global progression state derived from the entire graph.
 */
interface GlobalProgression {
  /** Overall completion percentage (0–100) */
  overallCompletion: number;
  /** Number of completed nodes */
  completedCount: number;
  /** Total number of nodes */
  totalCount: number;
  /** IDs of nodes currently in-progress */
  activeNodeIds: string[];
  /** IDs of milestone nodes that are completed (cause shine effect) */
  completedMilestoneIds: string[];
  /** Whether the final goal milestone is completed */
  goalCompleted: boolean;
}
```

### 3.2 WorldObject

The universal building block of the world. Every entity — planet, continent, city, building, road, tree, landmark — is a WorldObject.

```typescript
/**
 * A single object in the world hierarchy.
 * Every entity in the world is a WorldObject — there is no separate
 * class for cities, buildings, or landmarks.
 */
interface WorldObject {
  /** Unique identifier for this object */
  id: string;

  /** Back-reference to source GraphNode (empty for synthetic objects like terrain) */
  nodeId: string | null;

  /** Human-readable label */
  label: string;

  /** Type of world object */
  type: ObjectType;

  /** Spatial transform */
  transform: Transform;

  /** Visual state */
  state: WorldObjectState;

  /** Child objects (recursive hierarchy) */
  children: WorldObject[];

  /** Object-specific metadata */
  metadata: ObjectMetadata;

  /** Decoration/vegetation objects attached to this object */
  decorations: Decoration[];
}
```

### 3.3 ObjectType

```typescript
/**
 * Type of world object.
 * Determines how the Theme Engine and Renderer process this object.
 */
type ObjectType =
  // Core hierarchy (from graph)
  | 'planet'
  | 'continent'
  | 'region'
  | 'city'
  | 'district'
  | 'building'
  | 'landmark'

  // Infrastructure
  | 'road'
  | 'bridge'
  | 'tunnel'
  | 'sky-bridge'

  // Environment
  | 'terrain'
  | 'water'
  | 'atmosphere'

  // Decoration
  | 'vegetation'
  | 'rock'
  | 'cloud'
  | 'particle';
```

### 3.4 Transform

```typescript
/**
 * Spatial transform for a WorldObject.
 * Position, rotation, and scale in 3D space on the sphere surface.
 * All values are in world units relative to the sphere center.
 */
interface Transform {
  /** Position on/near the sphere surface (x, y, z) */
  position: [number, number, number];

  /** Rotation in Euler angles (radians) */
  rotation: [number, number, number];

  /** Scale (uniform or per-axis) */
  scale: [number, number, number];
}
```

### 3.5 WorldObjectState

```typescript
/**
 * Visual state of a world object.
 * Determines rendering behavior and animation triggers.
 * States are monotonic — they only move forward.
 */
type WorldObjectState =
  | 'hidden'       // Not rendered at all
  | 'locked'       // Visible but obscured (fog, chains, rubble overlay)
  | 'available'    // Visible and interactive
  | 'in-progress'  // Construction animation active
  | 'completed'    // Fully built, normal lighting
  | 'shining';     // Completed milestone with glow/aurora
```

### 3.6 ObjectMetadata

```typescript
/**
 * Type-specific metadata for a WorldObject.
 * Each ObjectType has its own metadata shape.
 */
interface ObjectMetadata {
  /** Difficulty (1–5). Affects visual detail level. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Importance (1–10). Affects scale and prominence. */
  importance: number;
  /** Estimated hours. Affects building density. */
  estimatedHours: number;
  /** XP reward. Affects vegetation density around this object. */
  estimatedXP: number;
  /** Priority (1–5). Affects construction order. */
  priority: 1 | 2 | 3 | 4 | 5;

  // Type-specific metadata (may be empty)
  data: Record<string, unknown>;
}
```

### 3.7 Decoration

```typescript
/**
 * A decorative element attached to a WorldObject.
 * Examples: trees around a city, rocks on terrain, clouds above a landmark.
 */
interface Decoration {
  /** Type of decoration */
  type: 'tree' | 'bush' | 'flower' | 'rock' | 'grass' | 'mushroom' | 'crystal';

  /** Position relative to the parent object */
  localPosition: [number, number, number];

  /** Scale */
  scale: number;

  /** Random rotation for variety */
  rotation: number;

  /** Color tint (applied by Theme Engine) */
  colorTint?: [number, number, number];
}
```

### 3.8 Road

```typescript
/**
 * A road connecting two world objects.
 * Roads are not WorldObjects — they sit alongside the hierarchy
 * and are rendered by the Theme Engine as a separate pass.
 */
interface Road {
  /** Unique identifier */
  id: string;
  /** Source object ID */
  sourceId: string;
  /** Target object ID */
  targetId: string;
  /** Edge type from graph */
  edgeType: 'prerequisite' | 'recommended' | 'related' | 'leads-to';
  /** Road width (world units) */
  width: number;
  /** Geodesic path waypoints */
  path: [number, number, number][];
  /** Visual state (derived from endpoint completion) */
  state: 'dirt' | 'paved' | 'glowing';
}
```

---

## 4. Recursive WorldObject Hierarchy

The World Generator produces a strictly nested tree of WorldObjects. The depth corresponds to graph hierarchy levels.

```
Planet (root, depth=0)
├── Continent (depth=1)
│   ├── Region (depth=2)
│   │   ├── City (depth=3)
│   │   │   ├── District (depth=4)
│   │   │   │   ├── Building (depth=5)
│   │   │   │   │   └── [decorations: trees, rocks]
│   │   │   │   └── Building
│   │   │   └── District
│   │   └── City
│   ├── Region
│   └── City (no region level if continent has <5 nodes)
└── Continent
    └── ...
```

### 4.1 Hierarchy Construction Rules

| Graph Hierarchy Level | WorldObject Type | Depth | Parent Type |
|-----------------------|-----------------|-------|-------------|
| — (synthetic) | planet | 0 | null (root) |
| continent | continent | 1 | planet |
| region | region | 2 | continent |
| city | city | 3 | continent or region |
| district | district | 4 | city |
| building | building | 5 | district |
| landmark | landmark | 5 | city (placed at edge or elevation) |
| decoration | — (merged) | — | Attached as decorations to parent |

### 4.2 Node-Level Simplification

Not every GraphNode becomes a WorldObject in the tree. Some are absorbed into their parent:

| GraphNode Type | World Representation |
|----------------|---------------------|
| `milestone` | Continent or region WorldObject |
| `skill` | City or district WorldObject |
| `sub-skill` | Building WorldObject |
| `project` | Landmark WorldObject |
| `resource` | No WorldObject. Instead, 1–3 decorations added to parent |

This matches WORLD_RULES.md — resources become decorations, not structural elements.

---

## 5. Mapping Rules: Graph → World

| Graph Property | → | World Property | Formula / Rule | Source |
|----------------|---|----------------|----------------|--------|
| `type` + depth + children | → | Hierarchy level | `inferHierarchyLevel()` from Graph Engine | WORLD_RULES §1 |
| `type` + `importance` | → | `ObjectType` | See §5.1 below | WORLD_RULES §1 |
| `category` | → | Continent biome hint | `continent.dominantCategory` | WORLD_RULES §2 |
| `difficulty` | → | `scale` multiplier | `baseScale × (difficulty / 5) × (importance / 10)` | WORLD_RULES §4, §9 |
| `importance` | → | Prominence | Inner ring for importance ≥ 8, outer ring for ≤ 4 | WORLD_RULES §5 |
| `estimatedHours` | → | Building count | `min(buildings, ceil(estimatedHours / 5))` | WORLD_RULES §4 |
| `estimatedXP` | → | Vegetation density | `sqrt(estimatedXP) × 0.1` radius | WORLD_RULES §7 |
| `priority` | → | Construction order | Lower number = built first | WORLD_RULES §12 |
| `progress.status` | → | `WorldObjectState` | See §5.2 below | WORLD_RULES §8 |
| `type: 'project'` | → | Landmark | Scale + glow radius from difficulty + importance | WORLD_RULES §6 |
| `type: 'resource'` | → | Decorations | 1–3 decorations attached to parent | WORLD_RULES §1 |
| `edge.weight` | → | Road width | `0.1 + weight × 1.9` | WORLD_RULES §11 |
| `edge.type` | → | Road structure | prerequisite→bridge, recommended→tunnel, etc. | WORLD_RULES §11 |

### 5.1 ObjectType Assignment

```typescript
function mapHierarchyToObjectType(hierarchyLevel: HierarchyLevel): ObjectType {
  switch (hierarchyLevel) {
    case 'continent': return 'continent';
    case 'region':    return 'region';
    case 'city':      return 'city';
    case 'district':  return 'district';
    case 'building':  return 'building';
    case 'landmark':  return 'landmark';
    case 'decoration': return 'building'; // Resources become tiny buildings
  }
}
```

### 5.2 State Assignment (Monotonic)

```typescript
function mapStatusToState(
  status: NodeStatus,
  isMilestone: boolean,
  parentState: WorldObjectState,
): WorldObjectState {
  // If parent is hidden, this object is also hidden
  if (parentState === 'hidden') return 'hidden';

  switch (status) {
    case 'locked':
      return 'hidden';
    case 'available':
      return 'locked';
    case 'in-progress':
      return 'in-progress';
    case 'completed':
      return isMilestone ? 'shining' : 'completed';
  }
}
```

### 5.3 Scale Computation

```typescript
function computeScale(
  difficulty: number,
  importance: number,
  objectType: ObjectType,
): [number, number, number] {
  const DIFFICULTY_MULTIPLIERS = [0, 0.5, 0.75, 1.0, 1.5, 2.5];

  // Base scale depends on object type
  const baseScale: Record<ObjectType, number> = {
    continent: 3.0, region: 2.0, city: 1.5, district: 1.0,
    building: 0.5, landmark: 0.8,
    // Non-hierarchy types have fixed base
    planet: 1.0, terrain: 1.0, water: 1.0, atmosphere: 1.0,
    road: 1.0, bridge: 1.0, tunnel: 1.0, skyBridge: 1.0,
    vegetation: 0.1, rock: 0.05, cloud: 0.3, particle: 0.01,
  };

  const diffMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] ?? 1.0;
  const impMultiplier = importance / 10;
  const base = baseScale[objectType] ?? 1.0;
  const scale = base * diffMultiplier * impMultiplier;

  return [scale, scale, scale];
}
```

---

## 6. Generation Pipeline

The World Generator processes LayoutOutput → WorldScene through **7 sequential stages**. Each stage operates on a growing WorldObject tree, refining and enriching it.

```
LayoutOutput + WorldGenerationConfig
         │
         ▼
┌──────────────────────────────────┐
│ 1. Create Root World             │  ← Create planet node
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 2. Generate Continents           │  ← One per layout continent
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 3. Generate Cities               │  ← One per city-level graph node
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 4. Generate Districts            │  ← Subdivisions within cities
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 5. Generate Buildings            │  ← One per sub-skill / leaf node
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 6. Generate Landmarks            │  ← Projects → special objects
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 7. Compute Decorations + Roads   │  ← Vegetation, roads, state
└──────────────┬───────────────────┘
               │
               ▼
         WorldScene
```

### Stage 1 — Create Root World

**Purpose**: Create the planet root WorldObject and initialize global state.

**Process**:
```
1. Create root WorldObject:
   - id: "planet-{graphId}"
   - nodeId: null (synthetic)
   - label: graph.title
   - type: 'planet'
   - transform: { position: [0,0,0], rotation: [0,0,0], scale: [5,5,5] }
   - state: 'completed' (planet is always visible)
   - metadata: { difficulty: 1, importance: 10, ... }
   - children: []
   - decorations: []

2. Compute GlobalProgression from graph:
   - Iterate all nodes, count completed/locked/in-progress
   - Find completed milestones
   - Check if goal node is completed
```

**Output**: A WorldObject tree with a single planet root node. No children yet.

### Stage 2 — Generate Continents

**Purpose**: For each continent in LayoutOutput, create a continent WorldObject. Assign biome hints based on dominant category.

**Process**:
```
For each continent in layoutOutput.continents:
  1. Create continent WorldObject:
     - id: "continent-{continent.id}"
     - nodeId: null (aggregate — no single GraphNode maps to a continent)
     - label: continent.label
     - type: 'continent'
     - transform:
         position: sphericalToCartesian(continent.center, sphereRadius)
         rotation: [0, 0, 0]
         scale: computeScale(4, continent.importance, 'continent')
     - state: 'completed' (continents are always visible)
     - metadata: { difficulty: 4, importance: continent.importance, ... }
     - children: []

  2. Assign biome hint to continent (for Theme Engine):
     continent.metadata.data.biomeHint = continent.dominantCategory

  3. Add continent as child of planet root.

  4. Set continent.center on metadata for road endpoint reference.
```

**Output**: Planet root with N continent children. Continents positioned at their assigned centers on the sphere surface.

### Stage 3 — Generate Cities

**Purpose**: For each city-level GraphNode, create a city WorldObject within its parent continent.

**Process**:
```
For each node in graph where hierarchyLevel = 'city':
  1. Look up node position from layoutOutput.positions
  2. Determine parent continent (continent containing this position)
  3. Find the continent WorldObject
  4. Create city WorldObject:
     - id: "city-{node.id}"
     - nodeId: node.id  (traceable to graph)
     - label: node.label + computeSuffix(node)
     - type: 'city'
     - transform:
         position: layoutPos.position
         rotation: [0, prng.range(0, 2π), 0]  (random yaw)
         scale: computeScale(node.difficulty, node.importance, 'city')
     - state: mapStatusToState(node.progress.status, node.type === 'milestone', parentState)
     - children: []

  5. Add to parent continent's children array.

  6. Compute city name suffix per WORLD_RULES §4:
     - milestone → "{Label} Capital"
     - skill → "{Label} Borough"
     - difficulty ≥ 4 → add "Citadel"
     - importance ≥ 8 → add "Grand" prefix

  7. If continent has < 5 nodes, skip region level and place city directly under continent.
```

### Stage 4 — Generate Districts

**Purpose**: Districts are optional subdivisions of cities. Created only if a city has many children.

**Process**:
```
For each city WorldObject:
  buildingChildren = nodes where parentId = city's nodeId and hierarchyLevel = 'district'

  If buildingChildren.length >= 3:
    group buildings into 1–3 districts based on spatial proximity.

    For each district:
      1. Create district WorldObject:
         - id: "district-{city.id}-{i}"
         - type: 'district'
         - transform: interpolated position between its buildings
         - state: derived from most-completed child building
      2. Add city's buildings as children of this district.

  Else:
    No districts — buildings are direct children of the city.
```

**Design note**: Districts are an optimization for visual clustering, not a strict graph concept. A city with 2 buildings doesn't need districts. A city with 20 buildings benefits from 3–4 districts for organizational clarity in the 3D world.

### Stage 5 — Generate Buildings

**Purpose**: For each building-level GraphNode, create a building WorldObject within its parent district or city.

**Process**:
```
For each node in graph where hierarchyLevel = 'building' or 'decoration':
  1. Look up position from layoutOutput.positions
  2. Determine parent (city or district) from hierarchy
  3. Compute building position:
     - Use layout position as anchor
     - Apply radial offset within the parent city:
       - Importance 8–10: inner ring
       - Importance 5–7: middle ring
       - Importance 1–4: outer ring
     - Angle: evenly distributed among siblings

  4. Compute building properties:
     - height: difficulty * baseHeight
     - footprint: importance * baseFootprint
     - floors: difficulty

  5. Create building WorldObject:
     - id: "building-{node.id}"
     - nodeId: node.id
     - label: node.label
     - type: 'building'
     - transform:
         position: computed position
         rotation: [0, prng.range(0, 2π), 0]
         scale: computeScale(node.difficulty, node.importance, 'building')
     - state: mapStatusToState(...)

  6. Add to parent's children array.
```

### Stage 6 — Generate Landmarks

**Purpose**: Projects and high-importance milestones become landmarks — visually prominent objects visible from distance.

**Process**:
```
For each node in graph where hierarchyLevel = 'landmark':
  1. Look up position from layoutOutput.positions
  2. Find parent city WorldObject
  3. Compute landmark position:
     - If terrain elevation data available: place on highest nearby point
     - Otherwise: place at city edge, 30° offset from city center

  4. Compute landmark properties:
     - scale: difficulty * 2.5 × baseScale
     - glowRadius: importance * 0.5

  5. Create landmark WorldObject:
     - id: "landmark-{node.id}"
     - nodeId: node.id
     - type: 'landmark'
     - state: mapStatusToState(...)
     - metadata.data.glowRadius: computed value
     - metadata.data.raised: true (flag for Renderer to elevate)

  6. Add to parent city's children array.
```

### Stage 7 — Compute Decorations + Roads

**Purpose**: Final pass to add vegetation, decorations, and compute road visual states.

**Process**:
```
1. For each city/district/building WorldObject:
   a. Compute vegetation density from parent node's estimatedXP
   b. Generate decorations:
      - Trees: density * 0.5 trees per XP/100
      - Bushes: density * 0.3 per XP/100
      - Rocks: density * 0.1 per XP/100
   c. Distribute decorations around parent with radial falloff:
      - Closer to center: fewer trees, more structured
      - Farther from center: more trees, wild growth
   d. Add decorations to parent's decorations array

2. For each edge in layoutOutput (empty in MVP):
   a. Look up source and target node positions
   b. Compute road visual state:
      - Both endpoints 'completed' or 'shining' → 'glowing'
      - Any endpoint 'in-progress' → 'paved'
      - Otherwise → 'dirt'
   c. Add to WorldScene.roads array

3. Compute GlobalProgression:
   - Finalize percentages, active node list, milestone list

4. Validate WorldScene:
   - Every GraphNode has a corresponding WorldObject
   - All positions are valid (no NaN, no null)
   - State propagation is consistent (no child in 'completed' when parent is 'hidden')
```

**Output**: Complete WorldScene ready for Theme Engine.

---

## 7. Deterministic Generation

### 7.1 Determinism Sources

The World Generator uses the **same seed** as the Layout Engine (derived from `LayoutOutput.seed`). All stochastic decisions use a SeededRandom instance initialized from this seed.

| Decision | PRNG Usage | Determinism Guarantee |
|----------|-----------|----------------------|
| Building yaw rotation | `prng.range(0, 2π)` | Same seed → same rotation |
| Decoration placement | `prng.range()` for position offsets | Same seed → same arrangement |
| Landmark placement angle | `prng.range()` for edge offset | Same seed → same offset |
| Vegetation distribution | `prng.range()` for radial position | Same seed → same distribution |
| Building count variation | Deterministic from `estimatedHours` | No randomness — pure formula |

### 7.2 Seed Flow

```
User Seed (e.g., 42)
    │
    ▼
Layout Engine: SeededRandom(42)
    │
    ├── Forces layout positions (deterministic)
    │
    ▼
LayoutOutput.seed = 42
    │
    ▼
World Generator: SeededRandom(42)
    │
    ├── Building rotations
    ├── Decoration positions
    ├── Landmark offsets
    └── Vegetation distribution
```

### 7.3 Reproducibility Guarantee

Given the same LayoutOutput and config, the World Generator guarantees:

1. Same number of WorldObjects at each hierarchy level
2. Same transforms (position, rotation, scale) for every WorldObject
3. Same state for every WorldObject
4. Same decoration count, type, and position for every parent
5. Same road visual states
6. Same GlobalProgression values
7. Same decorations array order (sorted by type then position)

This holds across JavaScript runtimes, OS platforms, and CPU architectures.

---

## 8. Extensibility

### 8.1 Future Procedural Meshes

The World Generator does not generate meshes. Instead it provides `ObjectMetadata.data` with parameters that the Renderer uses to generate procedural geometry:

```typescript
// Future: WorldGenerator provides shape hints
building.metadata.data = {
  shapeHint: 'cylindrical' | 'rectangular' | 'spherical' | 'pyramidal',
  floors: 5,
  hasRoof: true,
  windowDensity: 0.3,
  colorPalette: ['#4a7c59', '#2d5a3d'],
};
```

The Renderer reads these hints and generates corresponding Three.js geometry. New shapes can be added without modifying the World Generator.

### 8.2 Biomes

Biomes are implemented in the Theme Engine, not the World Generator. However, the World Generator provides biome hints per continent:

```typescript
continent.metadata.data.biomeHint = 'frontend'; // SkillCategory
```

The Theme Engine maps these hints to actual biome definitions (colors, vegetation types, terrain textures, lighting). A new biome can be added by:
1. Defining it in the Theme Engine
2. No changes to World Generator or Graph Engine

### 8.3 Decorations

Decorations are generic — the World Generator specifies type, position, and scale. The Theme Engine determines the actual mesh:

| Decoration Type | Fantasy Theme | Cyberpunk Theme | Sci-Fi Theme |
|----------------|---------------|-----------------|--------------|
| `tree` | Oak tree | Neon data-spire | Holographic beacon |
| `bush` | Flowering shrub | Glitch bush | Nanite swarm |
| `rock` | Granite boulder | Concrete debris | Alloy fragment |
| `flower` | Rose | LED blossom | Plasma bloom |

New decoration types can be added by extending the `DecorationType` enum and implementing corresponding meshes in the Renderer.

### 8.4 Roads

Road data is stored in a flat array (`WorldScene.roads`), not in the WorldObject hierarchy. This allows the Theme Engine to render roads as a separate pass (e.g., tube geometry, ribbon trails, or particle streams).

```typescript
// Future: Additional road metadata
road.metadata = {
  trafficDensity: 0.3,  // 0–1, based on edge weight
  hasLights: true,       // true if both endpoints completed
  animationSpeed: 0.5,   // Speed of traffic particles
};
```

### 8.5 Rivers

Rivers are not part of the MVP. When added, they will be generated by the Terrain Generator (part of World Generator's domain) using:

```typescript
// Future: River data
interface RiverConfig {
  sourcePosition: [number, number, number];
  targetPosition: [number, number, number]; // Ocean
  width: number;
  meanderStrength: number;
  path: [number, number, number][];
}
```

Rivers are computed from terrain elevation data (lowest paths between continent centers and ocean). They are added as `WorldObject` with `type: 'water'` and stored in the root's children.

### 8.6 NPCs

NPCs (non-player characters) are future scope and will be stored as lightweight WorldObjects:

```typescript
// Future: NPC data
interface NPCData {
  npcType: 'builder' | 'guide' | 'merchant' | 'trainer';
  patrolPath: [number, number, number][];
  dialogue: string[];
  questItems: string[];
}
```

NPCs are generated by the World Generator based on node properties:
- Completed buildings → idle builder NPCs nearby
- Landmarks → guide NPCs providing hints
- High-importance cities → merchant NPCs

### 8.7 Weather

Weather is computed by the World Generator's progression system (Section 6, Stage 7) based on overall completion:

```typescript
// Weather settings in WorldScene.metadata
interface WorldWeather {
  /** Cloud coverage (0 = clear, 1 = overcast) */
  cloudCoverage: number;
  /** Precipitation intensity (0 = none, 1 = storm) */
  precipitation: number;
  /** Wind strength (0 = calm, 1 = gale) */
  windStrength: number;
  /** Time of day (0 = midnight, 0.5 = noon, 1 = midnight) */
  timeOfDay: number;
  /** Special effects */
  specialEffects: string[]; // 'aurora', 'shooting-stars', 'rainbow', etc.
}
```

Weather is deterministic from completion percentage. A world at 0% completion has stormy weather and midnight lighting. A world at 100% completion has clear skies, golden hour lighting, and aurora effects. Intermediate values interpolate linearly.

---

## 9. Separation from Other Systems

### 9.1 Separation from Layout Engine

| Concern | World Generator | Layout Engine |
|---------|----------------|---------------|
| Node positions | Reads from LayoutOutput.positions | Computes positions |
| Continent clusters | Creates continent WorldObjects | Computes cluster boundaries |
| Roads | Computes road visual state | Computes road geometry |
| Metrics | Uses metrics for quality checks | Computes metrics |
| Seed | Consumes same seed | Produces seed in output |

The World Generator never calls the Layout Engine. It receives fully computed LayoutOutput and works from that.

### 9.2 Separation from Theme Engine

| Concern | World Generator | Theme Engine |
|---------|----------------|--------------|
| Colors | Never assigned | Assigns color palettes from biome hints |
| Materials | Never assigned | Assigns materials from object type + theme |
| Meshes | Never generated | Generates Three.js geometry from metadata |
| Lighting | Never configured | Sets light colors, intensities |
| Particle systems | Never defined | Creates particle emitters from decoration data |

The World Generator produces abstract data only. Theme Engine is the first system that introduces visual concepts.

### 9.3 Separation from Renderer

| Concern | World Generator | Renderer |
|---------|----------------|----------|
| Three.js | Never imported | Core dependency |
| React | Never imported | Core dependency (R3F) |
| GSAP | Never imported | Core dependency |
| Scene graph | Never created | Creates R3F scene from WorldScene |
| Shaders | Never written | Writes/finds appropriate shaders |

The World Generator is a pure TypeScript module with no rendering dependencies.

---

## 10. Pipeline Orchestration (Conceptual)

```typescript
// Full pipeline orchestration (pseudo-architecture)
function generateWorld(graph: GraphData, seed: number): WorldScene {
  // Step 1: Graph Engine — validate and compute metadata
  const validation = validateGraphData(graph);
  if (!validation.valid) {
    throw new Error('Cannot generate world: graph is invalid');
  }

  // Step 2: Layout Engine — compute spatial layout
  const layout = new LayoutEngine().generate(graph, seed);

  // Step 3: World Generator — build WorldScene
  const world = new WorldGenerator().generate(layout, {
    vegetationDensity: 1.0,
    buildingDensity: 1.0,
    season: 'none',
  });

  return world;
}

// Rendering pipeline (conceptual)
function renderWorld(world: WorldScene, theme: string): void {
  // Step 4: Theme Engine — apply visual theme
  const themedWorld = themeEngine.apply(world, theme);

  // Step 5: Renderer — create Three.js scene
  renderer.render(themedWorld);
}
```

---

## 11. UML Diagrams

### 11.1 Component Diagram

```
┌─────────────┐     LayoutOutput     ┌──────────────────┐
│  Layout     │─────────────────────>│  WorldGenerator   │
│  Engine     │                      │                   │
└─────────────┘                      │  ┌─────────────┐  │
                                     │  │ Hierarchy   │  │
┌─────────────┐     GraphData        │  │ Constructor │  │
│  Graph      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│  └─────────────┘  │
│  Engine     │  (via node IDs)      │         │         │
└─────────────┘                      │         ▼         │
                                     │  ┌─────────────┐  │
┌─────────────┐     WORLD_RULES.md   │  │  Property   │  │
│  WorldRules │─────────────────────>│  │  Computer   │  │
│  (static)   │  (read at build)     │  └─────────────┘  │
└─────────────┘                      │         │         │
                                     │         ▼         │
                                     │  ┌─────────────┐  │
                                     │  │  Decorator  │  │
                                     │  │  Generator  │  │
                                     │  └─────────────┘  │
                                     │         │         │
                                     │         ▼         │
                                     │  ┌─────────────┐  │
                                     │  │  State      │  │
                                     │  │  Propagator │  │
                                     │  └─────────────┘  │
                                     └────────┬──────────┘
                                              │
                                         WorldScene
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │  Theme Engine    │
                                     └──────────────────┘
```

### 11.2 Sequence Diagram — Full Pipeline

```
User                    Graph Engine         Layout Engine      World Generator      Theme Engine
 │                          │                     │                   │                   │
 │  Start Goal              │                     │                   │                   │
 │─────────────────────────>│                     │                   │                   │
 │                          │                     │                   │                   │
 │                     GraphData                  │                   │                   │
 │<─────────────────────────│                     │                   │                   │
 │                          │                     │                   │                   │
 │  Generate World          │                     │                   │                   │
 │──────────────────────────────────────────────────────────────────>│                   │
 │                          │  LayoutOutput       │                   │                   │
 │                          │─────────────────────>                   │                   │
 │                          │                     │  LayoutOutput     │                   │
 │                          │                     │──────────────────>│                   │
 │                          │                     │                   │                   │
 │                          │                     │  1. Create Root   │                   │
 │                          │                     │  2. Continents    │                   │
 │                          │                     │  3. Cities        │                   │
 │                          │                     │  4. Districts     │                   │
 │                          │                     │  5. Buildings     │                   │
 │                          │                     │  6. Landmarks     │                   │
 │                          │                     │  7. Decorations   │                   │
 │                          │                     │                   │                   │
 │                          │                     │            WorldScene               │
 │                          │                     │──────────────────────────────────>│
 │                          │                     │                   │                   │
 │                          │                     │        ThemedWorldScene            │
 │                          │                     │                   │<──────────────────│
 │                          │                     │                   │                   │
 │<─────────────────────────────────────────────────────────────────────────────────────│
```

### 11.3 Class Diagram — WorldScene Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        WorldScene                                │
├─────────────────────────────────────────────────────────────────┤
│ - metadata: WorldMetadata                                        │
│ - root: WorldObject                                              │
│ - progression: GlobalProgression                                 │
│ - roads: Road[]                                                  │
└─────────────────────────────────────────────────────────────────┘
         │ 1
         │ contains
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        WorldObject                                │
├─────────────────────────────────────────────────────────────────┤
│ + id: string                                                     │
│ + nodeId: string | null                                          │
│ + label: string                                                  │
│ + type: ObjectType                                               │
│ + transform: Transform                                           │
│ + state: WorldObjectState                                        │
│ + children: WorldObject[]                                        │ 0..*
│ + metadata: ObjectMetadata                                       │
│ + decorations: Decoration[]                                      │ 0..*
└─────────────────────────────────────────────────────────────────┘
         │
         │ parent of
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  WorldObject (recursive)                                         │
│  - continent                                                    │
│    - region / city                                               │
│      - district                                                  │
│        - building                                                │
│          - decorations                                           │
│    - city (no region)                                            │
│      - building (no district)                                    │
│  - landmark (special)                                            │
│  - terrain / water / atmosphere (synthetic)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Comparison with Alternative Approaches

| Approach | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| **Recursive hierarchy** (chosen) | Clean tree, easy traversal, natural parent/child relationships | Deep nesting for large graphs | — |
| **Flat list with references** | Simple to store, easy to query | No natural hierarchy, harder to render recursively | Loses spatial organization |
| **ECS (Entity-Component-System)** | Flexible, extensible, good for games | Over-engineered for MVP, complex composition | Too much abstraction too early |
| **Direct graph → mesh** | Fastest path to visible output | No separation of concerns, impossible to theme | Violates architecture rules |

---

## Appendix B: State Transition Diagram

```
                ┌─────────┐
                │ HIDDEN  │
                └────┬────┘
                     │ Parent node status changes to 'available'
                     ▼
                ┌─────────┐
                │ LOCKED  │  ← Visible but obscured
                └────┬────┘
                     │ User starts learning
                     ▼
              ┌─────────────┐
              │ IN-PROGRESS │  ← Construction animation
              └──────┬──────┘
                     │ All sub-skills completed
                     ▼
              ┌───────────┐
              │ COMPLETED │  ← Fully built, normal state
              └─────┬─────┘
                    │ Is milestone node
                    ▼
              ┌───────────┐
              │  SHINING  │  ← Glow, aurora, celebration
              └───────────┘
```

States are monotonic — a WorldObject never transitions backward unless the parent state forces it (e.g., parent goes from 'completed' to 'hidden' — which in practice only happens if the graph is modified externally).

---

**End of WORLD_GENERATOR.md**

*This document defines the complete architecture for the World Generator system. It serves as the blueprint for implementation in Sprint MVP System #3. The design ensures clean separation from the Layout Engine (System #2) and Theme Engine (System #4), with the World Generator acting as the bridge between spatial layout and visual theming.*
