import { TerrainType, type TileData } from '../../shared/types/tiles.js';
import { createTile, isTerrainBuildable, isTerrainWalkable } from './Tile.js';

/**
 * TileMap: compact logical tile storage.
 *
 * A 256x256 world is 65,536 tiles. Storing full objects for every tile
 * wastes memory, so terrain/variant/elevation live in typed arrays and
 * TileData snapshots are materialized on demand. Object occupancy is tracked
 * separately (see World) and merged into snapshots.
 *
 * Pure data — no rendering, no Phaser.
 */
export class TileMap {
  public readonly width: number;
  public readonly height: number;

  private readonly terrain: Uint8Array;
  private readonly variants: Uint8Array;
  private readonly elevation: Int8Array;

  public constructor(width: number, height: number, defaultTerrain: TerrainType = TerrainType.Grass) {
    this.width = width;
    this.height = height;
    const count = width * height;
    this.terrain = new Uint8Array(count).fill(defaultTerrain);
    this.variants = new Uint8Array(count);
    this.elevation = new Int8Array(count);
  }

  public isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private indexOf(x: number, y: number): number {
    return y * this.width + x;
  }

  public getTerrain(x: number, y: number): TerrainType {
    if (!this.isInBounds(x, y)) {
      throw new Error(`TILEMAP_BOUNDS_ERROR: (${x}, ${y}) outside ${this.width}x${this.height}`);
    }
    return this.terrain[this.indexOf(x, y)] as TerrainType;
  }

  public setTerrain(x: number, y: number, terrain: TerrainType, variantId = 0, elevation = 0): void {
    if (!this.isInBounds(x, y)) {
      throw new Error(`TILEMAP_BOUNDS_ERROR: (${x}, ${y}) outside ${this.width}x${this.height}`);
    }
    const i = this.indexOf(x, y);
    this.terrain[i] = terrain;
    this.variants[i] = variantId;
    this.elevation[i] = elevation;
  }

  public getVariant(x: number, y: number): number {
    if (!this.isInBounds(x, y)) {
      throw new Error(`TILEMAP_BOUNDS_ERROR: (${x}, ${y}) outside ${this.width}x${this.height}`);
    }
    return this.variants[this.indexOf(x, y)] ?? 0;
  }

  public getElevation(x: number, y: number): number {
    if (!this.isInBounds(x, y)) {
      throw new Error(`TILEMAP_BOUNDS_ERROR: (${x}, ${y}) outside ${this.width}x${this.height}`);
    }
    return this.elevation[this.indexOf(x, y)] ?? 0;
  }

  /**
   * Materialize a TileData snapshot. `objectId` is injected by World, which
   * owns the occupancy index.
   */
  public getTile(x: number, y: number, objectId: string | null = null): TileData {
    const terrain = this.getTerrain(x, y);
    return createTile(x, y, terrain, {
      variantId: this.variants[this.indexOf(x, y)],
      elevation: this.elevation[this.indexOf(x, y)],
      objectId,
    });
  }

  /** Base walkability from terrain alone (ignores objects). */
  public isTerrainWalkableAt(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }
    return isTerrainWalkable(this.getTerrain(x, y));
  }

  public isTerrainBuildableAt(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }
    return isTerrainBuildable(this.getTerrain(x, y));
  }

  /** Fill a rectangle (inclusive) with terrain. Out-of-bounds cells are skipped. */
  public fillRect(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    terrain: TerrainType,
    variantOf?: (x: number, y: number) => number,
  ): void {
    const [minX, maxX] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [minY, maxY] = y0 <= y1 ? [y0, y1] : [y1, y0];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isInBounds(x, y)) {
          this.setTerrain(x, y, terrain, variantOf ? variantOf(x, y) : 0);
        }
      }
    }
  }

  /** Fill an ellipse (center + radii, inclusive) with terrain. */
  public fillEllipse(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    terrain: TerrainType,
    variantOf?: (x: number, y: number) => number,
  ): void {
    for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y++) {
      for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x++) {
        const nx = (x - centerX) / radiusX;
        const ny = (y - centerY) / radiusY;
        if (nx * nx + ny * ny <= 1 && this.isInBounds(x, y)) {
          this.setTerrain(x, y, terrain, variantOf ? variantOf(x, y) : 0);
        }
      }
    }
  }
}
