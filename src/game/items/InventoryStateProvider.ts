import type { InventorySlotData } from '../../shared/types/items.js';

/**
 * InventoryStateProvider: persistence port for inventory slots.
 *
 * Phase 3 ships LocalInventoryState (in-memory). A future
 * ServerInventoryStateProvider implements this interface for
 * server-authoritative inventories without touching InventorySystem or UI.
 */
export interface InventoryStateProvider {
  load(): ReadonlyArray<InventorySlotData | null>;
  save(slots: ReadonlyArray<InventorySlotData | null>): void;
  clear(): void;
}
