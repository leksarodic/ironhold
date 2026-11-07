import type { Quality } from '@/theme/tokens';
import type { ClassId } from './classes';

export type ItemSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainhand' | 'offhand' | 'trinket';

export type ItemKind = 'weapon' | 'armor' | 'consumable' | 'material' | 'quest';

export interface ItemStats {
  attack?: number;
  armor?: number;
  hp?: number;
  resource?: number;
  /** Bonus damage for mage/priest spells. */
  spellPower?: number;
  /** Healing power for priests. */
  healing?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  slot?: ItemSlot;
  quality: Quality;
  ilvl: number;
  /** Max stack size; 1 means unique/equipment. */
  stack: number;
  icon: string;
  stats: ItemStats;
  /** Classes that benefit most (used for need/greed hints). */
  classes?: ClassId[];
  sellPrice: number;
  flavor?: string;
}

export const ITEMS: Record<string, ItemDef> = {
  rusty_shortsword: {
    id: 'rusty_shortsword',
    name: 'Rusty Shortsword',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'poor',
    ilvl: 3,
    stack: 1,
    icon: 'sword',
    stats: { attack: 3 },
    classes: ['warrior'],
    sellPrice: 8,
    flavor: 'Pitted, but it still has an edge.',
  },
  militia_blade: {
    id: 'militia_blade',
    name: 'Militia Blade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    ilvl: 8,
    stack: 1,
    icon: 'sword',
    stats: { attack: 7 },
    classes: ['warrior'],
    sellPrice: 42,
    flavor: 'Issued to every recruit of the Vale.',
  },
  ashwood_staff: {
    id: 'ashwood_staff',
    name: 'Ashwood Staff',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    ilvl: 9,
    stack: 1,
    icon: 'smite',
    stats: { spellPower: 8, attack: 2 },
    classes: ['mage', 'priest'],
    sellPrice: 48,
    flavor: 'Warm to the touch, as if remembering fire.',
  },
  apprentice_robe: {
    id: 'apprentice_robe',
    name: 'Apprentice Robe',
    kind: 'armor',
    slot: 'chest',
    quality: 'common',
    ilvl: 5,
    stack: 1,
    icon: 'ward',
    stats: { armor: 4, spellPower: 3 },
    classes: ['mage', 'priest'],
    sellPrice: 18,
  },
  ironbound_hauberk: {
    id: 'ironbound_hauberk',
    name: 'Ironbound Hauberk',
    kind: 'armor',
    slot: 'chest',
    quality: 'rare',
    ilvl: 14,
    stack: 1,
    icon: 'shield',
    stats: { armor: 14, hp: 20 },
    classes: ['warrior'],
    sellPrice: 120,
    flavor: 'Forged in the shadow of the Hold.',
  },
  wolfhide_boots: {
    id: 'wolfhide_boots',
    name: 'Wolfhide Boots',
    kind: 'armor',
    slot: 'feet',
    quality: 'uncommon',
    ilvl: 7,
    stack: 1,
    icon: 'boot',
    stats: { armor: 5, hp: 8 },
    sellPrice: 34,
  },
  kobold_candle: {
    id: 'kobold_candle',
    name: 'Kobold Candle',
    kind: 'material',
    quality: 'common',
    ilvl: 1,
    stack: 10,
    icon: 'scroll',
    stats: {},
    sellPrice: 2,
    flavor: 'You no take candle!',
  },
  boar_tusk: {
    id: 'boar_tusk',
    name: 'Boar Tusk',
    kind: 'material',
    quality: 'common',
    ilvl: 2,
    stack: 10,
    icon: 'scroll',
    stats: {},
    sellPrice: 4,
  },
  minor_healing_potion: {
    id: 'minor_healing_potion',
    name: 'Minor Healing Potion',
    kind: 'consumable',
    quality: 'common',
    ilvl: 5,
    stack: 5,
    icon: 'heal',
    stats: { hp: 45 },
    sellPrice: 12,
    flavor: 'Tastes of copper and regret.',
  },
  minor_mana_potion: {
    id: 'minor_mana_potion',
    name: 'Minor Mana Potion',
    kind: 'consumable',
    quality: 'common',
    ilvl: 5,
    stack: 5,
    icon: 'ward',
    stats: { resource: 45 },
    sellPrice: 12,
  },
  ogre_warband: {
    id: 'ogre_warband',
    name: 'Ogre Warband Signet',
    kind: 'armor',
    slot: 'trinket',
    quality: 'epic',
    ilvl: 22,
    stack: 1,
    icon: 'crown',
    stats: { attack: 6, hp: 30, spellPower: 6 },
    sellPrice: 400,
    flavor: 'Crude iron, yet it hums with old strength.',
  },
  vale_quest_note: {
    id: 'vale_quest_note',
    name: "Warden's Sealed Note",
    kind: 'quest',
    quality: 'rare',
    ilvl: 1,
    stack: 1,
    icon: 'scroll',
    stats: {},
    sellPrice: 0,
    flavor: 'The seal is broken. Someone wanted this found.',
  },
};

export const ITEM_LIST = Object.values(ITEMS);

export function itemById(id: string): ItemDef | undefined {
  return ITEMS[id];
}

/** Loot table per enemy type: [itemId, weight]. */
export const LOOT_TABLES: Record<string, Array<[string, number]>> = {
  boar: [
    ['boar_tusk', 55],
    ['rusty_shortsword', 10],
    ['minor_healing_potion', 14],
    ['wolfhide_boots', 6],
    ['apprentice_robe', 8],
  ],
  kobold: [
    ['kobold_candle', 60],
    ['minor_mana_potion', 16],
    ['apprentice_robe', 9],
    ['militia_blade', 6],
    ['vale_quest_note', 3],
  ],
  wolf: [
    ['wolfhide_boots', 22],
    ['boar_tusk', 25],
    ['minor_healing_potion', 14],
    ['ashwood_staff', 7],
    ['ironbound_hauberk', 5],
  ],
  ogre: [
    ['ironbound_hauberk', 22],
    ['ogre_warband', 8],
    ['militia_blade', 18],
    ['ashwood_staff', 16],
    ['minor_healing_potion', 30],
  ],
};

/** Inventory grid dimensions, classic 16-slot backpack look. */
export const BAG_COLS = 5;
export const BAG_ROWS = 4;
export const BAG_SLOTS = BAG_COLS * BAG_ROWS;
