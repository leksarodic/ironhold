/**
 * End-to-end testing hook.
 *
 * When EXPO_PUBLIC_E2E=1 (set only by the local screenshot/QA harness) the
 * Zustand stores are attached to `globalThis` so a headless browser can drive
 * game state deterministically instead of waiting on emergent gameplay.
 * This is a no-op in production builds, where the flag is absent.
 */
import { useWorldStore } from './useWorldStore';
import { useInventoryStore } from './useInventoryStore';
import { useGameStore } from './useGameStore';

export function installE2eHooks(): void {
  if (process.env.EXPO_PUBLIC_E2E !== '1') return;
  const g = globalThis as unknown as Record<string, unknown>;
  g.__ironhold = {
    world: useWorldStore,
    inventory: useInventoryStore,
    game: useGameStore,
  };
}
