import { SEED_STARTING_COUNT } from '../../shared/constants/config.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * Temporary seed storage behind an interface.
 *
 * This is NOT the final InventorySystem — it isolates the "how many seeds"
 * concern so FarmingSystem never manages quantities directly and a real
 * inventory can replace this class later without touching farming rules.
 */
export interface ISeedInventory {
  getCount(seedItemId: string): number;
  /** Returns false (no mutation) when empty. */
  consume(seedItemId: string, amount?: number): boolean;
  add(seedItemId: string, amount?: number): void;
}

export class SeedPouch implements ISeedInventory {
  private readonly seeds = new Map<string, number>();

  public constructor(initialCounts?: Readonly<Record<string, number>>) {
    if (initialCounts) {
      for (const [id, count] of Object.entries(initialCounts)) {
        this.seeds.set(id, count);
      }
    }
  }

  /** Pouch pre-filled with the configured starting seeds for given crops. */
  public static withStarterSeeds(seedItemIds: readonly string[]): SeedPouch {
    const pouch = new SeedPouch();
    for (const id of seedItemIds) {
      pouch.add(id, SEED_STARTING_COUNT);
    }
    return pouch;
  }

  public getCount(seedItemId: string): number {
    return this.seeds.get(seedItemId) ?? 0;
  }

  public consume(seedItemId: string, amount = 1): boolean {
    const current = this.getCount(seedItemId);
    if (current < amount) {
      return false;
    }
    this.seeds.set(seedItemId, current - amount);
    return true;
  }

  public add(seedItemId: string, amount = 1): void {
    if (amount < 0) {
      Logger.warn('SeedPouch', `refusing to add negative seeds (${seedItemId}, ${amount})`);
      return;
    }
    this.seeds.set(seedItemId, this.getCount(seedItemId) + amount);
  }
}
