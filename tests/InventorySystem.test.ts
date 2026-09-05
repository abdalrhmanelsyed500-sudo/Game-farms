import { describe, expect, it } from 'vitest';
import { INVENTORY_CAPACITY } from '../src/shared/constants/config.js';
import { ItemCategory } from '../src/shared/types/items.js';
import { InventorySystem } from '../src/game/items/InventorySystem.js';
import { LocalInventoryState } from '../src/game/items/LocalInventoryState.js';
import {
  getItemDefinition,
  getItemDefinitions,
  requireItemDefinition,
} from '../src/game/items/ItemCatalog.js';

function makeInventory(capacity = INVENTORY_CAPACITY): InventorySystem {
  return new InventorySystem(new LocalInventoryState(), capacity);
}

describe('ItemCatalog', () => {
  it('defines seeds + crops + wood + stone with stable ids', () => {
    const ids = getItemDefinitions().map((d) => d.id);
    expect(ids).toContain('item:wheat_seed');
    expect(ids).toContain('item:corn_seed');
    expect(ids).toContain('item:tomato_seed');
    expect(ids).toContain('item:wheat');
    expect(ids).toContain('item:corn');
    expect(ids).toContain('item:tomato');
    expect(ids).toContain('item:wood');
    expect(ids).toContain('item:stone');
  });

  it('categorizes seeds, crops, and materials', () => {
    expect(requireItemDefinition('item:wheat_seed').category).toBe(ItemCategory.Seed);
    expect(requireItemDefinition('item:wheat').category).toBe(ItemCategory.Crop);
    expect(requireItemDefinition('item:wood').category).toBe(ItemCategory.BuildingMaterial);
    expect(requireItemDefinition('item:stone').category).toBe(ItemCategory.BuildingMaterial);
  });

  it('looks up by id, returns null when unknown, throws on require', () => {
    expect(getItemDefinition('item:wood')?.name).toBe('Wood');
    expect(getItemDefinition('item:nope')).toBeNull();
    expect(() => requireItemDefinition('item:nope')).toThrow();
  });

  it('gives every item a stack size and an icon key', () => {
    for (const def of getItemDefinitions()) {
      expect(def.maxStack).toBeGreaterThanOrEqual(1);
      expect(def.iconKey).toMatch(/^icon_/);
    }
  });
});

describe('InventorySystem', () => {
  it('starts empty with the configured capacity', () => {
    const inventory = makeInventory(10);
    expect(inventory.getCapacity()).toBe(10);
    expect(inventory.getSlots()).toHaveLength(10);
    expect(inventory.getQuantity('item:wood')).toBe(0);
  });

  it('stacks into existing stacks before opening new slots', () => {
    const inventory = makeInventory();
    expect(inventory.addItem('item:wood', 50)).toEqual({ added: 50, leftover: 0 });
    expect(inventory.addItem('item:wood', 60)).toEqual({ added: 60, leftover: 0 });
    // maxStack 99: first stack capped, remainder in a second stack.
    expect(inventory.getSlot(0)).toEqual({ itemId: 'item:wood', quantity: 99 });
    expect(inventory.getSlot(1)).toEqual({ itemId: 'item:wood', quantity: 11 });
    expect(inventory.getQuantity('item:wood')).toBe(110);
  });

  it('reports leftovers instead of overflowing a full inventory', () => {
    const inventory = makeInventory(1);
    expect(inventory.addItem('item:stone', 99)).toEqual({ added: 99, leftover: 0 });
    expect(inventory.addItem('item:stone', 5)).toEqual({ added: 0, leftover: 5 });
    expect(inventory.canAdd('item:stone', 1)).toBe(false);
    // A different item cannot evict the stone stack either.
    expect(inventory.canAdd('item:wood', 1)).toBe(false);
    expect(inventory.addItem('item:wood', 1)).toEqual({ added: 0, leftover: 1 });
  });

  it('canAdd simulates without mutating', () => {
    const inventory = makeInventory(1);
    expect(inventory.canAdd('item:wood', 99)).toBe(true);
    expect(inventory.getQuantity('item:wood')).toBe(0);
    expect(inventory.getSlot(0)).toBeNull();
  });

  it('removes from fullest stacks first and reports missing amounts', () => {
    const inventory = makeInventory();
    inventory.addItem('item:wood', 120); // 99 + 21
    expect(inventory.removeItem('item:wood', 100)).toEqual({ removed: 100, missing: 0 });
    expect(inventory.getQuantity('item:wood')).toBe(20);
    expect(inventory.removeItem('item:wood', 50)).toEqual({ removed: 20, missing: 30 });
    expect(inventory.getQuantity('item:wood')).toBe(0);
    expect(inventory.getSlot(0)).toBeNull();
    expect(inventory.getSlot(1)).toBeNull();
  });

  it('canRemove/hasItem answer without mutating', () => {
    const inventory = makeInventory();
    inventory.addItem('item:stone', 10);
    expect(inventory.hasItem('item:stone', 10)).toBe(true);
    expect(inventory.hasItem('item:stone', 11)).toBe(false);
    expect(inventory.canRemove('item:stone', 10)).toBe(true);
    expect(inventory.canRemove('item:stone', 11)).toBe(false);
    expect(inventory.getQuantity('item:stone')).toBe(10);
  });

  it('setQuantity adjusts totals up and down', () => {
    const inventory = makeInventory();
    inventory.setQuantity('item:corn', 150);
    expect(inventory.getQuantity('item:corn')).toBe(150);
    inventory.setQuantity('item:corn', 30);
    expect(inventory.getQuantity('item:corn')).toBe(30);
    inventory.setQuantity('item:corn', 0);
    expect(inventory.getQuantity('item:corn')).toBe(0);
  });

  it('clear empties every slot', () => {
    const inventory = makeInventory();
    inventory.addItem('item:wood', 10);
    inventory.addItem('item:tomato', 4);
    inventory.clear();
    expect(inventory.getQuantity('item:wood')).toBe(0);
    expect(inventory.getQuantity('item:tomato')).toBe(0);
    expect(inventory.getSlots().every((s) => s === null)).toBe(true);
  });

  it('emits inventory-changed on mutation, not on reads', () => {
    const inventory = makeInventory();
    let events = 0;
    inventory.events.on('inventory-changed', () => events++);
    inventory.getQuantity('item:wood');
    inventory.canAdd('item:wood', 1);
    expect(events).toBe(0);
    inventory.addItem('item:wood', 1);
    expect(events).toBe(1);
    inventory.removeItem('item:wood', 1);
    expect(events).toBe(2);
  });

  it('throws loudly on unknown item ids (never silent)', () => {
    const inventory = makeInventory();
    expect(() => inventory.addItem('item:nope', 1)).toThrow();
    expect(() => inventory.removeItem('item:nope', 1)).toThrow();
    expect(() => inventory.getQuantity('item:nope')).toThrow();
  });

  it('persists through the provider across instances', () => {
    const provider = new LocalInventoryState();
    const first = new InventorySystem(provider);
    first.addItem('item:wood', 42);
    first.addItem('item:wheat_seed', 7);
    const second = new InventorySystem(provider);
    expect(second.getQuantity('item:wood')).toBe(42);
    expect(second.getQuantity('item:wheat_seed')).toBe(7);
    expect(second.getSlot(0)).toEqual({ itemId: 'item:wood', quantity: 42 });
  });

  it('rejects invalid slot access', () => {
    const inventory = makeInventory(2);
    expect(() => inventory.getSlot(-1)).toThrow();
    expect(() => inventory.getSlot(2)).toThrow();
  });
});
