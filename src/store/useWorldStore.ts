import { create } from 'zustand';
import { CLASSES, abilityById, type ClassId } from '@/game/classes';
import { World } from '@/engine/world';
import type { Combatant, FloatingText, GroundLoot, Projectile, WorldEvent } from '@/engine/types';
import type { StickVector } from '@/ui/Joystick';

export interface WorldSnapshot {
  /** Bumped every simulation frame so selectors can re-render. */
  tick: number;
  players: Combatant[];
  enemies: Combatant[];
  projectiles: Projectile[];
  texts: FloatingText[];
  loot: GroundLoot[];
  cooldowns: Record<string, number>;
  targetId: string | null;
  castBar: { label: string; progress: number } | null;
}

interface WorldStoreState {
  world: World | null;
  localPlayerId: string | null;
  snapshot: WorldSnapshot;
  stick: StickVector;
  selectedTargetId: string | null;
  /** Local UI-only event log (combat log panel). */
  combatLog: Array<{ id: number; text: string; color: string }>;
  lastXpGain: number;
  start: (opts: { name: string; classId: ClassId; seed?: number; level?: number; id?: string }) => void;
  stop: () => void;
  setStick: (v: StickVector) => void;
  faceTowards: (angle: number) => void;
  castAbility: (abilityId: string) => void;
  selectTarget: (id: string | null) => void;
  /** Advance the simulation; called from the frame loop. */
  step: (dt: number) => WorldEvent[];
  refresh: () => void;
  pushLog: (text: string, color?: string) => void;
}

const emptySnapshot: WorldSnapshot = {
  tick: 0,
  players: [],
  enemies: [],
  projectiles: [],
  texts: [],
  loot: [],
  cooldowns: {},
  targetId: null,
  castBar: null,
};

let logId = 1;
const pendingCasts = new Map<string, { abilityId: string; endsAt: number }>();

function cooldownMap(world: World, player: Combatant | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!player || !player.classId) return out;
  for (const a of CLASSES[player.classId].abilities) {
    out[a.id] = world.cooldownRemaining(player.id, a.id);
  }
  return out;
}

export const useWorldStore = create<WorldStoreState>((set, get) => ({
  world: null,
  localPlayerId: null,
  snapshot: emptySnapshot,
  stick: { x: 0, y: 0, mag: 0 },
  selectedTargetId: null,
  combatLog: [],
  lastXpGain: 0,

  start: ({ name, classId, seed = 20260101, level = 1, id }) => {
    pendingCasts.clear();
    const world = new World(seed);
    const playerId = id ?? 'local-player';
    world.addPlayer({ id: playerId, name, classId, level });
    // A second party member in single-player shows the co-op HUD slot layout.
    set({
      world,
      localPlayerId: playerId,
      selectedTargetId: null,
      combatLog: [],
      snapshot: emptySnapshot,
    });
    get().pushLog(`Welcome to Ironhold, ${name}.`, '#e8c66a');
    get().refresh();
  },

  stop: () => {
    pendingCasts.clear();
    set({ world: null, localPlayerId: null, snapshot: emptySnapshot, combatLog: [] });
  },

  setStick: (v) => set({ stick: v }),

  faceTowards: (angle) => {
    const { world, localPlayerId } = get();
    const p = world && localPlayerId ? world.combatants.get(localPlayerId) : null;
    if (!p) return;
    p.facing = { x: Math.cos(angle), y: Math.sin(angle) };
  },

  castAbility: (abilityId) => {
    const { world, localPlayerId, stick } = get();
    if (!world || !localPlayerId) return;
    const p = world.combatants.get(localPlayerId);
    if (!p || !p.classId) return;
    if (!world.aliveEnemies.length && abilityId !== 'heal') {
      // still allow casts; the engine reports "out of range"
    }
    const def = abilityById(p.classId, abilityId);
    if (!def) return;
    const target = get().selectedTargetId
      ? world.combatants.get(get().selectedTargetId as string) ?? null
      : null;
    const aim = target && target.alive ? target.pos : {
      x: p.pos.x + p.facing.x * def.range,
      y: p.pos.y + p.facing.y * def.range,
    };
    if (stick.mag > 0.2) {
      p.facing = { x: stick.x, y: stick.y };
    }
    const ok = world.cast(localPlayerId, abilityId, { ...aim }, target?.id ?? null);
    if (ok) {
      if (def.castTime > 0) {
        pendingCasts.set(abilityId, { abilityId, endsAt: world.time + def.castTime });
      }
      get().pushLog(`You cast ${def.name}.`, def.color);
    } else {
      const cd = world.cooldownRemaining(localPlayerId, abilityId);
      if (cd > 0) get().pushLog(`${def.name} is not ready (${cd.toFixed(1)}s).`, '#c9b38a');
      else if (p.resource < def.cost) get().pushLog(`Not enough ${CLASSES[p.classId].resource}.`, '#c9b38a');
    }
    get().refresh();
  },

  selectTarget: (id) => {
    set({ selectedTargetId: id });
    get().refresh();
  },

  step: (dt) => {
    const { world, localPlayerId, stick } = get();
    if (!world || !localPlayerId) return [];
    const p = world.combatants.get(localPlayerId);
    if (p) {
      const speedScale = 1;
      if (stick.mag > 0.12 && p.alive) {
        world.moveEntity(localPlayerId, { x: stick.x, y: stick.y }, { x: stick.x, y: stick.y }, speedScale);
      }
    }
    const events = world.step(dt);

    // Auto-advance XP and log major events.
    for (const ev of events) {
      if (ev.type === 'death' && ev.targetId) {
        const dead = world.combatants.get(ev.targetId);
        if (dead && dead.kind === 'enemy') {
          get().pushLog(`${dead.name} has been slain.`, '#c9b38a');
        }
      }
      if (ev.type === 'damage' && ev.targetId === localPlayerId) {
        get().pushLog(`You take ${ev.amount ?? 0} damage.`, '#ff6b6b');
      }
      if (ev.type === 'loot' && ev.actorId === localPlayerId) {
        get().pushLog(`Looted ${ev.abilityId ?? 'an item'}.`, '#1eff00');
      }
    }

    // Drop combat casts that finished.
    for (const [k, v] of pendingCasts) {
      if (world.time >= v.endsAt) pendingCasts.delete(k);
    }

    get().refresh();
    return events;
  },

  refresh: () => {
    const { world, localPlayerId, selectedTargetId } = get();
    if (!world || !localPlayerId) return;
    const local = world.combatants.get(localPlayerId);
    let castBar: WorldSnapshot['castBar'] = null;
    if (local && local.classId) {
      for (const [abilityId, v] of pendingCasts) {
        const def = abilityById(local.classId, abilityId);
        if (!def) continue;
        castBar = {
          label: def.name,
          progress: 1 - Math.max(0, v.endsAt - world.time) / Math.max(def.castTime, 0.01),
        };
      }
    }
    set({
      snapshot: {
        tick: get().snapshot.tick + 1,
        players: world.players.map((p) => ({ ...p, pos: { ...p.pos }, buffs: [...p.buffs] })),
        enemies: world.enemies.map((e) => ({ ...e, pos: { ...e.pos } })),
        projectiles: world.projectiles.map((p) => ({ ...p })),
        texts: world.drainFloatingTexts(),
        loot: world.groundLoot.map((l) => ({ ...l })),
        cooldowns: cooldownMap(world, local),
        targetId: selectedTargetId,
        castBar,
      },
    });
  },

  pushLog: (text, color = '#d8c7a4') =>
    set((s) => ({
      combatLog: [...s.combatLog.slice(-40), { id: logId++, text, color }],
    })),
}));
