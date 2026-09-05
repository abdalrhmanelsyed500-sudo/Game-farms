/**
 * Item data contracts (Phase 3).
 *
 * Items are identified by STABLE string ids ("item:wheat_seed") — never by
 * display names. Definitions live in the ItemCatalog; quantities live in
 * InventorySystem state; rendering lives in UI. The three never mix.
 */

/** Item categories. Unused variants are future-ready placeholders. */
export enum ItemCategory {
  Seed = 'seed',
  Crop = 'crop',
  Resource = 'resource',
  Tool = 'tool',
  BuildingMaterial = 'building_material',
  Decoration = 'decoration',
  Food = 'food',
  AnimalProduct = 'animal_product',
  CraftedGood = 'crafted_good',
  QuestItem = 'quest_item',
  Cosmetic = 'cosmetic',
}

/** Static definition of one item kind (single source: ItemCatalog). */
export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  /** Texture key for icons/slots. */
  readonly iconKey: string;
  /** Reserved for the future economy (no selling in Phase 3). */
  readonly sellable: boolean;
  readonly sellPrice: number;
  /** Whether the item can be "used" directly (seeds plant via tools instead). */
  readonly usable: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** One occupied inventory slot (state, not rendering). */
export interface InventorySlotData {
  readonly itemId: string;
  readonly quantity: number;
}
