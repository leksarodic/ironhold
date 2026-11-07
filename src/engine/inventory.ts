import { itemById, ITEMS, LOOT_TABLES, BAG_SLOTS, type ItemDef } from '@/game/items';
import { Rng } from './rng';

export interface ItemStack {
  /** Unique instance id so the same item in two slots stays distinct. */
  uid: string;
  itemId: string;
  qty: number;
}

export interface Equipment {
  head?: string;
  chest?: string;
  legs?: string;
  feet?: string;
  mainhand?: string;
  offhand?: string;
  trinket?: string;
}

let uidCounter = 0;

export function resetUidCounter(): void {
  uidCounter = 0;
}

export function makeStack(itemId: string, qty = 1): ItemStack {
  return { uid: `it-${++uidCounter}`, itemId, qty };
}

/**
 * A fixed-size bag: slots are an array where `null` means empty. Stackable items
 * top up existing stacks before consuming a new slot, like the classic bags.
 */
export class Inventory {
  readonly slots: Array<ItemStack | null>;
  readonly size: number;

  constructor(size = BAG_SLOTS) {
    this.size = size;
    this.slots = new Array<ItemStack | null>(size).fill(null);
  }

  get usedSlots(): number {
    return this.slots.filter(Boolean).length;
  }

  get freeSlots(): number {
    return this.size - this.usedSlots;
  }

  isFullFor(itemId: string, qty = 1): boolean {
    const def = itemById(itemId);
    if (!def) return true;
    if (def.stack > 1) {
      let room = 0;
      for (const s of this.slots) {
        if (s && s.itemId === itemId) room += def.stack - s.qty;
        if (s === null) room += def.stack;
      }
      return room < qty;
    }
    return this.freeSlots < qty;
  }

  /**
   * Add items, stacking where possible. Returns how many were actually stored —
   * a partial add is normal when the bag fills up mid-pickup.
   */
  add(itemId: string, qty = 1): number {
    const def = itemById(itemId);
    if (!def || qty <= 0) return 0;
    let remaining = qty;

    if (def.stack > 1) {
      for (const s of this.slots) {
        if (remaining <= 0) break;
        if (s && s.itemId === itemId && s.qty < def.stack) {
          const take = Math.min(def.stack - s.qty, remaining);
          s.qty += take;
          remaining -= take;
        }
      }
    }
    while (remaining > 0) {
      const idx = this.slots.indexOf(null);
      if (idx < 0) break;
      const take = Math.min(def.stack, remaining);
      this.slots[idx] = makeStack(itemId, take);
      remaining -= take;
    }
    return qty - remaining;
  }

  removeAt(index: number, qty = 1): ItemStack | null {
    const s = this.slots[index];
    if (!s) return null;
    const take = Math.min(qty, s.qty);
    s.qty -= take;
    if (s.qty <= 0) this.slots[index] = null;
    return { ...s, qty: take };
  }

  countOf(itemId: string): number {
    return this.slots.reduce((n, s) => (s && s.itemId === itemId ? n + s.qty : n), 0);
  }

  find(itemId: string): number {
    return this.slots.findIndex((s) => s?.itemId === itemId);
  }

  /** Move a stack between slots; swaps when the destination is occupied. */
  move(from: number, to: number): boolean {
    if (from === to) return false;
    if (from < 0 || to < 0 || from >= this.size || to >= this.size) return false;
    const a = this.slots[from] ?? null;
    if (!a) return false;
    const b = this.slots[to] ?? null;
    // Merge identical stackables rather than swapping them.
    if (b && b.itemId === a.itemId) {
      const def = itemById(a.itemId);
      const cap = def?.stack ?? 1;
      if (cap > 1) {
        const space = cap - b.qty;
        const moved = Math.min(space, a.qty);
        b.qty += moved;
        a.qty -= moved;
        if (a.qty <= 0) this.slots[from] = null;
        return true;
      }
    }
    this.slots[to] = a;
    this.slots[from] = b;
    return true;
  }

  toJSON(): Array<{ itemId: string; qty: number } | null> {
    return this.slots.map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null));
  }

  static fromJSON(data: Array<{ itemId: string; qty: number } | null>, size = BAG_SLOTS): Inventory {
    const inv = new Inventory(size);
    data.forEach((entry, i) => {
      if (entry && i < size) inv.slots[i] = makeStack(entry.itemId, entry.qty);
    });
    return inv;
  }
}

export interface LootRollResult {
  itemId: string | null;
  qty: number;
}

/**
 * Roll loot deterministically from a seed so the host and every joiner agree on
 * what dropped without sending the outcome for each kill.
 */
export function rollLoot(enemyType: string, seed: number, partyLevel = 1): LootRollResult {
  const table = LOOT_TABLES[enemyType];
  if (!table || table.length === 0) return { itemId: null, qty: 0 };
  const rng = new Rng(seed);
  // 62% chance of any drop at all, scaled slightly by party level.
  const dropChance = Math.min(0.85, 0.55 + partyLevel * 0.02);
  if (!rng.chance(dropChance)) return { itemId: null, qty: 0 };

  const total = table.reduce((n, [, w]) => n + w, 0);
  let roll = rng.next() * total;
  let picked = table[0]![0];
  for (const [id, weight] of table) {
    roll -= weight;
    if (roll <= 0) {
      picked = id;
      break;
    }
  }
  const def = itemById(picked);
  if (!def) return { itemId: null, qty: 0 };
  const qty = def.stack > 1 ? rng.int(1, Math.min(def.stack, 3)) : 1;
  return { itemId: picked, qty };
}

/** Total stats granted by equipped items. */
export function equipmentStats(equipment: Equipment): {
  attack: number;
  armor: number;
  hp: number;
  resource: number;
  spellPower: number;
  healing: number;
} {
  const total = { attack: 0, armor: 0, hp: 0, resource: 0, spellPower: 0, healing: 0 };
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const def: ItemDef | undefined = ITEMS[itemId];
    if (!def) continue;
    total.attack += def.stats.attack ?? 0;
    total.armor += def.stats.armor ?? 0;
    total.hp += def.stats.hp ?? 0;
    total.resource += def.stats.resource ?? 0;
    total.spellPower += def.stats.spellPower ?? 0;
    total.healing += def.stats.healing ?? 0;
  }
  return total;
}

/** Compare an item against what is equipped in its slot. */
export function isUpgrade(
  itemId: string,
  equipment: Equipment,
  stat: 'attack' | 'armor' | 'spellPower' | 'hp',
): boolean {
  const def = itemById(itemId);
  if (!def || !def.slot) return false;
  const current = equipment[def.slot];
  const curDef = current ? itemById(current) : undefined;
  const cur = curDef?.stats[stat] ?? 0;
  const next = def.stats[stat] ?? 0;
  return next > cur;
}
