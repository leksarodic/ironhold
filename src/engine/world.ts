import { CLASSES, abilityById, type ClassId } from '@/game/classes';
import { itemById } from '@/game/items';
import { rollLoot } from './inventory';
import { Rng } from './rng';
import {
  ENEMY_TYPES,
  type Buff,
  type Combatant,
  type EnemyTypeId,
  type FloatingText,
  type GroundLoot,
  type Projectile,
  type Vec2,
  type WorldEvent,
} from './types';

export const WORLD = {
  width: 64,
  height: 44,
  center: { x: 32, y: 22 },
  /** Player collision radius in world units. */
  bodyRadius: 0.55,
  /** Out-of-combat health/mana regeneration delay in seconds. */
  regenDelay: 5,
  regenHpPerSec: 0.018,
  regenResourcePerSec: 0.05,
  respawnDelayMs: 6000,
} as const;

export interface PartyMemberSeed {
  id: string;
  name: string;
  classId: ClassId;
  level?: number;
  spawn?: Vec2;
}

export interface ActorInput {
  /** Desired movement direction, normalised or zero. */
  move: Vec2;
  /** Facing angle in radians (from joystick or last cast). */
  facing: number;
  sprint: boolean;
}

export interface AbilityCast {
  actorId: string;
  abilityId: string;
  /** Aim point in world coordinates. */
  aim: Vec2;
  targetId?: string | null;
  at: number;
}

export interface StepResult {
  events: WorldEvent[];
  casts: Array<{ actorId: string; abilityId: string; aim: Vec2; targetId: string | null }>;
}

let nextEntityNum = 1;

function uid(prefix: string): string {
  return `${prefix}-${nextEntityNum++}`;
}

/** Reset ids — used by tests for stable output. */
export function resetEntityCounter(): void {
  nextEntityNum = 1;
}

export function makePlayer(seed: PartyMemberSeed, index: number): Combatant {
  const def = CLASSES[seed.classId];
  const level = seed.level ?? 1;
  const hpScale = 1 + (level - 1) * 0.12;
  return {
    id: seed.id,
    name: seed.name,
    kind: 'player',
    classId: seed.classId,
    pos: seed.spawn ?? {
      x: WORLD.center.x + (index - 1) * 2.2,
      y: WORLD.center.y + 6,
    },
    facing: { x: 0, y: -1 },
    hp: Math.round(def.base.hp * hpScale),
    maxHp: Math.round(def.base.hp * hpScale),
    resource: def.base.resource,
    maxResource: def.base.resource,
    level,
    alive: true,
    respawnAt: 0,
    buffs: [],
    sinceDamage: 99,
  };
}

export function makeEnemy(type: EnemyTypeId, pos: Vec2, level = 1): Combatant {
  const t = ENEMY_TYPES[type];
  const scale = 1 + (level - 1) * 0.18;
  return {
    id: uid('enemy'),
    name: t.name,
    kind: 'enemy',
    classId: null,
    pos: { ...pos },
    facing: { x: 0, y: 1 },
    hp: Math.round(t.hp * scale),
    maxHp: Math.round(t.hp * scale),
    resource: 0,
    maxResource: 1,
    level,
    alive: true,
    respawnAt: 0,
    buffs: [],
    enemyType: type,
    targetId: null,
    attackTimer: 0,
    hitFlash: 0,
  };
}

export class World {
  readonly seed: number;
  readonly rng: Rng;
  readonly combatants = new Map<string, Combatant>();
  readonly players: Combatant[] = [];
  projectiles: Projectile[] = [];
  floatingTexts: FloatingText[] = [];
  readonly groundLoot: GroundLoot[] = [];
  readonly now: number = 0;

  /** Cooldown finish timestamps per actor per ability. */
  private cooldowns = new Map<string, Map<string, number>>();
  /** Player-owned scheduled casts (cast bars). */
  private pendingCasts: Array<{
    actorId: string;
    abilityId: string;
    aim: Vec2;
    targetId: string | null;
    endsAt: number;
  }> = [];
  private clock = 0;
  private nextProjectileId = 1;
  private nextTextId = 1;
  private spawnTimer = 0;
  private events: WorldEvent[] = [];

  constructor(seed = 1337) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.spawnInitialEnemies();
  }

  get time(): number {
    return this.clock;
  }

  addPlayer(seed: PartyMemberSeed): Combatant {
    const index = this.players.length;
    const p = makePlayer(seed, index);
    this.combatants.set(p.id, p);
    this.players.push(p);
    return p;
  }

  removePlayer(id: string): void {
    const p = this.combatants.get(id);
    if (p) this.combatants.delete(id);
    const i = this.players.findIndex((x) => x.id === id);
    if (i >= 0) this.players.splice(i, 1);
  }

  private spawnInitialEnemies(): void {
    const layout: Array<[EnemyTypeId, Vec2]> = [
      ['boar', { x: 22, y: 14 }],
      ['boar', { x: 26, y: 11 }],
      ['kobold', { x: 38, y: 13 }],
      ['kobold', { x: 41, y: 16 }],
      ['wolf', { x: 15, y: 26 }],
      ['wolf', { x: 12, y: 22 }],
      ['boar', { x: 47, y: 28 }],
      ['kobold', { x: 50, y: 24 }],
      ['ogre', { x: 52, y: 12 }],
      ['wolf', { x: 30, y: 34 }],
      ['boar', { x: 20, y: 33 }],
      ['kobold', { x: 44, y: 34 }],
    ];
    for (const [type, pos] of layout) {
      const e = makeEnemy(type, pos);
      this.combatants.set(e.id, e);
    }
    this.spawnTimer = 0;
  }

  private respawnPoint(): Vec2 {
    // Spawn away from players.
    for (let i = 0; i < 12; i++) {
      const p = {
        x: this.rng.range(6, WORLD.width - 6),
        y: this.rng.range(6, WORLD.height - 6),
      };
      let clear = true;
      for (const pl of this.players) {
        if (dist2(pl.pos, p) < 100) {
          clear = false;
          break;
        }
      }
      if (clear) return p;
    }
    return { x: WORLD.width - 8, y: WORLD.height - 8 };
  }

  get enemies(): Combatant[] {
    return [...this.combatants.values()].filter((c) => c.kind === 'enemy');
  }

  get aliveEnemies(): Combatant[] {
    return this.enemies.filter((e) => e.alive);
  }

  cooldownRemaining(actorId: string, abilityId: string): number {
    const m = this.cooldowns.get(actorId);
    if (!m) return 0;
    const t = m.get(abilityId) ?? 0;
    return Math.max(0, t - this.clock);
  }

  /** True if the actor has enough resource and the ability is off cooldown. */
  canCast(actorId: string, abilityId: string): boolean {
    const c = this.combatants.get(actorId);
    if (!c || !c.alive) return false;
    const def = c.classId ? abilityById(c.classId, abilityId) : undefined;
    if (!def) return false;
    if (this.cooldownRemaining(actorId, abilityId) > 0) return false;
    if (c.resource < def.cost) return false;
    return true;
  }

  /** Nearest living enemy to a point within radius, or null. */
  nearestEnemy(from: Vec2, radius: number, excludeDead = true): Combatant | null {
    let best: Combatant | null = null;
    let bestD = radius * radius;
    for (const e of this.enemies) {
      if (excludeDead && !e.alive) continue;
      const d = dist2(from, e.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private pushEvent(e: WorldEvent): void {
    this.events.push(e);
  }

  private addText(pos: Vec2, text: string, color: string, kind: FloatingText['kind']): void {
    this.floatingTexts.push({
      id: this.nextTextId++,
      pos: { x: pos.x, y: pos.y },
      text,
      color,
      bornAt: this.clock,
      kind,
    });
    if (this.floatingTexts.length > 40) this.floatingTexts.shift();
  }

  setInput(_actorId: string, _input: ActorInput): void {
    // Inputs are applied directly by the caller via moveEntity; kept for API symmetry.
  }

  moveEntity(actorId: string, move: Vec2, facing: Vec2, speedScale = 1): void {
    const c = this.combatants.get(actorId);
    if (!c || !c.alive) return;
    const len = Math.hypot(move.x, move.y);
    if (len > 0.0001) {
      const nx = move.x / len;
      const ny = move.y / len;
      c.facing = { x: nx, y: ny };
      const def = c.classId ? CLASSES[c.classId] : null;
      const speed = (def?.base.speed ?? 3) * speedScale;
      c.pos.x = clamp(c.pos.x + nx * speed * this.lastDt, 1.2, WORLD.width - 1.2);
      c.pos.y = clamp(c.pos.y + ny * speed * this.lastDt, 1.2, WORLD.height - 1.2);
    } else if (facing.x !== 0 || facing.y !== 0) {
      c.facing = { ...facing };
    }
  }

  private lastDt = 1 / 30;

  /**
   * Advance the simulation. Returns events that the UI/network should consume.
   */
  step(dt: number): WorldEvent[] {
    const clamped = Math.min(dt, 0.1);
    this.lastDt = clamped;
    this.clock += clamped;

    for (const c of this.combatants.values()) {
      if (c.hitFlash && c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - clamped * 3);
      // Tick buffs
      if (c.buffs.length) {
        c.buffs = c.buffs.filter((b) => {
          b.remaining -= clamped;
          return b.remaining > 0;
        });
      }
      if (c.kind === 'player') {
        this.tickPlayerRegen(c, clamped);
      }
    }

    this.tickProjectiles(clamped);
    this.tickEnemies(clamped);
    this.tickPendingCasts();
    this.tickPickups();
    this.tickRespawns();
    this.tickEnemySpawning(clamped);

    // Hand over everything accumulated since the previous step, including
    // events raised by casts that happened between frames.
    const out = this.events;
    this.events = [];
    return out;
  }

  private tickPlayerRegen(c: Combatant, dt: number): void {
    if (!c.alive) return;
    c.sinceDamage = (c.sinceDamage ?? 99) + dt;
    if (c.sinceDamage < WORLD.regenDelay) return;
    const def = c.classId ? CLASSES[c.classId] : null;
    if (!def) return;
    c.hp = Math.min(c.maxHp, c.hp + c.maxHp * WORLD.regenHpPerSec * dt);
    c.resource = Math.min(c.maxResource, c.resource + c.maxResource * WORLD.regenResourcePerSec * dt);
  }

  private tickPendingCasts(): void {
    const ready = this.pendingCasts.filter((p) => p.endsAt <= this.clock);
    this.pendingCasts = this.pendingCasts.filter((p) => p.endsAt > this.clock);
    for (const p of ready) {
      const actor = this.combatants.get(p.actorId);
      if (!actor || !actor.alive) continue;
      this.resolveAbility(actor, p.abilityId, p.aim, p.targetId, false);
    }
  }

  /** Begin a cast; instant abilities resolve immediately. */
  cast(actorId: string, abilityId: string, aim: Vec2, targetId: string | null = null): boolean {
    const actor = this.combatants.get(actorId);
    if (!actor || !actor.alive || !actor.classId) return false;
    const def = abilityById(actor.classId, abilityId);
    if (!def) return false;
    if (!this.canCast(actorId, abilityId)) return false;

    this.spendAndCooldown(actor, def.id, def.cost, def.cooldown);
    this.pushEvent({
      type: 'cast',
      actorId,
      pos: { ...actor.pos },
      abilityId,
      at: this.clock,
    });

    if (def.castTime > 0) {
      this.pendingCasts.push({
        actorId,
        abilityId,
        aim,
        targetId,
        endsAt: this.clock + def.castTime,
      });
      return true;
    }
    this.resolveAbility(actor, abilityId, aim, targetId, true);
    return true;
  }

  private spendAndCooldown(actor: Combatant, abilityId: string, cost: number, cooldown: number): void {
    actor.resource = Math.max(0, actor.resource - cost);
    let m = this.cooldowns.get(actor.id);
    if (!m) {
      m = new Map();
      this.cooldowns.set(actor.id, m);
    }
    m.set(abilityId, this.clock + cooldown);
  }

  private resolveAbility(
    actor: Combatant,
    abilityId: string,
    aim: Vec2,
    targetId: string | null,
    instant: boolean,
  ): void {
    const def = actor.classId ? abilityById(actor.classId, abilityId) : undefined;
    if (!def) return;
    const attackBonus = this.attackBonus(actor);

    switch (def.kind) {
      case 'melee': {
        if (def.splash > 0) {
          const hit = this.enemies.filter(
            (e) => e.alive && dist(e.pos, actor.pos) <= def.splash,
          );
          for (const e of hit) {
            this.damage(e, def.power + attackBonus, actor, def.id);
          }
          if (hit.length === 0) this.addText(actor.pos, 'no target', '#c9b38a', 'info');
        } else {
          let target: Combatant | null = targetId ? this.combatants.get(targetId) ?? null : null;
          if (!target || !target.alive) {
            target = this.nearestEnemyInFront(actor, def.range);
          }
          if (!target) {
            this.addText(actor.pos, 'out of range', '#c9b38a', 'info');
            this.pushEvent({ type: 'miss', actorId: actor.id, pos: actor.pos, at: this.clock });
            return;
          }
          this.damage(target, def.power + attackBonus, actor, def.id);
          // Combat resources: warriors generate rage on hit.
          if (actor.classId === 'warrior') {
            actor.resource = Math.min(actor.maxResource, actor.resource + 12);
          }
        }
        break;
      }
      case 'projectile': {
        const target = this.nearestEnemy(actor.pos, def.range + 20);
        const to = target ? { ...target.pos } : { ...aim };
        this.projectiles.push({
          id: this.nextProjectileId++,
          ownerId: actor.id,
          from: { ...actor.pos },
          to,
          t: 0,
          speed: 2.6,
          color: def.color,
          glyph: def.icon,
          power: def.power + attackBonus,
          splash: def.splash,
          targetId: target ? target.id : null,
        });
        break;
      }
      case 'heal': {
        const allies = this.players.filter(
          (p) => p.alive && dist(p.pos, actor.pos) <= def.range,
        );
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        const target = allies[0] ?? (actor.alive ? actor : null);
        if (!target) break;
        const amount = Math.abs(def.power);
        target.hp = Math.min(target.maxHp, target.hp + amount);
        this.addText(target.pos, `+${amount}`, '#7bf07b', 'heal');
        this.pushEvent({
          type: 'heal',
          actorId: actor.id,
          targetId: target.id,
          pos: { ...target.pos },
          amount,
          abilityId: def.id,
          at: this.clock,
        });
        break;
      }
      case 'buff': {
        const targets = def.id === 'battle_shout' ? this.players.filter((p) => p.alive) : [actor];
        for (const t of targets) {
          const buff: Buff = {
            id: def.id,
            name: def.name,
            glyph: def.icon,
            color: def.color,
            duration: def.id === 'battle_shout' ? 12 : 10,
            remaining: def.id === 'battle_shout' ? 12 : 10,
            attackBonus: def.id === 'battle_shout' ? 6 : 0,
            absorb: def.id === 'arcane_ward' ? 45 : def.id === 'power_word_shield' ? 40 : 0,
          };
          t.buffs = t.buffs.filter((b) => b.id !== buff.id);
          t.buffs.push(buff);
          this.addText(t.pos, def.name, def.color, 'info');
          this.pushEvent({
            type: 'cast',
            actorId: actor.id,
            targetId: t.id,
            pos: { ...t.pos },
            abilityId: def.id,
            at: this.clock,
          });
        }
        break;
      }
    }
    void instant;
  }

  attackBonus(actor: Combatant): number {
    let bonus = 0;
    for (const b of actor.buffs) bonus += b.attackBonus ?? 0;
    const def = actor.classId ? CLASSES[actor.classId] : null;
    if (def) bonus += def.base.attack * (actor.level - 1) * 0.5;
    return Math.round(bonus);
  }

  private nearestEnemyInFront(actor: Combatant, range: number): Combatant | null {
    let best: Combatant | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(actor.pos, e.pos);
      if (d > range) continue;
      const dx = (e.pos.x - actor.pos.x) / (d || 1);
      const dy = (e.pos.y - actor.pos.y) / (d || 1);
      const dot = dx * actor.facing.x + dy * actor.facing.y;
      const score = dot * 2 - d / range;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  damage(target: Combatant, amount: number, source: Combatant | null, abilityId?: string): number {
    if (!target.alive) return 0;
    let remaining = amount;
    // Shields absorb first.
    for (const b of target.buffs) {
      if (b.absorb && b.absorb > 0 && remaining > 0) {
        const absorbed = Math.min(b.absorb, remaining);
        b.absorb -= absorbed;
        remaining -= absorbed;
        this.addText(target.pos, `-${absorbed} (absorbed)`, '#b9d4ff', 'info');
        if (b.absorb <= 0) b.remaining = 0;
      }
    }
    if (remaining <= 0) return 0;
    target.hp = Math.max(0, target.hp - remaining);
    target.hitFlash = 1;
    target.sinceDamage = 0;
    const isCrit = this.rng.chance(0.15);
    const shown = isCrit ? Math.round(remaining * 1.5) : Math.round(remaining);
    if (isCrit) target.hp = Math.max(0, target.hp - Math.round(remaining * 0.5));
    this.addText(
      target.pos,
      isCrit ? `${shown}!` : `${shown}`,
      target.kind === 'player' ? '#ff5a5a' : isCrit ? '#ffd166' : '#ffffff',
      isCrit ? 'crit' : 'damage',
    );
    this.pushEvent({
      type: 'damage',
      actorId: source?.id ?? '',
      targetId: target.id,
      pos: { ...target.pos },
      amount: shown,
      abilityId,
      at: this.clock,
    });

    if (target.kind === 'enemy') {
      // Aggro the attacker.
      target.targetId = source?.id ?? target.targetId;
    }

    if (target.hp <= 0) {
      this.kill(target, source);
    }
    return shown;
  }

  private kill(target: Combatant, source: Combatant | null): void {
    target.alive = false;
    target.hp = 0;
    target.buffs = [];
    target.respawnAt = Date.now() + WORLD.respawnDelayMs;
    this.pushEvent({
      type: 'death',
      actorId: source?.id ?? '',
      targetId: target.id,
      pos: { ...target.pos },
      at: this.clock,
    });
    if (target.kind === 'enemy') {
      this.addText(target.pos, 'slain', '#e8c66a', 'info');
      this.dropLootFor(target, source);
    }
  }

  /**
   * Roll loot for a slain enemy and leave it on the ground.
   *
   * The roll is seeded from the enemy id so every peer can reproduce the same
   * outcome; only the resulting drop needs to cross the wire.
   */
  private dropLootFor(enemy: Combatant, source: Combatant | null): void {
    const seed = hashCombine(this.seed, enemy.id);
    const roll = rollLoot(enemy.enemyType ?? 'boar', seed, enemy.level);
    if (!roll.itemId) return;
    const def = itemById(roll.itemId);
    if (!def) return;
    const qualityIndex = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(def.quality);
    this.groundLoot.push({
      id: `loot-${enemy.id}-${this.clock.toFixed(2)}`,
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      itemId: roll.itemId,
      qty: roll.qty,
      quality: Math.max(0, qualityIndex),
      ownerId: source?.id ?? null,
      droppedAt: this.clock,
    });
    this.pushEvent({
      type: 'loot',
      actorId: source?.id ?? '',
      targetId: enemy.id,
      pos: { ...enemy.pos },
      abilityId: roll.itemId,
      amount: roll.qty,
      at: this.clock,
    });
  }

  private tickProjectiles(dt: number): void {
    const done: Projectile[] = [];
    for (const p of this.projectiles) {
      p.t += dt * p.speed;
      if (p.t >= 1) done.push(p);
    }
    if (done.length) {
      for (const p of done) this.impactProjectile(p);
      this.projectiles = this.projectiles.filter((p) => p.t < 1);
    }
  }

  private impactProjectile(p: Projectile): void {
    const owner = this.combatants.get(p.ownerId) ?? null;
    const primary = p.targetId ? this.combatants.get(p.targetId) : undefined;
    if (primary && primary.alive) {
      this.damage(primary, p.power, owner, p.glyph);
    }
    if (p.splash > 0) {
      for (const e of this.enemies) {
        if (!e.alive || e.id === primary?.id) continue;
        if (dist(e.pos, primary?.pos ?? p.to) <= p.splash) {
          this.damage(e, Math.round(p.power * 0.5), owner, p.glyph);
        }
      }
    }
  }

  private tickEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const type = ENEMY_TYPES[e.enemyType ?? 'boar'];
      // Find target.
      let target: Combatant | undefined = e.targetId ? this.combatants.get(e.targetId) ?? undefined : undefined;
      if (!target || !target.alive || dist(target.pos, e.pos) > type.aggroRadius * 1.8) {
        target = this.nearestPlayer(e.pos, type.aggroRadius) ?? undefined;
        e.targetId = target?.id ?? null;
      }
      if (!target) {
        // Idle wander
        e.attackTimer = Math.max(0, (e.attackTimer ?? 0) - dt);
        continue;
      }
      const d = dist(e.pos, target.pos);
      const dir = {
        x: (target.pos.x - e.pos.x) / (d || 1),
        y: (target.pos.y - e.pos.y) / (d || 1),
      };
      e.facing = dir;
      if (d > type.attackRange) {
        const stepLen = type.speed * dt;
        e.pos.x = clamp(e.pos.x + dir.x * stepLen, 1, WORLD.width - 1);
        e.pos.y = clamp(e.pos.y + dir.y * stepLen, 1, WORLD.height - 1);
        // Separation so enemies don't stack.
        for (const other of this.enemies) {
          if (other.id === e.id || !other.alive) continue;
          const dd = dist(other.pos, e.pos);
          const min = type.radius + ENEMY_TYPES[other.enemyType ?? 'boar'].radius;
          if (dd < min && dd > 0.0001) {
            const push = (min - dd) * 0.5;
            e.pos.x += ((e.pos.x - other.pos.x) / dd) * push;
            e.pos.y += ((e.pos.y - other.pos.y) / dd) * push;
          }
        }
        e.attackTimer = Math.max(0, (e.attackTimer ?? 0) - dt);
      } else {
        e.attackTimer = (e.attackTimer ?? 0) - dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = type.attackInterval;
          const dmg = type.damage + e.level * 2;
          this.damage(target, dmg, e, 'enemy_melee');
        }
      }
    }
  }

  private nearestPlayer(pos: Vec2, radius: number): Combatant | null {
    let best: Combatant | null = null;
    let bestD = radius;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = dist(p.pos, pos);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private tickPickups(): void {
    // Ground loot is picked up by walking over it.
    const remaining: GroundLoot[] = [];
    for (const l of this.groundLoot) {
      const eligible = (p: Combatant) => {
        // Loot rights last 10 seconds, then anyone may take it.
        const exclusive = this.clock - l.droppedAt < 10;
        return !exclusive || !l.ownerId || l.ownerId === p.id;
      };
      const picker = this.players.find((p) => p.alive && eligible(p) && dist(p.pos, l.pos) < 1.1);
      if (picker) {
        this.pushEvent({
          type: 'loot',
          actorId: picker.id,
          pos: { ...l.pos },
          at: this.clock,
          amount: l.qty,
          abilityId: l.itemId,
        });
        continue;
      }
      remaining.push(l);
    }
    this.groundLoot.length = 0;
    this.groundLoot.push(...remaining);
  }

  private tickRespawns(): void {
    for (const c of this.combatants.values()) {
      if (!c.alive && c.respawnAt > 0 && Date.now() >= c.respawnAt) {
        c.alive = true;
        c.hp = c.maxHp;
        c.resource = c.maxResource;
        c.respawnAt = 0;
        c.buffs = [];
        c.targetId = null;
        if (c.kind === 'player') {
          c.pos = {
            x: WORLD.center.x + (this.players.indexOf(c) - 1) * 2,
            y: WORLD.center.y + 6,
          };
          this.pushEvent({ type: 'spawn', actorId: c.id, pos: { ...c.pos }, at: this.clock });
        } else {
          c.pos = this.respawnPoint();
        }
      }
    }
  }

  private tickEnemySpawning(dt: number): void {
    if (this.aliveEnemies.length >= 10) return;
    this.spawnTimer += dt;
    if (this.spawnTimer < 4) return;
    this.spawnTimer = 0;
    const type: EnemyTypeId = this.rng.pick<EnemyTypeId>(['boar', 'kobold', 'wolf']);
    const pos = this.respawnPoint();
    const e = makeEnemy(type, pos, 1 + Math.floor(this.players[0]?.level ?? 1));
    this.combatants.set(e.id, e);
    this.pushEvent({ type: 'spawn', actorId: e.id, pos, at: this.clock });
  }

  /** XP awarded for killing an enemy, scaled to level. */
  xpFor(enemy: Combatant): number {
    return Math.round(ENEMY_TYPES[enemy.enemyType ?? 'boar'].xp * (1 + enemy.level * 0.1));
  }

  /** Floating combat text is expressed in simulation seconds. */
  drainFloatingTexts(maxAge = 1.4): FloatingText[] {
    this.floatingTexts = this.floatingTexts.filter((t) => this.clock - t.bornAt < maxAge);
    return this.floatingTexts;
  }

  drainProjectiles(): Projectile[] {
    return this.projectiles;
  }
}

/** Mix a numeric seed with a string id without pulling in a hashing dependency. */
function hashCombine(seed: number, id: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
