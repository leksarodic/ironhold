import { create } from 'zustand';

export interface SettingsState {
  /** Master output volume, 0..1. */
  volume: number;
  /** Haptics on ability use / damage. */
  haptics: boolean;
  /** Show the floating combat text. */
  combatText: boolean;
  /** Show the tiled ground grid while debugging. */
  showGrid: boolean;
  /** Movement joystick size in px. */
  joystickSize: number;
  /** Reduce non-essential animation (accessibility). */
  reducedMotion: boolean;
  setVolume: (v: number) => void;
  toggleHaptics: () => void;
  toggleCombatText: () => void;
  toggleGrid: () => void;
  setJoystickSize: (size: number) => void;
  toggleReducedMotion: () => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS = {
  volume: 0.8,
  haptics: true,
  combatText: true,
  showGrid: false,
  joystickSize: 128,
  reducedMotion: false,
} as const;

/**
 * Player-facing settings. Kept deliberately small and local: everything here
 * affects presentation only, so it never has to travel the network.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleHaptics: () => set({ haptics: !get().haptics }),
  toggleCombatText: () => set({ combatText: !get().combatText }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  setJoystickSize: (size) => set({ joystickSize: Math.max(96, Math.min(160, Math.round(size))) }),
  toggleReducedMotion: () => set({ reducedMotion: !get().reducedMotion }),
  reset: () => set({ ...DEFAULT_SETTINGS }),
}));
