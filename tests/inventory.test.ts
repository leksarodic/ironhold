import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { Inventory, resetUidCounter, rollLoot, equipmentStats, isUpgrade } from '../src/engine/inventory';
import { itemById, BAG_SLOTS, LOOT_TABLES } from '../src/game/items';

beforeEach(() => resetUidCounter());

test('items start empty and report free space', () => {
  const inv = new Inventory();
  assert.equal(inv.usedSlots, 0);
  assert.equal(inv.freeSlots, BAG_SLOTS);
  assert.ok(inv.slots.every((s) => s === null));
});

test('adding a unique item consumes one slot', () => {
  const inv = new Inventory();
  assert.equal(inv.add('rusty_shortsword', 1), 1);
  assert.equal(inv.usedSlots, 1);
  assert.equal(inv.slots[0]!.itemId, 'rusty_shortsword');
});

test('stackable items fill one slot up to the cap', () => {
  const inv = new Inventory();
  const def = itemById('kobold_candle')!;
  assert.equal(def.stack, 10);
  inv.add('kobold_candle', 4);
  assert.equal(inv.usedSlots, 1);
  assert.equal(inv.slots[0]!.qty, 4);
  inv.add('kobold_candle', 4);
  assert.equal(inv.usedSlots, 1, 'should keep stacking in the same slot');
  assert.equal(inv.slots[0]!.qty, 8);
});

test('stack overflow spills into a new slot', () => {
  const inv = new Inventory();
  inv.add('kobold_candle', 10);
  inv.add('kobold_candle', 6);
  assert.equal(inv.usedSlots, 2);
  assert.equal(inv.slots[0]!.qty, 10);
  assert.equal(inv.slots[1]!.qty, 6);
  assert.equal(inv.countOf('kobold_candle'), 16);
});

test('adding stops when the bag is full and reports partial adds', () => {
  const inv = new Inventory(2);
  assert.equal(inv.add('rusty_shortsword', 5), 2);
  assert.equal(inv.usedSlots, 2);
  assert.equal(inv.isFullFor('rusty_shortsword'), true);
});

test('removeAt clears the slot when emptied', () => {
  const inv = new Inventory();
  inv.add('minor_healing_potion', 2);
  const taken = inv.removeAt(0, 1);
  assert.equal(taken!.qty, 1);
  assert.equal(inv.slots[0]!.qty, 1);
  inv.removeAt(0, 1);
  assert.equal(inv.slots[0], null);
});

test('move swaps two distinct items', () => {
  const inv = new Inventory();
  inv.add('rusty_shortsword', 1);
  inv.add('militia_blade', 1);
  assert.equal(inv.move(0, 1), true);
  assert.equal(inv.slots[0]!.itemId, 'militia_blade');
  assert.equal(inv.slots[1]!.itemId, 'rusty_shortsword');
});

test('move merges identical stacks instead of swapping', () => {
  const inv = new Inventory();
  inv.add('kobold_candle', 10); // fills slot 0 to the cap
  inv.add('boar_tusk', 1); // slot 1
  inv.add('kobold_candle', 3); // spills into slot 2
  assert.equal(inv.slots[0]!.qty, 10);
  assert.equal(inv.slots[2]!.itemId, 'kobold_candle');
  // Merging into a full stack cannot move anything, but must not swap.
  inv.move(2, 0);
  assert.equal(inv.slots[0]!.qty, 10);
  assert.equal(inv.slots[2]!.qty, 3, 'source stack must be untouched when target is full');

  // Now free space in slot 0 and merge for real.
  inv.removeAt(0, 4);
  assert.equal(inv.slots[0]!.qty, 6);
  assert.equal(inv.move(2, 0), true);
  assert.equal(inv.slots[0]!.qty, 9);
  assert.equal(inv.slots[2], null);
});

test('move into an empty slot relocates the stack', () => {
  const inv = new Inventory();
  inv.add('rusty_shortsword', 1);
  inv.move(0, 7);
  assert.equal(inv.slots[0], null);
  assert.equal(inv.slots[7]!.itemId, 'rusty_shortsword');
});

test('move rejects invalid indices and empty sources', () => {
  const inv = new Inventory();
  assert.equal(inv.move(0, 1), false);
  inv.add('rusty_shortsword', 1);
  assert.equal(inv.move(0, 999), false);
  assert.equal(inv.move(0, 0), false);
});

test('loot rolls are deterministic for the same seed', () => {
  const a = rollLoot('boar', 12345, 1);
  const b = rollLoot('boar', 12345, 1);
  assert.deepEqual(a, b);
});

test('loot rolls vary with the seed', () => {
  const results = new Set<string>();
  for (let s = 0; s < 60; s++) {
    const r = rollLoot('wolf', s, 1);
    results.add(`${r.itemId}:${r.qty}`);
  }
  assert.ok(results.size > 2, `expected varied loot, got ${results.size} outcomes`);
});

test('loot only ever comes from the enemy table', () => {
  for (const enemy of Object.keys(LOOT_TABLES)) {
    const allowed = new Set(LOOT_TABLES[enemy]!.map(([id]) => id));
    for (let s = 0; s < 80; s++) {
      const r = rollLoot(enemy, s, 1);
      if (r.itemId) assert.ok(allowed.has(r.itemId), `${r.itemId} not in ${enemy} table`);
    }
  }
});

test('unknown enemies drop nothing', () => {
  assert.deepEqual(rollLoot('dragon', 1, 1), { itemId: null, qty: 0 });
});

test('equipment stats sum across equipped pieces', () => {
  const total = equipmentStats({ mainhand: 'militia_blade', chest: 'ironbound_hauberk' });
  assert.equal(total.attack, 7);
  assert.equal(total.armor, 14);
  assert.equal(total.hp, 20);
});

test('equipment stats ignore unknown ids', () => {
  const total = equipmentStats({ mainhand: 'does_not_exist' });
  assert.equal(total.attack, 0);
});

test('isUpgrade compares against the currently equipped piece', () => {
  assert.equal(isUpgrade('militia_blade', {}, 'attack'), true);
  assert.equal(isUpgrade('militia_blade', { mainhand: 'rusty_shortsword' }, 'attack'), true);
  assert.equal(isUpgrade('rusty_shortsword', { mainhand: 'militia_blade' }, 'attack'), false);
});

test('inventory serialises and restores faithfully', () => {
  const inv = new Inventory();
  inv.add('militia_blade', 1);
  inv.add('kobold_candle', 7);
  const json = inv.toJSON();
  const restored = Inventory.fromJSON(json);
  assert.equal(restored.countOf('kobold_candle'), 7);
  assert.equal(restored.find('militia_blade'), 0);
});
