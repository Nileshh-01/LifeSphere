# Layout Engine — Design Document

**Status**: Design Only  
**Sprint**: MVP System #2  
**Dependencies**: Graph Engine (System #1)  
**Consumed By**: World Generator (System #3)

---

## 1. Responsibilities

### 1.1 Inputs

| Input | Type | Source | Description |
|-------|------|--------|-------------|
| GraphData | `Map<string, GraphNode>` + `GraphEdge[]` | Graph Engine | The knowledge graph to lay out spatially |
| LayoutConfig | `LayoutConfig` | Defaults / user override | Tuning parameters for the layout algorithm |
| Seed | `number` | User / system | Determinism anchor — same seed always produces identical output |

### 1.2 Outputs

| Output | Type | Consumer | Description |
|--------|------|----------|-------------|
| LayoutOutput | `LayoutOutput` | World Generator | Positions, continents, roads, metrics |

### 1.3 Ownership

The Layout Engine owns:

- **Spatial position assignment** — every GraphNode receives a deterministic 3D coordinate on the sphere surface.
- **Continent clustering** — topologically-related groups of nodes are identified and assigned to spatially distinct regions.
- **Road topology** — every GraphEdge is converted to a geodesic path between its endpoint positions.
- **Spatial quality metrics** — edge length, cluster separation, density variance, collision count.

### 1.4 Non-Ownership

The Layout Engine explicitly does NOT own:

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Graph validation | Graph Engine | Layout Engine assumes valid graph input |
| Hierarchy level inference | Graph Engine | `inferHierarchyLevel()` belongs to the domain layer |
| WorldObject construction | World Generator | The Layout Engine produces raw positions, not world entities |
| Biome assignment | World Generator | Biomes depend on skill categories, not spatial topology |
| Terrain generation | World Generator | Elevation maps are computed from hierarchy + density, not positions |
| Visual themes | Theme Engine | Colors, materials, and styles are rendering concerns |
| Rendering | Renderer (R3F) | No Three.js, no React, no meshes |

---

## 2. Data Model

### 2.1 LayoutConfig

```typescript
/**
 * Configuration parameters for the Layout Engine.
 * All values have sensible defaults — most users will only set `seed` and `sphereRadius`.
 */
interface LayoutConfig {
  /** Determinism seed. Same seed + same graph = identical layout. */
  seed: number;

  /** Radius of the sphere in world units. Default: 5 */
  sphereRadius: number;

  // ── Force-Directed Placement ──
  /** Repulsive force strength between all node pairs. Default: 100 */
  repulsionStrength: number;
  /** Attractive force strength along edges. Default: 0.1 */
  attractionStrength: number;
  /** Gravity toward continent center. Default: 0.01 */
  gravityStrength: number;
  /** Maximum force-directed iterations. Default: 500 */
  maxIterations: number;
  /** Temperature cooling rate per iteration (0–1). Default: 0.95 */
  coolingRate: number;

  // ── Continent Clustering ──
  /** Minimum nodes required to form a continent. Default: 3 */
  minContinentSize: number;
  /** Maximum number of continents. Default: 7 */
  maxContinents: number;

  // ── Collision Avoidance ──
  /** Minimum angular distance between nodes (radians). Default: 0.05 */
  minNodeSpacing: number;
  /** Maximum iterations for collision resolution. Default: 50 */
  collisionMaxIterations: number;

  // ── Density Balancing ──
  /** Grid resolution for density map (grid cells per continent). Default: 10 */
  densityGridResolution: number;
  /** Target coefficient of variation for density. Default: 0.3 */
  densityThreshold: number;

  // ── Road Topology ──
  /** Waypoint count per road segment. Default: 20 */
  roadSegmentCount: number;
  /** Road elevation amplitude as fraction of sphereRadius. Default: 0.02 */
  roadElevationAmplitude: number;
}
```

### 2.2 LayoutOutput

```typescript
/**
 * The complete output of the Layout Engine.
 * Every consumer (World Generator, debug visualizer, quality checker)
 * reads from this single structure.
 */
interface LayoutOutput {
  /** The seed used to produce this layout */
  seed: number;
  /** The graph ID this layout was computed from */
  graphId: string;

  /** Positions for every node in the graph */
  positions: Map<string, NodePosition>;

  /** Continent metadata */
  continents: Continent[];

  /** Road geometry for every edge */
  roads: RoadSegment[];

  /** Quality metrics for debugging and validation */
  metrics: LayoutMetrics;
}
```

### 2.3 NodePosition

Each node receives the following spatial data:

```typescript
interface NodePosition {
  /** The node ID this position corresponds to */
  nodeId: string;

  /** 3D coordinate on the sphere surface */
  position: [number, number, number]; // (x, y, z) normalized to sphereRadius

  /** Spherical coordinates for reference */
  spherical: {
    azimuth: number;     // θ (0–2π) — longitude
    inclination: number; // φ (0–π) — latitude from north pole
  };

  /** The continent this node belongs to */
  continentId: string;

  /** Hierarchy level inferred by Graph Engine */
  hierarchyLevel: HierarchyLevel;

  /** Depth from root node (number of edges in shortest path) */
  depth: number;

  /** Parent node ID (closest ancestor in graph topology) */
  parentId: string | null;

  /** Child node IDs (direct descendants) */
  childIds: string[];

  /** Cluster this node belongs to within its continent */
  clusterId: string;

  /** Layout metadata for debugging */
  metadata: {
    /** Number of force-directed iterations applied to reach this position */
    iterationsApplied: number;
    /** Total displacement during final iteration */
    finalDisplacement: number;
    /** Whether collision resolution touched this node */
    collisionResolved: boolean;
    /** Density of node's grid cell (nodes per cell area) */
    localDensity: number;
  };
}
```

**Design rationale for `NodePosition` structure:**

- `position` as a flat tuple rather than a Three.js Vector3 keeps the Layout Engine free of rendering dependencies.
- `spherical` coordinates are included because many World Generator calculations (biome boundaries, elevation gradients) are more naturally expressed in spherical space.
- `hierarchyLevel` is stored here (not on GraphNode) because it is computed by the Graph Engine and cached in the output for downstream consumers. The original GraphNode remains clean.
- `parentId` and `childIds` replicate graph topology in spatial context. This allows the World Generator to quickly determine which nodes are spatially related without re-querying the graph.
- `metadata` is purely diagnostic. It enables layout quality debugging without changing the algorithm.

### 2.4 Continent

```typescript
interface Continent {
  /** Unique continent identifier */
  id: string;

  /** Human-readable label (derived from most important node) */
  label: string;

  /** All node IDs belonging to this continent */
  nodeIds: string[];

  /** Center of the continent on the sphere (spherical coordinates) */
  center: {
    azimuth: number;
    inclination: number;
  };

  /** Aggregate importance of all nodes (determines landmass size) */
  importance: number;

  /** Angular radius on sphere surface (radians) */
  radius: number;

  /** Average depth of nodes in this continent */
  averageDepth: number;

  /** Dominant skill category (mode of node categories) */
  dominantCategory: string;
}
```

### 2.5 RoadSegment

```typescript
interface RoadSegment {
  /** The edge ID this road corresponds to */
  edgeId: string;

  /** Source node ID */
  sourceNodeId: string;

  /** Target node ID */
  targetNodeId: string;

  /** Geodesic path along sphere surface */
  path: [number, number, number][]; // 3D waypoints (includes elevation modulation)

  /** Road visual width (proportional to edge weight) */
  width: number;

  /** Curvature perturbation amplitude for visual variety */
  curvature: number;

  /** Number of waypoints in this path */
  waypointCount: number;
}
```

### 2.6 LayoutMetrics

```typescript
interface LayoutMetrics {
  /** Sum of all road geodesic distances */
  totalEdgeLength: number;
  /** Mean geodesic distance between connected node pairs */
  averageNodeDistance: number;
  /** Standard deviation of node distances */
  nodeDistanceStdDev: number;
  /** Minimum geodesic distance between continent boundaries */
  clusterSeparation: number;
  /** Coefficient of variation of node density across all grid cells */
  densityVariance: number;
  /** Number of remaining collisions (should be 0 for valid layouts) */
  collisionCount: number;
  /** Actual iterations used by force-directed placement */
  convergenceIterations: number;
  /** Whether the layout passed all quality checks */
  valid: boolean;
}
```

---

## 3. Deterministic Pipeline

The Layout Engine processes graph to positions through **7 sequential stages**. Each stage is a pure function: same inputs → same outputs. Stages cannot mutate shared state — they receive the previous stage's output and return new data.

```
GraphData + LayoutConfig
         │
         ▼
┌─────────────────────────┐
│ 1. Seed Initialization  │  ← Initialize seeded PRNG from LayoutConfig.seed
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Topology Analysis    │  ← Compute centrality, depth, clustering coefficient
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Continent Clustering │  ← Community detection → node → continent mapping
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Force-Directed       │  ← Spring-electric layout on sphere surface
│    Placement            │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. Collision Avoidance  │  ← Push apart overlapping nodes
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 6. Density Balancing    │  ← Evenly distribute within clusters
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 7. Road Topology        │  ← Compute geodesic paths for edges
└───────────┬─────────────┘
            │
            ▼
     LayoutOutput
```

### Stage 1 — Seed Initialization

**Purpose**: Create the single source of randomness for all stochastic decisions.

**Algorithm**: A seeded PRNG (xoshiro128**) is initialized from `LayoutConfig.seed`. The PRNG state is derived by passing the seed through splitmix32 to produce a well-distributed initial state.

```typescript
function initializePRNG(seed: number): PRNG {
  // splitmix32 seeds the xoshiro128** state
  const s0 = splitmix32(seed);
  const s1 = splitmix32(s0);
  const s2 = splitmix32(s1);
  const s3 = splitmix32(s2);
  return xoshiro128starstar(s0, s1, s2, s3);
}
```

**Rules**:
- No `Math.random()` anywhere in the Layout Engine.
- Every PRNG call is deterministic from the seed.
- If a stage does not use randomness, it does not consume PRNG state — ensuring reproducibility even when stages are skipped or reordered.

### Stage 2 — Topology Analysis

**Purpose**: Compute graph-theoretic metrics that inform layout decisions in downstream stages.

**Metrics computed**:

| Metric | Algorithm | Purpose |
|--------|-----------|---------|
| Depth from root | BFS from `rootNodeId` | Determines radial distance from continent center (deeper → farther out) |
| Betweenness centrality | Brandes' algorithm (unweighted) | Identifies hub nodes that should be continent centers |
| Clustering coefficient | Local clustering coefficient per node | Identifies tightly-knit groups → continent candidates |
| Degree centrality | Simple count of connected edges | High-degree nodes need more surrounding space |
| Leaf detection | Nodes with zero children | Placed at periphery of clusters |
| Longest path | BFS from farthest node | Determines overall continent span |

**Output**: A `TopologyAnalysis` object containing all computed metrics, keyed by node ID.

**Design rationale**: Computing these metrics once upfront avoids redundant graph traversals during force-directed iterations. The metrics are read-only after this stage.

### Stage 3 — Continent Clustering

**Purpose**: Partition nodes into spatially distinct groups (continents) based on graph topology.

**Algorithm selection by graph size**:

| Node Count | Algorithm | Complexity | Quality |
|------------|-----------|------------|---------|
| < 100 | Girvan–Newman (edge betweenness) | O(n² × m) | High — detects fine-grained communities |
| 100–1000 | Louvain (modularity optimization) | O(n × log² n) | High — fast, widely used |
| > 1000 | Label Propagation | O(n) | Approximate — good for large graphs |

**Fallback for linear/chain graphs**: If community detection produces a single continent containing all nodes (as in a linear chain), the algorithm falls back to hierarchical clustering: nodes are grouped by depth level modulo `maxContinents`. This ensures that even a simple linear path produces visually interesting multiple continents.

**Continent assignment**:

```typescript
function clusterContinents(
  graph: GraphData,
  analysis: TopologyAnalysis,
  prng: PRNG,
  config: LayoutConfig
): Continent[] {
  // 1. Run community detection
  const communities = detectCommunities(graph, analysis, config);

  // 2. Filter small communities (merge into nearest large community)
  const merged = mergeSmallCommunities(communities, config.minContinentSize);

  // 3. Assign continent centers on sphere surface
  //    Centers are placed uniformly on the sphere via Fibonacci sphere algorithm,
  //    then jittered by seeded PRNG for natural variation.
  const centers = assignContinentCenters(merged.length, prng, config.sphereRadius);

  // 4. Assign each node to its continent
  for (const community of merged) {
    const center = centers[community.index];
    const importance = sum(community.nodes.map(n => n.importance));
    const radius = computeContinentRadius(community.nodes.length, importance, config.sphereRadius);

    continents.push({
      id: `continent-${community.index}`,
      label: deriveLabel(community.nodes),
      nodeIds: community.nodes.map(n => n.id),
      center,
      importance,
      radius,
      averageDepth: mean(community.nodes.map(n => analysis.depthMap.get(n.id)!)),
      dominantCategory: mode(community.nodes.map(n => n.category)),
    });
  }

  return continents;
}
```

**Key design decisions**:

1. **Fibonacci sphere for continent center placement**: Distributes `n` points on a sphere as uniformly as possible. This prevents continents from clustering on one hemisphere.

2. **Continent radius scales with node count and importance**: More nodes or higher importance → larger continent surface area. This creates a visual hierarchy where the "most important" continent (e.g., containing the root and goal nodes) is visibly largest.

3. **Dominant category is computed here**: While biome assignment belongs to the World Generator, the dominant category is computed now because it helps downstream stages make spatial decisions (e.g., certain categories should be placed on specific hemispheres).

### Stage 4 — Force-Directed Placement

**Purpose**: Assign initial 3D positions to every node using a spring-electric model adapted for spherical geometry.

**Algorithm**: Modified Fruchterman-Reingold on a spherical manifold.

**Forces**:

| Force | Equation | Purpose |
|-------|----------|---------|
| Repulsion | `F_r(i,j) = k_r / geodesicDist(i,j)² × importance(j)` | Pushes all nodes apart. High-importance nodes repel more strongly, creating more space around them. |
| Attraction | `F_a(i,j) = k_a × edgeWeight(i,j) × geodesicDist(i,j)` | Pulls connected nodes together. Stronger edges produce stronger attraction. |
| Gravity | `F_g(i) = k_g × geodesicDist(i, continentCenter(i))` | Pulls each node toward its continent center. Prevents continents from drifting apart. |

**Spherical adaptation**: Forces are computed in the tangent plane at each node's position, then applied. After each iteration, positions are re-normalized to the sphere surface.

```typescript
function forceDirectedPlacement(
  nodes: GraphNode[],
  edges: GraphEdge[],
  continents: Continent[],
  analysis: TopologyAnalysis,
  prng: PRNG,
  config: LayoutConfig
): Map<string, NodePosition> {
  // Phase 1: Initialize positions
  const positions = initializePositions(nodes, continents, analysis, prng);
  // Nodes start randomly distributed within their continent's angular radius.

  // Phase 2: Iterative refinement
  let temperature = 1.0;
  for (let iter = 0; iter < config.maxIterations; iter++) {
    let maxDisplacement = 0;

    for (const node of nodes) {
      const pos = positions.get(node.id)!;

      // Compute resultant force
      const repulsion = computeRepulsion(node, nodes, positions, config.repulsionStrength);
      const attraction = computeAttraction(node, edges, positions, config.attractionStrength);
      const gravity = computeGravity(node, continents, positions, config.gravityStrength);

      const totalForce = normalize(add(repulsion, attraction, gravity));
      const displacement = scale(totalForce, temperature * config.sphereRadius * 0.01);

      // Apply and constrain to sphere
      const newPos = add(pos, displacement);
      positions.set(node.id, normalizeToSphere(newPos, config.sphereRadius));

      maxDisplacement = Math.max(maxDisplacement, magnitude(displacement));
    }

    // Temperature cooling
    temperature *= config.coolingRate;

    // Early termination
    if (maxDisplacement < 0.001) break;
  }

  return positions;
}
```

**Initialization strategy**: Nodes are initialized within their continent's spherical radius using a Fibonacci spiral distribution, jittered by seeded PRNG. This gives the force-directed algorithm a better starting point than pure random placement, reducing convergence iterations by ~40%.

**Convergence criteria**: The algorithm terminates when:
- Max displacement < 0.001 × sphereRadius, OR
- Max iterations reached

### Stage 5 — Collision Avoidance

**Purpose**: Ensure no two nodes occupy overlapping positions.

**Detection**: After force-directed placement, compute geodesic distance between every pair of nodes within the same continent. If distance < `config.minNodeSpacing`, flag as collision.

**Resolution**:

```typescript
function resolveCollisions(
  positions: Map<string, NodePosition>,
  continents: Continent[],
  prng: PRNG,
  config: LayoutConfig
): Map<string, NodePosition> {
  for (let iter = 0; iter < config.collisionMaxIterations; iter++) {
    let collisionCount = 0;

    for (const continent of continents) {
      const continentPositions = continent.nodeIds
        .map(id => ({ id, pos: positions.get(id)! }));

      // Check all pairs within continent
      for (let i = 0; i < continentPositions.length; i++) {
        for (let j = i + 1; j < continentPositions.length; j++) {
          const a = continentPositions[i];
          const b = continentPositions[j];
          const dist = geodesicDistance(a.pos.position, b.pos.position);

          if (dist < config.minNodeSpacing) {
            collisionCount++;
            const pushDir = normalize(subtract(a.pos.position, b.pos.position));
            const pushDist = (config.minNodeSpacing - dist) / 2;
            const push = scale(pushDir, pushDist);

            positions.set(a.id, {
              ...a.pos,
              position: normalizeToSphere(add(a.pos.position, push), sphereRadius),
              metadata: { ...a.pos.metadata, collisionResolved: true },
            });
            positions.set(b.id, {
              ...b.pos,
              position: normalizeToSphere(subtract(b.pos.position, push), sphereRadius),
              metadata: { ...b.pos.metadata, collisionResolved: true },
            });
          }
        }
      }
    }

    if (collisionCount === 0) break;
  }

  return positions;
}
```

**Fallback strategy**: If collisions persist after `collisionMaxIterations` (indicating an overcrowded continent), the entire continent's angular radius is increased by 20%, and force-directed placement is re-run for that continent only.

### Stage 6 — Density Balancing

**Purpose**: Ensure nodes are evenly distributed within their continent region, preventing visual clumping.

**Density map**: The continent's angular region is divided into a grid (configurable via `densityGridResolution`). Each grid cell counts how many nodes fall within its bounds.

```typescript
function balanceDensity(
  positions: Map<string, NodePosition>,
  continents: Continent[],
  prng: PRNG,
  config: LayoutConfig
): Map<string, NodePosition> {
  for (const continent of continents) {
    const grid = buildDensityGrid(continent, positions, config.densityGridResolution);
    const meanDensity = mean(grid.cells.map(c => c.count));
    const stdDev = standardDeviation(grid.cells.map(c => c.count));
    const cv = stdDev / meanDensity;

    if (cv <= config.densityThreshold) continue; // Already balanced

    // Identify hotspot cells (count > mean × 1.5)
    const hotspots = grid.cells.filter(c => c.count > meanDensity * 1.5);

    for (const hotspot of hotspots) {
      // Find the node closest to hotspot center
      const nodesInCell = continent.nodeIds
        .map(id => ({ id, pos: positions.get(id)! }))
        .filter(({ pos }) => grid.cellForPosition(pos.spherical) === hotspot);

      // Move the outermost nodes toward continent periphery
      const sorted = nodesInCell.sort(
        (a, b) => geodesicDistFromContinentCenter(b.pos, continent)
          - geodesicDistFromContinentCenter(a.pos, continent)
      );

      const toMove = sorted.slice(0, Math.ceil(nodesInCell.length * 0.3));
      for (const { id, pos } of toMove) {
        const outward = normalize(subtract(
          pos.position,
          sphericalToCartesian(continent.center, config.sphereRadius)
        ));
        const push = scale(outward, config.minNodeSpacing * 0.5);
        positions.set(id, {
          ...pos,
          position: normalizeToSphere(add(pos.position, push), config.sphereRadius),
          metadata: { ...pos.metadata, localDensity: hotspot.count },
        });
      }
    }
  }

  return positions;
}
```

**Balance metric**: Coefficient of variation (CV) of node density across grid cells. Target CV < `densityThreshold` (default 0.3). A CV of 0 means perfectly uniform distribution; 0.3 allows moderate variation that looks natural.

**Why density balancing matters**: Without it, force-directed placement tends to cluster nodes near the continent center, making peripheral nodes sparse and central nodes unreadably dense. This stage is purely about visual readability.

### Stage 7 — Road Topology Generation

**Purpose**: For every GraphEdge, compute the visual path connecting its two endpoint positions on the sphere surface.

**Algorithm**:

```typescript
function computeRoadTopology(
  edges: GraphEdge[],
  positions: Map<string, NodePosition>,
  prng: PRNG,
  config: LayoutConfig
): RoadSegment[] {
  const roads: RoadSegment[] = [];

  for (const edge of edges) {
    const sourcePos = positions.get(edge.source)!.position;
    const targetPos = positions.get(edge.target)!.position;

    // 1. Compute great circle arc
    const arc = greatCircleArc(sourcePos, targetPos);

    // 2. Subdivide into waypoints
    const waypoints = interpolateGreatCircle(arc, config.roadSegmentCount);

    // 3. Add elevation modulation
    const elevated = waypoints.map((wp, i) => {
      const t = i / (waypoints.length - 1);
      const elevation = Math.sin(t * Math.PI) * config.roadElevationAmplitude * config.sphereRadius;
      return scale(normalize(wp), config.sphereRadius + elevation);
    });

    // 4. Compute road width from edge weight
    const width = 0.1 + edge.weight * 1.9; // Range: 0.1 (weak) to 2.0 (strong)

    // 5. Add visual curvature variety (seeded by edge ID)
    const curvature = prng.next() * 0.5; // 0–0.5 radians of lateral perturbation

    roads.push({
      edgeId: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      path: elevated,
      width,
      curvature,
      waypointCount: elevated.length,
    });
  }

  return roads;
}
```

**Great circle arc**: The shortest path on a sphere between two points. Computed via spherical linear interpolation (slerp) of the unit vectors.

**Elevation modulation**: A sine wave applied along the road path creates a gentle arching effect. Roads appear to rise slightly above the terrain surface, making them visible even in dense terrain. Amplitude is configurable.

**Road width from edge weight**: Strong prerequisite edges (weight = 1.0) become wide highways. Weak related edges (weight = 0.1) become narrow paths. This creates an immediate visual cue for dependency strength.

**Curvature perturbation**: Each road receives a seeded random curvature value that laterally perturbs waypoints. This creates visual variety — no two roads look identical — while remaining deterministic (same edge + same seed = same curvature).

---

## 4. Coordinate System

### 4.1 Origin

The sphere is centered at the origin of the 3D coordinate system: `(0, 0, 0)`.

### 4.2 Axes

```
Y-axis: Up (north pole direction)
X-axis: Right (0° longitude reference)
Z-axis: Forward (90° longitude reference)

Right-hand coordinate system: Y-up, Z-forward.
```

**Spherical coordinate convention**:

```
azimuth (θ):      0 at +X, increasing counter-clockwise when viewed from +Y
                  Range: 0 to 2π
inclination (φ):  0 at +Y (north pole), π at -Y (south pole)
                  Range: 0 to π
radius (r):       LayoutConfig.sphereRadius (default: 5)
```

**Conversions**:

```typescript
function sphericalToCartesian(
  azimuth: number, inclination: number, radius: number
): [number, number, number] {
  const x = radius * Math.sin(inclination) * Math.cos(azimuth);
  const y = radius * Math.cos(inclination);
  const z = radius * Math.sin(inclination) * Math.sin(azimuth);
  return [x, y, z];
}
```

### 4.3 Units

All positions are in **world units** (arbitrary, consistent with Three.js world units). The default sphere radius is 5 units, matching the existing PlanetScene and PlanetConfig conventions.

| Quantity | Unit | Default Value |
|----------|------|---------------|
| Position | world units | — |
| Sphere radius | world units | 5 |
| Angular distance | radians | — |
| Road width | world units | 0.1–2.0 |
| Road elevation | fraction of sphere radius | 0.02 |
| Min node spacing | radians | 0.05 |

### 4.4 Spacing Rules

- **Minimum node spacing**: `config.minNodeSpacing` radians (default 0.05). At sphereRadius=5, this is approximately 0.25 world units of geodesic distance — enough to visually distinguish adjacent nodes at typical camera distance.
- **Continent spacing**: Continent centers are placed using Fibonacci sphere algorithm, ensuring minimum angular separation of ~2π/n radians where n = continent count.
- **Road path resolution**: `config.roadSegmentCount` waypoints per road (default 20). At sphereRadius=5, this gives a waypoint approximately every 1.5 world units for a road spanning 180° of arc.

### 4.5 Scaling Rules

All spatial quantities scale with `sphereRadius`:

| Quantity | Scaling | Example (radius=5) | Example (radius=10) |
|----------|---------|--------------------|----------------------|
| Min node spacing | `minNodeSpacing × radius` | 0.25 | 0.5 |
| Continent radius | `baseRadius × radius / 5` | Varies | 2× |
| Force displacement | `temperature × radius × 0.01` | 0.05 at t=1 | 0.1 at t=1 |
| Road elevation | `roadElevationAmplitude × radius` | 0.1 | 0.2 |

This ensures that the Layout Engine produces equally readable layouts at any sphere scale. A planet with `radius=50` will have 10× larger features but identical relative spacing.

---

## 5. Clustering Strategy

### 5.1 Why Cluster?

Without clustering, force-directed placement treats the entire graph as a single system. This produces layouts where:
- All nodes converge toward a single dense cluster (high-degree nodes pull everything together).
- Long-range edges create distorted, non-readable configurations.
- There is no visual indication of modular structure — the user cannot see which skills form natural groups.

Clustering solves these problems by partitioning the graph into independent spatial regions before layout.

### 5.2 Community Detection as Clustering

The primary clustering mechanism is **community detection** (Stage 3). This is a natural choice because:

- Communities in the graph correspond to groups of nodes that are more densely connected internally than externally.
- These communities naturally map to "continents" in the 3D world — spatially distinct regions containing related skills.
- Community detection requires no domain knowledge (no skill categories, no node types) — it operates purely on topology.

### 5.3 Multi-Level Clustering

The clustering strategy is hierarchical:

```
Level 0: Entire graph → 1 planet
Level 1: Communities → N continents (Stage 3)
Level 2: Within each continent, sub-communities → clusters (Stage 4 initialization)
Level 3: Individual nodes → cities/buildings (World Generator responsibility)
```

- **Level 1** is computed by community detection.
- **Level 2** is computed during force-directed initialization: within each continent, nodes are further grouped by their local clustering coefficient into "neighborhoods" that receive similar initial positions.
- **Levels 3+** are deferred to the World Generator, which uses hierarchy levels from the Graph Engine to determine city/building/landmark placement.

### 5.4 Ensuring Spatial Proximity

Related skills remain spatially close because:

1. **Continent assignment**: Nodes in the same community are assigned to the same continent. Continent centers are spatially separated on the sphere.

2. **Attractive force along edges**: Force-directed placement pulls connected nodes together. Since edges primarily exist within communities, intra-community nodes cluster naturally.

3. **Gravity toward continent center**: Every node is pulled toward its continent center. Nodes in different continents experience gravity toward different centers, preventing inter-continent drift.

4. **Density balancing preserves clusters**: Nodes are redistributed within their continent boundary, not moved to other continents.

### 5.5 Inter-Continent Edges

Edges that cross continent boundaries (connecting nodes in different continents) are handled specially:

- These edges are **not used** in force-directed attraction calculations. If they were, they would pull continents together, defeating clustering.
- Instead, inter-continent edges are rendered as **bridges** — visually distinct road segments that span the space between continents.
- The World Generator receives these edges as special cases and can render them as bridges, tunnels, or teleporters depending on theme.

---

## 6. Collision Strategy

### 6.1 Detection

Collisions are detected after force-directed placement (Stage 5) by checking all node pairs within each continent. The detection is O(n²) per continent, but since continents have at most ~100 nodes (enforced by `maxContinents` and graph size limits), this is acceptable.

**Collision criterion**: Two nodes collide if their geodesic distance < `config.minNodeSpacing`.

### 6.2 Resolution

Collisions are resolved by pushing colliding nodes apart along the great circle arc connecting them. The push distance is `(minNodeSpacing - actualDistance) / 2` per node, ensuring both nodes share the displacement equally.

### 6.3 Convergence

The collision resolution loop runs for up to `config.collisionMaxIterations` iterations. Within each iteration:
- All collisions are detected.
- All collisions are resolved simultaneously (using positions from the start of the iteration).
- If no collisions remain, the loop terminates early.

**Simultaneous resolution** prevents cascading: if A and B collide, and B and C collide, resolving A-B first would move B into C. Simultaneous resolution avoids this by computing all displacements from the same position snapshot.

### 6.4 Fallback: Continent Expansion

If collisions persist after `collisionMaxIterations`, it means the continent is overcrowded. The fallback strategy:

1. Increase the continent's angular radius by 20%.
2. Re-run force-directed placement for only this continent's nodes (all other nodes remain fixed).
3. Re-run collision avoidance.
4. If still failing, split the continent into two (re-run community detection on the continent's subgraph).

This fallback ensures that the Layout Engine always produces a collision-free layout, even for very dense graphs.

### 6.5 Output Validation

After collision resolution, `LayoutMetrics.collisionCount` reports the number of remaining collisions. A valid layout must have `collisionCount === 0`. The World Generator should reject layouts with collisions and request re-computation with adjusted parameters.

---

## 7. Extensibility

### 7.1 Consumer Abstraction

The Layout Engine produces `LayoutOutput`, which is consumed by the World Generator. The World Generator never calls the Layout Engine directly — instead, the pipeline orchestrator (located in `core/pipeline.ts` in future sprints) connects them:

```typescript
// Orchestrator (pseudo-architecture, not implementation)
function generateWorld(graph: GraphData, seed: number): WorldConfig {
  const layout = layoutEngine.compute(graph, seed);       // Layout Engine
  const world = worldGenerator.generate(graph, layout);   // World Generator
  return world;
}
```

This indirection means:
- The Layout Engine can be replaced without affecting the World Generator.
- The World Generator can be tested with mock LayoutOutput.
- Multiple Layout Engine implementations can exist (e.g., `SphereLayoutEngine`, `FlatLayoutEngine`, `TorusLayoutEngine`) and be selected at runtime.

### 7.2 Theme Engine Decoupling

The Layout Engine knows nothing about themes. `LayoutOutput` contains only spatial data — no colors, materials, or visual styles.

When the Theme Engine processes the World Generator's output, it uses `LayoutOutput` to determine:
- Which continent is closest to the camera (LOD decisions)
- How roads curve over terrain (road visual style)
- Where landmarks should glow (node importance → glow intensity)

These are rendering decisions, not layout decisions. The Layout Engine does not need to change when a new theme is added.

### 7.3 Biome Integration

Biomes are assigned by the World Generator, not the Layout Engine. However, the Layout Engine's continent clustering naturally groups nodes by topology, which often correlates with category. A biome (e.g., "forest" for frontend skills) is applied to a continent by the World Generator after layout is complete.

If a future requirement demands biome-aware layout (e.g., "forest continents should be on the equator, tundra continents at the poles"), this can be added as a post-processing stage between clustering and force-directed placement, without modifying any other stage.

### 7.4 Procedural Generation Integration

Future procedural generation systems (e.g., for terrain textures, vegetation placement, cloud patterns) can consume `LayoutOutput` to make spatial decisions:

```
Procedural Vegetation System
  └─ Input: LayoutOutput.positions
  └─ Logic: Place trees at positions with low localDensity
  └─ Output: VegetationConfig

Procedural Cloud System
  └─ Input: LayoutOutput.continents
  └─ Logic: Place cloud clusters above continent centers
  └─ Output: CloudConfig
```

These systems read from LayoutOutput but never modify it. The Layout Engine is immutable after output.

### 7.5 Graph Editor Integration

The Graph Editor's 2D graph view can display the Layout Engine's output as an optional "spatial preview" overlay:
- Node positions mapped to 2D via equirectangular projection.
- Continent boundaries shown as colored regions.
- Road paths shown as curved lines.

This is a visualization concern, not a layout concern. The Layout Engine provides the data; the Graph Editor renders it.

---

## 8. Determinism

### 8.1 Core Principle

Identical `GraphData` + identical `LayoutConfig.seed` → identical `LayoutOutput`. Always. Across runs, across machines, across platforms.

### 8.2 How Determinism Is Enforced

| Mechanism | What It Prevents |
|-----------|------------------|
| Seeded PRNG (xoshiro128**) | No `Math.random()` calls. All stochastic decisions consume PRNG state. |
| Deterministic iteration order | All loops over `Map` keys or `Set` values use sorted iteration (by node ID). JavaScript `Map` and `Set` insertion order is guaranteed, but explicit sorting removes ambiguity. |
| No floating-point non-determinism | Floating-point arithmetic is deterministic across JavaScript engines for the same sequence of operations. No parallel computation, no race conditions. |
| Fixed-point convergence | Force-directed placement uses a fixed iteration count as upper bound. Early termination is based on displacement threshold, which is deterministic. |
| No external dependencies | No network calls, no file I/O, no system clock queries. |
| Pure functions | Every stage is a pure function: `(input, config, prng) → output`. No mutable shared state. |
| Snapshot isolation | Collision resolution reads positions once at the start of each iteration and writes all displacements from that snapshot. |

### 8.3 Testing Determinism

The test suite must include a **determinism test**:

```typescript
describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const graph = createTestGraph();
    const config = createTestConfig(seed: 42);

    const output1 = layoutEngine.compute(graph, config);
    const output2 = layoutEngine.compute(graph, config);
    const output3 = layoutEngine.compute(graph, config);

    expect(output1).toEqual(output2);
    expect(output2).toEqual(output3);
  });

  it('produces different output for different seeds', () => {
    const graph = createTestGraph();

    const output1 = layoutEngine.compute(graph, { ...config, seed: 42 });
    const output2 = layoutEngine.compute(graph, { ...config, seed: 123 });

    expect(output1).not.toEqual(output2);
  });
});
```

### 8.4 Seed as Configuration

The seed is part of `LayoutConfig`, not a separate parameter. This means:

- Different seeds produce different layouts for the same graph.
- Users can regenerate their world with a different seed to get a fresh spatial arrangement.
- The seed can be derived from the graph ID for automatic determinism: `seed = hash(graph.id)`.

### 8.5 Reproducibility Guarantee

Given the same graph and seed, the Layout Engine guarantees:

1. Same number of continents.
2. Same node-to-continent assignment.
3. Same continent centers (within floating-point precision).
4. Same node positions (within floating-point precision).
5. Same road paths (waypoints identical).
6. Same metrics values.
7. Same PRNG state consumed.

This guarantee extends across:
- JavaScript runtimes (Node.js, Deno, Bun)
- Operating systems (macOS, Linux, Windows)
- CPU architectures (x64, ARM)
- Layout Engine versions (backward compatibility documented in semver)

---

## Appendix A: Pipeline Orchestration (Conceptual)

The Layout Engine is invoked as a single entry point that chains the 7 stages:

```typescript
function computeLayout(graph: GraphData, config: LayoutConfig): LayoutOutput {
  // Stage 1
  const prng = initializePRNG(config.seed);

  // Stage 2
  const analysis = analyzeTopology(graph);

  // Stage 3
  const continents = clusterContinents(graph, analysis, prng, config);

  // Stage 4
  const rawPositions = forceDirectedPlacement(
    [...graph.nodes.values()], [...graph.edges], continents, analysis, prng, config
  );

  // Stage 5
  const collisionFree = resolveCollisions(rawPositions, continents, prng, config);

  // Stage 6
  const balanced = balanceDensity(collisionFree, continents, prng, config);

  // Stage 7
  const roads = computeRoadTopology([...graph.edges], balanced, prng, config);

  // Assemble output
  return {
    seed: config.seed,
    graphId: graph.id,
    positions: balanced,
    continents,
    roads,
    metrics: computeMetrics(balanced, continents, roads, config),
  };
}
```

Each stage is independently testable. A stage can be replaced, skipped, or reordered without affecting the others, as long as the input/output contracts are maintained.

---

## Appendix B: Comparison with Alternative Approaches

| Approach | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| **Force-directed on sphere** (chosen) | Natural for connected graphs, deterministic, produces readable clusters | O(n²) repulsion, slow for >1000 nodes | — |
| **Random placement** | Simple, fast | Unreadable, nodes overlap, no cluster structure | Unacceptable for user-facing product |
| **Grid placement** | Deterministic, fast, no collisions | No cluster structure, no relationship visibility | Ignores graph topology entirely |
| **PCA/MDS projection** | Captures global structure, fast | Not deterministic (unless seeded), poor local structure | Less predictable, harder to debug |
| **Spectral layout** | Good for clustered graphs | Complex to implement, non-deterministic eigenvectors | Over-engineered for MVP |
| **Tree layout** | Simple, hierarchical | Only works for tree graphs, not DAGs | Graphs are DAGs, not trees |
| **Self-organizing maps** | Topology-preserving | Slow, non-deterministic training | Too complex for basic layout |

The chosen approach (force-directed on sphere with community detection initialization) provides the best balance of determinism, readability, and algorithmic simplicity for the MVP.
