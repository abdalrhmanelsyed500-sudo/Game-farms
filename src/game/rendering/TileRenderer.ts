import Phaser from 'phaser';
import { TerrainType, TERRAIN_TYPE_NAMES, type TileData } from '../../shared/types/tiles.js';
import { depthOfTile } from '../isometric/DepthSorter.js';
import type { Coordinates } from '../isometric/Coordinates.js';

/**
 * 8-neighbourhood terrain context for future autotiling.
 * Phase 1 passes it through but the default resolver ignores it.
 */
export interface TileNeighborhood {
  readonly n: TerrainType;
  readonly ne: TerrainType;
  readonly e: TerrainType;
  readonly se: TerrainType;
  readonly s: TerrainType;
  readonly sw: TerrainType;
  readonly w: TerrainType;
  readonly nw: TerrainType;
}

/**
 * Terrain-variant resolution strategy.
 *
 * Phase 1: DefaultTerrainVariantResolver (variantId => texture key).
 * Future: an AutotileVariantResolver implementing this SAME interface can
 * produce grass/water edges, road transitions, etc. from `neighbors` —
 * no changes needed in TileRenderer or IsoRenderer.
 */
export interface ITerrainVariantResolver {
  resolveTextureKey(tile: TileData, neighbors?: TileNeighborhood): string;
}

/** How many texture variants exist per terrain (matches AssetManifest). */
const VARIANT_COUNTS: Readonly<Record<TerrainType, number>> = {
  [TerrainType.Grass]: 3,
  [TerrainType.Dirt]: 2,
  [TerrainType.Water]: 2,
  [TerrainType.Stone]: 2,
  [TerrainType.Sand]: 1,
  [TerrainType.Road]: 2,
};

export class DefaultTerrainVariantResolver implements ITerrainVariantResolver {
  public resolveTextureKey(tile: TileData): string {
    const count = VARIANT_COUNTS[tile.terrain] ?? 1;
    const variant = (tile.variantId % count) + 1;
    const name = TERRAIN_TYPE_NAMES[tile.terrain].toLowerCase();
    return `tile_${name}_${String(variant).padStart(2, '0')}`;
  }
}

/**
 * TileRenderer: turns logical TileData into Phaser Images.
 *
 * Data flows ONE way: Tile => TileRenderer => Phaser GameObject.
 * Tile data objects are never stored on sprites and sprites are never the
 * source of truth.
 */
export class TileRenderer {
  private readonly scene: Phaser.Scene;
  private readonly coordinates: Coordinates;
  private readonly resolver: ITerrainVariantResolver;

  public constructor(
    scene: Phaser.Scene,
    coordinates: Coordinates,
    resolver: ITerrainVariantResolver = new DefaultTerrainVariantResolver(),
  ) {
    this.scene = scene;
    this.coordinates = coordinates;
    this.resolver = resolver;
  }

  /** Create the sprite for one tile (caller owns lifecycle / destruction). */
  public createTile(tile: TileData, neighbors?: TileNeighborhood): Phaser.GameObjects.Image {
    const center = this.coordinates.tileCenterToScreen(tile.x, tile.y);
    const textureKey = this.resolver.resolveTextureKey(tile, neighbors);
    const image = this.scene.add.image(center.x, center.y, textureKey);
    image.setName(TileRenderer.tileName(tile.x, tile.y));
    image.setDepth(depthOfTile(tile.x, tile.y));
    return image;
  }

  /** Re-resolve an existing tile sprite (used when tile data changes). */
  public refreshTile(image: Phaser.GameObjects.Image, tile: TileData, neighbors?: TileNeighborhood): void {
    image.setTexture(this.resolver.resolveTextureKey(tile, neighbors));
    image.setDepth(depthOfTile(tile.x, tile.y));
  }

  public static tileName(x: number, y: number): string {
    return `tile_${x}_${y}`;
  }
}
