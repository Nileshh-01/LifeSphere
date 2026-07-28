# LifeSphere

## Vision

A 3D planet representing a user's learning journey. Every user starts with an empty planet. Learning goals are transformed by AI into a dependency graph of skills, which is procedurally generated into a living 3D world. Skills become cities, districts, buildings, forests, laboratories, and bridges. Completing skills visually transforms the world through construction, vegetation, weather, lighting, and animations.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| 3D Rendering | React Three Fiber + Three.js |
| Animation | GSAP |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Graph Editor | React Flow |
| AI | OpenAI API (swappable) |
| Persistence | IndexedDB (local) + Supabase (cloud) |

## Core Architecture Rules

1. **No hardcoded skills** — Everything is data-driven from the graph model.
2. **World generated entirely from graph** — World generation consumes generic `GraphData` + `LayoutOutput` and produces a hierarchical `WorldConfig` of `WorldObject` instances.
3. **Rendering separate from AI** — The AI layer produces graph data only. The rendering layer reads from the world store only.
4. **Every feature modular** — Feature-based folder structure with strict separation of concerns.
5. **Components under 300 lines** — Enforced code quality rule.
6. **Strict layer separation** — UI → State → Domain/Logic → Rendering (unidirectional).
7. **Graph is domain-agnostic** — A GraphNode never knows whether it becomes a city, district, building, or landmark. That decision belongs to the World Generator.
8. **Theme is separate from world data** — The Theme Engine converts generic WorldObjects into themed visual styles. WorldConfig contains no rendering information.

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete software architecture, including:

- **Pipeline**: Graph Engine → Layout Engine → World Generator → Theme Engine → Renderer
- Feature-based folder structure (MVP scope)
- Graph data model (GraphNode, GraphEdge, GraphData) — fully domain-agnostic
- Layout Engine design (8-stage algorithm: seed → topology → clustering → placement → collision → density → projection → roads)
- World generation pipeline (hierarchy construction → terrain → cities → roads → biomes/progression)
- Theme Engine (5 themes: fantasy, cyberpunk, voxel, sci-fi, minimal)
- Recursive WorldObjectRenderer (no hardcoded level components)
- State management (Zustand stores)
- Rendering pipeline (R3F scene graph)
- AI integration flow
- 8-system MVP roadmap with explicit Future Scope
- Performance, testing, and extensibility strategies

## Related Documents

- [WORLD_RULES.md](./WORLD_RULES.md) — Logical mapping rules (Domain → Continent, Skill → City, etc.)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Complete software architecture

## Quick Start

```bash
# Coming soon
npm install
npm run dev
```
