# Theme Engine — Architecture Design

**Status**: Design Only  
**Sprint**: MVP System #4  
**Dependencies**: World Generator (System #3)  
**Consumed By**: Renderer (System #5)  

---

## 1. Responsibilities

### 1.1 Inputs

| Input | Type | Source | Description |
|-------|------|--------|-------------|
| WorldScene | `WorldScene` | World Generator | Complete hierarchical world data (WorldObject tree, roads, progression) |
| ThemeConfig | `ThemeConfig` | User/System | Active theme selection + optional overrides |
| ThemeDefinition | `ThemeDefinition` | Theme Registry | Pre-defined theme assets, materials, colors, animations |

### 1.2 Outputs

| Output | Type | Consumer | Description |
|--------|------|----------|-------------|
| RenderScene | `RenderScene` | Renderer | Themed visual data ready for Three.js scene construction |

### 1.3 Ownership

The Theme Engine owns:

- **Theme selection and validation** — Resolves the active theme from a registry of available themes. Validates that the theme is compatible with the WorldScene (e.g., all required ObjectTypes have mappings).
- **Asset mapping** — For every WorldObject, determines which mesh, material, color palette, and effects to use based on its ObjectType, state, and the active theme.
- **Material assignment** — Generates MaterialDefinition objects (color, roughness, metalness, emissive, opacity, shader references) for every WorldObject.
- **Animation assignment** — Attaches AnimationDefinition objects to WorldObjects based on their state transitions (hidden→locked→in-progress→completed→shining).
- **Effect assignment** — Attaches particle effects, glow, fog, and post-processing effects based on WorldObject state and theme.
- **Scale and transform modulation** — Applies theme-specific scale modifiers (e.g., Cyberpunk buildings are 20% taller, Fantasy buildings are 30% wider).
- **Color palette generation** — Generates deterministic color palettes from WorldObject metadata (difficulty, importance, biome hint) combined with theme color rules.

### 1.4 Non-Ownership

The Theme Engine explicitly does NOT own:

| Concern | Owner | Rationale |
|---------|-------|-----------|
| WorldObject hierarchy | World Generator | Theme Engine receives the tree, does not modify it |
| Spatial positions | World Generator | Positions are finalized before theming |
| Three.js geometry creation | Renderer | Theme Engine produces MeshDefinition (parameters), not actual meshes |
| Three.js scene construction | Renderer | RenderScene is consumed by the Renderer to build the R3F scene graph |
| GSAP timeline creation | Animation Engine | Theme Engine produces AnimationDefinition (parameters), not actual timelines |
| Shader source code | Renderer | Theme Engine references shader names, Renderer loads/compiles them |
| User interaction logic | UI Layer | Click handlers, hover states, tooltips are UI concerns |

---

## 2. Public API

```typescript
/**
 * Theme Engine — converts a WorldScene into a themed RenderScene.
 *
 * Stateless and deterministic: same WorldScene + same ThemeConfig → identical RenderScene.
 * The single entry point is `generate()`.
 */
interface ThemeEngine {
  /**
   * Generate a themed RenderScene from world data.
   *
   * @param worldScene - The hierarchical world data from World Generator
   * @param themeConfig - Theme selection and optional overrides
   * @returns RenderScene - Themed visual data ready for the Renderer
   */
  generate(
    worldScene: WorldScene,
    themeConfig?: Partial<ThemeConfig>,
  ): RenderScene;
}

/**
 * Configuration for theme application.
 */
interface ThemeConfig {
  /** Active theme name. Must match a registered theme. Default: 'low-poly' */
  activeTheme: string;
  /** Optional per-object-type overrides */
  overrides: {
    /** Override specific object types with a different theme */
    objectTypeOverrides?: Partial<Record<ObjectType, string>>;
    /** Override specific WorldObject IDs with custom visual properties */
    objectOverrides?: Record<string, Partial<VisualProperties>>;
  };
  /** Quality level for LOD decisions */
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
  /** Whether to enable particle effects */
  enableParticles: boolean;
  /** Whether to enable post-processing (bloom, DOF) */
  enablePostProcessing: boolean;
}

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  activeTheme: 'low-poly',
  overrides: {},
  qualityLevel: 'high',
  enableParticles: true,
  enablePostProcessing: true,
};
```

### 2.1 Usage

```
// Orchestrator (conceptual)
const world = worldGenerator.generate(layoutOutput, graph);
const renderScene = themeEngine.generate(world, { activeTheme: 'fantasy' });
renderer.render(renderScene);
```

---

## 3. Core Data Structures

### 3.1 RenderScene

The top-level output of the Theme Engine. Contains all visual data needed by the Renderer to construct the Three.js scene.

```typescript
/**
 * The complete themed visual scene.
 * Contains a flat list of RenderObjects (for efficient rendering)
 * plus global scene settings.
 */
interface RenderScene {
  /** Metadata about this render scene */
  metadata: {
    /** Source WorldScene seed */
    seed: number;
    /** Graph ID this scene was generated from */
    graphId: string;
    /** Active theme name */
    theme: string;
    /** ISO timestamp of generation */
    generatedAt: string;
  };

  /** All renderable objects in the scene (flat list for efficient rendering) */
  objects: RenderObject[];

  /** Global scene settings */
  settings: SceneSettings;

  /** Post-processing effects */
  postProcessing: PostProcessingConfig;

  /** Animation definitions keyed by trigger event */
  animations: AnimationDefinition[];
}

/**
 * Global scene settings.
 */
interface SceneSettings {
  /** Ambient light color and intensity */
  ambientLight: { color: string; intensity: number };
  /** Directional light (sun) */
  sunLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
  };
  /** Fill light (sky bounce) */
  fillLight: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  /** Fog settings */
  fog: {
    color: string;
    near: number;
    far: number;
    density: number;
  } | null;
  /** Background color / sky */
  background: {
    type: 'color' | 'gradient' | 'skybox';
    value: string | [string, string] | string;
  };
  /** Shadow map settings */
  shadows: {
    enabled: boolean;
    mapSize: number;
    bias: number;
    normalBias: number;
  };
}
```

### 3.2 RenderObject

A single renderable entity in the scene. Contains all visual properties needed by the Renderer.

```typescript
/**
 * A single renderable object in the themed scene.
 * Every WorldObject becomes one or more RenderObjects.
 */
interface RenderObject {
  /** Unique identifier (matches source WorldObject ID) */
  id: string;
  /** Source WorldObject nodeId (for traceability) */
  nodeId: string;
  /** Human-readable label */
  label: string;
  /** Type of render object */
  type: ObjectType;
  /** Visual state */
  state: WorldObjectState;

  /** Spatial transform (from WorldObject, possibly modified by theme) */
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };

  /** Mesh definition */
  mesh: MeshDefinition;

  /** Material definition */
  material: MaterialDefinition;

  /** Child render objects (for composite objects like cities with buildings) */
  children: RenderObject[];

  /** Attached particle effects */
  effects: EffectDefinition[];

  /** Animation triggers for this object */
  animations: AnimationTrigger[];

  /** LOD levels (optional, for distant objects) */
  lodLevels?: LODLevel[];

  /** Whether this object casts/receives shadows */
  shadow: {
    cast: boolean;
    receive: boolean;
  };

  /** Render layer (for sorting and post-processing) */
  renderLayer: 'opaque' | 'transparent' | 'overlay' | 'effect';
}
```

### 3.3 MeshDefinition

Describes how to construct the geometry for a RenderObject. Does not contain actual Three.js geometry — only parameters.

```typescript
/**
 * Definition of a mesh geometry.
 * The Renderer uses this to create the actual Three.js geometry.
 */
interface MeshDefinition {
  /** Type of geometry to generate */
  type: MeshType;
  /** Parameters for the geometry generator */
  parameters: Record<string, unknown>;
  /** Whether to merge with sibling meshes (for instancing) */
  mergeable: boolean;
  /** Instance group ID (objects with same groupId can be instanced) */
  instanceGroupId?: string;
}

/**
 * Supported mesh types.
 * Each type has a corresponding generator in the Renderer.
 */
type MeshType =
  | 'sphere'          // Planet, atmosphere
  | 'plane'           // Terrain base
  | 'box'             // Buildings, platforms
  | 'cylinder'        // Towers, silos
  | 'cone'            // Spires, roofs
  | 'dome'            // Planetariums, observatories
  | 'ring'            // Orbital rings, space stations
  | 'tube'            // Roads, bridges
  | 'icosahedron'     // Crystals, geodesic domes
  | 'torus'           // Rings, donut structures
  | 'extrusion'       // Custom extruded shapes (landmarks)
  | 'lathe'           // Revolved shapes (columns, domes)
  | 'custom'          // Custom geometry (loaded from assets)
  | 'particle'        // Point cloud / particle system
  | 'sprite';         // Billboard sprite
```

### 3.4 MaterialDefinition

Describes the visual surface properties of a RenderObject.

```typescript
/**
 * Definition of a material.
 * The Renderer uses this to create the actual Three.js material.
 */
interface MaterialDefinition {
  /** Type of material */
  type: MaterialType;
  /** Base color (hex string) */
  color: string;
  /** Secondary color (for gradients, two-tone) */
  secondaryColor?: string;
  /** Emissive color (for glow effects) */
  emissive?: string;
  /** Emissive intensity */
  emissiveIntensity?: number;
  /** Roughness (0 = mirror, 1 = matte) */
  roughness: number;
  /** Metalness (0 = non-metal, 1 = metal) */
  metalness: number;
  /** Opacity (0 = transparent, 1 = opaque) */
  opacity: number;
  /** Whether material is transparent */
  transparent: boolean;
  /** Whether to use vertex colors */
  vertexColors: boolean;
  /** Wireframe mode */
  wireframe: boolean;
  /** Flat shading (vs smooth) */
  flatShading: boolean;
  /** Side to render */
  side: 'front' | 'back' | 'double';
  /** Texture references (loaded by Renderer) */
  textures?: {
    map?: string;
    normalMap?: string;
    roughnessMap?: string;
    metalnessMap?: string;
    emissiveMap?: string;
    alphaMap?: string;
  };
  /** Shader name (for custom shader materials) */
  shader?: string;
  /** Shader uniforms (for custom shader materials) */
  uniforms?: Record<string, unknown>;
}

/**
 * Supported material types.
 */
type MaterialType =
  | 'standard'        // MeshStandardMaterial
  | 'physical'        // MeshPhysicalMaterial (clearcoat, sheen)
  | 'phong'           // MeshPhongMaterial
  | 'lambert'         // MeshLambertMaterial
  | 'matte'           // MeshMatteMaterial
  | 'toon'            // MeshToonMaterial (cel-shaded)
  | 'normal'          // MeshNormalMaterial (debug)
  | 'depth'           // MeshDepthMaterial
  | 'shader'          // Custom ShaderMaterial
  | 'points'          // PointsMaterial (particles)
  | 'sprite'          // SpriteMaterial
  | 'line';           // LineBasicMaterial
```

### 3.5 ThemeDefinition

The complete definition of a theme. Contains all rules for mapping WorldObjects to visual properties.

```typescript
/**
 * Complete definition of a visual theme.
 * Themes are registered in the Theme Registry and selected by name.
 */
interface ThemeDefinition {
  /** Unique theme name */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Theme description */
  description: string;
  /** Theme version for compatibility checking */
  version: string;

  /** Global scene settings for this theme */
  sceneSettings: SceneSettings;

  /** Per-ObjectType mapping rules */
  objectMappings: Partial<Record<ObjectType, ObjectTypeMapping>>;

  /** Per-WorldObjectState visual overrides */
  stateOverrides: Partial<Record<WorldObjectState, StateVisualOverride>>;

  /** Color palette generation rules */
  colorRules: ColorRules;

  /** Scale modifiers per ObjectType */
  scaleModifiers: Partial<Record<ObjectType, number>>;

  /** Post-processing configuration */
  postProcessing: PostProcessingConfig;

  /** Default animation definitions */
  animations: AnimationDefinition[];

  /** Particle effect definitions */
  particleEffects: EffectDefinition[];

  /** LOD configuration */
  lodConfig: LODConfig;
}

/**
 * Mapping rules for a single ObjectType within a theme.
 */
interface ObjectTypeMapping {
  /** Mesh type to use */
  mesh: MeshType;
  /** Mesh parameters */
  meshParameters: Record<string, unknown>;
  /** Material type to use */
  material: MaterialType;
  /** Material parameters (can include functions of WorldObject metadata) */
  materialParameters: MaterialParameterFunction;
  /** Whether this object casts/receives shadows */
  shadow: { cast: boolean; receive: boolean };
  /** Render layer */
  renderLayer: 'opaque' | 'transparent' | 'overlay' | 'effect';
  /** Whether this object type can be instanced */
  instanceable: boolean;
  /** Child layout strategy (for composite objects) */
  childLayout?: 'radial' | 'grid' | 'random' | 'none';
}

/**
 * Visual overrides applied based on WorldObjectState.
 */
interface StateVisualOverride {
  /** Opacity multiplier (0 = invisible, 1 = full) */
  opacity: number;
  /** Emissive color override */
  emissive?: string;
  /** Emissive intensity */
  emissiveIntensity?: number;
  /** Whether to show construction scaffolding */
  showScaffolding: boolean;
  /** Whether to show glow effect */
  showGlow: boolean;
  /** Whether to show particle effects */
  showParticles: boolean;
  /** Whether object is clickable/interactive */
  interactive: boolean;
}

/**
 * Rules for generating deterministic color palettes.
 */
interface ColorRules {
  /** Base palette (array of hex colors) */
  basePalette: string[];
  /** How to derive colors from WorldObject metadata */
  derivation: {
    /** Use difficulty to index into palette */
    useDifficulty: boolean;
    /** Use importance to modulate hue */
    useImportance: boolean;
    /** Use biome hint to select palette subset */
    useBiome: boolean;
    /** Use hierarchy level to determine saturation */
    useHierarchy: boolean;
  };
  /** Color variation (hue shift, saturation, lightness) */
  variation: {
    /** Hue shift range in degrees (±) */
    hueShift: number;
    /** Saturation multiplier range */
    saturationRange: [number, number];
    /** Lightness multiplier range */
    lightnessRange: [number, number];
  };
}

/**
 * Post-processing configuration.
 */
interface PostProcessingConfig {
  /** Bloom effect */
  bloom?: {
    enabled: boolean;
    intensity: number;
    radius: number;
    threshold: number;
  };
  /** Depth of field */
  depthOfField?: {
    enabled: boolean;
    focalLength: number;
    blurStrength: number;
    focusRange: number;
  };
  /** Color grading */
  colorGrading?: {
    enabled: boolean;
    contrast: number;
    saturation: number;
    brightness: number;
    hue: number;
  };
  /** Vignette */
  vignette?: {
    enabled: boolean;
    darkness: number;
    offset: number;
  };
  /** Film grain */
  filmGrain?: {
    enabled: boolean;
    intensity: number;
  };
}

/**
 * LOD configuration.
 */
interface LODConfig {
  /** Number of LOD levels */
  levels: number;
  /** Distance thresholds for each level */
  distances: number[];
  /** Quality reduction per level (0–1) */
  qualityReduction: number;
}
```

### 3.6 EffectDefinition

Particle and visual effects attached to RenderObjects.

```typescript
/**
 * Definition of a visual effect (particles, glow, etc.).
 */
interface EffectDefinition {
  /** Effect type */
  type: EffectType;
  /** Effect parameters */
  parameters: Record<string, unknown>;
  /** Position relative to parent object */
  localPosition: [number, number, number];
  /** Whether effect is active */
  active: boolean;
}

/**
 * Supported effect types.
 */
type EffectType =
  | 'particle-burst'      // One-shot particle explosion
  | 'particle-stream'     // Continuous particle flow
  | 'particle-aura'       // Spherical particle halo
  | 'glow'                // Emissive glow sprite
  | 'pulse'               // Pulsing light/scale
  | 'scaffolding'         // Construction scaffolding mesh
  | 'beam'                // Light beam / spotlight
  | 'trail'               // Motion trail
  | 'sparkle'             // Twinkling sparkles
  | 'fog-patch'           // Localized fog
  | 'rain'                // Rain particles
  | 'snow';               // Snow particles
```

### 3.7 AnimationDefinition

Describes a timed visual transition.

```typescript
/**
 * Definition of an animation sequence.
 */
interface AnimationDefinition {
  /** Animation name */
  name: string;
  /** Trigger event that starts this animation */
  trigger: AnimationTrigger;
  /** Target property to animate */
  target: AnimationTarget;
  /** Animation parameters */
  parameters: AnimationParameters;
}

/**
 * Event that triggers an animation.
 */
interface AnimationTrigger {
  /** Type of trigger */
  type: 'state-change' | 'proximity' | 'click' | 'time' | 'completion';
  /** Value that activates the trigger */
  value: string | number;
  /** Delay before animation starts (seconds) */
  delay: number;
}

/**
 * Property to animate.
 */
interface AnimationTarget {
  /** Object property path (e.g., "transform.scale", "material.opacity") */
  property: string;
  /** Target value */
  to: number | [number, number, number] | string;
  /** Starting value (optional, uses current if omitted) */
  from?: number | [number, number, number] | string;
}

/**
 * Animation timing parameters.
 */
interface AnimationParameters {
  /** Duration in seconds */
  duration: number;
  /** Easing function name */
  easing: string;
  /** Number of repeats (-1 = infinite) */
  repeats: number;
  /** Whether to yoyo (reverse on repeat) */
  yoyo: boolean;
  /** Stagger delay for child objects (seconds) */
  stagger?: number;
}
```

### 3.8 LODLevel

Level-of-detail configuration for distant objects.

```typescript
/**
 * A single LOD level for a RenderObject.
 */
interface LODLevel {
  /** Distance threshold (camera distance at which this level activates) */
  distance: number;
  /** Mesh type at this LOD (simpler geometry for distant objects) */
  mesh: MeshType;
  /** Mesh parameters at this LOD */
  meshParameters: Record<string, unknown>;
  /** Material quality reduction (0–1) */
  materialQuality: number;
  /** Whether to skip effects at this LOD */
  skipEffects: boolean;
}
```

---

## 4. Theme System

### 4.1 Theme Registry

Themes are registered in a central registry and selected by name. The registry provides lookup, validation, and fallback.

```typescript
/**
 * Registry of available themes.
 * Themes are registered at application startup.
 */
interface ThemeRegistry {
  /** Register a new theme */
  register(theme: ThemeDefinition): void;
  /** Get a theme by name */
  get(name: string): ThemeDefinition;
  /** List all registered theme names */
  list(): string[];
  /** Check if a theme exists */
  has(name: string): boolean;
  /** Get the default theme */
  getDefault(): ThemeDefinition;
}
```

### 4.2 Built-in Themes

The MVP ships with 5 themes. Each theme defines a complete visual identity.

#### Low Poly (Default)

| Property | Value |
|----------|-------|
| Aesthetic | Geometric, faceted, minimalist |
| Colors | Muted earth tones, pastel accents |
| Materials | Flat-shaded, matte, no reflections |
| Lighting | Soft, diffuse, warm |
| Buildings | Box + triangular prism roof |
| Terrain | Faceted icosahedron |
| Vegetation | Low-poly cone trees |
| Atmosphere | Gradient sky, soft fog |
| Post-processing | Subtle bloom, light vignette |

```
Scene Settings:
  ambientLight: { color: "#ffeedd", intensity: 0.4 }
  sunLight: { color: "#ffffff", intensity: 1.2, position: [10, 15, 5] }
  fillLight: { color: "#88bbff", intensity: 0.3, position: [-5, -5, -10] }
  fog: { color: "#ddeeff", near: 30, far: 80, density: 0.02 }
  background: { type: "gradient", value: ["#87ceeb", "#e0f0ff"] }
```

#### Fantasy

| Property | Value |
|----------|-------|
| Aesthetic | Whimsical, organic, detailed |
| Colors | Rich jewel tones, gold accents |
| Materials | Slightly glossy, warm, emissive highlights |
| Lighting | Golden hour, warm, dramatic |
| Buildings | Stone + thatched roof, towers with spires |
| Terrain | Rolling hills, dramatic mountains |
| Vegetation | Detailed trees, glowing flora |
| Atmosphere | Warm sky, volumetric clouds, mist |
| Post-processing | Strong bloom, warm color grading, lens flare |

```
Scene Settings:
  ambientLight: { color: "#ffcc88", intensity: 0.3 }
  sunLight: { color: "#ffaa44", intensity: 1.5, position: [15, 20, 5] }
  fillLight: { color: "#8844ff", intensity: 0.2, position: [-10, -5, -15] }
  fog: { color: "#eeddcc", near: 40, far: 100, density: 0.01 }
  background: { type: "gradient", value: ["#ff8844", "#ffcc88"] }
```

#### Cyberpunk

| Property | Value |
|----------|-------|
| Aesthetic | Neon, angular, high-tech |
| Colors | Dark base, neon accents (cyan, magenta, yellow) |
| Materials | Glossy, metallic, emissive edges |
| Lighting | High contrast, colored lights, volumetric |
| Buildings | Tall, angular, neon strips, holographic signs |
| Terrain | Dark, geometric, grid patterns |
| Vegetation | Neon wireframe trees, holographic plants |
| Atmosphere | Dark sky, neon fog, rain |
| Post-processing | Strong bloom, chromatic aberration, film grain |

```
Scene Settings:
  ambientLight: { color: "#220044", intensity: 0.1 }
  sunLight: { color: "#ff00ff", intensity: 0.3, position: [5, 10, 3] }
  fillLight: { color: "#00ffff", intensity: 0.4, position: [-8, -3, -12] }
  fog: { color: "#110022", near: 20, far: 60, density: 0.03 }
  background: { type: "color", value: "#0a0015" }
```

#### Space

| Property | Value |
|----------|-------|
| Aesthetic | Clean, futuristic, minimal |
| Colors | White, silver, blue accents, deep space black |
| Materials | Metallic, reflective, clean |
| Lighting | Cool, clinical, high contrast |
| Buildings | Geometric, modular, solar panels |
| Terrain | Cratered, smooth, metallic |
| Vegetation | None (or crystalline formations) |
| Atmosphere | Star field, nebula, no fog |
| Post-processing | Subtle bloom, cool color grading |

```
Scene Settings:
  ambientLight: { color: "#4488ff", intensity: 0.2 }
  sunLight: { color: "#ffffff", intensity: 2.0, position: [20, 10, 5] }
  fillLight: { color: "#0044ff", intensity: 0.1, position: [-10, -5, -20] }
  fog: null
  background: { type: "color", value: "#000005" }
```

#### Minimal

| Property | Value |
|----------|-------|
| Aesthetic | Ultra-clean, monochrome, functional |
| Colors | White, light grey, single accent color |
| Materials | Matte, uniform, no reflections |
| Lighting | Even, shadowless, clinical |
| Buildings | Simple boxes, no decoration |
| Terrain | Smooth, uniform, low contrast |
| Vegetation | Simple spheres or omitted |
| Atmosphere | White/light grey, no effects |
| Post-processing | None |

```
Scene Settings:
  ambientLight: { color: "#ffffff", intensity: 0.6 }
  sunLight: { color: "#ffffff", intensity: 0.8, position: [5, 10, 5] }
  fillLight: { color: "#ffffff", intensity: 0.4, position: [-5, -5, -10] }
  fog: { color: "#ffffff", near: 50, far: 120, density: 0.005 }
  background: { type: "color", value: "#f5f5f5" }
```

### 4.3 Theme Selection Algorithm

```
User selects theme "fantasy"
    │
    ▼
┌──────────────────────────────────────┐
│ 1. Lookup theme in registry          │
│    - If found: use ThemeDefinition   │
│    - If not found: fall back to      │
│      default theme ("low-poly")      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Validate theme compatibility      │
│    - Check all ObjectTypes in        │
│      WorldScene have mappings        │
│    - If missing: use default mapping │
│      from low-poly theme             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Apply user overrides              │
│    - ObjectType overrides            │
│    - Per-object overrides            │
│    - Quality level adjustments       │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Generate RenderScene              │
│    - Apply all mappings              │
│    - Generate colors                 │
│    - Assign materials                │
│    - Attach effects                  │
│    - Assign animations               │
└──────────────────────────────────────┘
```

---

## 5. Mapping Rules

### 5.1 ObjectType → Visual Properties

For every ObjectType, the Theme Engine determines:

| ObjectType | Mesh | Material | Colors | Animations | Effects |
|------------|------|----------|--------|------------|---------|
| `planet` | sphere | standard | Base from theme | Slow rotation | Atmosphere glow |
| `continent` | plane (terrain) | standard | Biome-derived | None | None |
| `region` | plane (sub-terrain) | standard | Sub-biome | None | None |
| `city` | box (platform) | standard | Importance-derived | Construction reveal | Pulsing border |
| `district` | box (small platform) | standard | Difficulty-derived | Construction reveal | None |
| `building` | box/cylinder/cone | per theme | Difficulty + importance | Construction rise | Window glow |
| `landmark` | custom/extrusion | physical | Max importance | Special reveal | Glow aura, particles |
| `road` | tube | standard | Edge weight | None | Traffic particles |
| `bridge` | tube (arched) | standard | Edge type | None | None |
| `tunnel` | tube (dark) | standard | Edge type | None | Portal glow |
| `sky-bridge` | tube (glowing) | shader | Edge type | Float animation | Trail particles |
| `terrain` | sphere (heightmap) | standard | Biome-derived | None | None |
| `water` | sphere (animated) | physical | Blue/teal | Wave animation | Reflection |
| `atmosphere` | sphere (shader) | shader | Theme primary | Shimmer | Rim glow |
| `vegetation` | cone/sphere | toon | XP-derived | Sway animation | None |
| `rock` | icosahedron | standard | Random | None | None |
| `cloud` | sphere (transparent) | standard | White | Drift animation | None |
| `particle` | sprite | sprite | Theme accent | Float | Sparkle |

### 5.2 State → Visual Overrides

| WorldObjectState | Opacity | Emissive | Scaffolding | Glow | Particles | Interactive |
|------------------|---------|----------|-------------|------|-----------|-------------|
| `hidden` | 0 | none | false | false | false | false |
| `locked` | 0.3 | dark grey | true | false | false | true |
| `available` | 0.6 | none | true | false | false | true |
| `in-progress` | 0.8 | yellow | true | false | construction | true |
| `completed` | 1.0 | none | false | false | false | true |
| `shining` | 1.0 | gold | false | true | celebration | true |

### 5.3 Color Derivation

Colors are derived deterministically from WorldObject metadata combined with theme color rules.

```typescript
function deriveColor(
  worldObject: WorldObject,
  theme: ThemeDefinition,
  prng: SeededRandom,
): string {
  const rules = theme.colorRules;
  const palette = rules.basePalette;

  // Select base color from palette using deterministic index
  let index = 0;

  if (rules.derivation.useDifficulty) {
    index += worldObject.metadata.difficulty - 1;
  }

  if (rules.derivation.useImportance) {
    index += Math.floor(worldObject.metadata.importance / 3);
  }

  if (rules.derivation.useBiome) {
    const biome = worldObject.metadata.data.biomeHint as string;
    const biomeOffset = hashString(biome) % 3;
    index += biomeOffset;
  }

  if (rules.derivation.useHierarchy) {
    const hierarchyLevel = worldObject.metadata.data.hierarchyLevel as string;
    const hierarchyOrder = [
      'planet', 'continent', 'region', 'city',
      'district', 'building', 'landmark',
    ];
    const levelIndex = hierarchyOrder.indexOf(hierarchyLevel);
    index += levelIndex;
  }

  // Wrap around palette
  const baseColor = palette[index % palette.length];

  // Apply variation
  const hueShift = prng.range(-rules.variation.hueShift, rules.variation.hueShift);
  const satMult = prng.range(
    rules.variation.saturationRange[0],
    rules.variation.saturationRange[1],
  );
  const lightMult = prng.range(
    rules.variation.lightnessRange[0],
    rules.variation.lightnessRange[1],
  );

  return adjustColor(baseColor, hueShift, satMult, lightMult);
}
```

### 5.4 Scale Modulation

Each theme can apply scale modifiers per ObjectType. These are multiplicative on top of the WorldGenerator's computed scale.

```typescript
function applyScaleModifiers(
  worldObject: WorldObject,
  theme: ThemeDefinition,
): [number, number, number] {
  const modifier = theme.scaleModifiers[worldObject.type] ?? 1.0;
  const [x, y, z] = worldObject.transform.scale;
  return [x * modifier, y * modifier, z * modifier];
}
```

Example modifiers:

| ObjectType | Low Poly | Fantasy | Cyberpunk | Space | Minimal |
|------------|----------|---------|-----------|-------|---------|
| building | 1.0 | 1.3 (wider) | 1.5 (taller) | 1.2 | 0.9 |
| landmark | 1.0 | 1.5 | 1.3 | 1.4 | 1.0 |
| vegetation | 1.0 | 1.4 | 0.8 | 0.0 | 0.5 |
| city | 1.0 | 1.2 | 1.1 | 1.0 | 0.9 |

---

## 6. Pipeline

The Theme Engine processes WorldScene → RenderScene through **5 sequential stages**.

```
WorldScene + ThemeConfig
         │
         ▼
┌──────────────────────────────────┐
│ 1. Theme Selection               │  ← Resolve active theme, validate, apply overrides
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 2. Asset Mapping                 │  ← Map each WorldObject to MeshDefinition + MaterialDefinition
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 3. Material Assignment           │  ← Generate colors, apply state overrides, assign textures
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 4. Animation & Effect Assignment │  ← Attach animations and particle effects
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 5. RenderScene Assembly          │  ← Flatten hierarchy, compute LOD, assemble output
└──────────────┬───────────────────┘
               │
               ▼
         RenderScene
```

### Stage 1 — Theme Selection

**Purpose**: Resolve the active theme, validate it against the WorldScene, and apply any user overrides.

**Process**:
```
1. Look up theme name in ThemeRegistry
   - If found: use ThemeDefinition
   - If not found: log warning, fall back to 'low-poly'

2. Validate theme compatibility:
   - For each ObjectType present in WorldScene:
     - Check theme.objectMappings has an entry
     - If missing: use default mapping from 'low-poly' theme
   - Check all required scene settings are present
   - If missing: fill from 'low-poly' defaults

3. Apply user overrides:
   - If themeConfig.overrides.objectTypeOverrides exists:
     - For each override, replace the corresponding ObjectTypeMapping
   - If themeConfig.overrides.objectOverrides exists:
     - For each object ID, merge overrides into the mapping

4. Apply quality level:
   - 'low': Disable post-processing, reduce particle count, lower shadow map
   - 'medium': Reduce particle count, lower shadow map
   - 'high': Full quality
   - 'ultra': Full quality + extra effects
```

**Output**: Resolved ThemeDefinition with all overrides applied.

### Stage 2 — Asset Mapping

**Purpose**: For every WorldObject in the scene, determine which mesh and material to use.

**Process**:
```
For each WorldObject in WorldScene (recursive traversal):
  1. Look up ObjectTypeMapping from theme.objectMappings[worldObject.type]
  2. If no mapping exists, use fallback from 'low-poly' theme

  3. Create MeshDefinition:
     - type: mapping.mesh
     - parameters: evaluate mapping.meshParameters (may be functions of WorldObject metadata)
     - mergeable: mapping.instanceable
     - instanceGroupId: worldObject.type (same type = same group)

  4. Create base MaterialDefinition:
     - type: mapping.material
     - color: deriveColor(worldObject, theme, prng)
     - roughness, metalness, etc. from mapping.materialParameters
     - textures: from mapping.materialParameters (may reference biome)

  5. Create RenderObject:
     - id, nodeId, label, type, state from WorldObject
     - transform: applyScaleModifiers(worldObject, theme)
     - mesh: MeshDefinition
     - material: MaterialDefinition (will be refined in Stage 3)
     - children: [] (will be populated recursively)
     - effects: []
     - animations: []
     - shadow: mapping.shadow
     - renderLayer: mapping.renderLayer
     - lodLevels: [] (will be computed in Stage 5)

  6. Recursively process children
```

**Output**: Tree of RenderObjects with base mesh and material assignments.

### Stage 3 — Material Assignment

**Purpose**: Refine material definitions with state-based overrides, textures, and shader references.

**Process**:
```
For each RenderObject:
  1. Get state override from theme.stateOverrides[renderObject.state]
  2. Apply state overrides to material:
     - material.opacity *= stateOverride.opacity
     - If stateOverride.emissive: material.emissive = stateOverride.emissive
     - If stateOverride.emissiveIntensity: material.emissiveIntensity = stateOverride.emissiveIntensity

  3. Assign textures based on biome hint:
     - If worldObject.metadata.data.biomeHint exists:
       - Look up texture set for that biome in theme
       - Assign map, normalMap, roughnessMap, etc.

  4. If material.type === 'shader':
     - Set shader name from mapping
     - Initialize uniforms from WorldObject metadata

  5. Apply quality level adjustments:
     - 'low': Disable normal maps, reduce texture resolution
     - 'medium': Reduce texture resolution
```

**Output**: RenderObjects with fully resolved MaterialDefinitions.

### Stage 4 — Animation & Effect Assignment

**Purpose**: Attach animations and particle effects based on WorldObject state and theme.

**Process**:
```
For each RenderObject:
  1. Get state override from theme.stateOverrides[renderObject.state]

  2. If stateOverride.showGlow:
     - Add EffectDefinition: { type: 'glow', parameters: { color, intensity, radius } }

  3. If stateOverride.showParticles:
     - For 'in-progress' state: add construction particle effects
       - EffectDefinition: { type: 'particle-stream', parameters: { count, color, speed } }
     - For 'shining' state: add celebration particle effects
       - EffectDefinition: { type: 'particle-burst', parameters: { count, color, spread } }

  4. If stateOverride.showScaffolding:
     - Add EffectDefinition: { type: 'scaffolding', parameters: { height, color } }

  5. Assign animations from theme.animations:
     - For each animation where trigger matches:
       - If trigger.type === 'state-change' && trigger.value === renderObject.state:
         - Add AnimationTrigger to renderObject.animations
     - For 'shining' state: add pulsing glow animation
     - For 'in-progress' state: add construction rise animation

  6. Recursively process children
```

**Output**: RenderObjects with fully resolved effects and animation triggers.

### Stage 5 — RenderScene Assembly

**Purpose**: Flatten the RenderObject tree into a flat list, compute LOD levels, and assemble the final RenderScene.

**Process**:
```
1. Flatten RenderObject tree:
   - Recursively traverse all RenderObjects
   - Collect into flat objects array
   - Preserve parent-child relationships via children arrays

2. Compute LOD levels:
   - For each RenderObject:
     - If object is instanceable (same instanceGroupId):
       - Generate LOD levels with reduced geometry complexity
     - If object is large (landmark, continent):
       - Generate 3 LOD levels
     - If object is small (vegetation, rock):
       - Generate 1 LOD level (or skip if far)

3. Compute instance groups:
   - Group RenderObjects by instanceGroupId
   - For each group, create an InstancedRenderGroup
   - Store transform matrices for each instance

4. Assemble RenderScene:
   - metadata: seed, graphId, theme, timestamp
   - objects: flattened RenderObject array
   - settings: theme.sceneSettings (with quality adjustments)
   - postProcessing: theme.postProcessing (with quality adjustments)
   - animations: theme.animations (with object-specific triggers)

5. Validate RenderScene:
   - All RenderObjects have valid MeshDefinitions
   - All MaterialDefinitions have valid colors
   - No NaN values in transforms
   - All IDs are unique
```

**Output**: Complete RenderScene ready for the Renderer.

---

## 7. Determinism

### 7.1 Determinism Sources

The Theme Engine uses the **same seed** as the World Generator (from `WorldScene.metadata.seed`). All stochastic decisions use a SeededRandom instance initialized from this seed.

| Decision | PRNG Usage | Determinism Guarantee |
|----------|-----------|----------------------|
| Color variation (hue shift) | `prng.range(-hueShift, hueShift)` | Same seed → same color |
| Color variation (saturation) | `prng.range(satMin, satMax)` | Same seed → same saturation |
| Color variation (lightness) | `prng.range(lightMin, lightMax)` | Same seed → same lightness |
| Particle effect parameters | `prng.range()` for count, speed, spread | Same seed → same particles |
| Animation timing variation | `prng.range()` for stagger offsets | Same seed → same timing |
| LOD distance thresholds | Deterministic from object size | No randomness |

### 7.2 Seed Flow

```
WorldScene.metadata.seed (from Layout Engine)
    │
    ▼
Theme Engine: SeededRandom(seed)
    │
    ├── Color derivation (hue, saturation, lightness)
    ├── Particle effect parameters
    └── Animation timing offsets
```

### 7.3 Reproducibility Guarantee

Given the same WorldScene and ThemeConfig, the Theme Engine guarantees:

1. Same number of RenderObjects
2. Same MeshDefinition for every RenderObject
3. Same MaterialDefinition (color, roughness, metalness, etc.) for every RenderObject
4. Same EffectDefinition count and parameters for every RenderObject
5. Same AnimationTrigger assignments
6. Same LOD levels and distances
7. Same SceneSettings
8. Same PostProcessingConfig

This holds across JavaScript runtimes, OS platforms, and CPU architectures.

---

## 8. Extensibility

### 8.1 New Themes

Adding a new theme requires:

1. Create a new `ThemeDefinition` object with all required mappings
2. Register it in the ThemeRegistry
3. No changes to World Generator, Renderer, or existing themes

```typescript
// Example: Adding a "steampunk" theme
const steampunkTheme: ThemeDefinition = {
  name: 'steampunk',
  displayName: 'Steampunk',
  description: 'Victorian industrial aesthetic with brass and copper',
  version: '1.0.0',
  sceneSettings: { /* warm, sepia-toned lighting */ },
  objectMappings: {
    building: {
      mesh: 'extrusion',
      meshParameters: { style: 'victorian' },
      material: 'physical',
      materialParameters: { /* brass, copper, wood */ },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: true,
    },
    // ... other mappings
  },
  // ... other properties
};

themeRegistry.register(steampunkTheme);
```

### 8.2 LOD (Level of Detail)

LOD is built into the RenderObject structure. Each object can have multiple LOD levels with progressively simpler geometry. The Renderer switches between levels based on camera distance.

```typescript
// Future: LOD generation in Theme Engine
function generateLODLevels(
  renderObject: RenderObject,
  theme: ThemeDefinition,
): LODLevel[] {
  const config = theme.lodConfig;
  const levels: LODLevel[] = [];

  for (let i = 0; i < config.levels; i++) {
    const quality = 1.0 - (i * config.qualityReduction);
    levels.push({
      distance: config.distances[i],
      mesh: simplifyMesh(renderObject.mesh, quality),
      meshParameters: simplifyParameters(renderObject.mesh.parameters, quality),
      materialQuality: quality,
      skipEffects: i >= 2,
    });
  }

  return levels;
}
```

### 8.3 Procedural Materials

Materials can be procedural (generated at runtime) rather than texture-based. The Theme Engine supports this via the `shader` material type.

```typescript
// Future: Procedural material definition
const proceduralMaterial: MaterialDefinition = {
  type: 'shader',
  shader: 'terrain-biome',
  uniforms: {
    biomeColor1: { value: '#4a7c59' },
    biomeColor2: { value: '#2d5a3d' },
    elevationRange: { value: [0.0, 1.0] },
    noiseScale: { value: 2.5 },
  },
  // ... other properties
};
```

### 8.4 Custom Shaders

Shaders are referenced by name in MaterialDefinition. The Renderer maintains a shader registry and loads/compiles shaders as needed.

```typescript
// Future: Shader reference in theme
const shaderMaterial: MaterialDefinition = {
  type: 'shader',
  shader: 'atmosphere-rim',
  uniforms: {
    glowColor: { value: '#4488ff' },
    rimPower: { value: 3.0 },
    opacity: { value: 0.12 },
  },
};
```

### 8.5 Seasonal Themes

Seasonal themes can be implemented as theme overrides rather than full themes. A "winter" override would modify color palettes, add snow effects, and adjust lighting.

```typescript
// Future: Seasonal theme override
const winterOverride: Partial<ThemeDefinition> = {
  name: 'fantasy-winter',
  displayName: 'Fantasy (Winter)',
  colorRules: {
    basePalette: ['#e8f0ff', '#c0d8f0', '#a0c0e0', '#8098b0', '#607090'],
    derivation: { /* same as base */ },
    variation: { /* reduced saturation, increased lightness */ },
  },
  particleEffects: [
    { type: 'snow', parameters: { count: 1000, speed: 0.5 } },
  ],
  sceneSettings: {
    ambientLight: { color: '#c0d8ff', intensity: 0.5 },
    // ... cooler lighting
  },
};
```

### 8.6 User-Created Themes

Users can create custom themes by providing a partial ThemeDefinition. The Theme Engine merges it with a base theme.

```typescript
// Future: User-created theme
const userTheme: Partial<ThemeDefinition> = {
  name: 'my-custom-theme',
  displayName: 'My Theme',
  colorRules: {
    basePalette: ['#ff0000', '#00ff00', '#0000ff'],
    derivation: { useDifficulty: true, useImportance: false, useBiome: false, useHierarchy: false },
    variation: { hueShift: 0, saturationRange: [1, 1], lightnessRange: [1, 1] },
  },
};

const mergedTheme = mergeTheme(baseTheme, userTheme);
themeRegistry.register(mergedTheme);
```

---

## 9. Separation from Other Systems

### 9.1 Separation from World Generator

| Concern | Theme Engine | World Generator |
|---------|--------------|-----------------|
| WorldObject hierarchy | Reads, does not modify | Creates and owns |
| Spatial positions | Reads, may scale | Computes |
| Object types | Maps to visual properties | Assigns from graph hierarchy |
| Metadata | Uses for color/material derivation | Stores from graph |
| State | Maps to visual overrides | Computes from graph progress |
| Decorations | Assigns meshes and materials | Creates empty arrays |
| Roads | Assigns visual properties | Creates empty arrays |

The Theme Engine never calls the World Generator. It receives a fully computed WorldScene and works from that.

### 9.2 Separation from Renderer

| Concern | Theme Engine | Renderer |
|---------|--------------|----------|
| Three.js | Never imported | Core dependency |
| Geometry creation | Produces MeshDefinition (parameters) | Creates actual BufferGeometry |
| Material creation | Produces MaterialDefinition (parameters) | Creates actual Material |
| Scene graph | Produces flat RenderObject list | Constructs R3F scene tree |
| Shaders | References by name | Loads, compiles, manages |
| Animations | Produces AnimationDefinition | Creates GSAP timelines |
| Particles | Produces EffectDefinition | Creates particle systems |
| LOD switching | Computes LOD levels | Switches at runtime |
| Instancing | Groups by instanceGroupId | Creates InstancedMesh |

The Theme Engine produces abstract visual data only. The Renderer is the first system that creates actual Three.js objects.

### 9.3 Separation from Animation Engine

| Concern | Theme Engine | Animation Engine |
|---------|--------------|------------------|
| Animation definitions | Produces AnimationDefinition | Consumes and executes |
| Timeline creation | Never creates | Creates GSAP timelines |
| Easing functions | References by name | Imports and applies |
| State transitions | Defines triggers | Listens and reacts |
| Construction sequences | Defines parameters | Orchestrates |

---

## 10. UML Diagrams

### 10.1 Component Diagram

```
┌─────────────┐     WorldScene     ┌──────────────────────────────────────┐
│  World      │───────────────────>│          Theme Engine                │
│  Generator  │                    │                                      │
└─────────────┘                    │  ┌──────────────┐  ┌──────────────┐  │
                                   │  │  Theme       │  │  Asset       │  │
┌─────────────┐     ThemeConfig    │  │  Selector    │  │  Mapper      │  │
│  User/UI    │───────────────────>│  └──────┬───────┘  └──────┬───────┘  │
└─────────────┘                    │         │                  │          │
                                   │         ▼                  ▼          │
┌─────────────┐                    │  ┌──────────────┐  ┌──────────────┐  │
│  Theme      │     ThemeDef       │  │  Material    │  │  Animation   │  │
│  Registry   │<───────────────────│  │  Assigner    │  │  Assigner    │  │
└─────────────┘                    │  └──────┬───────┘  └──────┬───────┘  │
                                   │         │                  │          │
                                   │         ▼                  ▼          │
                                   │  ┌──────────────────────────────────┐│
                                   │  │      RenderScene Assembler       ││
                                   │  └──────────────┬───────────────────┘│
                                   └─────────────────┼────────────────────┘
                                                     │
                                                RenderScene
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │      Renderer        │
                                          └──────────────────────┘
```

### 10.2 Sequence Diagram — Full Pipeline

```
User                    World Generator       Theme Engine          Theme Registry       Renderer
 │                          │                     │                     │                  │
 │  Generate World          │                     │                     │                  │
 │─────────────────────────>│                     │                     │                  │
 │                          │                     │                     │                  │
 │                    WorldScene                  │                     │                  │
 │<─────────────────────────│                     │                     │                  │
 │                          │                     │                     │                  │
 │  Apply Theme             │                     │                     │                  │
 │────────────────────────────────────────────────>                     │                  │
 │                          │                     │                     │                  │
 │                          │                     │  1. Select Theme    │                  │
 │                          │                     │────────────────────>│                  │
 │                          │                     │  ThemeDefinition    │                  │
 │                          │                     │<────────────────────│                  │
 │                          │                     │                     │                  │
 │                          │                     │  2. Map Assets      │                  │
 │                          │                     │  3. Assign Materials│                  │
 │                          │                     │  4. Assign Anims    │                  │
 │                          │                     │  5. Assemble Scene  │                  │
 │                          │                     │                     │                  │
 │                          │                     │            RenderScene               │
 │                          │                     │─────────────────────────────────────>│
 │                          │                     │                     │                  │
 │                          │                     │                     │   Render Scene  │
 │                          │                     │                     │                  │
 │<──────────────────────────────────────────────────────────────────────────────────────│
```

### 10.3 Class Diagram — RenderScene Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                          RenderScene                                  │
├─────────────────────────────────────────────────────────────────────┤
│ - metadata: SceneMetadata                                             │
│ - objects: RenderObject[]                                             │
│ - settings: SceneSettings                                             │
│ - postProcessing: PostProcessingConfig                                │
│ - animations: AnimationDefinition[]                                   │
└─────────────────────────────────────────────────────────────────────┘
         │ 0..*
         │ contains
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          RenderObject                                 │
├─────────────────────────────────────────────────────────────────────┤
│ + id: string                                                         │
│ + nodeId: string                                                     │
│ + label: string                                                      │
│ + type: ObjectType                                                   │
│ + state: WorldObjectState                                            │
│ + transform: Transform                                               │
│ + mesh: MeshDefinition                                               │
│ + material: MaterialDefinition                                       │
│ + children: RenderObject[]                                           │ 0..*
│ + effects: EffectDefinition[]                                        │ 0..*
│ + animations: AnimationTrigger[]                                     │ 0..*
│ + lodLevels: LODLevel[]                                              │ 0..*
│ + shadow: { cast: boolean, receive: boolean }                        │
│ + renderLayer: 'opaque' | 'transparent' | 'overlay' | 'effect'      │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ references
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MeshDefinition                                   │
├─────────────────────────────────────────────────────────────────────┤
│ + type: MeshType                                                     │
│ + parameters: Record<string, unknown>                                │
│ + mergeable: boolean                                                 │
│ + instanceGroupId?: string                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MaterialDefinition                                 │
├─────────────────────────────────────────────────────────────────────┤
│ + type: MaterialType                                                 │
│ + color: string                                                      │
│ + secondaryColor?: string                                            │
│ + emissive?: string                                                  │
│ + emissiveIntensity?: number                                         │
│ + roughness: number                                                  │
│ + metalness: number                                                  │
│ + opacity: number                                                    │
│ + transparent: boolean                                               │
│ + vertexColors: boolean                                              │
│ + wireframe: boolean                                                 │
│ + flatShading: boolean                                               │
│ + side: 'front' | 'back' | 'double'                                 │
│ + textures?: TextureMap                                              │
│ + shader?: string                                                    │
│ + uniforms?: Record<string, unknown>                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.4 State → Visual Mapping Diagram

```
WorldObjectState          Visual Representation
──────────────────────────────────────────────────────────────────
HIDDEN                    [Not rendered]
                              │
                              │ Parent node status changes to 'available'
                              ▼
LOCKED                    [Visible but obscured]
                          - Opacity: 0.3
                          - Dark fog overlay
                          - Scaffolding mesh
                          - No glow, no particles
                              │
                              │ User starts learning
                              ▼
IN-PROGRESS               [Construction animation]
                          - Opacity: 0.8
                          - Yellow emissive highlights
                          - Scaffolding + crane particles
                          - Rising animation (0% → 100% height)
                              │
                              │ All sub-skills completed
                              ▼
COMPLETED                 [Fully built]
                          - Opacity: 1.0
                          - Normal material
                          - No scaffolding
                          - No glow (unless milestone)
                              │
                              │ Is milestone node
                              ▼
SHINING                   [Celebration]
                          - Opacity: 1.0
                          - Gold emissive glow
                          - Particle burst (sparkles)
                          - Pulsing animation
                          - Glow aura sprite
```

---

## Appendix A: Theme Definition Template

```typescript
const themeTemplate: ThemeDefinition = {
  name: 'my-theme',
  displayName: 'My Theme',
  description: 'Description of the theme',
  version: '1.0.0',

  sceneSettings: {
    ambientLight: { color: '#ffffff', intensity: 0.4 },
    sunLight: {
      color: '#ffffff',
      intensity: 1.0,
      position: [10, 15, 5],
      castShadow: true,
    },
    fillLight: {
      color: '#88bbff',
      intensity: 0.3,
      position: [-5, -5, -10],
    },
    fog: null,
    background: { type: 'color', value: '#000000' },
    shadows: {
      enabled: true,
      mapSize: 2048,
      bias: -0.001,
      normalBias: 0.02,
    },
  },

  objectMappings: {
    planet: {
      mesh: 'sphere',
      meshParameters: { radius: 5, segments: 64 },
      material: 'standard',
      materialParameters: {
        roughness: 0.7,
        metalness: 0.1,
        vertexColors: true,
      },
      shadow: { cast: false, receive: false },
      renderLayer: 'opaque',
      instanceable: false,
    },
    continent: {
      mesh: 'plane',
      meshParameters: { width: 10, height: 10, segments: 32 },
      material: 'standard',
      materialParameters: {
        roughness: 0.8,
        metalness: 0.0,
        vertexColors: true,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: false,
    },
    city: {
      mesh: 'box',
      meshParameters: { width: 1, height: 0.2, depth: 1 },
      material: 'standard',
      materialParameters: {
        roughness: 0.6,
        metalness: 0.2,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: false,
      childLayout: 'radial',
    },
    building: {
      mesh: 'box',
      meshParameters: { width: 0.3, height: 0.5, depth: 0.3 },
      material: 'standard',
      materialParameters: {
        roughness: 0.5,
        metalness: 0.3,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: true,
    },
    landmark: {
      mesh: 'custom',
      meshParameters: { style: 'tower' },
      material: 'physical',
      materialParameters: {
        roughness: 0.3,
        metalness: 0.7,
        clearcoat: 0.5,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: false,
    },
    road: {
      mesh: 'tube',
      meshParameters: { radius: 0.05, segments: 8 },
      material: 'standard',
      materialParameters: {
        roughness: 0.9,
        metalness: 0.0,
      },
      shadow: { cast: false, receive: true },
      renderLayer: 'opaque',
      instanceable: false,
    },
    vegetation: {
      mesh: 'cone',
      meshParameters: { radius: 0.1, height: 0.3, segments: 6 },
      material: 'toon',
      materialParameters: {
        roughness: 0.8,
        metalness: 0.0,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: true,
    },
    atmosphere: {
      mesh: 'sphere',
      meshParameters: { radius: 5.75, segments: 32 },
      material: 'shader',
      materialParameters: {
        shader: 'atmosphere-rim',
        uniforms: {
          glowColor: { value: '#4488ff' },
          rimPower: { value: 3.0 },
          opacity: { value: 0.12 },
        },
      },
      shadow: { cast: false, receive: false },
      renderLayer: 'transparent',
      instanceable: false,
    },
    water: {
      mesh: 'sphere',
      meshParameters: { radius: 5.1, segments: 64 },
      material: 'physical',
      materialParameters: {
        color: '#1a5276',
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.8,
      },
      shadow: { cast: false, receive: true },
      renderLayer: 'transparent',
      instanceable: false,
    },
    terrain: {
      mesh: 'sphere',
      meshParameters: { radius: 5, segments: 128 },
      material: 'standard',
      materialParameters: {
        roughness: 0.9,
        metalness: 0.0,
        vertexColors: true,
      },
      shadow: { cast: true, receive: true },
      renderLayer: 'opaque',
      instanceable: false,
    },
  },

  stateOverrides: {
    hidden: {
      opacity: 0,
      showScaffolding: false,
      showGlow: false,
      showParticles: false,
      interactive: false,
    },
    locked: {
      opacity: 0.3,
      emissive: '#333333',
      emissiveIntensity: 0.1,
      showScaffolding: true,
      showGlow: false,
      showParticles: false,
      interactive: true,
    },
    available: {
      opacity: 0.6,
      showScaffolding: true,
      showGlow: false,
      showParticles: false,
      interactive: true,
    },
    'in-progress': {
      opacity: 0.8,
      emissive: '#ffaa00',
      emissiveIntensity: 0.3,
      showScaffolding: true,
      showGlow: false,
      showParticles: true,
      interactive: true,
    },
    completed: {
      opacity: 1.0,
      showScaffolding: false,
      showGlow: false,
      showParticles: false,
      interactive: true,
    },
    shining: {
      opacity: 1.0,
      emissive: '#ffd700',
      emissiveIntensity: 0.8,
      showScaffolding: false,
      showGlow: true,
      showParticles: true,
      interactive: true,
    },
  },

  colorRules: {
    basePalette: ['#4a7c59', '#2d5a3d', '#8b6f47', '#5c4033', '#a0522d'],
    derivation: {
      useDifficulty: true,
      useImportance: true,
      useBiome: true,
      useHierarchy: true,
    },
    variation: {
      hueShift: 15,
      saturationRange: [0.8, 1.2],
      lightnessRange: [0.9, 1.1],
    },
  },

  scaleModifiers: {
    building: 1.0,
    landmark: 1.0,
    vegetation: 1.0,
    city: 1.0,
  },

  postProcessing: {
    bloom: {
      enabled: true,
      intensity: 0.5,
      radius: 0.3,
      threshold: 0.8,
    },
    colorGrading: {
      enabled: true,
      contrast: 1.0,
      saturation: 1.0,
      brightness: 1.0,
      hue: 0,
    },
  },

  animations: [
    {
      name: 'construction-rise',
      trigger: { type: 'state-change', value: 'in-progress', delay: 0 },
      target: { property: 'transform.scale.y', from: 0, to: 1 },
      parameters: { duration: 2.0, easing: 'power3.out', repeats: 0, yoyo: false },
    },
    {
      name: 'shining-pulse',
      trigger: { type: 'state-change', value: 'shining', delay: 0.5 },
      target: { property: 'material.emissiveIntensity', from: 0.5, to: 1.0 },
      parameters: { duration: 1.5, easing: 'sine.inOut', repeats: -1, yoyo: true },
    },
  ],

  particleEffects: [
    {
      type: 'particle-burst',
      parameters: { count: 50, color: '#ffd700', spread: 2.0, speed: 1.0 },
      localPosition: [0, 1, 0],
      active: true,
    },
  ],

  lodConfig: {
    levels: 3,
    distances: [10, 30, 60],
    qualityReduction: 0.3,
  },
};
```

---

## Appendix B: Comparison with Alternative Approaches

| Approach | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| **Theme Engine as data transformer** (chosen) | Clean separation, testable, swappable themes | More files to maintain | — |
| **Theme as CSS-like stylesheets** | Familiar syntax, easy to author | Limited expressiveness for 3D | Can't describe meshes, shaders, particles |
| **Theme as shader-only** | Maximum visual flexibility | Steep learning curve, hard to author | Not accessible to non-developers |
| **Theme baked into World Generator** | Fewer pipeline stages | Violates separation of concerns | Can't swap themes without regenerating world |
| **Theme as runtime Three.js code** | Maximum runtime flexibility | Not serializable, hard to debug | Can't preview themes without rendering |

---

**End of THEME_ENGINE.md**

*This document defines the complete architecture for the Theme Engine system. It serves as the blueprint for implementation in Sprint MVP System #4. The design ensures clean separation from the World Generator (System #3) and Renderer (System #5), with the Theme Engine acting as the bridge between abstract world data and concrete visual representation.*
