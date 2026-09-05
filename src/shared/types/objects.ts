/**
 * World-object data types. World objects are pure data — rendering is handled
 * by game/rendering/ObjectRenderer.ts.
 */

/** Object kinds implemented in Phase 1. Buildings arrive in later phases. */
export enum WorldObjectType {
  Tree = 'tree',
  Rock = 'rock',
  Flower = 'flower',
  Bush = 'bush',
}

/** A generic logical world object with a tile footprint. */
export interface WorldObjectData {
  readonly id: string;
  readonly type: WorldObjectType;
  /** Footprint origin tile (top corner of the footprint rectangle). */
  readonly x: number;
  readonly y: number;
  /** Logical footprint in tiles. Independent from the visual sprite size. */
  readonly width: number;
  readonly height: number;
  readonly elevation: number;
  /** Whether entities may stand on footprint tiles (decor like flowers: true). */
  readonly walkable: boolean;
  /** Resolved texture key (includes variant), e.g. "tree_01". */
  readonly spriteKey: string;
  readonly variantId: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
