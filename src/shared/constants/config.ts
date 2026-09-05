/**
 * Centralized game configuration constants.
 *
 * RULE: no magic numbers in gameplay/rendering code. Everything tunable lives
 * here so future phases (and tools) have a single source of truth.
 */

// ---------------------------------------------------------------------------
// Isometric projection
// ---------------------------------------------------------------------------

/** Isometric tile width in pixels (diamond horizontal diagonal). */
export const TILE_WIDTH = 128;
/** Isometric tile height in pixels (diamond vertical diagonal). */
export const TILE_HEIGHT = 64;
/** Half tile width — used constantly by the projection math. */
export const TILE_HALF_WIDTH = TILE_WIDTH / 2;
/** Half tile height — used constantly by the projection math. */
export const TILE_HALF_HEIGHT = TILE_HEIGHT / 2;

// ---------------------------------------------------------------------------
// World layout
// ---------------------------------------------------------------------------

/** Logical world width in tiles (Phase 1: finite world). */
export const WORLD_WIDTH = 256;
/** Logical world height in tiles (Phase 1: finite world). */
export const WORLD_HEIGHT = 256;
/** Chunk edge length in tiles. World must be divisible by this. */
export const CHUNK_SIZE = 32;
/** Deterministic seed for the Phase 1 demo world. Same seed => same world. */
export const WORLD_SEED = 1337;

/** Chunks per axis (derived). */
export const CHUNKS_X = WORLD_WIDTH / CHUNK_SIZE;
/** Chunks per axis (derived). */
export const CHUNKS_Y = WORLD_HEIGHT / CHUNK_SIZE;

// ---------------------------------------------------------------------------
// Chunk streaming
// ---------------------------------------------------------------------------

/**
 * Chunk load radius around the camera's current chunk (Chebyshev distance).
 * radius 1 => 3x3 chunks, radius 2 => 5x5 chunks. Tunable per device later.
 */
export const CHUNK_LOAD_RADIUS = 1;
/** How often (ms) the streaming system re-evaluates visible chunks. */
export const CHUNK_STREAM_INTERVAL_MS = 150;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export const CAMERA_DEFAULT_ZOOM = 1.0;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_MAX_ZOOM = 2.0;
/** Keyboard pan speed in world-pixels per second (at zoom 1). */
export const CAMERA_KEYBOARD_SPEED = 900;
/** Smoothing rate for pan/zoom interpolation (higher = snappier). */
export const CAMERA_SMOOTHING = 10;
/** Mouse-wheel zoom step multiplier. */
export const CAMERA_WHEEL_STEP = 1.12;

// ---------------------------------------------------------------------------
// Player placeholder
// ---------------------------------------------------------------------------

/** Movement speed in world units (tiles) per second. */
export const PLAYER_SPEED = 4;
/** Collision radius in world units. The placeholder is smaller than a tile. */
export const PLAYER_RADIUS = 0.3;
/** Player spawn tile. The demo world guarantees a clearing here. */
export const PLAYER_SPAWN_TILE_X = 128;
export const PLAYER_SPAWN_TILE_Y = 128;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Pointer travel (px) before a press becomes a camera drag instead of a click. */
export const DRAG_THRESHOLD_PX = 6;
/** Double-click window (ms) reserved for future interactions. */
export const DOUBLE_CLICK_MS = 350;

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

export const DEBUG_KEY = 'F3';
export const GRID_KEY = 'G';
export const CHUNK_OVERLAY_KEY = 'C';
export const COLLISION_OVERLAY_KEY = 'K';
/** Debug text refresh rate (Hz) — no need to rebuild strings every frame. */
export const DEBUG_REFRESH_HZ = 5;
/** Start with the debug overlay visible (dev-friendly default). */
export const DEBUG_DEFAULT_VISIBLE = true;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Canvas background color (visible outside world bounds while panning). */
export const BACKGROUND_COLOR = '#101a12';
/** Depth epsilon per (x + y) sort step. See DepthSorter for the full scheme. */
export const DEPTH_EPSILON = 0.001;
/** Vertical pixel offset per elevation level (2.5D lift, not full 3D). */
export const ELEVATION_STEP_PX = 16;

// ---------------------------------------------------------------------------
// Farming (Phase 2)
// ---------------------------------------------------------------------------

/** Designated farm plot rectangle (tiles). Farming is only allowed inside. */
export const FARM_PLOT_X = 104;
export const FARM_PLOT_Y = 140;
export const FARM_PLOT_WIDTH = 24;
export const FARM_PLOT_HEIGHT = 16;

/**
 * Growth time multiplier. 1 = definition durations (dev-tuned to 30–60s per
 * crop). Raise for production pacing without touching crop definitions.
 */
export const FARM_TIME_SCALE = 1;

/** Starting seed count per crop (temporary pouch; inventory comes later). */
export const SEED_STARTING_COUNT = 20;

/** Toolbar bar height in screen px (tap-through exclusion + layout). */
export const TOOLBAR_HEIGHT_PX = 76;
/** Toolbar slot size in screen px. */
export const TOOLBAR_SLOT_PX = 56;

// ---------------------------------------------------------------------------
// Inventory (Phase 3)
// ---------------------------------------------------------------------------

/** Number of inventory slots. Never hard-code capacity elsewhere. */
export const INVENTORY_CAPACITY = 24;

/** Development starting inventory (seeded through state, not UI). */
export const STARTER_INVENTORY: Readonly<Record<string, number>> = {
  'item:wood': 100,
  'item:stone': 60,
  'item:wheat_seed': 20,
  'item:corn_seed': 20,
  'item:tomato_seed': 20,
};
