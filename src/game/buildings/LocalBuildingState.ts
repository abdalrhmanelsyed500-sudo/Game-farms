/**
 * LocalBuildingState (Phase 3): in-memory BuildingStateProvider.
 */
import type { PlacedBuildingData } from '../../shared/types/buildings.js';
import type { BuildingStateProvider } from './BuildingStateProvider.js';

export class LocalBuildingState implements BuildingStateProvider {
  private readonly records = new Map<string, PlacedBuildingData>();

  public getAll(): readonly PlacedBuildingData[] {
    return [...this.records.values()];
  }

  public add(record: PlacedBuildingData): void {
    this.records.set(record.objectId, { ...record });
  }

  public removeByObjectId(objectId: string): PlacedBuildingData | null {
    const record = this.records.get(objectId) ?? null;
    if (record) {
      this.records.delete(objectId);
    }
    return record;
  }

  public clear(): void {
    this.records.clear();
  }
}
