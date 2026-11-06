import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLASSES, type ClassDef, type AbilityDef } from '@/game/classes';
import { palette } from '@/theme/tokens';
import type { Buff, Combatant } from '@/engine/types';
import { Frame } from './Frame';
import { Portrait, SpellIcon, type GlyphId } from './Icons';
import { BuffBadge, CastBar, Outlined, ResourceBar } from './ResourceBar';

const PORTRAIT_GLYPH: Record<string, GlyphId> = {
  warrior: 'shield',
  mage: 'fireball',
  priest: 'heal',
};

function abilityGlyph(a: AbilityDef): GlyphId {
  return (a.icon as GlyphId) ?? 'sword';
}

/** Player frame: portrait, name, level, HP and resource bars. */
export function PlayerFrame({
  player,
  compact = false,
  designated = false,
}: {
  player: Combatant;
  compact?: boolean;
  designated?: boolean;
}) {
  const def: ClassDef | null = player.classId ? CLASSES[player.classId] : null;
  if (!def) return null;
  const hpPct = player.hp / player.maxHp;
  const portraitSize = compact ? 40 : 56;
  return (
    <View style={{ width: compact ? 168 : 214 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 2,
            borderColor: designated ? palette.gold[200] : palette.gold[600],
            padding: 1,
            backgroundColor: '#000',
          }}
        >
          <Portrait
            glyph={PORTRAIT_GLYPH[def.id] ?? 'shield'}
            tint={def.primaryColor}
            size={portraitSize}
            ring={palette.gold[400]}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 6, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Outlined size={compact ? 11 : 12.5} color={palette.gold[200]} font="Cinzel_700Bold">
              {player.name}
            </Outlined>
            <Outlined size={compact ? 9.5 : 10.5} color={palette.parchment[300]}>
              {`Lv ${player.level}`}
            </Outlined>
          </View>
          <ResourceBar
            value={player.hp}
            max={player.maxHp}
            color={palette.hp}
            height={compact ? 11 : 13}
            label={`${Math.ceil(player.hp)} / ${player.maxHp}`}
            style={{ marginTop: 2 }}
          />
          <ResourceBar
            value={player.resource}
            max={player.maxResource}
            color={def.resourceColor}
            height={compact ? 8 : 10}
            style={{ marginTop: 2 }}
          />
          {!compact && player.buffs.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
              {player.buffs.slice(0, 6).map((b: Buff) => (
                <BuffBadge
                  key={b.id}
                  color={b.color}
                  remaining={b.remaining}
                  duration={b.duration}
                  size={20}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      {hpPct < 0.3 && player.alive && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            borderWidth: 1,
            borderColor: 'rgba(255,60,60,0.55)',
            borderRadius: 6,
          }}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

/** Party roster shown under the player frame. */
export function PartyFrames({ members }: { members: Combatant[] }) {
  return (
    <View style={{ gap: 4 }}>
      {members.map((m) => (
        <PlayerFrame key={m.id} player={m} compact />
      ))}
    </View>
  );
}

/**
 * Bottom action bar: classic 12-slot bar with the 3 class abilities bound,
 * cooldown sweeps, resource costs and hotkeys.
 */
export function ActionBar({
  classId,
  cooldowns,
  resource,
  onCast,
  size = 52,
  disabled = false,
}: {
  classId: ClassDef['id'];
  cooldowns: Record<string, number>;
  resource: number;
  onCast: (ability: AbilityDef) => void;
  size?: number;
  disabled?: boolean;
}) {
  const abilities = CLASSES[classId].abilities;
  const slots: Array<AbilityDef | null> = [...abilities, null, null, null];
  return (
    <Frame radius={10} style={{ alignSelf: 'center' }} contentStyle={{ padding: 5 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {slots.map((a, i) => {
          if (!a) {
            return (
              <View
                key={`empty-${i}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: 5,
                  borderWidth: 1.5,
                  borderColor: 'rgba(120,96,50,0.55)',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                }}
              />
            );
          }
          const cd = cooldowns[a.id] ?? 0;
          const cdPct = cd > 0 ? Math.min(1, cd / a.cooldown) : 0;
          const noRes = resource < a.cost;
          return (
            <Pressable
              key={a.id}
              onPress={() => onCast(a)}
              disabled={disabled || noRes}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${a.cost} ${a.cost > 0 ? 'resource' : 'free'}`}
              style={({ pressed }) => ({
                width: size,
                height: size,
                borderRadius: 5,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <SpellIcon glyph={abilityGlyph(a)} tint={a.color} size={size} dim={noRes} />
              {cd > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.62)',
                    height: `${cdPct * 100}%`,
                    top: 0,
                  }}
                />
              )}
              {cd > 0 && (
                <View style={StyleSheet.absoluteFill}>
                  <Text
                    style={{
                      marginTop: size * 0.3,
                      textAlign: 'center',
                      color: '#ffe9a8',
                      fontFamily: 'Alegreya_700Bold',
                      fontSize: 13,
                      textShadowColor: '#000',
                      textShadowRadius: 3,
                    }}
                  >
                    {cd < 1 ? cd.toFixed(1) : Math.ceil(cd)}
                  </Text>
                </View>
              )}
              {a.cost > 0 && (
                <Text
                  style={{
                    position: 'absolute',
                    right: 2,
                    bottom: 0,
                    fontSize: 9,
                    color: noRes ? '#ff6b6b' : '#cfe2ff',
                    fontFamily: 'Alegreya_700Bold',
                    textShadowColor: '#000',
                    textShadowRadius: 2,
                  }}
                >
                  {a.cost}
                </Text>
              )}
              <Text
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 1,
                  fontSize: 8.5,
                  color: palette.gold[200],
                  fontFamily: 'Alegreya_700Bold',
                  textShadowColor: '#000',
                  textShadowRadius: 2,
                }}
              >
                {i + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Frame>
  );
}

/** Circular minimap with a compass ring, blips and zone label. */
export function Minimap({
  size = 96,
  zone,
  blips = [],
}: {
  size?: number;
  zone: string;
  blips?: Array<{ x: number; y: number; color: string; size?: number }>;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: palette.gold[500],
          backgroundColor: '#0f0c08',
          overflow: 'hidden',
        }}
      >
        <RenderMinimapBlips blips={blips} size={size} />
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.75)',
            borderRadius: size / 2,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          top: -6,
          backgroundColor: palette.stone[900],
          paddingHorizontal: 6,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: palette.gold[600],
        }}
      >
        <Outlined size={8.5} color={palette.gold[200]} font="Cinzel_700Bold">
          {zone}
        </Outlined>
      </View>
    </View>
  );
}

function RenderMinimapBlips({ blips, size }: { blips: Array<{ x: number; y: number; color: string; size?: number }>; size: number }) {
  return (
    <>
      {blips.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            width: b.size ?? 4,
            height: b.size ?? 4,
            borderRadius: 999,
            backgroundColor: b.color,
            transform: [{ translateX: -(b.size ?? 4) / 2 }, { translateY: -(b.size ?? 4) / 2 }],
          }}
        />
      ))}
    </>
  );
}

/** Zone banner that fades in when entering a new area. */
export function ZoneBanner({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Outlined size={26} color={palette.gold[200]} font="Cinzel_800ExtraBold" align="center">
        {title}
      </Outlined>
      {subtitle && (
        <Outlined size={11} color={palette.parchment[300]} align="center">
          {subtitle}
        </Outlined>
      )}
    </View>
  );
}

/** Target frame with health bar and enemy level. */
export function TargetFrame({ target }: { target: Combatant }) {
  return (
    <View style={{ alignItems: 'flex-end', width: 190 }}>
      <Outlined size={12} color={palette.gold[200]} font="Cinzel_700Bold">
        {target.name}
      </Outlined>
      <ResourceBar
        value={target.hp}
        max={target.maxHp}
        color="#9e2b25"
        height={11}
        label={`${Math.ceil(target.hp)} / ${target.maxHp}`}
        style={{ marginTop: 2 }}
        width="100%"
      />
      <Outlined size={9.5} color={palette.parchment[300]} style={{ marginTop: 1 }}>
        {`Level ${target.level}`}
      </Outlined>
    </View>
  );
}

export { CastBar };
