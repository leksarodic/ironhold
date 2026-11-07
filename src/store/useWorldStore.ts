import { create } from 'zustand';
import { CLASSES, abilityById, type ClassId } from '@/game/classes';
import { World } from '@/engine/world';
import type { Combatant, FloatingText, GroundLoot, Projectile, WorldEvent } from '@/engine/types';
import type { StickVector } from '@/ui/Joystick';
import type { WorldStatePayload } from '@/net/protocol';
import { fromWireState, toWireState } from '@/net/sync';

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
  /** True when this device is a joiner rendering host-authoritative state. */
  remoteAuthoritative: boolean;
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
  /** True when this peer is the simulation authority (solo or host). */
  isAuthority: boolean;
  /** Latest network snapshot, used for interpolated remote rendering. */
  remoteState: WorldStatePayload | null;
  remoteReceivedAt: number;
  start: (opts: {
    name: string;
    classId: ClassId;
    seed?: number;
    level?: number;
    id?: string;
    authority?: boolean;
  }) => void;
  /** Merge a party member into the local simulation (host authority). */
  addPartyMember: (member: { id: string; name: string; classId: ClassId; level: number }) => void;
  removePartyMember: (id: string) => void;
  /** Apply a joiner's movement input on the host. */
  applyRemoteInput: (peerId: string, mx: number, my: number, dt: number) => void;
  /** Apply a joiner's ability cast on the host. */
  applyRemoteCast: (peerId: string, abilityId: string, aim: { x: number; y: number }, targetId: string | null) => void;
  /** Feed the authoritative snapshot into a joiner's render state. */
  applyRemoteState: (state: WorldStatePayload) => void;
  /** Host hook: build the snapshot to broadcast. */
  buildWireState: () => WorldStatePayload | null;
  stop: () => void;
  setStick: (v: StickVector) => void;
  faceTowards: (angle: number) => void;
  castAbility: (abilityId: string) => void;
  selectTarget: (id: string | null) => void;
  /** Remove a ground loot entry (after it has been taken). */
  takeLoot: (lootId: string) => void;
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
  remoteAuthoritative: false,
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
  isAuthority: true,
  remoteState: null,
  remoteReceivedAt: 0,

  start: ({ name, classId, seed = 20260101, level = 1, id, authority = true }) => {
    pendingCasts.clear();
    const world = new World(seed);
    const playerId = id ?? 'local-player';
    world.addPlayer({ id: playerId, name, classId, level });
    set({
      world,
      localPlayerId: playerId,
      selectedTargetId: null,
      combatLog: [],
      snapshot: emptySnapshot,
      isAuthority: authority,
      remoteState: null,
    });
    get().pushLog(`Welcome to Ironhold, ${name}.`, '#e8c66a');
    get().refresh();
  },

  addPartyMember: ({ id, name, classId, level }) => {
    const { world } = get();
    if (!world) return;
    if (world.combatants.has(id)) return;
    world.addPlayer({ id, name, classId, level });
    get().pushLog(`${name} joined the party.`, '#8ef08e');
    get().refresh();
  },

  removePartyMember: (id) => {
    const { world, localPlayerId } = get();
    if (!world || id === localPlayerId) return;
    const p = world.combatants.get(id);
    if (p) get().pushLog(`${p.name} left the party.`, '#c9b38a');
    world.removePlayer(id);
    get().refresh();
  },

  applyRemoteInput: (peerId, mx, my, dt) => {
    const { world } = get();
    if (!world) return;
    const p = world.combatants.get(peerId);
    if (!p || !p.alive) return;
    const len = Math.hypot(mx, my);
    if (len > 0.1) {
      world.moveEntity(peerId, { x: mx, y: my }, { x: mx / len, y: my / len }, 1);
    }
    void dt;
  },

  applyRemoteCast: (peerId, abilityId, aim, targetId) => {
    const { world } = get();
    if (!world) return;
    const ok = world.cast(peerId, abilityId, aim, targetId);
    if (ok) {
      const p = world.combatants.get(peerId);
      const def = p?.classId ? abilityById(p.classId, abilityId) : undefined;
      if (def) get().pushLog(`${p?.name ?? 'Ally'} casts ${def.name}.`, def.color);
    }
    get().refresh();
  },

  applyRemoteState: (state) => {
    const { players, enemies } = fromWireState(state);
    set((s) => ({
      remoteState: state,
      remoteReceivedAt: Date.now(),
      snapshot: {
        ...s.snapshot,
        tick: s.snapshot.tick + 1,
        players,
        enemies,
        remoteAuthoritative: true,
      },
    }));
  },

  buildWireState: () => {
    const { world } = get();
    if (!world) return null;
    return toWireState(world, world.time);
  },

  stop: () => {
    pendingCasts.clear();
    set({ world: null, localPlayerId: null, snapshot: emptySnapshot, combatLog: [], remoteState: null });
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
    const def = abilityById(p.classId, abilityId);
    if (!def) return;
    const target = get().selectedTargetId
      ? world.combatants.get(get().selectedTargetId as string) ?? null
      : null;
    const aim = target && target.alive
      ? target.pos
      : { x: p.pos.x + p.facing.x * def.range, y: p.pos.y + p.facing.y * def.range };
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

  takeLoot: (lootId) => {
    const { world } = get();
    if (!world) return;
    const idx = world.groundLoot.findIndex((l) => l.id === lootId);
    if (idx >= 0) world.groundLoot.splice(idx, 1);
    get().refresh();
  },

  step: (dt) => {
    const { world, localPlayerId, stick, isAuthority } = get();
    if (!world || !localPlayerId || !isAuthority) return [];
    const p = world.combatants.get(localPlayerId);
    if (p) {
      if (stick.mag > 0.12 && p.alive) {
        world.moveEntity(localPlayerId, { x: stick.x, y: stick.y }, { x: stick.x, y: stick.y }, 1);
      }
    }
    const events = world.step(dt);

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
        ...get().snapshot,
        tick: get().snapshot.tick + 1,
        players: world.players.map((p) => ({ ...p, pos: { ...p.pos }, buffs: [...p.buffs] })),
        enemies: world.enemies.map((e) => ({ ...e, pos: { ...e.pos } })),
        projectiles: world.projectiles.map((p) => ({ ...p })),
        texts: world.drainFloatingTexts(),
        loot: world.groundLoot.map((l) => ({ ...l })),
        cooldowns: cooldownMap(world, local),
        targetId: selectedTargetId,
        castBar,
        remoteAuthoritative: false,
      },
    });
  },

  pushLog: (text, color = '#d8c7a4') =>
    set((s) => ({
      combatLog: [...s.combatLog.slice(-40), { id: logId++, text, color }],
    })),
}));
