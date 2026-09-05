import type { ChunkCoord } from '../../shared/types/coordinates.js';
import type { TileData } from '../../shared/types/tiles.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import { worldToChunk } from '../isometric/IsoMath.js';
import { ChunkManager } from './ChunkManager.js';
import type { WorldConfig } from './WorldConfig.js';
import type { WorldDataProvider } from './WorldDataProvider.js';
import { Chunk } from './Chunk.js';

/**
 * World: the authoritative in-memory game world.
 *
 * - Data comes from a WorldDataProvider (local now, server later).
 * - ChunkManager tracks which chunks are active.
 * - This class answers gameplay queries: tiles, objects, walkability.
 *
 * Pure — no rendering, no Phaser. IsoRenderer observes ChunkManager events.
 */
export class World {
  public readonly config: WorldConfig;
  public readonly chunks: ChunkManager;
  public readonly provider: WorldDataProvider;

  public constructor(config: WorldConfig, provider: WorldDataProvider) {
    this.config = config;
    this.provider = provider;
    this.chunks = new ChunkManager(
      Math.floor(config.width / config.chunkSize),
      Math.floor(config.height / config.chunkSize),
      config.chunkSize,
      config.chunkLoadRadius,
    );
  }

  public initialize(): void {
    this.provider.initialize();
  }

  // -- tiles ---------------------------------------------------------------

  public getTile(x: number, y: number): TileData {
    return this.provider.getTile(x, y);
  }

  public setTile(tile: TileData): void {
    this.provider.setTile(tile);
  }

  public isInBounds(x: number, y: number): boolean {
    return this.provider.isInBounds(x, y);
  }

  // -- objects --------------------------------------------------------------

  public getObject(objectId: string): WorldObjectData | null {
    return this.provider.getObjectById(objectId);
  }

  public getObjectsInChunk(chunkX: number, chunkY: number): readonly WorldObjectData[] {
    return this.provider.getObjectsInChunk(chunkX, chunkY);
  }

  // -- chunks ---------------------------------------------------------------

  public getChunk(chunkX: number, chunkY: number): Chunk | null {
    return this.chunks.getLoadedChunk(chunkX, chunkY);
  }

  public worldToChunk(worldX: number, worldY: number): ChunkCoord {
    return worldToChunk(worldX, worldY, this.config.chunkSize);
  }

  public chunkToWorldBounds(chunkX: number, chunkY: number): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } {
    const s = this.config.chunkSize;
    return { x0: chunkX * s, y0: chunkY * s, x1: chunkX * s + s - 1, y1: chunkY * s + s - 1 };
  }

  // -- collision queries -----------------------------------------------------

  /** Full walkability for integer tile coords (terrain + objects + bounds). */
  public isWalkable(tileX: number, tileY: number): boolean {
    return this.provider.isWalkable(tileX, tileY);
  }

  /** Walkability for a continuous world point (floors to its tile). */
  public isWalkableAt(worldX: number, worldY: number): boolean {
    return this.isWalkable(Math.floor(worldX), Math.floor(worldY));
  }

  /** Clamp a world point into valid bounds (keeps entities inside the world). */
  public clampToBounds(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.min(Math.max(worldX, 0.001), this.config.width - 0.001),
      y: Math.min(Math.max(worldY, 0.001), this.config.height - 0.001),
    };
  }
}
