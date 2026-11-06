import { create } from 'zustand';
import { CLASS_LIST, type ClassDef, type ClassId } from '@/game/classes';

export type Screen = 'menu' | 'select' | 'game';

export interface CharacterSummary {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
}

interface GameStoreState {
  screen: Screen;
  character: CharacterSummary;
  /** Persisted flags for the "first time" teaching flow. */
  hasPlayed: boolean;
  setScreen: (s: Screen) => void;
  setCharacter: (c: Partial<CharacterSummary>) => void;
  chooseClass: (id: ClassId) => void;
  addXp: (amount: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  screen: 'menu',
  character: { name: 'Thrall', classId: 'warrior', level: 1, xp: 0 },
  hasPlayed: false,
  setScreen: (screen) => set({ screen }),
  setCharacter: (c) =>
    set((s) => ({ character: { ...s.character, ...c }, hasPlayed: true })),
  chooseClass: (id) => set((s) => ({ character: { ...s.character, classId: id } })),
  addXp: (amount) =>
    set((s) => {
      const xp = s.character.xp + amount;
      const needed = s.character.level * 100;
      if (xp >= needed) {
        return {
          character: { ...s.character, level: s.character.level + 1, xp: xp - needed },
        };
      }
      return { character: { ...s.character, xp } };
    }),
  reset: () => ({ character: { name: 'Thrall', classId: 'warrior', level: 1, xp: 0 } }),
}));

export const xpToNext = (level: number) => level * 100;

export function classOf(id: ClassId): ClassDef {
  return CLASS_LIST.find((c) => c.id === id) ?? CLASS_LIST[0]!;
}
