# Game Farms — Phase 1: Engine + Isometric World Foundation

A production-quality foundation for an original browser-based isometric farming / life-sim
game. Phase 1 delivers the engine, the isometric renderer, and a playable demo world —
**no farming, crops, animals, inventory, economy, quests, NPCs, multiplayer, auth, shops,
or database yet.** Those plug in later without rewriting the core.

> Open the game and you get a living isometric world: grasslands, a northern forest, a
> winding western road, an eastern pond, southern farm plots, trees, rocks, flowers, a
> movable player placeholder, smooth pan/zoom camera, tile picking, chunk streaming, and
> a full debug toolkit.

---

## 1. Quick start

**Requirements:** Node.js ≥ 18, npm.

```bash
npm install
npm run dev        # start the game at http://localhost:5173
```

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`      | Vite dev server with hot reload                           |
| `npm run build`    | Strict typecheck (`tsc --noEmit`) + production build      |
| `npm run preview`  | Serve the production build locally                        |
| `npm run typecheck`| Strict TypeScript check only                              |
| `npm test`         | Run all unit + headless boot smoke tests (vitest)         |
| `npm run test:watch` | Watch mode                                              |

**Stack:** TypeScript (strict) · Phaser 3 (WebGL, Canvas fallback) · Vite · Vitest.
The world is rendered **only** by Phaser — no React/DOM rendering of game content.

---

## 2. Controls

| Input              | Action                              |
| ------------------ | ----------------------------------- |
| `WASD` / arrows    | Move player (world axes) **and** pan camera while held |
| Mouse drag / touch drag | Pan camera                      |
| Mouse wheel        | Zoom toward pointer (0.5× – 2×)     |
| Pinch (touch)      | Zoom                                |
| Hover              | Highlight tile + inspect coordinates |
| Click / tap        | Select tile (yellow diamond)        |
| `F3`               | Toggle debug overlay                |
| `G`                | Toggle tile-grid overlay            |
| `C`                | Toggle chunk-boundary overlay       |
| `K`                | Toggle collision overlay (green = walkable, red = blocked) |

---

## 3. Architecture

```
                    WORLD DATA (pure, tested, no Phaser)
                         ↓
                   WorldManager / World
                   TileMap · ChunkManager · CollisionMap
                         ↓            ↓
                   TILE SYSTEM    OBJECT SYSTEM
                         ↓            ↓
              TileRenderer   ObjectRenderer   ← rendering only,
                         ↓            ↓         never game state
                     IsoRenderer (chunk visuals, depth-sorted)
                                ↓
                         PHASER → GPU

USER → InputManager → CameraController → IsoCamera → Phaser camera
                    → PlayerPlaceholder → CollisionSystem → World
```

**Hard rules enforced by the codebase:**

- **Gameplay state lives in world coordinates** (`x: 12.45, y: 8.72`). Screen
  coordinates are never stored as state and sprites are never the source of truth.
- **Data → Renderer → Sprite, one way.** `TileData`/`WorldObjectData` never touch
  Phaser; renderers never hold game logic.
- **No magic numbers.** Tunables live in `src/shared/constants/config.ts`.
- **Deterministic world.** All world randomness uses `SeededRng`; seed `1337`
  always reproduces the same demo world.
- **Fail loudly.** Asset/chunk/world errors log `ASSET_LOAD_ERROR`,
  `CHUNK_LOAD_ERROR`, etc. — never silent.

### Project structure

```
src/
├── main.ts                     # browser entry: css + Game boot
├── game/
│   ├── GameConfig.ts           # Phaser config (WebGL-first, RESIZE, input)
│   ├── core/                   # Game, GameContext (services), GameState (selection/debug)
│   ├── scenes/                 # BootScene → PreloadScene → WorldScene
│   ├── isometric/              # IsoMath (pure), Coordinates, IsoCamera, IsoRenderer, DepthSorter
│   ├── world/                  # WorldManager, World, TileMap, Tile, Chunk, ChunkManager,
│   │                           # WorldObject, WorldConfig, WorldDataProvider (+Local impl)
│   ├── rendering/              # TileRenderer, ObjectRenderer, RenderLayers
│   ├── entities/               # PlayerPlaceholder (temporary test entity)
│   ├── collision/              # CollisionMap (queries), CollisionSystem (slide resolution)
│   ├── input/                  # InputManager (normalized actions), KeyboardInput, PointerInput
│   ├── camera/                 # CameraController (smoothing, bounds, zoom-to-pointer)
│   ├── debug/                  # Debug/Performance/Coordinate/Grid/Chunk/Collision overlays
│   └── assets/                 # AssetManifest, AssetLoader, PlaceholderTextureFactory
├── shared/
│   ├── types/                  # coordinates, tiles, objects (pure data contracts)
│   ├── constants/              # THE config file (tiles, world, chunks, camera, player, debug)
│   └── utils/                  # Logger, SeededRng, TypedEventEmitter, MathUtils
tests/
├── IsoMath.test.ts             # projection, picking, chunk math, round-trips
├── DepthSorter.test.ts         # behind/in-front, multi-tile, determinism, layer bands
├── World.test.ts               # tiles, regions, walkability, objects, streaming
├── ChunkManager.test.ts        # radius sets, edge clipping, load/unload events
├── CollisionSystem.test.ts     # free move, water block, wall slide, bounds
└── smoke/BootSmoke.test.ts     # REAL game boot under jsdom (scenes, textures, chunks, camera…)
```

---

## 4. Coordinate system

Three spaces, converted explicitly — never mixed:

1. **World** — logical units. Tiles are integers (`floor` of a point); entities are
   floats (`x: 12.45`). Authoritative for everything.
2. **Isometric / world-pixel** — projected pixels. `origin = (H·64, 0)` keeps the
   whole world in positive space; a 256×256 world spans 32768×16384 px.
3. **Screen** — canvas pixels / pointer. Mapped through the camera
   (`scroll + pointer/zoom`).

Diamond projection (`TILE_WIDTH = 128`, `TILE_HEIGHT = 64`):

```
screenX = originX + (x - y) * 64
screenY = originY + (x + y) * 32
```

Tile `(tx, ty)` is the unit square `[tx, tx+1) × [ty, ty+1)`; its diamond is
centered on the projection of `(tx + 0.5, ty + 0.5)`. Pointer picking inverts the
pipeline: `screen → world-px → world → tile`. All math is pure (`IsoMath.ts`) and
round-trip tested.

---

## 5. Chunk streaming

- World: **256×256 tiles**, chunks of **32×32** (8×8 = 64 chunks).
- `ChunkManager` (pure logic) computes the desired set around the camera chunk
  (Chebyshev radius, default **1** → 3×3 = 9 chunks) and emits `chunk-load` /
  `chunk-unload`. `IsoRenderer` subscribes and **builds/destroys** real GameObjects —
  unloading destroys everything (tiles + object views), never hides.
- Terrain data is compact typed arrays; objects are bucketed per chunk at world-gen.
- Streaming re-evaluates every 150 ms from the camera view center; camera zoom-out
  is safe because radius-1 coverage (96×96 tiles) exceeds the max view (~60×68).
- Press `C` to watch boundaries + labels live as you pan.

---

## 6. Depth sorting

Within the shared `WorldObjects` depth band, every object/entity sorts by
`base + (sortX + sortY) × 0.001`, where `(sortX, sortY)` is the footprint's
**front (max x+y) corner** — so 2×2 trees (and future 4×4 barns) sort by their
front edge. Same-tile ties break deterministically via an id hash (no flicker,
far below one epsilon step). Terrain lives in a lower band, selection/debug in
higher bands. Walk the player around the depth-test corridor (tree rows north and
south of spawn) to see behind/in-front sorting. Fully unit-tested.

---

## 7. Collision

`CollisionMap` answers logical queries (`isWalkable`, circle-vs-tiles);
`CollisionSystem` resolves movement with **axis-separated sliding**. Blocked:
water, trees, rocks (footprints), out-of-bounds. Walkable: grass, dirt, road,
sand, stone, decor (flowers/bushes). Phaser physics is **not** used for world
collision — logic is pure and tested; rendering only follows.

---

## 8. How to add a tile type

1. Add the variant to `TerrainType` in `src/shared/types/tiles.ts` (+ name entry).
2. Set walkability/buildability in `src/game/world/Tile.ts`.
3. Add `tile_<name>_NN` entries to `AssetManifest.ts` and draw them in
   `PlaceholderTextureFactory.ts` (128×64 diamonds; variants supported).
4. Register the variant count in `TileRenderer.ts` (`VARIANT_COUNTS`).
5. Paint it in `LocalWorldDataProvider.ts` (or a future provider).

No gameplay/rendering code changes needed — the resolver + manifest do the work.

## 9. How to add a world object

1. Add the kind to `WorldObjectType` in `src/shared/types/objects.ts`.
2. Add footprint + blocking defaults in `src/game/world/WorldObject.ts`.
3. Add the `<type>_NN` texture(s) to the manifest + factory (ground anchor =
   bottom-center; any visual height allowed — footprint stays logical).
4. Place it via the provider (`placeObject`) or scatter rules.

Depth sorting, chunk bucketing, collision, and debug counts pick it up automatically.

## 10. Swapping placeholder art for final art

`AssetLoader` already supports file entries: give a manifest definition a `path`
(and `generated: false`), drop the file under `assets/`, and it loads through the
normal preload pipeline with progress + `ASSET_LOAD_ERROR` reporting. Keep the same
keys/dimensions/anchors and **zero** game code changes.

---

## 11. Debug toolkit

- `F3` panel: FPS · player world/tile/chunk · camera scroll/zoom/chunk · loaded
  chunks · rendered tiles/objects · hover/selection · world seed/origin.
- Hover inspector (bottom-left): screen / world / tile / chunk for the pointer.
- Perf panel (top-right): FPS + smoothed frame ms, chunks, tiles/objects, display
  list size, texture count.
- `G` grid, `C` chunk bounds, `K` collision — all world-space, throttled redraws.
- Browser console: `__gameFarms` exposes the running game for poking around.

## 12. Tests

- **Unit (Node, no Phaser):** math, depth, world, chunks, collision — 42 tests.
- **Boot smoke (jsdom + stubbed canvas):** boots the real `Phaser.Game` through all
  three scenes, generates all textures, streams 9 chunks (9216 tiles), and drives
  camera/picking/movement/debug — 3 tests. No GPU required, runs in CI.
- Determinism: demo-world tests rely on the fixed seed; ids are coordinate-based.

## 13. Performance notes

- 9 loaded chunks ≈ 9.2k tile `Image`s + ~250 object views hold 60 FPS on normal
  desktop hardware (measured via the perf overlay; static images batch well).
- World data gen: ~35 ms for 65k tiles + ~2.6k objects (typed arrays + one pass).
- Debug overlays redraw on change only (camera-delta threshold / 5 Hz text).
- **Known limits (by design, Phase 1):** radius-1 streaming (raise
  `CHUNK_LOAD_RADIUS` for bigger views); no object pooling yet (structure is
  pool-ready); water/tiles are static (no animation system yet); finite 256×256
  world (provider interface is built for server streaming later).

## 14. What Phase 2 builds on this

`FarmingSystem` / `BuildingSystem` / … plug into `WorldManager` (data),
`IsoRenderer.refreshTile` + object views (visuals), `InputManager` actions
(`tile-select` et al.), and `CollisionMap` — without touching `IsoMath`,
`ChunkManager`, `CameraController`, `DepthSorter`, or the renderers.
Suggested first Phase 2 step: **hoe/soil state on tiles** (new `TileData` field +
`refreshTile` visuals) driven by `tile-select`, with `CollisionMap` unchanged.
