import type { ClassId } from '@/game/classes';
import type { Combatant, Vec2 } from '@/engine/types';
import type { WorldStatePayload } from '@/net/protocol';

/**
 * Conversion between the authoritative world and the compact wire format.
 *
 * The host is the simulation authority: it advances the world, serialises a
 * slim snapshot and pushes it to joiners at a fixed rate. Joiners send inputs;
 * the host applies them to that player's entity. This keeps damage, enemy AI
 * and loot deterministic on one machine while staying cheap on the radio.
 */

export interface RemotePlayerInput {
  peerId: string;
  mx: number;
  my: number;
  facing: number;
}

const CLASS_IDS = new Set(['warrior', 'mage', 'priest']);

function asClassId(value: string): ClassId {
  return (CLASS_IDS.has(value) ? value : 'warrior') as ClassId;
}

/** Serialise the world for the wire, dropping fields peers can derive. */
export function toWireState(world: { players: Combatant[]; enemies: Combatant[] }, time: number): WorldStatePayload {
  return {
    t: Math.round(time * 1000),
    players: world.players.map((p) => ({
      id: p.id,
      name: p.name,
      classId: asClassId(p.classId ?? 'warrior'),
      x: round(p.pos.x),
      y: round(p.pos.y),
      fx: round(p.facing.x),
      fy: round(p.facing.y),
      hp: Math.round(p.hp),
      maxHp: Math.round(p.maxHp),
      res: Math.round(p.resource),
      maxRes: Math.round(p.maxResource),
      lvl: p.level,
      alive: p.alive,
      buffs: p.buffs.map((b) => ({ id: b.id, r: round(b.remaining), d: round(b.duration) })),
    })),
    enemies: world.enemies.map((e) => ({
      id: e.id,
      type: e.enemyType ?? 'boar',
      x: round(e.pos.x),
      y: round(e.pos.y),
      fx: round(e.facing.x),
      fy: round(e.facing.y),
      hp: Math.round(e.hp),
      maxHp: Math.round(e.maxHp),
      lvl: e.level,
      alive: e.alive,
      target: e.targetId ?? null,
    })),
  };
}

/** Rebuild lightweight view entities from an incoming network snapshot. */
export function fromWireState(state: WorldStatePayload): { players: Combatant[]; enemies: Combatant[] } {
  const players: Combatant[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    kind: 'player' as const,
    classId: p.classId,
    pos: { x: p.x, y: p.y },
    facing: { x: p.fx, y: p.fy },
    hp: p.hp,
    maxHp: p.maxHp,
    resource: p.res,
    maxResource: p.maxRes,
    level: p.lvl,
    alive: p.alive,
    respawnAt: 0,
    buffs: p.buffs.map((b) => ({
      id: b.id,
      name: b.id,
      glyph: b.id,
      color: '#e8c66a',
      remaining: b.r,
      duration: b.d,
    })),
  }));

  const enemies: Combatant[] = state.enemies.map((e) => ({
    id: e.id,
    name: e.type,
    kind: 'enemy' as const,
    classId: null,
    pos: { x: e.x, y: e.y },
    facing: { x: e.fx, y: e.fy },
    hp: e.hp,
    maxHp: e.maxHp,
    resource: 0,
    maxResource: 1,
    level: e.lvl,
    alive: e.alive,
    respawnAt: 0,
    buffs: [],
    enemyType: e.type as Combatant['enemyType'],
    targetId: e.target,
  }));

  return { players, enemies };
}

/** Round to 2 decimals: plenty for rendering, half the characters on the wire. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Interpolate between the previous and current network positions. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
