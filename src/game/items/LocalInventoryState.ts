import { INVENTORY_CAPACITY } from '../../shared/constants/config.js';
import type { InventorySlotData } from '../../shared/types/items.js';
import type { InventoryStateProvider } from './InventoryStateProvider.js';

/**
 * LocalInventoryState: in-memory InventoryStateProvider (Phase 3).
 * Owns the slot array; InventorySystem owns the stacking rules.
 */
export class LocalInventoryState implements InventoryStateProvider {
  private slots: Array<InventorySlotData | null>;

  public constructor(capacity: number = INVENTORY_CAPACITY) {
    this.slots = new Array<InventorySlotData | null>(capacity).fill(null);
  }

  public load(): ReadonlyArray<InventorySlotData | null> {
    return [...this.slots];
  }

  public save(slots: ReadonlyArray<InventorySlotData | null>): void {
    this.slots = [...slots];
  }

  public clear(): void {
    this.slots = new Array<InventorySlotData | null>(this.slots.length).fill(null);
  }
}
