import { PLAYER_SPAWN_TILE_X, PLAYER_SPAWN_TILE_Y } from '../../shared/constants/config.js';
import type { TileData } from '../../shared/types/tiles.js';
import { TerrainType } from '../../shared/types/tiles.js';
import { WorldObjectType, type WorldObjectData } from '../../shared/types/objects.js';
import { Logger } from '../../shared/utils/Logger.js';
import { SeededRng } from '../../shared/utils/SeededRng.js';
import { getChunkKey } from '../isometric/IsoMath.js';
import { TileMap } from './TileMap.js';
import { createWorldObject, footprintTiles } from './WorldObject.js';
import type { WorldConfig } from './WorldConfig.js';
import type { WorldDataProvider } from './WorldDataProvider.js';

/**
 * LocalWorldDataProvider: deterministic authored + seeded demo world.
 *
 * Layout (256x256, north = -y):
 * - NORTH band: forest (dense trees on grass)
 * - CENTER:    grassland clearing + spawn + depth-sort test corridor
 * - WEST:      winding dirt road (walkable)
 * - EAST:      pond (water + sand rim)
 * - SOUTH:     open farm-like grass with dirt patches
 * - Scatter:   seeded trees / rocks / flowers / bushes everywhere valid
 *
 * Everything derives from config.seed, so the world is reproducible.
 */
export class LocalWorldDataProvider implements WorldDataProvider {
  public readonly config: WorldConfig;

  private readonly map: TileMap;
  private readonly objectsById = new Map<string, WorldObjectData>();
  private readonly objectsByChunk = new Map<string, WorldObjectData[]>();
  private readonly occupancy = new Map<string, string>();
  private initialized = false;

  public constructor(config: WorldConfig) {
    this.config = config;
    this.map = new TileMap(config.width, config.height, TerrainType.Grass);
  }

  public initialize(): void {
    if (this.initialized) {
      return;
    }
    const startedAt = performance.now();
    const rng = new SeededRng(this.config.seed);

    this.paintBaseGrass(rng.fork(11));
    this.paintForestRegion(rng.fork(21));
    this.paintWestRoad(rng.fork(31));
    this.paintEastPond(rng.fork(41));
    this.paintSouthernFarm(rng.fork(51));
    this.paintStonePatch(rng.fork(61));
    this.clearSpawnArea();
    this.authorDepthTestCorridor();
    this.scatterVegetation(rng.fork(71));

    this.initialized = true;
    Logger.info(
      'World',
      `demo world generated in ${(performance.now() - startedAt).toFixed(1)}ms`,
      `objects=${this.objectsById.size}`,
    );
  }

  // -- WorldDataProvider -----------------------------------------------------

  public getTile(x: number, y: number): TileData {
    return this.map.getTile(x, y, this.getObjectIdAt(x, y));
  }

  public setTile(tile: TileData): void {
    this.map.setTerrain(tile.x, tile.y, tile.terrain, tile.variantId, tile.elevation);
  }

  public getObjectById(objectId: string): WorldObjectData | null {
    return this.objectsById.get(objectId) ?? null;
  }

  public getObjectsInChunk(chunkX: number, chunkY: number): readonly WorldObjectData[] {
    return this.objectsByChunk.get(getChunkKey(chunkX, chunkY)) ?? [];
  }

  public getObjectIdAt(tileX: number, tileY: number): string | null {
    return this.occupancy.get(LocalWorldDataProvider.tileKey(tileX, tileY)) ?? null;
  }

  public isWalkable(tileX: number, tileY: number): boolean {
    if (!this.map.isInBounds(tileX, tileY)) {
      return false;
    }
    if (!this.map.isTerrainWalkableAt(tileX, tileY)) {
      return false;
    }
    const objectId = this.getObjectIdAt(tileX, tileY);
    if (objectId === null) {
      return true;
    }
    return this.objectsById.get(objectId)?.walkable ?? true;
  }

  public isInBounds(tileX: number, tileY: number): boolean {
    return this.map.isInBounds(tileX, tileY);
  }

  // -- terrain painters ------------------------------------------------------

  private static tileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Base: all grass with seeded visual variants. */
  private paintBaseGrass(rng: SeededRng): void {
    const { width, height } = this.config;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.map.setTerrain(x, y, TerrainType.Grass, rng.int(0, 2));
      }
    }
  }

  /** NORTH: forest band with extra-dense tree soil (trees added in scatter). */
  private paintForestRegion(rng: SeededRng): void {
    const { width } = this.config;
    // y 8..64: grass with dirt flecks.
    for (let y = 8; y <= 64; y++) {
      for (let x = 4; x < width - 4; x++) {
        if (rng.chance(0.06)) {
          this.map.setTerrain(x, y, TerrainType.Dirt, rng.int(0, 1));
        } else {
          this.map.setTerrain(x, y, TerrainType.Grass, rng.int(0, 2));
        }
      }
    }
  }

  /** WEST: winding north-south dirt road around x ~ 40. */
  private paintWestRoad(rng: SeededRng): void {
    const { height } = this.config;
    for (let y = 0; y < height; y++) {
      const centerX = Math.round(40 + Math.sin(y * 0.045) * 9 + Math.sin(y * 0.013) * 5);
      for (let dx = -1; dx <= 1; dx++) {
        const x = centerX + dx;
        if (this.map.isInBounds(x, y)) {
          this.map.setTerrain(x, y, TerrainType.Road, rng.int(0, 1));
        }
      }
      // Dirt shoulders.
      for (const dx of [-2, 2]) {
        const x = centerX + dx;
        if (this.map.isInBounds(x, y) && rng.chance(0.8)) {
          this.map.setTerrain(x, y, TerrainType.Dirt, rng.int(0, 1));
        }
      }
    }
  }

  /** EAST: pond with sand shoreline. */
  private paintEastPond(rng: SeededRng): void {
    const cx = 196;
    const cy = 128;
    this.map.fillEllipse(cx, cy, 17, 12, TerrainType.Sand, () => rng.int(0, 0));
    this.map.fillEllipse(cx, cy, 14, 9, TerrainType.Water, () => rng.int(0, 1));
    // A couple of sandy islets just outside the water for visual interest.
    this.map.fillEllipse(cx - 20, cy + 14, 3, 2, TerrainType.Sand, () => 0);
    this.map.fillEllipse(cx + 19, cy - 13, 2, 2, TerrainType.Sand, () => 0);
  }

  /** SOUTH: open farm-like grass with tilled-looking dirt patches (visual only). */
  private paintSouthernFarm(rng: SeededRng): void {
    // Six dirt patch plots south of spawn.
    const plots = [
      { x: 96, y: 168 },
      { x: 116, y: 168 },
      { x: 136, y: 168 },
      { x: 96, y: 188 },
      { x: 116, y: 188 },
      { x: 136, y: 188 },
    ];
    for (const plot of plots) {
      this.map.fillRect(plot.x, plot.y, plot.x + 12, plot.y + 8, TerrainType.Dirt, () => rng.int(0, 1));
      // Grass seams between rows inside each plot.
      for (let x = plot.x; x <= plot.x + 12; x += 4) {
        for (let y = plot.y; y <= plot.y + 8; y++) {
          this.map.setTerrain(x, y, TerrainType.Grass, rng.int(0, 2));
        }
      }
    }
  }

  /** Small stone quarry area south-west of the pond for terrain variety. */
  private paintStonePatch(rng: SeededRng): void {
    this.map.fillEllipse(168, 178, 10, 7, TerrainType.Stone, () => rng.int(0, 1));
    this.map.fillEllipse(168, 178, 6, 4, TerrainType.Dirt, () => rng.int(0, 1));
  }

  /** Guarantee a walkable, object-free clearing around spawn. */
  private clearSpawnArea(): void {
    const sx = PLAYER_SPAWN_TILE_X;
    const sy = PLAYER_SPAWN_TILE_Y;
    this.map.fillRect(sx - 6, sy - 6, sx + 6, sy + 6, TerrainType.Grass, () => 0);
  }

  // -- object authoring ------------------------------------------------------

  /**
   * Depth-sort test corridor: two facing tree rows near spawn so walking
   * north/south exercises behind/in-front sorting, plus overlapping trees
   * and mixed footprints (tree 2x2 vs rock/flower 1x1).
   *
   * All placements stay FULLY outside the ±6 spawn plaza so the spawn
   * guarantee (walkable + object-free) always holds.
   */
  private authorDepthTestCorridor(): void {
    const sx = PLAYER_SPAWN_TILE_X;
    const sy = PLAYER_SPAWN_TILE_Y;
    // Row A (north of spawn) and row B (south), with a walk lane between.
    for (let i = 0; i < 4; i++) {
      this.placeObject(WorldObjectType.Tree, sx - 10 + i * 5, sy - 9, 0);
      this.placeObject(WorldObjectType.Tree, sx - 8 + i * 5, sy + 8, 1);
    }
    // Overlapping pair: second tree tucked one tile into the first's visual zone.
    this.placeObject(WorldObjectType.Tree, sx + 12, sy - 4, 0);
    this.placeObject(WorldObjectType.Tree, sx + 13, sy - 2, 1);
    // Mixed footprints near the lane.
    this.placeObject(WorldObjectType.Rock, sx - 9, sy + 1, 0);
    this.placeObject(WorldObjectType.Flower, sx + 8, sy - 7, 0);
    this.placeObject(WorldObjectType.Bush, sx + 9, sy, 0);
  }

  /** Seeded scatter pass for trees / rocks / flowers / bushes. */
  private scatterVegetation(rng: SeededRng): void {
    const { width, height } = this.config;
    const sx = PLAYER_SPAWN_TILE_X;
    const sy = PLAYER_SPAWN_TILE_Y;

    for (let y = 2; y < height - 4; y++) {
      for (let x = 2; x < width - 4; x++) {
        // Keep spawn clearing + road corridor out of scatter.
        if (Math.abs(x - sx) < 9 && Math.abs(y - sy) < 9) {
          continue;
        }
        const terrain = this.map.getTerrain(x, y);
        if (terrain === TerrainType.Water || terrain === TerrainType.Road) {
          continue;
        }
        const inForest = y >= 8 && y <= 64;
        const roll = rng.next();
        if (inForest) {
          if (roll < 0.055) {
            this.placeObject(WorldObjectType.Tree, x, y, rng.int(0, 1), rng);
          } else if (roll < 0.075) {
            this.placeObject(WorldObjectType.Bush, x, y, 0, rng);
          } else if (roll < 0.095) {
            this.placeObject(WorldObjectType.Flower, x, y, rng.int(0, 2), rng);
          }
        } else if (terrain === TerrainType.Grass) {
          if (roll < 0.008) {
            this.placeObject(WorldObjectType.Tree, x, y, rng.int(0, 1), rng);
          } else if (roll < 0.014) {
            this.placeObject(WorldObjectType.Rock, x, y, 0, rng);
          } else if (roll < 0.026) {
            this.placeObject(WorldObjectType.Flower, x, y, rng.int(0, 2), rng);
          } else if (roll < 0.032) {
            this.placeObject(WorldObjectType.Bush, x, y, 0, rng);
          }
        } else if (terrain === TerrainType.Stone) {
          if (roll < 0.03) {
            this.placeObject(WorldObjectType.Rock, x, y, 0, rng);
          }
        } else if (terrain === TerrainType.Sand) {
          if (roll < 0.006) {
            this.placeObject(WorldObjectType.Rock, x, y, 0, rng);
          }
        }
      }
    }
  }

  /**
   * Place an object if its whole footprint is free and on placeable terrain.
   * Returns the object, or null when placement was rejected (keeps the world
   * valid: no overlapping footprints, nothing on water/roads).
   */
  private placeObject(
    type: WorldObjectType,
    x: number,
    y: number,
    variantId: number,
    rng?: SeededRng,
  ): WorldObjectData | null {
    const id = rng !== undefined ? `obj-${type}-${x}-${y}` : `authored-${type}-${x}-${y}`;
    const obj = createWorldObject(type, x, y, { id, variantId });
    for (const tile of footprintTiles(obj)) {
      if (!this.map.isInBounds(tile.x, tile.y)) {
        return null;
      }
      const terrain = this.map.getTerrain(tile.x, tile.y);
      if (terrain === TerrainType.Water || terrain === TerrainType.Road) {
        return null;
      }
      if (this.occupancy.has(LocalWorldDataProvider.tileKey(tile.x, tile.y))) {
        return null;
      }
    }
    this.registerObject(obj);
    return obj;
  }

  private registerObject(obj: WorldObjectData): void {
    this.objectsById.set(obj.id, obj);
    for (const tile of footprintTiles(obj)) {
      this.occupancy.set(LocalWorldDataProvider.tileKey(tile.x, tile.y), obj.id);
    }
    // Bucket by the chunk containing the footprint ORIGIN tile.
    const chunkX = Math.floor(obj.x / this.config.chunkSize);
    const chunkY = Math.floor(obj.y / this.config.chunkSize);
    const key = getChunkKey(chunkX, chunkY);
    let list = this.objectsByChunk.get(key);
    if (!list) {
      list = [];
      this.objectsByChunk.set(key, list);
    }
    list.push(obj);
  }
}
