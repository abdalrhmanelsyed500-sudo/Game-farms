import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { Logger } from '../../shared/utils/Logger.js';
import type { TileBounds } from '../../shared/types/coordinates.js';
import { computeWorldOrigin, worldPixelSize } from '../isometric/IsoMath.js';
import { Coordinates } from '../isometric/Coordinates.js';
import { LocalWorldDataProvider } from './LocalWorldDataProvider.js';
import { World } from './World.js';
import { DEFAULT_WORLD_CONFIG, validateWorldConfig, type WorldConfig } from './WorldConfig.js';
import type { WorldDataProvider } from './WorldDataProvider.js';

/** WorldManager lifecycle events. */
export interface WorldManagerEvents {
  'world-ready': World;
}

/**
 * WorldManager: top-level world facade used by scenes and future systems.
 *
 * Responsibilities: world initialization, world data access, chunk streaming
 * triggers, coordinate conversion (owns the Coordinates instance), and world
 * boundaries. Rendering subscribes to chunk events — it is never driven
 * imperatively from here.
 *
 * Server-compat: construct with any WorldDataProvider. Phase 1 passes a
 * LocalWorldDataProvider; a ServerWorldDataProvider slots in later without
 * changing this class's public API.
 */
export class WorldManager {
  public readonly events = new TypedEventEmitter<WorldManagerEvents>();
  public readonly config: WorldConfig;
  public readonly coordinates: Coordinates;

  private readonly world: World;
  private ready = false;

  public constructor(config: WorldConfig = DEFAULT_WORLD_CONFIG, provider?: WorldDataProvider) {
    validateWorldConfig(config);
    this.config = config;
    const origin = computeWorldOrigin(config.width, config.height);
    this.coordinates = new Coordinates(origin.x, origin.y);
    this.world = new World(config, provider ?? new LocalWorldDataProvider(config));
  }

  public get isReady(): boolean {
    return this.ready;
  }

  /** Build world data (idempotent). Emits 'world-ready'. */
  public initialize(): World {
    if (this.ready) {
      return this.world;
    }
    this.world.initialize();
    this.ready = true;
    Logger.info('WorldManager', `world "${this.config.name}" ready (${this.config.width}x${this.config.height})`);
    this.events.emit('world-ready', this.world);
    return this.world;
  }

  public getWorld(): World {
    if (!this.ready) {
      throw new Error('WORLD_NOT_READY: call WorldManager.initialize() first');
    }
    return this.world;
  }

  /** Total projected pixel extents of the world (camera bounds source). */
  public getPixelSize(): { width: number; height: number } {
    return worldPixelSize(this.config.width, this.config.height);
  }

  /** Tile bounds of the whole world. */
  public getTileBounds(): TileBounds {
    return { x0: 0, y0: 0, x1: this.config.width - 1, y1: this.config.height - 1 };
  }

  /**
   * Streaming entry point: ensure chunks around a world point are loaded.
   * Called by WorldScene on an interval with the camera's view center.
   */
  public updateStreaming(worldX: number, worldY: number): void {
    const center = this.world.worldToChunk(worldX, worldY);
    this.world.chunks.update(center);
  }
}
