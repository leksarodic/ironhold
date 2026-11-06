import assert from 'node:assert/strict';
import { test } from 'node:test';
import { World, resetEntityCounter, WORLD } from '../src/engine/world';
import { Rng, hashString } from '../src/engine/rng';

function newWorld(seed = 42) {
  resetEntityCounter();
  return new World(seed);
}

test('rng is deterministic for a given seed', () => {
  const a = new Rng(99);
  const b = new Rng(99);
  const seqA = Array.from({ length: 8 }, () => a.next());
  const seqB = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(seqA, seqB);
  const c = new Rng(100);
  assert.notDeepEqual(seqA, Array.from({ length: 8 }, () => c.next()));
});

test('rng range and int stay within bounds', () => {
  const r = new Rng(7);
  for (let i = 0; i < 500; i++) {
    const v = r.range(2, 5);
    assert.ok(v >= 2 && v < 5);
    const n = r.int(1, 6);
    assert.ok(n >= 1 && n <= 6 && Number.isInteger(n));
  }
});

test('hashString is stable and differs by input', () => {
  assert.equal(hashString('ROOM-ABCD'), hashString('ROOM-ABCD'));
  assert.notEqual(hashString('ROOM-ABCD'), hashString('ROOM-ABCE'));
});

test('world seeds enemies on construction', () => {
  const w = newWorld();
  assert.ok(w.enemies.length >= 10, `expected enemies, got ${w.enemies.length}`);
  assert.ok(w.aliveEnemies.every((e) => e.hp > 0));
});

test('adding players places them near the world centre', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Tester', classId: 'warrior' });
  assert.equal(w.players.length, 1);
  assert.ok(Math.abs(p.pos.y - WORLD.center.y) < 10);
  assert.equal(p.hp, p.maxHp);
});

test('warrior melee damages the nearest enemy in front', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Tank', classId: 'warrior' });
  // Place an enemy right in front of the player.
  const enemy = w.enemies[0]!;
  enemy.pos = { x: p.pos.x, y: p.pos.y - 1.5 };
  p.facing = { x: 0, y: -1 };
  const before = enemy.hp;
  const ok = w.cast('p1', 'heroic_strike', enemy.pos, enemy.id);
  assert.equal(ok, true);
  assert.ok(enemy.hp < before, 'enemy should take damage');
});

test('casting respects cooldown and resource', () => {
  const w = newWorld();
  w.addPlayer({ id: 'm1', name: 'Mage', classId: 'mage' });
  const first = w.cast('m1', 'fireball', { x: 10, y: 10 });
  assert.equal(first, true);
  const second = w.cast('m1', 'fireball', { x: 10, y: 10 });
  assert.equal(second, false, 'second cast blocked by cooldown');
  assert.ok(w.cooldownRemaining('m1', 'fireball') > 0);
});

test('warrior generates rage when hitting with heroic strike', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'w1', name: 'Bruiser', classId: 'warrior' });
  p.resource = 0;
  const enemy = w.enemies[0]!;
  enemy.pos = { x: p.pos.x, y: p.pos.y - 1 };
  w.cast('w1', 'heroic_strike', enemy.pos, enemy.id);
  assert.ok(p.resource > 0, 'rage should accumulate');
});

test('priest heal restores health to the most wounded ally', () => {
  const w = newWorld();
  const priest = w.addPlayer({ id: 'p1', name: 'Healer', classId: 'priest' });
  const ally = w.addPlayer({ id: 'p2', name: 'Friend', classId: 'warrior' });
  ally.pos = { x: priest.pos.x + 2, y: priest.pos.y };
  ally.hp = ally.maxHp / 2;
  const before = ally.hp;
  const ok = w.cast('p1', 'lesser_heal', ally.pos, ally.id);
  assert.equal(ok, true);
  // Heal has a cast time, so advance the simulation.
  for (let i = 0; i < 40; i++) w.step(1 / 30);
  assert.ok(ally.hp > before, `ally should be healed: ${before} -> ${ally.hp}`);
});

test('damage kills enemies and emits a death event', () => {
  const w = newWorld();
  w.addPlayer({ id: 'p1', name: 'Killer', classId: 'mage' });
  const enemy = w.enemies[0]!;
  enemy.hp = 5;
  const events = [];
  w.damage(enemy, 50, null, 'test');
  events.push(...w.step(1 / 30));
  assert.equal(enemy.alive, false);
  assert.ok(events.some((e) => e.type === 'death'));
});

test('shields absorb damage before health', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Warded', classId: 'mage' });
  w.cast('p1', 'arcane_ward', p.pos);
  const hpBefore = p.hp;
  w.damage(p, 20, null, 'test');
  assert.equal(p.hp, hpBefore, 'shield should absorb all damage');
  const ward = p.buffs.find((b) => b.id === 'arcane_ward');
  assert.ok(ward && (ward.absorb ?? 0) < 45, 'absorb pool should deplete');
});

test('enemies chase and damage nearby players', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Victim', classId: 'warrior' });
  const enemy = w.enemies[0]!;
  enemy.pos = { x: p.pos.x + 2, y: p.pos.y };
  enemy.targetId = 'p1';
  const hpBefore = p.hp;
  for (let i = 0; i < 120; i++) w.step(1 / 30);
  assert.ok(p.hp < hpBefore, 'player should take enemy damage');
});

test('battle shout buffs the whole party', () => {
  const w = newWorld();
  const w1 = w.addPlayer({ id: 'w1', name: 'Shouter', classId: 'warrior' });
  const ally = w.addPlayer({ id: 'a1', name: 'Ally', classId: 'mage' });
  w1.resource = 100;
  w.cast('w1', 'battle_shout', w1.pos);
  assert.ok(w1.buffs.some((b) => b.id === 'battle_shout'));
  assert.ok(ally.buffs.some((b) => b.id === 'battle_shout'));
  assert.ok(w.attackBonus(w1) > 0);
});

test('movement is clamped to world bounds', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Runner', classId: 'warrior' });
  for (let i = 0; i < 400; i++) {
    w.moveEntity('p1', { x: -1, y: -1 }, { x: -1, y: -1 });
  }
  assert.ok(p.pos.x >= 1.2 && p.pos.y >= 1.2, `pos ${p.pos.x},${p.pos.y} should stay in bounds`);
});

test('dead players respawn after the delay', () => {
  const w = newWorld();
  const p = w.addPlayer({ id: 'p1', name: 'Fallen', classId: 'warrior' });
  p.hp = 1;
  w.damage(p, 100, null, 'test');
  assert.equal(p.alive, false);
  // Simulate the respawn timestamp elapsing.
  p.respawnAt = Date.now() - 1;
  w.step(1 / 30);
  assert.equal(p.alive, true);
  assert.equal(p.hp, p.maxHp);
});

test('simulation is deterministic across two identical worlds', () => {
  const run = () => {
    resetEntityCounter();
    const w = new World(2024);
    const p = w.addPlayer({ id: 'p1', name: 'Sim', classId: 'warrior' });
    const out: string[] = [];
    for (let i = 0; i < 90; i++) {
      w.moveEntity('p1', { x: 0.4, y: -0.6 }, { x: 0, y: -1 });
      if (i % 30 === 0) w.cast('p1', 'thunder_clap', p.pos);
      w.step(1 / 30);
      out.push(`${p.pos.x.toFixed(4)},${p.pos.y.toFixed(4)},${p.hp.toFixed(2)}`);
    }
    return out.join('|');
  };
  assert.equal(run(), run());
});
