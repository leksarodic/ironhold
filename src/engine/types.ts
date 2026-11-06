export type Vec2 = { x: number; y: number };

export type EntityKind = 'player' | 'enemy';

export type EnemyTypeId = 'boar' | 'kobold' | 'wolf' | 'ogre';

export interface Buff {
  id: string;
  name: string;
  glyph: string;
  color: string;
  /** Seconds remaining. */
  remaining: number;
  duration: number;
  /** Flat attack bonus. */
  attackBonus?: number;
  /** Absorb pool for shields. */
  absorb?: number;
}

export interface Combatant {
  id: string;
  name: string;
  kind: EntityKind;
  classId: 'warrior' | 'mage' | 'priest' | null;
  pos: Vec2;
  /** Unit vector the entity faces. */
  facing: Vec2;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  level: number;
  alive: boolean;
  /** Wall-clock ms at which the entity respawns, 0 when alive. */
  respawnAt: number;
  buffs: Buff[];
  /** For enemies: which type. */
  enemyType?: EnemyTypeId;
  /** Enemy aggro target. */
  targetId?: string | null;
  /** Seconds until the next enemy attack. */
  attackTimer?: number;
  /** Visual hit flash timer. */
  hitFlash?: number;
  /** Time since last damage taken, for regen. */
  sinceDamage?: number;
}

export interface EnemyType {
  id: EnemyTypeId;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  aggroRadius: number;
  attackRange: number;
  attackInterval: number;
  xp: number;
  color: string;
  scale: number;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
  boar: {
    id: 'boar',
    name: 'Wild Boar',
    hp: 70,
    damage: 8,
    speed: 1.9,
    radius: 0.65,
    aggroRadius: 7,
    attackRange: 1.6,
    attackInterval: 2,
    xp: 45,
    color: '#7a5a3a',
    scale: 0.85,
  },
  kobold: {
    id: 'kobold',
    name: 'Kobold Vermin',
    hp: 55,
    damage: 6,
    speed: 2.3,
    radius: 0.55,
    aggroRadius: 8,
    attackRange: 1.5,
    attackInterval: 1.6,
    xp: 35,
    color: '#8a7f6a',
    scale: 0.7,
  },
  wolf: {
    id: 'wolf',
    name: 'Timber Wolf',
    hp: 85,
    damage: 11,
    speed: 2.8,
    radius: 0.6,
    aggroRadius: 9,
    attackRange: 1.7,
    attackInterval: 1.4,
    xp: 55,
    color: '#5c5a58',
    scale: 0.8,
  },
  ogre: {
    id: 'ogre',
    name: 'Ogre Brute',
    hp: 220,
    damage: 20,
    speed: 1.6,
    radius: 1.1,
    aggroRadius: 10,
    attackRange: 2.2,
    attackInterval: 2.6,
    xp: 120,
    color: '#6d7a45',
    scale: 1.35,
  },
};

export type WorldEventType =
  | 'damage'
  | 'heal'
  | 'death'
  | 'cast'
  | 'loot'
  | 'levelup'
  | 'miss'
  | 'spawn';

export interface FloatingText {
  id: number;
  pos: Vec2;
  text: string;
  color: string;
  bornAt: number;
  kind: 'damage' | 'heal' | 'crit' | 'info';
}

export interface WorldEvent {
  type: WorldEventType;
  actorId: string;
  targetId?: string;
  pos: Vec2;
  amount?: number;
  abilityId?: string;
  at: number;
}

export interface Projectile {
  id: number;
  ownerId: string;
  from: Vec2;
  to: Vec2;
  /** 0..1 travel progress. */
  t: number;
  speed: number;
  color: string;
  glyph: string;
  power: number;
  splash: number;
  targetId: string | null;
}

export interface LootRoll {
  itemId: string;
  quality: number;
  qty: number;
}

export interface GroundLoot {
  id: string;
  pos: Vec2;
  itemId: string;
  qty: number;
  quality: number;
  /** Owner may loot for the first N ms (loot rights). */
  ownerId: string | null;
  droppedAt: number;
}
