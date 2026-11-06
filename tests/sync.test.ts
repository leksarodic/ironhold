import assert from 'node:assert/strict';
import { test } from 'node:test';
import { World, resetEntityCounter } from '../src/engine/world';
import { toWireState, fromWireState, lerp } from '../src/net/sync';

function setup() {
  resetEntityCounter();
  const w = new World(777);
  w.addPlayer({ id: 'p1', name: 'Host', classId: 'warrior' });
  w.addPlayer({ id: 'p2', name: 'Guest', classId: 'mage' });
  return w;
}

test('wire state carries every party member and enemy', () => {
  const w = setup();
  const wire = toWireState(w, w.time);
  assert.equal(wire.players.length, 2);
  assert.equal(wire.enemies.length, w.enemies.length);
  assert.ok(wire.t >= 0);
  const guest = wire.players.find((p) => p.id === 'p2');
  assert.ok(guest);
  assert.equal(guest!.classId, 'mage');
  assert.equal(guest!.name, 'Guest');
});

test('wire payload stays compact', () => {
  const w = setup();
  const json = JSON.stringify(toWireState(w, w.time));
  // 2 players + 12 enemies should fit comfortably in one data-channel frame.
  assert.ok(json.length < 12000, `payload too large: ${json.length} bytes`);
});

test('positions round-trip within 1cm', () => {
  const w = setup();
  const player = w.players[0]!;
  player.pos = { x: 12.345678, y: 9.876543 };
  const wire = toWireState(w, w.time);
  const back = fromWireState(wire);
  const p = back.players.find((x) => x.id === 'p1')!;
  assert.ok(Math.abs(p.pos.x - player.pos.x) < 0.01);
  assert.ok(Math.abs(p.pos.y - player.pos.y) < 0.01);
});

test('rebuilt entities preserve combat-relevant fields', () => {
  const w = setup();
  const e = w.enemies[0]!;
  e.hp = 13;
  e.alive = true;
  e.targetId = 'p1';
  const back = fromWireState(toWireState(w, w.time));
  const eb = back.enemies.find((x) => x.id === e.id)!;
  assert.equal(eb.hp, 13);
  assert.equal(eb.targetId, 'p1');
  assert.equal(eb.alive, true);
  assert.equal(eb.kind, 'enemy');
});

test('dead entities stay dead across serialisation', () => {
  const w = setup();
  const e = w.enemies[0]!;
  e.alive = false;
  e.hp = 0;
  const back = fromWireState(toWireState(w, w.time));
  const eb = back.enemies.find((x) => x.id === e.id)!;
  assert.equal(eb.alive, false);
  assert.equal(eb.hp, 0);
});

test('lerp interpolates positions', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(lerp(10, 0, 0), 10);
  assert.equal(lerp(10, 0, 1), 0);
});

test('a joiner applying host state sees host-driven movement', () => {
  const w = setup();
  // Host advances its player, then serialises.
  w.moveEntity('p1', { x: 1, y: 0 }, { x: 1, y: 0 });
  const wire = toWireState(w, w.time);
  const view = fromWireState(wire);
  const seen = view.players.find((p) => p.id === 'p1')!;
  assert.ok(seen.pos.x >= w.players[0]!.pos.x - 0.01);
});

test('buff timers survive the wire format', () => {
  const w = setup();
  const p = w.players[0]!;
  p.buffs.push({ id: 'battle_shout', name: 'Battle Shout', glyph: 'shout', color: '#fff', duration: 12, remaining: 7.5 });
  const back = fromWireState(toWireState(w, w.time));
  const pb = back.players.find((x) => x.id === 'p1')!;
  assert.equal(pb.buffs.length, 1);
  assert.ok(Math.abs(pb.buffs[0]!.remaining - 7.5) < 0.02);
});
