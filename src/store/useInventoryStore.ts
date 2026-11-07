import { create } from 'zustand';
import { BAG_SLOTS, itemById } from '@/game/items';
import { Inventory, equipmentStats, makeStack, type Equipment, type ItemStack } from '@/engine/inventory';

export interface InventoryState {
  /** Serialised bag slots; `null` is an empty slot. */
  slots: Array<ItemStack | null>;
  equipment: Equipment;
  /** Slot index of the item currently showing a tooltip. */
  hoveredSlot: number | null;
  /** Slot index picked up for drag/drop. */
  pickedSlot: number | null;
  /** Index of a loot roll window, if open. */
  open: boolean;
  /** Transient toast when an item is looted. */
  toast: { text: string; quality: string } | null;
  addItem: (itemId: string, qty?: number) => number;
  removeSlot: (index: number, qty?: number) => void;
  moveSlot: (from: number, to: number) => void;
  equipSlot: (index: number) => void;
  unequip: (slot: keyof Equipment) => void;
  hover: (index: number | null) => void;
  pick: (index: number | null) => void;
  useConsumable: (index: number) => void;
  setOpen: (open: boolean) => void;
  stats: () => ReturnType<typeof equipmentStats>;
  reset: () => void;
}

function freshSlots(): Array<ItemStack | null> {
  return new Array<ItemStack | null>(BAG_SLOTS).fill(null);
}

/** Give every new character the classic starter kit. */
function starterSlots(classId: 'warrior' | 'mage' | 'priest'): Array<ItemStack | null> {
  const inv = new Inventory(BAG_SLOTS);
  if (classId === 'warrior') {
    inv.add('rusty_shortsword', 1);
    inv.add('minor_healing_potion', 3);
  } else if (classId === 'mage') {
    inv.add('ashwood_staff', 1);
    inv.add('apprentice_robe', 1);
    inv.add('minor_mana_potion', 3);
  } else {
    inv.add('apprentice_robe', 1);
    inv.add('minor_healing_potion', 2);
    inv.add('minor_mana_potion', 2);
  }
  inv.add('kobold_candle', 2);
  return inv.slots;
}

const DEFAULT_EQUIPMENT: Equipment = {};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  slots: starterSlots('warrior'),
  equipment: DEFAULT_EQUIPMENT,
  hoveredSlot: null,
  pickedSlot: null,
  open: false,
  toast: null,

  addItem: (itemId, qty = 1) => {
    const def = itemById(itemId);
    if (!def) return 0;
    const inv = new Inventory(BAG_SLOTS);
    // Preserve existing uids by copying current slots into the working inventory.
    get().slots.forEach((s, i) => {
      if (s) inv.slots[i] = { ...s };
    });
    const added = inv.add(itemId, qty);
    if (added > 0) {
      set({
        slots: inv.slots,
        toast: { text: `${def.name}${added > 1 ? ` x${added}` : ''}`, quality: def.quality },
      });
    }
    return added;
  },

  removeSlot: (index, qty = 1) => {
    const inv = new Inventory(BAG_SLOTS);
    get().slots.forEach((s, i) => {
      if (s) inv.slots[i] = { ...s };
    });
    inv.removeAt(index, qty);
    set({ slots: inv.slots });
  },

  moveSlot: (from, to) => {
    const inv = new Inventory(BAG_SLOTS);
    get().slots.forEach((s, i) => {
      if (s) inv.slots[i] = { ...s };
    });
    inv.move(from, to);
    set({ slots: inv.slots, pickedSlot: null });
  },

  equipSlot: (index) => {
    const { slots, equipment } = get();
    const stack = slots[index];
    if (!stack) return;
    const def = itemById(stack.itemId);
    if (!def || !def.slot) return;
    const next = [...slots];
    // Equipment slot is exclusive; the previously worn item returns to the bag.
    const previous = equipment[def.slot];
    const removed = next[index];
    next[index] = null;
    if (previous) {
      next[index] = makeStack(previous, 1);
    }
    void removed;
    set({
      slots: next,
      equipment: { ...equipment, [def.slot]: stack.itemId },
      toast: { text: `Equipped ${def.name}`, quality: def.quality },
    });
  },

  unequip: (slot) => {
    const { equipment, slots } = get();
    const itemId = equipment[slot];
    if (!itemId) return;
    const inv = new Inventory(BAG_SLOTS);
    slots.forEach((s, i) => {
      if (s) inv.slots[i] = { ...s };
    });
    const added = inv.add(itemId, 1);
    if (added === 0) {
      set({ toast: { text: 'Bag is full', quality: 'poor' } });
      return;
    }
    const nextEquip = { ...equipment };
    delete nextEquip[slot];
    set({ slots: inv.slots, equipment: nextEquip });
  },

  hover: (index) => set({ hoveredSlot: index }),
  pick: (index) => set({ pickedSlot: index }),

  useConsumable: (index) => {
    const { slots } = get();
    const stack = slots[index];
    if (!stack) return;
    const def = itemById(stack.itemId);
    if (!def || def.kind !== 'consumable') return;
    set({ toast: { text: `Used ${def.name}`, quality: def.quality } });
    get().removeSlot(index, 1);
  },

  setOpen: (open) => set({ open }),
  stats: () => equipmentStats(get().equipment),
  reset: () => set({ slots: freshSlots(), equipment: {}, hoveredSlot: null, pickedSlot: null }),
}));

/** Convenience: total of a stat across equipment. */
export function equippedTotal(equipment: Equipment): number {
  return equipmentStats(equipment).attack;
}
