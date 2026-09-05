import { INVENTORY_CAPACITY } from '../../shared/constants/config.js';
import type { InventorySlotData } from '../../shared/types/items.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { requireItemDefinition } from './ItemCatalog.js';
import type { InventoryStateProvider } from './InventoryStateProvider.js';

/** Events emitted on every inventory mutation (UI subscribes). */
export interface InventoryEvents {
  'inventory-changed': { slots: ReadonlyArray<InventorySlotData | null> };
}

export interface AddItemResult {
  readonly added: number;
  readonly leftover: number;
}

export interface RemoveItemResult {
  readonly removed: number;
  readonly missing: number;
}

/**
 * InventorySystem: slot-based item storage with stacking rules.
 *
 * - Pure logic (no Phaser, no UI): quantities live in slot state, validated
 *   against the ItemCatalog (maxStack, existence).
 * - addItem fills existing stacks first, then empty slots; never overflows
 *   silently — leftovers are reported so callers (harvest, building) can
 *   roll back instead of deleting items.
 * - Persists through an InventoryStateProvider (local now, server later).
 */
export class InventorySystem {
  public readonly events = new TypedEventEmitter<InventoryEvents>();

  private readonly provider: InventoryStateProvider;
  private readonly capacity: number;
  private slots: Array<InventorySlotData | null>;

  public constructor(provider: InventoryStateProvider, capacity: number = INVENTORY_CAPACITY) {
    this.provider = provider;
    this.capacity = capacity;
    const loaded = provider.load();
    this.slots = new Array<InventorySlotData | null>(capacity).fill(null);
    for (let i = 0; i < Math.min(loaded.length, capacity); i++) {
      this.slots[i] = loaded[i] ?? null;
    }
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getSlots(): ReadonlyArray<InventorySlotData | null> {
    return [...this.slots];
  }

  public getSlot(index: number): InventorySlotData | null {
    this.assertSlotIndex(index);
    return this.slots[index] ?? null;
  }

  /** Total quantity across all stacks. Unknown ids fail loudly. */
  public getQuantity(itemId: string): number {
    requireItemDefinition(itemId);
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.itemId === itemId) {
        total += slot.quantity;
      }
    }
    return total;
  }

  public hasItem(itemId: string, quantity = 1): boolean {
    return this.getQuantity(itemId) >= quantity;
  }

  public canRemove(itemId: string, quantity: number): boolean {
    return this.hasItem(itemId, quantity);
  }

  /** Simulate addItem without mutating. */
  public canAdd(itemId: string, quantity: number): boolean {
    requireItemDefinition(itemId);
    if (quantity <= 0) {
      return true;
    }
    return this.simulateAdd(itemId, quantity) === 0;
  }

  /**
   * Add items (stack-first, then empty slots). Returns leftover that did
   * NOT fit — callers must handle leftovers, never ignore them.
   */
  public addItem(itemId: string, quantity: number): AddItemResult {
    const def = requireItemDefinition(itemId);
    if (quantity <= 0) {
      return { added: 0, leftover: 0 };
    }
    let remaining = quantity;
    // Pass 1: top up existing stacks.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.itemId === itemId && slot.quantity < def.maxStack) {
        const room = def.maxStack - slot.quantity;
        const take = Math.min(room, remaining);
        this.slots[i] = { itemId, quantity: slot.quantity + take };
        remaining -= take;
      }
    }
    // Pass 2: new stacks in empty slots.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const take = Math.min(def.maxStack, remaining);
        this.slots[i] = { itemId, quantity: take };
        remaining -= take;
      }
    }
    const added = quantity - remaining;
    if (added > 0) {
      this.commit();
    }
    return { added, leftover: remaining };
  }

  /**
   * Remove items (from fullest stacks first to free slots early).
   * Reports missing quantities instead of going negative.
   */
  public removeItem(itemId: string, quantity: number): RemoveItemResult {
    requireItemDefinition(itemId);
    if (quantity <= 0) {
      return { removed: 0, missing: 0 };
    }
    let remaining = quantity;
    const order = this.slotIndicesByQuantityDesc(itemId);
    for (const i of order) {
      if (remaining <= 0) {
        break;
      }
      const slot = this.slots[i];
      if (!slot || slot.itemId !== itemId) {
        continue;
      }
      const take = Math.min(slot.quantity, remaining);
      const left = slot.quantity - take;
      this.slots[i] = left > 0 ? { itemId, quantity: left } : null;
      remaining -= take;
    }
    const removed = quantity - remaining;
    if (removed > 0) {
      this.commit();
    }
    return { removed, missing: remaining };
  }

  /** Set the TOTAL quantity of an item (adjusts stacks up or down). */
  public setQuantity(itemId: string, quantity: number): void {
    requireItemDefinition(itemId);
    const target = Math.max(0, Math.floor(quantity));
    const current = this.getQuantity(itemId);
    if (target > current) {
      this.addItem(itemId, target - current);
    } else if (target < current) {
      this.removeItem(itemId, current - target);
    }
  }

  public clear(): void {
    this.slots = new Array<InventorySlotData | null>(this.capacity).fill(null);
    this.commit();
  }

  // -- internals ---------------------------------------------------------------------

  private simulateAdd(itemId: string, quantity: number): number {
    const def = requireItemDefinition(itemId);
    let remaining = quantity;
    for (const slot of this.slots) {
      if (remaining <= 0) {
        break;
      }
      if (slot === null) {
        remaining -= Math.min(def.maxStack, remaining);
      } else if (slot.itemId === itemId) {
        remaining -= Math.min(def.maxStack - slot.quantity, remaining);
      }
    }
    return remaining;
  }

  private slotIndicesByQuantityDesc(itemId: string): number[] {
    return this.slots
      .map((slot, index) => ({ slot, index }))
      .filter((entry) => entry.slot?.itemId === itemId)
      .sort((a, b) => (b.slot?.quantity ?? 0) - (a.slot?.quantity ?? 0))
      .map((entry) => entry.index);
  }

  private assertSlotIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.capacity) {
      throw new Error(`INVENTORY_ERROR: slot index ${index} out of range 0..${this.capacity - 1}`);
    }
  }

  private commit(): void {
    this.provider.save(this.getSlots());
    this.events.emit('inventory-changed', { slots: this.getSlots() });
  }
}
