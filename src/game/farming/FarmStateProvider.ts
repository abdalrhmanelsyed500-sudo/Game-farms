import type {
  CropStateData,
  FarmPlotData,
  SoilState,
} from '../../shared/types/farming.js';

/**
 * FarmStateProvider: abstraction over WHERE farming state lives.
 *
 * Phase 2 ships LocalFarmState (in-memory, deterministic). A future
 * ServerFarmStateProvider implements this same interface to make farming
 * server-authoritative WITHOUT touching FarmingSystem, renderers, or UI.
 */
export interface FarmStateProvider {
  /** The designated farm plot (farming is only valid inside). */
  getPlot(): FarmPlotData;

  // -- soil ------------------------------------------------------------------
  getSoil(tileX: number, tileY: number): SoilState;
  setSoil(tileX: number, tileY: number, soil: SoilState): void;
  isWatered(tileX: number, tileY: number): boolean;
  /** All tiles with non-default soil (chunk rebuilds + future saves). */
  getModifiedSoil(): ReadonlyArray<{ x: number; y: number; soil: SoilState }>;

  // -- crops ------------------------------------------------------------------
  getCrop(tileX: number, tileY: number): CropStateData | null;
  setCrop(crop: CropStateData): void;
  removeCrop(tileX: number, tileY: number): CropStateData | null;
  getAllCrops(): readonly CropStateData[];

  /** Reset all farming state (dev tools / tests). */
  clear(): void;
}
