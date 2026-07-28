# WORLD_RULES — Logical Mapping Rules

This document defines how the **World Generator** converts a domain-agnostic knowledge graph into a hierarchical 3D world. It contains **only logical mappings** — no meshes, materials, shaders, or rendering implementation details. The Renderer and Theme Engine are responsible for visual interpretation.

## 1. Hierarchy Mapping

The Graph Engine's `inferHierarchyLevel()` function determines where each GraphNode belongs in the world hierarchy. The mapping is:

| GraphNode Property | World Level | Description |
|--------------------|-------------|-------------|
| `type: 'milestone'` + `importance ≥ 8` | Continent | Major skill domain — the largest geographic division |
| `type: 'milestone'` + `importance < 8` | Region | Sub-domain within a continent |
| `type: 'skill'` + `children.length ≥ 3` | City | Core skill with multiple sub-skills |
| `type: 'skill'` + `children.length < 3` | District | Small skill within a city |
| `type: 'sub-skill'` | Building | Individual learning unit |
| `type: 'project'` | Landmark | Capstone or portfolio project |
| `type: 'resource'` | Decoration | Reference material, not a structural element |

### Classification Algorithm

```typescript
function inferHierarchyLevel(node: GraphNode, graph: GraphData): HierarchyLevel {
  const children = getChildren(node.id, graph);
  const depth = getDepth(node.id, graph);
  
  // Milestones at root level are continents
  if (node.type === 'milestone' && depth <= 1) return 'continent';
  
  // Deep milestones or node with many children
  if (node.type === 'milestone') return 'region';
  
  // High-importance skills with many sub-skills
  if (node.type === 'skill' && children.length >= 3 && node.importance >= 5) return 'city';
  if (node.type === 'skill' && children.length > 0) return 'district';
  
  // Sub-skills become buildings
  if (node.type === 'sub-skill') return 'building';
  
  // Projects are landmarks (visible from distance)
  if (node.type === 'project') return 'landmark';
  
  // Resources are decoration
  return 'decoration';
}
```

**Rule**: This function is **stateless and deterministic**. It relies only on graph topology (edges, types, importance), never on external state. The World Generator calls this for every node before constructing the hierarchy tree.

## 2. Domain → Continent

Each top-level `milestone` with a distinct `category` becomes a continent. The mapping is:

| SkillCategory | Continent Name Pattern | Biomes |
|---------------|-----------------------|--------|
| `frontend` | "{Milestone Name} Frontier" | Lush Forest, Crystal Plains |
| `backend` | "{Milestone Name} Highlands" | Mountain Range, Rocky Desert |
| `devops` | "{Milestone Name} Caldera" | Volcanic, Ash Wastes |
| `data-science` | "{Milestone Name} Tundra" | Ice Fields, Geometric Plains |
| `design` | "{Milestone Name} Garden" | Prismatic Fields, Mirror Lakes |
| `music` | "{Milestone Name} Soundscape" | Echoing Canyons, Rhythm Forests |
| `academic` | "{Milestone Name} Archive" | Library Ruins, Marble Plateaus |
| `creative` | "{Milestone Name} Atelier" | Sunset Plains, Canvas Meadows |
| `fitness` | "{Milestone Name} Wilds" | Jungle, Rapids, Summit Peaks |
| `language` | "{Milestone Name} Archipelago" | Coastal Isles, Linguistic Reefs |
| `business` | "{Milestone Name} Exchange" | Urban Center, Trade Routes |
| `custom` | "{Milestone Name}" | Default Temperate |

**Rule**: Continent names are derived from the milestone node's label. Multiple milestones with the same category merge into a single continent. Each continent is assigned exactly one primary biome (most common category of its child nodes).

## 3. Category → Region

Within a continent, nodes are grouped into regions based on sub-category or tag clusters.

| Sub-Category / Tag | Region Type |
|--------------------|-------------|
| "fundamentals", "basics", "intro" | Coastal Lowlands |
| "advanced", "expert", "deep-dive" | Mountain Highlands |
| "tooling", "infrastructure" | Industrial District |
| "theory", "concepts" | Academic Quarter |
| "practice", "exercises" | Training Grounds |
| "project", "capstone" | Landmark Zone |

**Rule**: Regions are only created if a continent has ≥5 nodes. Smaller continents skip the region level and place cities directly under the continent object.

## 4. Skill → City

Every GraphNode classified as a `city` (see Hierarchy Mapping) becomes a city in the world.

| GraphNode Property | World Property | Formula |
|--------------------|----------------|---------|
| `difficulty` | City Size | `baseSize × (difficulty / 5)` |
| `importance` | City Height | `baseHeight × (importance / 10)` |
| `estimatedHours` | Building Density | `min(buildings, ceil(estimatedHours / 5))` |
| `priority` | Construction Order | Lower priority = built first |

### City Naming Convention
```
City Name = {Node Label} + Suffix
  - milestone → "{Label} Capital"
  - skill     → "{Label} Borough"
  - if difficulty ≥ 4 → add "Citadel" suffix
  - if importance ≥ 8 → add "Grand" prefix
```

**Rule**: City names are generated from the GraphNode label. The suffix encodes semantic information about the node's role. The Theme Engine can override naming conventions (e.g., cyberpunk uses "Sector" instead of "Borough").

## 5. Sub-skill → Building

Each sub-skill within a city becomes a building.

| GraphNode Property | Building Property |
|--------------------|-------------------|
| `node.type === 'sub-skill'` | Building — one per sub-skill |
| `difficulty` | Building height (floors = difficulty) |
| `importance` | Building footprint (width, depth) |
| `progress.status === 'completed'` | Building is fully constructed |
| `progress.status === 'locked'` | Building is hidden |

### Building Distribution
Buildings are arranged radially around the city center:
- **Importance 8–10**: Inner ring (closest to center)
- **Importance 5–7**: Middle ring
- **Importance 1–4**: Outer ring (periphery)
- **Difficulty 5**: Unique architecture (tower landmark)

## 6. Project → Landmark

Projects are rendered as landmarks — highly visible structures that stand out from regular buildings.

| GraphNode Property | Landmark Property |
|--------------------|-------------------|
| `type: 'project'` | Landmark (not a regular building) |
| `difficulty` | Landmark scale |
| `importance` | Landmark glow radius |
| `estimatedHours` | Landmark complexity (mesh detail level) |

**Rule**: Landmarks are placed on elevated terrain (hilltops, cliffs) to maximize visibility. If no elevated terrain exists near the parent city, the landmark is placed at the city's edge with a raised platform.

## 7. XP → Vegetation

`estimatedXP` on a GraphNode determines the vegetation density around its corresponding city.

| XP Range | Vegetation Density | Visual Interpretation |
|----------|-------------------|----------------------|
| 0–50 | None | Barren, no vegetation |
| 51–200 | Sparse | Grass patches, few bushes |
| 201–500 | Moderate | Trees, shrubs, flower beds |
| 501–1000 | Dense | Forest, thick undergrowth |
| 1000+ | Lush | Ancient forest, glowing flora |

**Rule**: Vegetation is distributed in a radius around the city. Radius = `sqrt(estimatedXP) × 0.1` world units. Vegetation type is determined by the biome assigned to the parent continent. Higher XP also increases vegetation height and color vibrancy.

## 8. Completion → Construction State

A GraphNode's `progress.status` maps directly to the visual state of its corresponding WorldObject.

| GraphNode Status | WorldObject State | Visual Implication |
|------------------|-------------------|-------------------|
| `locked` | `hidden` | Not rendered at all. The user cannot see or interact with this node's representation. |
| `available` | `locked` | Visible but obscured (rubble, chains, fog overlay). The user can see something exists but cannot interact until started. |
| `in-progress` | `in-progress` | Construction animation plays. Scaffolding, cranes, particle effects. Partial completion is visible. |
| `completed` | `completed` | Fully constructed. Normal lighting, shadows, and detail. All visual elements are active. |
| `completed` + `type: 'milestone'` | `shining` | Same as completed, plus glow effect, particle aurora, or other celebratory visuals. Milestone nodes get special treatment. |

**State transition rules**:
- States are **monotonic**: `hidden → locked → in-progress → completed → shining`. A node never goes backward.
- When a parent node is `locked`, all its children are `hidden` regardless of their individual status.
- `shining` is only applied to milestone nodes upon completion. Regular skills stop at `completed`.

## 9. Difficulty → Scale

A GraphNode's `difficulty` (1–5) controls the physical scale of its world representation. This applies to cities, buildings, and landmarks.

| Difficulty | Scale Multiplier | Examples |
|------------|-----------------|----------|
| 1 (Beginner) | 0.5× | Small hut, tiny district |
| 2 (Elementary) | 0.75× | Cottage, small neighborhood |
| 3 (Intermediate) | 1.0× | Standard building, average city block |
| 4 (Advanced) | 1.5× | Large structure, prominent city |
| 5 (Expert) | 2.5× | Tower, citadel, sprawling metropolis |

**Rule**: Scale is applied multiplicatively on top of the base size determined by importance. A difficulty-5, importance-10 building is 5× larger than a difficulty-1, importance-1 building:
```
finalScale = baseScale × difficultyMultiplier × (importance / 10)
```

## 10. Locked → Hidden

Locked GraphNodes produce WorldObjects with `state: 'hidden'`. The following rules determine visibility:

| Condition | Visibility | Rationale |
|-----------|-----------|-----------|
| Node status is `locked` | Hidden | The user hasn't reached this skill yet. No spoilers. |
| Node status is `available` or higher | Visible | The user has unlocked this skill. |
| Parent node is `locked` | Hidden (whole subtree) | Cannot see content of a locked domain. |
| All prerequisites incomplete | `state: 'locked'` | Visible but inaccessible. Creates curiosity. |

**Edge case — partial tree visibility**: If a user completes enough prerequisites to unlock a node but not all its siblings, only that node and its descendants become visible. This creates a "reveal" effect where the world fills in as the user progresses.

## 11. Edge Weight → Road Properties

GraphEdge properties determine the visual appearance of roads between cities.

| Edge Property | Road Property | Mapping |
|---------------|--------------|---------|
| `weight ≥ 0.8` | Highway | Wide road (width 2.0), smooth path, glowing when both endpoints complete |
| `weight 0.5–0.79` | Paved Road | Medium width (1.0), standard path |
| `weight < 0.5` | Path | Narrow (0.3), rougher path, may be dirt |
| `type: 'prerequisite'` | Bridge | Elevated road with arch supports |
| `type: 'recommended'` | Tunnel | Road with portal effects at each end |
| `type: 'related'` | Surface Road | Standard at-grade road |
| `type: 'leads-to'` | Sky Bridge | Floating, glowing connection |

**Rule**: Road visual state is derived from the minimum completion status of its two endpoint nodes (see Section 8). Road curvature is seeded by edge ID to ensure deterministic variety.

## 12. Priority → Construction Animation Order

`priority` (1–5) determines the order in which construction animations play when multiple skills are in-progress simultaneously.

| Priority | Build Order | Animation Speed |
|----------|-------------|-----------------|
| 1 | First | 1.5× speed (urgent) |
| 2 | Second | 1.25× speed |
| 3 | Third | 1.0× speed (standard) |
| 4 | Fourth | 0.75× speed (leisurely) |
| 5 | Last | 0.5× speed (slow) |

**Rule**: Priority is a suggestion, not a guarantee. The Progress System may reorder builds based on dependency resolution (prerequisites must complete before dependents, regardless of priority).

## 13. Summary of All Mappings

| Graph Property | World Property | Section |
|----------------|----------------|---------|
| `node.type` + `importance` | Hierarchy Level (continent → decoration) | §1 |
| `node.category` | Continent / Biome | §2 |
| Sub-category / tags | Region Type | §3 |
| `difficulty` | City Size, Building Scale | §4, §9 |
| `importance` | City Prominence, Building Radius | §4, §5 |
| `estimatedHours` | Building Density | §4 |
| `priority` | Construction Order | §12 |
| Sub-skill (child node) | Building | §5 |
| `type: 'project'` | Landmark | §6 |
| `estimatedXP` | Vegetation Density | §7 |
| `progress.status` | Construction State | §8 |
| `locked` | Hidden / Obscured | §10 |
| `edge.weight` | Road Width | §11 |
| `edge.type` | Road Type (bridge, tunnel, etc.) | §11 |

---

**End of WORLD_RULES.md**

*These rules are consumed by the World Generator (specifically `core/world-generation/world-rules.ts`) to convert a domain-agnostic GraphData + LayoutOutput into a hierarchical WorldConfig. The Theme Engine then interprets these logical mappings into visual representations based on the active theme (fantasy, cyberpunk, voxel, sci-fi, minimal). No rendering implementation details exist in this document.*
