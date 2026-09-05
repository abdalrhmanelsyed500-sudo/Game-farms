# Game Farms — Phase 3: Inventory & Buildings

A production-quality foundation for an original browser-based isometric farming / life-sim
game. Phase 1 delivered the engine + isometric renderer, Phase 2 the farming loop;
**Phase 3 adds the item/inventory/tool systems and constructible buildings** on top of
the untouched Phase 1 + 2 core:

> **Inventory (24 slots) → seed picker → harvests land in your pack → spend wood/stone
> to place a house, barn, or shed** with a ghost preview, rotation, and live validity —
> still **no animals, economy, quests, NPCs, multiplayer, auth, shops, or database.**
> Those plug in later without rewriting the core.

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
| Hover              | Highlight tile + validity preview (white/green ✓/red ✗) |
| Click / tap        | Select tile + run current tool action (or place building) |
| `1`–`4` / toolbar  | Hoe · Seeds (picker) · Water · Build mode |
| `I` / INV slot     | Toggle the inventory panel (24 slots, read-only) |
| `R` (build mode)   | Rotate ghost 0° → 90° → 180° → 270° |
| `1`–`3` (build mode) | Pick Small House · Barn · Storage Shed |
| `H` or bare click  | Harvest mature crops (no HAND slot by design) |
| `Esc`              | Close panel → picker → build mode → deselect, in that order |
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
                    → Toolbar → FarmingSystem → LocalFarmState (+ events)
                                                 ↓
                                   CropRenderer / SoilRenderer / FarmEffects
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
│   ├── farming/                # FarmingSystem, LocalFarmState, Crop/Soil renderers,
│   │                           # CropDefinitions, Clock, FarmEffects
│   ├── items/                  # ItemCatalog, InventorySystem, LocalInventoryState
│   ├── tools/                  # ToolCatalog, EquipmentState
│   ├── buildings/              # BuildingCatalog, PlacementValidator, BuildingSystem,
│   │                           # LocalBuildingState, BuildingPreview (ghost)
│   ├── ui/                     # Toolbar, SeedPickerPopup, BuildMenuPanel, InventoryPanel
│   └── assets/                 # AssetManifest, AssetLoader, PlaceholderTextureFactory
├── shared/
│   ├── types/                  # coordinates, tiles, objects, farming, items, tools,
│   │                           # buildings, ui (pure data contracts)
│   ├── constants/              # THE config file (tiles, world, chunks, camera, player, debug)
│   └── utils/                  # Logger, SeededRng, TypedEventEmitter, MathUtils
tests/
├── IsoMath.test.ts             # projection, picking, chunk math, round-trips
├── DepthSorter.test.ts         # behind/in-front, multi-tile, determinism, layer bands
├── World.test.ts               # tiles, regions, walkability, objects, streaming
├── ChunkManager.test.ts        # radius sets, edge clipping, load/unload events
├── CollisionSystem.test.ts     # free move, water block, wall slide, bounds
└── smoke/BootSmoke.test.ts     # REAL game boot under jsdom (scenes, textures, chunks, camera…)
├── FarmingSystem.test.ts       # soil/plant/water/harvest rules, timestamp growth, TIME_SCALE
├── FarmingIntegration.test.ts  # event sequences, single-tile refresh, chunk-reload state
├── InventorySystem.test.ts     # catalog, stacking, capacity, atomicity, persistence
├── Tools.test.ts               # tool catalog, equipment selection, UI modes
└── BuildingSystem.test.ts      # catalog, rotation, 7 placement rejections, atomic costs
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

## 11. Farming gameplay (Phase 2)

**The loop:** pick a tool from the toolbar (`1`–`4`, `I`, `R`, `Esc`) → hover shows a
validity preview (green ✓ / red ✗, never color alone) → click to act:

1. **Hoe** — till grass/dirt inside the farm plot (soil overlay appears, brown puff).
2. **Seeds** — opens the seed picker (wheat/corn/tomato + live counts); planting
   consumes 1 seed from the inventory (20 each to start).
3. **Water** — water the crop (soil darkens, droplets) — crops only grow while watered.
4. **Harvest** — click a mature crop bare-handed (or press `H`): gold burst, floating
   `+N Crop`, and the yield lands in the inventory. A full pack leaves the crop
   planted with an `InventoryFull` hint — harvests are never lost.

**Rules worth knowing:**

- Farming is only allowed inside the data-driven farm plot
  (`FARM_PLOT_X/Y/W/H` in config, 24×16 tiles south of spawn) — the future
  ownership/permission hook. Everything outside rejects with a floating reason.
- Growth derives from **timestamps** (`plantedAt`/`wateredAt` + accrued `grownMs`),
  never timers. Durations are dev-tuned (wheat 40s, tomato 48s, corn 55s at
  `FARM_TIME_SCALE = 1`); production pacing is a config change.
- State lives in `LocalFarmState` behind the `FarmStateProvider` interface — a
  `ServerFarmStateProvider` replaces it later with zero changes to rules, renderers,
  or UI. Crop state is never stored in sprites.
- Every change updates **one view**: soil overlay swap, crop texture swap, or single
  view create/destroy. Chunks are never rebuilt for farming; unload/reload rebuilds
  crop/soil views from state automatically.
- Crops depth-sort as 1×1 footprints through the unchanged Phase 1 `DepthSorter`.

## 12. Debug toolkit

- `F3` panel: FPS · player world/tile/chunk · camera scroll/zoom/chunk · loaded
  chunks · rendered tiles/objects · hover/selection · world seed/origin.
- Hover inspector (bottom-left): screen / world / tile / chunk for the pointer.
- Perf panel (top-right): FPS + smoothed frame ms, chunks, tiles/objects, display
  list size, texture count.
- `G` grid, `C` chunk bounds, `K` collision — all world-space, throttled redraws.
- Farming lines (F3): current tool · seed counts · selected tile soil/water ·
  crop id, stage (`2/4`), and age in seconds.
- Browser console: `__gameFarms` exposes the running game for poking around.

## 13. Tests

- **Unit (Node, no Phaser):** math, depth, world, chunks, collision — 42 tests,
  all still passing unmodified (Phase 1 regression gate).
- **Farming unit:** soil/plant/water/harvest validation, timestamp growth,
  `TIME_SCALE`, inventory integration (yield lands in pack, full pack keeps the
  crop planted, failed plants consume nothing), state deltas — 23 tests
  (`ManualClock`, no Phaser).
- **Farming integration:** exact event sequences, single-tile refresh proof,
  chunk-reload state, multi-tile independence — 4 tests.
- **Inventory unit:** catalog, stacking, capacity/leftovers, `canAdd` simulation,
  fullest-first removal, events, provider persistence — 16 tests.
- **Tools unit:** tool catalog, key bindings, equipment selection/events — 10 tests.
- **Buildings unit:** catalog, rotation footprints, all 7 placement rejections,
  atomic costs, WorldObject + walkability integration, demolish, state — 18 tests.
- **Boot smoke (jsdom + stubbed canvas):** boots the real `Phaser.Game` through all
  three scenes, generates all textures (incl. buildings + item icons), streams 9
  chunks (9216 tiles), drives camera/picking/movement/debug, runs the full farming
  loop end-to-end, **and runs the Phase 3 loop** (seed picker → inventory panel →
  build mode → rotate → place, asserting single-view add + atomic deduction) —
  5 tests. No GPU required, runs in CI.
- **Total: 118 tests.** Determinism: demo-world tests rely on the fixed seed;
  farming-time tests use `ManualClock`.

## 14. Performance notes

- 9 loaded chunks ≈ 9.2k tile `Image`s + ~250 object views hold 60 FPS on normal
  desktop hardware (measured via the perf overlay; static images batch well).
- World data gen: ~35 ms for 65k tiles + ~2.6k objects (typed arrays + one pass).
- Farming updates are event-driven single-view swaps; `FarmingSystem.update()`
  iterates only planted crops (typically dozens) and emits solely on stage change.
  Effects are ≤10 self-destroying sprites per action.
- Debug overlays redraw on change only (camera-delta threshold / 5 Hz text).
- **Known limits (by design, Phase 2):** radius-1 streaming (raise
  `CHUNK_LOAD_RADIUS` for bigger views); no object pooling yet (structure is
  pool-ready); water/tiles are static (no animation system yet); finite 256×256
  world (provider interfaces are built for server streaming later); soil never
  dries and crops never wither (growth-gating hooks exist in `FarmingSystem`).

## 15. Inventory, tools & buildings (Phase 3)

**Items & inventory:** `ItemCatalog` is the single source of truth (8 items: 3 seeds,
3 crops, wood, stone — stable `item:*` ids, stack sizes, icon keys). `InventorySystem`
is pure slot logic (24 slots via `INVENTORY_CAPACITY`): stack-first adds, fullest-first
removals, `canAdd`/`canRemove` simulations, leftover/missing reporting instead of
silent overflow, and `inventory-changed` events. State persists through the
`InventoryStateProvider` port (`LocalInventoryState` now, server later). Seeded from
`STARTER_INVENTORY` (100 wood / 60 stone / 20 of each seed — house+shed together, or
barn as a real choice).

**Farming ↔ inventory:** planting consumes a seed atomically (failed plants consume
nothing); harvests move yield into the pack and roll back on any leftover — a full
inventory returns `InventoryFull` and leaves the crop planted. The temporary
`SeedPouch` is deleted; `CropDefinitions` is untouched (the legacy→namespaced id
bridge lives in two `FarmingSystem` helpers).

**Tools:** `ToolCatalog` (hoe/seeds/water/hand + key bindings) with `EquipmentState`
as the selection source of truth (tool + seed crop + building, `equipment-changed`
events). The toolbar is `HOE / SEEDS / WATER / BUILD / INV` (`1/2/3/4/I`, `Esc`
cascade, `R` rotate, `H` harvest); SEEDS opens a catalog-driven seed picker with live
counts.

**Buildings:** `BuildingCatalog` (Small House 3×2, Barn 4×3, Storage Shed 2×2 — costs,
footprints, sprites, all data). `PlacementValidator` is pure rules with 7 rejection
reasons (unknown building · bad rotation · outside farm plot · past world edge ·
occupied · crops in footprint · insufficient resources with per-line have/need).
`BuildingSystem.place()` re-checks, deducts atomically (never half-charges, refunds on
registration failure), registers a blocking `WorldObjectType.Building` — collision
follows from the existing walkability, no second system — and emits
`building-placed`, which `IsoRenderer.addObjectView()` turns into exactly one view
(chunks never rebuild). Build mode (`UiMode.Build`) centers the ghost footprint on
the hovered tile, previews green/red by live validation, and rotates 0/90/180/270
(`R`); the build menu shows footprint + live affordability, `1`–`3` pick entries.

**How to add an item:** one `ItemCatalog` entry + one `icon_*` manifest key + one
factory painter — UI, stacking, and saves follow automatically.
**How to add a building:** one `BuildingCatalog` entry + one `building_*` texture —
validator, ghost, menu, and placement follow automatically.

## 16. What Phase 4 builds on this

`AnimalSystem` / quests / NPCs / multiplayer / … plug into the same seams: `World` +
`WorldDataProvider` (data), `IsoRenderer.addObjectView/removeObjectView` (single-view
visuals), `InputManager` + `UiMode` + `EquipmentState` (actions), `InventorySystem`
(spend/reward ports), `*-stateProvider` interfaces (local now, server later) — without
touching `IsoMath`, `ChunkManager`, `CameraController`, `DepthSorter`,
`CollisionMap`, `FarmingSystem`, `InventorySystem`, `BuildingSystem`, or the renderers.
