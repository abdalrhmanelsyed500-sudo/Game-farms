/**
 * BuildingStateProvider (Phase 3): abstraction over WHERE placed-building
 * records live. Mirrors FarmStateProvider: LocalBuildingState ships now
 * (in-memory); a server provider can replace it without touching
 * BuildingSystem, renderers, or UI.
 */
import type { PlacedBuildingData } from '../../shared/types/buildings.js';

export interface BuildingStateProvider {
  getAll(): readonly PlacedBuildingData[];
  add(record: PlacedBuildingData): void;
  removeByObjectId(objectId: string): PlacedBuildingData | null;
  clear(): void;
}
