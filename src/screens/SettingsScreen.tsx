import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { palette } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { Outlined, ResourceBar } from '@/ui/ResourceBar';
import { WorldBackdrop } from '@/ui/WorldBackdrop';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Outlined size={11.5} color={palette.parchment[100]} font="Alegreya_600SemiBold">
            {label}
          </Outlined>
          {hint ? (
            <Outlined size={9} color={palette.parchment[500]}>
              {hint}
            </Outlined>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

/** Classic pill switch: gold when on, iron when off. */
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      testID={`toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <View
        style={{
          width: 54,
          height: 26,
          borderRadius: 13,
          borderWidth: 1.5,
          borderColor: value ? palette.gold[300] : palette.gold[700],
          backgroundColor: value ? 'rgba(184,134,43,0.35)' : 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: value ? palette.gold[300] : palette.stone[500],
            alignSelf: value ? 'flex-end' : 'flex-start',
            borderWidth: 1,
            borderColor: value ? palette.gold[200] : palette.stone[400],
          }}
        />
        <Outlined
          size={7.5}
          color={value ? palette.gold[200] : palette.parchment[500]}
          font="Cinzel_700Bold"
          style={{
            position: 'absolute',
            alignSelf: value ? 'flex-start' : 'flex-end',
            left: value ? 7 : undefined,
            right: value ? undefined : 7,
          }}
        >
          {value ? 'ON' : 'OFF'}
        </Outlined>
      </View>
    </Pressable>
  );
}

/** Settings screen. Presentation-only options; nothing here is networked. */
export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  return (
    <View style={{ flex: 1, backgroundColor: palette.stone[900] }}>
      <WorldBackdrop dim />
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Outlined size={17} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 2 }}>
              SETTINGS
            </Outlined>
            <Outlined size={9.5} color={palette.parchment[400]}>
              IRONHOLD · OPTIONS
            </Outlined>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings">
            <GoldPlate tone="iron" style={{ width: 56, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Outlined size={9.5} color={palette.gold[200]} font="Cinzel_700Bold">
                BACK
              </Outlined>
            </GoldPlate>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <Frame radius={9} contentStyle={{ paddingHorizontal: 11, paddingVertical: 2 }}>
            <Row label="Master Volume" hint="Sound effects and ambience">
              <View style={{ width: 130, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable
                  onPress={() => s.setVolume(s.volume - 0.1)}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease volume"
                >
                  <GoldPlate tone="iron" style={{ width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Outlined size={12} color={palette.gold[200]} font="Cinzel_700Bold">
                      −
                    </Outlined>
                  </GoldPlate>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <ResourceBar
                    value={Math.round(s.volume * 100)}
                    max={100}
                    color={palette.gold[500]}
                    height={10}
                    showTicks={false}
                    label={`${Math.round(s.volume * 100)}%`}
                  />
                </View>
                <Pressable
                  onPress={() => s.setVolume(s.volume + 0.1)}
                  accessibilityRole="button"
                  accessibilityLabel="Increase volume"
                >
                  <GoldPlate tone="iron" style={{ width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Outlined size={12} color={palette.gold[200]} font="Cinzel_700Bold">
                      +
                    </Outlined>
                  </GoldPlate>
                </Pressable>
              </View>
            </Row>
            <Divider />
            <Row label="Haptics" hint="Vibrate on abilities and damage taken">
              <Toggle value={s.haptics} onChange={s.toggleHaptics} label="Haptics" />
            </Row>
            <Divider />
            <Row label="Floating Combat Text" hint="Show damage and healing numbers">
              <Toggle value={s.combatText} onChange={s.toggleCombatText} label="Combat Text" />
            </Row>
            <Divider />
            <Row label="Reduce Motion" hint="Limit idle animation and flashes">
              <Toggle value={s.reducedMotion} onChange={s.toggleReducedMotion} label="Reduce Motion" />
            </Row>
          </Frame>

          <Frame radius={9} style={{ marginTop: 10 }} contentStyle={{ paddingHorizontal: 11, paddingVertical: 2 }}>
            <Row label="Joystick Size" hint={`${s.joystickSize}px`}>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {[96, 128, 152].map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => s.setJoystickSize(size)}
                    accessibilityRole="button"
                    accessibilityLabel={`Joystick size ${size}`}
                  >
                    <View
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: s.joystickSize === size ? palette.gold[300] : palette.gold[700],
                        backgroundColor:
                          s.joystickSize === size ? 'rgba(184,134,43,0.3)' : 'rgba(0,0,0,0.4)',
                      }}
                    >
                      <Outlined
                        size={9}
                        color={s.joystickSize === size ? palette.gold[200] : palette.parchment[400]}
                        font="Cinzel_600SemiBold"
                      >
                        {size === 96 ? 'S' : size === 128 ? 'M' : 'L'}
                      </Outlined>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Row>
            <Divider />
            <Row label="Show Ground Grid" hint="Debug overlay for the world tile grid">
              <Toggle value={s.showGrid} onChange={s.toggleGrid} label="Ground Grid" />
            </Row>
          </Frame>

          <View style={{ marginTop: 12 }}>
            <Pressable onPress={s.reset} accessibilityRole="button" accessibilityLabel="Reset settings to defaults">
              <GoldPlate tone="ember">
                <View style={{ paddingVertical: 9, alignItems: 'center' }}>
                  <Outlined size={10.5} color={palette.gold[200]} font="Cinzel_700Bold" style={{ letterSpacing: 1.2 }}>
                    RESTORE DEFAULTS
                  </Outlined>
                </View>
              </GoldPlate>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({});
