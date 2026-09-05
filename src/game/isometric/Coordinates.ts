import type { ChunkCoord, IsoPoint, TileCoord, WorldPoint } from '../../shared/types/coordinates.js';
import {
  chunkToWorldBounds,
  getChunkKey,
  isoPointToTile,
  parseChunkKey,
  screenToWorld,
  tileCenterToScreen,
  worldToChunk,
  worldToScreen,
  worldToTile,
} from './IsoMath.js';

/**
 * Coordinates: stateful facade over the pure IsoMath functions.
 *
 * A single instance is created per world with that world's projection origin.
 * Rendering and input code use this instead of threading originX/originY
 * through every call. Still deterministic and unit-testable.
 */
export class Coordinates {
  public readonly originX: number;
  public readonly originY: number;

  public constructor(originX: number, originY: number) {
    this.originX = originX;
    this.originY = originY;
  }

  public worldToScreen(worldX: number, worldY: number): IsoPoint {
    return worldToScreen(worldX, worldY, this.originX, this.originY);
  }

  public screenToWorld(isoX: number, isoY: number): WorldPoint {
    return screenToWorld(isoX, isoY, this.originX, this.originY);
  }

  public worldToTile(worldX: number, worldY: number): TileCoord {
    return worldToTile(worldX, worldY);
  }

  public isoPointToTile(isoX: number, isoY: number): TileCoord {
    return isoPointToTile(isoX, isoY, this.originX, this.originY);
  }

  public tileCenterToScreen(tileX: number, tileY: number): IsoPoint {
    return tileCenterToScreen(tileX, tileY, this.originX, this.originY);
  }

  public worldToChunk(worldX: number, worldY: number): ChunkCoord {
    return worldToChunk(worldX, worldY);
  }

  public chunkToWorldBounds(chunkX: number, chunkY: number): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } {
    return chunkToWorldBounds(chunkX, chunkY);
  }

  public getChunkKey(chunkX: number, chunkY: number): string {
    return getChunkKey(chunkX, chunkY);
  }

  public parseChunkKey(key: string): ChunkCoord {
    return parseChunkKey(key);
  }
}
