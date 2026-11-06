import { useEffect, useRef } from 'react';
import { useWorldStore } from '@/store/useWorldStore';
import { useNetStore, getHostSession } from '@/store/useNetStore';
import { useGameStore } from '@/store/useGameStore';
import type { CastPayload, InputPayload, WorldStatePayload } from '@/net/protocol';
import type { ClassId } from '@/game/classes';

/**
 * Bridges the P2P session and the world simulation.
 *
 * - Authority (solo/host) advances the world and broadcasts state at ~12 Hz.
 * - Joiners forward input/cast intents and render the authoritative snapshot.
 * - Roster changes add or remove entities on both sides.
 */
export function useCoopSync() {
  const role = useNetStore((s) => s.role);
  const consumeMessages = useNetStore((s) => s.consumeMessages);
  const send = useNetStore((s) => s.send);
  const peers = useNetStore((s) => s.peers);
  const seed = useNetStore((s) => s.seed);
  const selfId = useNetStore((s) => s.selfId);

  const knownPeers = useRef(new Set<string>());
  const lastStateAt = useRef(0);
  const lastInputAt = useRef(0);

  // Host: replicate roster changes as players come and go.
  useEffect(() => {
    const world = useWorldStore.getState();
    if (!world.isAuthority) return;
    const active = new Set(peers.map((p) => p.peerId));
    for (const p of peers) {
      if (!knownPeers.current.has(p.peerId)) {
        knownPeers.current.add(p.peerId);
        world.addPartyMember({ id: p.peerId, name: p.name, classId: p.classId, level: p.level });
      }
    }
    for (const id of [...knownPeers.current]) {
      if (!active.has(id)) {
        knownPeers.current.delete(id);
        world.removePartyMember(id);
      }
    }
  }, [peers]);

  // Inbound message pump.
  useEffect(() => {
    const interval = setInterval(() => {
      const messages = consumeMessages();
      if (messages.length === 0) return;
      const world = useWorldStore.getState();
      for (const m of messages) {
        switch (m.type) {
          case 'input': {
            if (!world.isAuthority) break;
            const p = m.payload as InputPayload;
            world.applyRemoteInput(m.from, p.mx, p.my, 1 / 30);
            break;
          }
          case 'cast': {
            if (!world.isAuthority) break;
            const p = m.payload as CastPayload;
            world.applyRemoteCast(m.from, p.abilityId, { x: p.x, y: p.y }, p.targetId);
            break;
          }
          case 'state': {
            if (world.isAuthority) break;
            world.applyRemoteState(m.payload as WorldStatePayload);
            break;
          }
          case 'welcome': {
            const payload = m.payload as { peers?: Array<{ peerId: string; name: string; classId: ClassId; level: number }> };
            if (!world.isAuthority) {
              // Joiners render the host stream, but the local player must exist
              // in the snapshot with a stable id for HUD lookups.
              const me = useGameStore.getState().character;
              world.start({
                name: me.name,
                classId: me.classId,
                level: me.level,
                seed,
                id: selfId || 'local-player',
                authority: false,
              });
            }
            for (const p of payload.peers ?? []) {
              if (!world.isAuthority) break;
              world.addPartyMember({ id: p.peerId, name: p.name, classId: p.classId, level: p.level });
            }
            break;
          }
          case 'spawn': {
            const payload = m.payload as { peer?: { peerId: string; name: string; classId: ClassId; level: number } };
            if (payload.peer && world.isAuthority) {
              world.addPartyMember({
                id: payload.peer.peerId,
                name: payload.peer.name,
                classId: payload.peer.classId,
                level: payload.peer.level,
              });
            }
            break;
          }
          default:
            break;
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [consumeMessages, seed, selfId, role]);

  // Outbound: authority pushes state; joiners push their input.
  useEffect(() => {
    if (role === 'solo') return;
    const interval = setInterval(() => {
      const world = useWorldStore.getState();
      const now = Date.now();
      if (world.isAuthority) {
        if (now - lastStateAt.current < 80) return;
        lastStateAt.current = now;
        const state = world.buildWireState();
        if (state) send('state', state, false);
      } else {
        if (now - lastInputAt.current < 50) return;
        lastInputAt.current = now;
        const stick = world.stick;
        const me = world.snapshot.players.find((p) => p.id === world.localPlayerId);
        if (!me) return;
        const payload: InputPayload = {
          mx: stick.x,
          my: stick.y,
          facing: Math.atan2(me.facing.y, me.facing.x),
          sprint: false,
          t: now,
        };
        send('input', payload, false);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [role, send]);

  // Host: attach the authoritative state broadcaster to the session.
  useEffect(() => {
    if (role !== 'host') return;
    const session = getHostSession();
    if (!session) return;
    session.startStateBroadcast(() => {
      const world = useWorldStore.getState();
      return world.isAuthority ? world.buildWireState() : null;
    }, 12);
    return () => session.stopStateBroadcast();
  }, [role]);
}

/** Publish a cast intent so the host can resolve it. */
export function broadcastCast(abilityId: string, x: number, y: number, targetId: string | null): void {
  const { role, send } = useNetStore.getState();
  if (role === 'solo') return;
  const payload: CastPayload = { abilityId, x, y, targetId, t: Date.now() };
  send('cast', payload, true);
}
