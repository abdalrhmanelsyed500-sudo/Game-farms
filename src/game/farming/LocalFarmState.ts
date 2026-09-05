import {
  FARM_PLOT_HEIGHT,
  FARM_PLOT_WIDTH,
  FARM_PLOT_X,
  FARM_PLOT_Y,
} from '../../shared/constants/config.js';
import { SoilState, type CropStateData, type FarmPlotData } from '../../shared/types/farming.js';
import type { FarmStateProvider } from './FarmStateProvider.js';

/**
 * LocalFarmState: in-memory FarmStateProvider (Phase 2).
 *
 * Stores ONLY farming deltas (modified soil + crops). Terrain/objects stay in
 * the world provider. Soil entries are created lazily — untouched tiles cost
 * nothing and implicitly read as SoilState.Normal.
 */
export class LocalFarmState implements FarmStateProvider {
  private readonly plot: FarmPlotData;
  private readonly soil = new Map<string, SoilState>();
  private readonly crops = new Map<string, CropStateData>();

  public constructor(plot: FarmPlotData = {
    x: FARM_PLOT_X,
    y: FARM_PLOT_Y,
    width: FARM_PLOT_WIDTH,
    height: FARM_PLOT_HEIGHT,
  }) {
    this.plot = { ...plot };
  }

  public getPlot(): FarmPlotData {
    return { ...this.plot };
  }

  public isInPlot(tileX: number, tileY: number): boolean {
    return (
      tileX >= this.plot.x &&
      tileY >= this.plot.y &&
      tileX < this.plot.x + this.plot.width &&
      tileY < this.plot.y + this.plot.height
    );
  }

  // -- soil --------------------------------------------------------------------

  public getSoil(tileX: number, tileY: number): SoilState {
    return this.soil.get(LocalFarmState.key(tileX, tileY)) ?? SoilState.Normal;
  }

  public setSoil(tileX: number, tileY: number, soil: SoilState): void {
    const key = LocalFarmState.key(tileX, tileY);
    if (soil === SoilState.Normal) {
      this.soil.delete(key); // deltas only: Normal is the implicit default
    } else {
      this.soil.set(key, soil);
    }
  }

  public isWatered(tileX: number, tileY: number): boolean {
    return this.getSoil(tileX, tileY) === SoilState.Watered;
  }

  public getModifiedSoil(): ReadonlyArray<{ x: number; y: number; soil: SoilState }> {
    const entries: Array<{ x: number; y: number; soil: SoilState }> = [];
    for (const [key, soil] of this.soil) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      entries.push({ x, y, soil });
    }
    return entries;
  }

  // -- crops --------------------------------------------------------------------

  public getCrop(tileX: number, tileY: number): CropStateData | null {
    return this.crops.get(LocalFarmState.key(tileX, tileY)) ?? null;
  }

  public setCrop(crop: CropStateData): void {
    this.crops.set(LocalFarmState.key(crop.tileX, crop.tileY), crop);
  }

  public removeCrop(tileX: number, tileY: number): CropStateData | null {
    const key = LocalFarmState.key(tileX, tileY);
    const crop = this.crops.get(key) ?? null;
    if (crop) {
      this.crops.delete(key);
    }
    return crop;
  }

  public getAllCrops(): readonly CropStateData[] {
    return [...this.crops.values()];
  }

  public clear(): void {
    this.soil.clear();
    this.crops.clear();
  }

  private static key(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }
}
