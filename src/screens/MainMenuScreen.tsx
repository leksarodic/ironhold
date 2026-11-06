import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/store/useGameStore';
import { palette } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { Outlined } from '@/ui/ResourceBar';
import { WorldBackdrop } from '@/ui/WorldBackdrop';

function MenuButton({
  label,
  sub,
  onPress,
  tone = 'gold',
  primary = false,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  tone?: 'gold' | 'iron' | 'ember';
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <GoldPlate tone={tone} style={{ width: primary ? 260 : 230, alignSelf: 'center' }}>
        <View style={{ paddingVertical: primary ? 13 : 10, paddingHorizontal: 16, alignItems: 'center' }}>
          <Text
            style={{
              color: primary ? palette.gold[200] : palette.parchment[100],
              fontFamily: primary ? 'Cinzel_700Bold' : 'Cinzel_600SemiBold',
              fontSize: primary ? 17 : 14,
              letterSpacing: 1.1,
              textShadowColor: '#000',
              textShadowRadius: 3,
            }}
          >
            {label}
          </Text>
          {sub ? (
            <Text
              style={{
                color: palette.parchment[400],
                fontFamily: 'Alegreya_400Regular',
                fontSize: 10,
                marginTop: 1,
              }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </GoldPlate>
    </Pressable>
  );
}

export function MainMenuScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const character = useGameStore((s) => s.character);
  const insets = useSafeAreaInsets();
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <View style={{ flex: 1, backgroundColor: palette.stone[900] }}>
      <WorldBackdrop dim />
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 300,
                height: 300,
                borderRadius: 150,
                backgroundColor: palette.ember,
                opacity: glowOpacity,
                transform: [{ scale: 0.6 }],
              }}
            >
              <LinearGradient
                colors={['rgba(224,90,43,0.5)', 'rgba(224,90,43,0)']}
                style={{ flex: 1, borderRadius: 150 }}
              />
            </Animated.View>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 118, height: 118, borderRadius: 18 }}
              resizeMode="cover"
            />
          </View>
          <Text
            style={{
              marginTop: 10,
              fontSize: 42,
              letterSpacing: 5,
              color: palette.gold[300],
              fontFamily: 'Cinzel_900Black',
              textShadowColor: '#000',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 10,
            }}
          >
            IRONHOLD
          </Text>
          <Outlined size={11} color={palette.parchment[300]} style={{ letterSpacing: 3, marginTop: 2 }}>
            BONDS FORGED IN IRON
          </Outlined>
          <Divider style={{ width: 220, marginTop: 12 }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 11 }}>
          <MenuButton
            primary
            label="ENTER THE HOLD"
            sub={`Continue as ${character.name}`}
            onPress={() => setScreen('game')}
          />
          <MenuButton
            label="CREATE CHARACTER"
            onPress={() => setScreen('select')}
            tone="iron"
          />
          <MenuButton label="JOIN A PARTY" onPress={() => setScreen('game')} tone="gold" />
          <MenuButton label="SETTINGS" onPress={() => {}} tone="iron" />
        </View>

        <Frame style={{ width: '100%', maxWidth: 380, alignSelf: 'center' }} radius={8}>
          <View style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#59d16a' }} />
            <Outlined size={10} color={palette.parchment[300]} style={{ flex: 1 }}>
              LOCAL REALM · P2P NETWORK READY
            </Outlined>
            <Outlined size={10} color={palette.parchment[500]}>
              v1.0.0
            </Outlined>
          </View>
        </Frame>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
});
