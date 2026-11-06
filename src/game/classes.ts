export type ClassId = 'warrior' | 'mage' | 'priest';

export type AbilityKind = 'melee' | 'projectile' | 'heal' | 'buff';

export interface AbilityDef {
  id: string;
  name: string;
  kind: AbilityKind;
  icon: string;
  /** Seconds before the ability may be used again. */
  cooldown: number;
  /** Resource consumed on cast. */
  cost: number;
  /** Range in world units. */
  range: number;
  /** Base damage (negative values are heals). */
  power: number;
  /** Radius of splash damage, 0 = single target. */
  splash: number;
  /** Cast time in seconds; 0 = instant. */
  castTime: number;
  color: string;
  tooltip: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  blurb: string;
  resource: 'rage' | 'mana';
  resourceColor: string;
  /** Base stats before level scaling. */
  base: {
    hp: number;
    resource: number;
    armor: number;
    attack: number;
    /** Units per second. */
    speed: number;
  };
  abilities: AbilityDef[];
  primaryColor: string;
  accentColor: string;
}

const WARRIOR_ABILITIES: AbilityDef[] = [
  {
    id: 'heroic_strike',
    name: 'Heroic Strike',
    kind: 'melee',
    icon: 'sword',
    cooldown: 1.6,
    cost: 0,
    range: 3.2,
    power: 26,
    splash: 0,
    castTime: 0,
    color: '#e05a2b',
    tooltip: 'A strong attack that increases melee damage. Strikes the nearest enemy in front of you.',
  },
  {
    id: 'thunder_clap',
    name: 'Thunder Clap',
    kind: 'melee',
    icon: 'wave',
    cooldown: 7,
    cost: 20,
    range: 0,
    power: 18,
    splash: 4.2,
    castTime: 0,
    color: '#8fb6e8',
    tooltip: 'Blasts nearby enemies with thunder, damaging all of them around you.',
  },
  {
    id: 'battle_shout',
    name: 'Battle Shout',
    kind: 'buff',
    icon: 'shout',
    cooldown: 20,
    cost: 10,
    range: 12,
    power: 0,
    splash: 0,
    castTime: 0,
    color: '#d4a942',
    tooltip: 'The warrior shouts, increasing the attack power of all party members for 12 seconds.',
  },
];

const MAGE_ABILITIES: AbilityDef[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    kind: 'projectile',
    icon: 'fireball',
    cooldown: 1.2,
    cost: 18,
    range: 16,
    power: 34,
    splash: 1.6,
    castTime: 0.55,
    color: '#ff8a3d',
    tooltip: 'Hurls a fiery ball that causes fire damage to an enemy and burns nearby foes.',
  },
  {
    id: 'frost_nova',
    name: 'Frost Nova',
    kind: 'melee',
    icon: 'frost',
    cooldown: 9,
    cost: 24,
    range: 0,
    power: 14,
    splash: 5,
    castTime: 0,
    color: '#7fd8ff',
    tooltip: 'Freezes all enemies around the caster, dealing frost damage and rooting them briefly.',
  },
  {
    id: 'arcane_ward',
    name: 'Arcane Ward',
    kind: 'buff',
    icon: 'ward',
    cooldown: 18,
    cost: 20,
    range: 0,
    power: 0,
    splash: 0,
    castTime: 0,
    color: '#b58cff',
    tooltip: 'Shields the caster, absorbing incoming damage for 10 seconds.',
  },
];

const PRIEST_ABILITIES: AbilityDef[] = [
  {
    id: 'smite',
    name: 'Smite',
    kind: 'projectile',
    icon: 'smite',
    cooldown: 1.5,
    cost: 14,
    range: 14,
    power: 24,
    splash: 0,
    castTime: 0.4,
    color: '#f0c95a',
    tooltip: 'Smites an enemy with holy power, causing damage at range.',
  },
  {
    id: 'lesser_heal',
    name: 'Lesser Heal',
    kind: 'heal',
    icon: 'heal',
    cooldown: 2.2,
    cost: 26,
    range: 12,
    power: -46,
    splash: 0,
    castTime: 0.9,
    color: '#8ef08e',
    tooltip: 'Calls upon the Light to heal the most wounded party member within range.',
  },
  {
    id: 'power_word_shield',
    name: 'Power Word: Shield',
    kind: 'buff',
    icon: 'shield',
    cooldown: 12,
    cost: 22,
    range: 12,
    power: 0,
    splash: 0,
    castTime: 0.2,
    color: '#f7e3a1',
    tooltip: 'Shields an ally, absorbing 40 damage for 10 seconds.',
  },
];

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    title: 'Disciple of War',
    blurb: 'A stalwart front-liner who builds rage with every strike and protects the party at the tip of the spear.',
    resource: 'rage',
    resourceColor: '#c0392b',
    base: { hp: 220, resource: 100, armor: 28, attack: 14, speed: 3.4 },
    abilities: WARRIOR_ABILITIES,
    primaryColor: '#8f3b24',
    accentColor: '#e05a2b',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    title: 'Master of Elements',
    blurb: 'A fragile but devastating caster who rains fire and frost from afar, controlling the battlefield.',
    resource: 'mana',
    resourceColor: '#2f6fd0',
    base: { hp: 130, resource: 180, armor: 8, attack: 8, speed: 3.7 },
    abilities: MAGE_ABILITIES,
    primaryColor: '#1f3f7a',
    accentColor: '#4f8ef7',
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    title: 'Voice of the Light',
    blurb: 'A devoted healer who mends wounds and shields allies, keeping the party standing through the darkest fights.',
    resource: 'mana',
    resourceColor: '#2f6fd0',
    base: { hp: 150, resource: 200, armor: 12, attack: 7, speed: 3.5 },
    abilities: PRIEST_ABILITIES,
    primaryColor: '#6b5a1c',
    accentColor: '#f0c95a',
  },
};

export const CLASS_LIST: ClassDef[] = [CLASSES.warrior, CLASSES.mage, CLASSES.priest];

export function classById(id: ClassId): ClassDef {
  return CLASSES[id];
}

export function abilityById(classId: ClassId, abilityId: string): AbilityDef | undefined {
  return CLASSES[classId].abilities.find((a) => a.id === abilityId);
}
