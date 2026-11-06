import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLASS_LIST, type ClassId } from '@/game/classes';
import { useGameStore } from '@/store/useGameStore';
import { palette } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { Portrait, SpellIcon, type GlyphId } from '@/ui/Icons';
import { Outlined, ResourceBar } from '@/ui/ResourceBar';
import { WorldBackdrop } from '@/ui/WorldBackdrop';

const PORTRAIT_GLYPH: Record<ClassId, GlyphId> = {
  warrior: 'shield',
  mage: 'fireball',
  priest: 'heal',
};

const DEFAULT_NAMES: Record<ClassId, string> = {
  warrior: 'Thrall',
  mage: 'Jaina',
  priest: 'Anduin',
};

const CLASS_GLYPHS: Record<ClassId, GlyphId> = { warrior: 'sword', mage: 'fireball', priest: 'smite' };

function StatRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
      <Outlined size={10} color={palette.parchment[300]} style={{ width: 52 }}>
        {label}
      </Outlined>
      <View style={{ flex: 1 }}>
        <ResourceBar value={value} max={max} color={palette.gold[500]} height={7} showTicks={false} />
      </View>
      <Outlined size={10} color={palette.gold[200]} style={{ width: 26, textAlign: 'right' }}>
        {value}
      </Outlined>
    </View>
  );
}

export function CharacterSelectScreen() {
  const { character, chooseClass, setCharacter, setScreen } = useGameStore();
  const [selected, setSelected] = useState<ClassId>(character.classId);
  const [name, setName] = useState(character.name);
  const insets = useSafeAreaInsets();
  const def = CLASS_LIST.find((c) => c.id === selected) ?? CLASS_LIST[0]!;

  const confirm = () => {
    chooseClass(selected);
    setCharacter({ name: name.trim() || DEFAULT_NAMES[selected], classId: selected, level: 1, xp: 0 });
    setScreen('game');
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.stone[900] }}>
      <WorldBackdrop dim />
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => setScreen('menu')}
            accessibilityRole="button"
            accessibilityLabel="Back to main menu"
            hitSlop={12}
          >
            <GoldPlate tone="iron" style={{ width: 40, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Outlined size={13} color={palette.gold[200]} font="Cinzel_700Bold">
                {'\u2039'}
              </Outlined>
            </GoldPlate>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                color: palette.gold[300],
                fontFamily: 'Cinzel_700Bold',
                fontSize: 17,
                letterSpacing: 2.5,
                textShadowColor: '#000',
                textShadowRadius: 4,
              }}
            >
              CHOOSE YOUR PATH
            </Text>
            <Outlined size={9.5} color={palette.parchment[400]} style={{ letterSpacing: 1.5 }}>
              IRONHOLD · CHARACTER CREATION
            </Outlined>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1, marginTop: 10 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Class cards */}
          <View style={{ gap: 8 }}>
            {CLASS_LIST.map((c) => {
              const active = c.id === selected;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setSelected(c.id);
                    setName(DEFAULT_NAMES[c.id]);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${c.name}, ${c.title}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Frame
                    radius={9}
                    gold={active ? 1.15 : 0.45}
                    accent={active ? c.accentColor : palette.gold[700]}
                    style={{ width: '100%' }}
                    contentStyle={{ padding: 8 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          borderRadius: 999,
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? c.accentColor : palette.gold[700],
                          padding: 1,
                        }}
                      >
                        <Portrait glyph={PORTRAIT_GLYPH[c.id]} tint={c.primaryColor} size={52} ring={c.accentColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={{
                              color: active ? palette.gold[200] : palette.parchment[200],
                              fontFamily: 'Cinzel_700Bold',
                              fontSize: 15,
                            }}
                          >
                            {c.name}
                          </Text>
                          {active && (
                            <View
                              style={{
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                                borderRadius: 3,
                                borderWidth: 1,
                                borderColor: c.accentColor,
                              }}
                            >
                              <Outlined size={7.5} color={c.accentColor} font="Cinzel_700Bold">
                                SELECTED
                              </Outlined>
                            </View>
                          )}
                        </View>
                        <Outlined size={9.5} color={palette.parchment[400]}>
                          {c.title}
                        </Outlined>
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 5 }}>
                          {c.abilities.map((a) => (
                            <SpellIcon key={a.id} glyph={a.icon as GlyphId} tint={a.color} size={26} />
                          ))}
                          <View style={{ flex: 1 }} />
                          <Outlined size={9} color={c.resourceColor}>
                            {c.resource.toUpperCase()}
                          </Outlined>
                        </View>
                      </View>
                    </View>
                  </Frame>
                </Pressable>
              );
            })}
          </View>

          {/* Detail panel */}
          <Frame radius={10} style={{ marginTop: 10 }} contentStyle={{ padding: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SpellIcon glyph={CLASS_GLYPHS[def.id]} tint={def.accentColor} size={20} />
              <Text style={{ color: palette.gold[200], fontFamily: 'Cinzel_700Bold', fontSize: 12.5, letterSpacing: 1 }}>
                {def.name.toUpperCase()} — {def.title.toUpperCase()}
              </Text>
            </View>
            <Divider style={{ marginVertical: 6 }} />
            <Text
              style={{
                color: palette.parchment[200],
                fontFamily: 'Alegreya_400Regular',
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {def.blurb}
            </Text>

            <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Outlined size={9} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 1 }}>
                  ATTRIBUTES
                </Outlined>
                <StatRow label="Health" value={def.base.hp} max={240} />
                <StatRow label={def.resource === 'rage' ? 'Rage' : 'Mana'} value={def.base.resource} max={200} />
                <StatRow label="Armor" value={def.base.armor} max={30} />
                <StatRow label="Attack" value={def.base.attack} max={16} />
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Outlined size={9} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 1 }}>
                ABILITIES
              </Outlined>
              {def.abilities.map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 }}>
                  <SpellIcon glyph={a.icon as GlyphId} tint={a.color} size={24} />
                  <View style={{ flex: 1 }}>
                    <Outlined size={10.5} color={palette.gold[200]}>
                      {a.name}
                    </Outlined>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: palette.parchment[400],
                        fontFamily: 'Alegreya_400Regular',
                        fontSize: 9.5,
                        lineHeight: 12,
                      }}
                    >
                      {a.tooltip}
                    </Text>
                  </View>
                  <Outlined size={9} color={palette.parchment[400]} style={{ width: 46, textAlign: 'right' }}>
                    {a.cooldown}s
                  </Outlined>
                </View>
              ))}
            </View>
          </Frame>
        </ScrollView>

        {/* Footer: name + confirm */}
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          <Frame radius={8} contentStyle={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Outlined size={9.5} color={palette.parchment[400]} font="Cinzel_600SemiBold">
                NAME
              </Outlined>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={14}
                placeholder="Enter a name"
                placeholderTextColor={palette.parchment[600]}
                accessibilityLabel="Character name"
                style={{
                  flex: 1,
                  color: palette.gold[200],
                  fontFamily: 'Alegreya_600SemiBold',
                  fontSize: 13,
                  paddingVertical: 4,
                  textAlign: 'right',
                }}
              />
            </View>
          </Frame>
          <Pressable onPress={confirm} accessibilityRole="button" accessibilityLabel="Enter the world">
            {({ pressed }) => (
              <GoldPlate tone="ember" style={{ opacity: pressed ? 0.85 : 1 }}>
                <LinearGradient
                  colors={['rgba(224,90,43,0.35)', 'transparent']}
                  style={{ position: 'absolute', inset: 0 }}
                />
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <Text
                    style={{
                      color: palette.gold[200],
                      fontFamily: 'Cinzel_800ExtraBold',
                      fontSize: 15,
                      letterSpacing: 2,
                      textShadowColor: '#000',
                      textShadowRadius: 4,
                    }}
                  >
                    ENTER THE WORLD
                  </Text>
                </View>
              </GoldPlate>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
