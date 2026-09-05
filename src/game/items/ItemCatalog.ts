import { ItemCategory, type ItemDefinition } from '../../shared/types/items.js';

/**
 * ItemCatalog: the single source of truth for item definitions.
 *
 * Phase 3 items: 3 seeds + 3 crops + wood + stone. Tools are governed by
 * ToolCatalog (a tool ITEM category exists for the future inventory-held
 * tools, but no tool items ship yet). Nothing outside this file may
 * hard-code item properties (names, stack sizes, icons).
 */
const ITEMS: readonly ItemDefinition[] = [
  {
    id: 'item:wheat_seed',
    name: 'Wheat Seeds',
    description: 'Plant in tilled soil. Grows into wheat.',
    category: ItemCategory.Seed,
    maxStack: 99,
    iconKey: 'icon_wheat_seed',
    sellable: false,
    sellPrice: 0,
    usable: false,
    metadata: { cropId: 'wheat' },
  },
  {
    id: 'item:corn_seed',
    name: 'Corn Seeds',
    description: 'Plant in tilled soil. Grows into corn.',
    category: ItemCategory.Seed,
    maxStack: 99,
    iconKey: 'icon_corn_seed',
    sellable: false,
    sellPrice: 0,
    usable: false,
    metadata: { cropId: 'corn' },
  },
  {
    id: 'item:tomato_seed',
    name: 'Tomato Seeds',
    description: 'Plant in tilled soil. Grows into tomatoes.',
    category: ItemCategory.Seed,
    maxStack: 99,
    iconKey: 'icon_tomato_seed',
    sellable: false,
    sellPrice: 0,
    usable: false,
    metadata: { cropId: 'tomato' },
  },
  {
    id: 'item:wheat',
    name: 'Wheat',
    description: 'Golden grain. A future crafting staple.',
    category: ItemCategory.Crop,
    maxStack: 99,
    iconKey: 'icon_wheat',
    sellable: true,
    sellPrice: 5,
    usable: false,
    metadata: { cropId: 'wheat' },
  },
  {
    id: 'item:corn',
    name: 'Corn',
    description: 'Hearty ears of corn.',
    category: ItemCategory.Crop,
    maxStack: 99,
    iconKey: 'icon_corn',
    sellable: true,
    sellPrice: 8,
    usable: false,
    metadata: { cropId: 'corn' },
  },
  {
    id: 'item:tomato',
    name: 'Tomato',
    description: 'Juicy red tomatoes.',
    category: ItemCategory.Crop,
    maxStack: 99,
    iconKey: 'icon_tomato',
    sellable: true,
    sellPrice: 7,
    usable: false,
    metadata: { cropId: 'tomato' },
  },
  {
    id: 'item:wood',
    name: 'Wood',
    description: 'Building material. Chop more later.',
    category: ItemCategory.BuildingMaterial,
    maxStack: 99,
    iconKey: 'icon_wood',
    sellable: true,
    sellPrice: 2,
    usable: false,
    metadata: {},
  },
  {
    id: 'item:stone',
    name: 'Stone',
    description: 'Building material. Mine more later.',
    category: ItemCategory.BuildingMaterial,
    maxStack: 99,
    iconKey: 'icon_stone',
    sellable: true,
    sellPrice: 3,
    usable: false,
    metadata: {},
  },
];

const BY_ID: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(ITEMS.map((d) => [d.id, d])),
);

export const ITEM_IDS: readonly string[] = ITEMS.map((d) => d.id);

/** All item definitions (UI lists, tests). */
export function getItemDefinitions(): readonly ItemDefinition[] {
  return ITEMS;
}

export function getItemDefinition(itemId: string): ItemDefinition | null {
  return BY_ID[itemId] ?? null;
}

export function requireItemDefinition(itemId: string): ItemDefinition {
  const def = getItemDefinition(itemId);
  if (!def) {
    throw new Error(`ITEM_ERROR: unknown item id "${itemId}"`);
  }
  return def;
}

export function getItemsByCategory(category: ItemCategory): readonly ItemDefinition[] {
  return ITEMS.filter((d) => d.category === category);
}
