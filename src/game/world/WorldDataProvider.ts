import type { TileData } from '../../shared/types/tiles.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import type { WorldConfig } from './WorldConfig.js';

/**
 * WorldDataProvider: abstraction over WHERE world data comes from.
 *
 * Phase 1 ships LocalWorldDataProvider (authored + seeded local data).
 * A future ServerWorldDataProvider can implement this same interface to make
 * the world server-authoritative WITHOUT touching rendering, chunks, camera,
 * input, or any gameplay system built on top of WorldManager.
 */
export interface WorldDataProvider {
  readonly config: WorldConfig;

  /** Build/refresh all static world content. Called once at startup (Phase 1). */
  initialize(): void;

  getTile(x: number, y: number): TileData;
  setTile(tile: TileData): void;

  getObjectById(objectId: string): WorldObjectData | null;
  getObjectsInChunk(chunkX: number, chunkY: number): readonly WorldObjectData[];

  /**
   * Register a runtime object (Phase 3: placed buildings). Throws on
   * duplicate ids. Validation (overlap, terrain) is the caller's job.
   */
  addObject(obj: WorldObjectData): void;
  /** Remove a runtime object from every index. Returns false when unknown. */
  removeObject(objectId: string): boolean;

  /** Object id occupying a tile, if any. */
  getObjectIdAt(tileX: number, tileY: number): string | null;

  /** Full walkability: terrain AND object footprints. */
  isWalkable(tileX: number, tileY: number): boolean;

  isInBounds(tileX: number, tileY: number): boolean;
}
