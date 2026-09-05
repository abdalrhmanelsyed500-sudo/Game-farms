import { DEPTH_EPSILON } from '../../shared/constants/config.js';

/**
 * Conceptual render layers.
 *
 * Layers are coarse groups (terrain always under objects, debug always on
 * top). WITHIN the world layers, exact ordering is decided by DepthSorter —
 * layers must never be used as a replacement for depth sorting.
 */
export enum RenderLayer {
  Background = 0,
  Terrain = 1,
  GroundDecals = 5,
  /** World objects AND entities share one band so they interleave correctly. */
  WorldObjects = 10,
  Foreground = 100,
  Effects = 200,
  SelectionHighlight = 300,
  Debug = 1000,
  Ui = 2000,
}

export const RENDER_DEPTH_EPSILON = DEPTH_EPSILON;

/**
 * Maximum (x + y) sort key the world-object band must accommodate.
 * Phase 1 world is 256x256 => max key ~512. Keep headroom for growth.
 */
export const WORLD_SORT_HEADROOM = 4096;

/** Sanity check: object-band depths must never leak into the Foreground band. */
export function assertDepthInLayer(depth: number, layer: RenderLayer): void {
  const maxAllowed =
    layer === RenderLayer.WorldObjects
      ? RenderLayer.Foreground
      : layer === RenderLayer.Terrain
        ? RenderLayer.GroundDecals
        : Number.POSITIVE_INFINITY;
  if (depth < layer || depth >= maxAllowed) {
    throw new Error(`DEPTH_ERROR: depth ${depth} outside layer ${layer}`);
  }
}
