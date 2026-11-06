import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '@/theme/tokens';
import { Frame } from './Frame';

/**
 * Classic resource bar: inset stone well, segmented fill, gold cap line.
 * The animation eases value changes so damage and healing read clearly.
 */
export function ResourceBar({
  value,
  max,
  color,
  height = 14,
  width,
  style,
  label,
  showTicks = true,
  glow = false,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  label?: string;
  showTicks?: boolean;
  glow?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, max <= 0 ? 0 : value / max));
  const anim = useRef(new Animated.Value(pct)).current;
  const prev = useRef(pct);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 220,
      useNativeDriver: false,
    }).start();
    prev.current = pct;
  }, [pct, anim]);

  const widthInterpolate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: '#000',
          backgroundColor: '#0a0704',
          overflow: 'hidden',
        },
        glow && {
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      <Animated.View style={{ width: widthInterpolate, height: '100%' }}>
        <LinearGradient
          colors={[shade(color, 0.45), color, shade(color, -0.35)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1,
            height: height * 0.32,
            backgroundColor: 'rgba(255,255,255,0.16)',
          }}
        />
      </Animated.View>
      {showTicks &&
        Array.from({ length: 7 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${((i + 1) / 8) * 100}%`,
              top: 0,
              bottom: 0,
              width: StyleSheet.hairlineWidth,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          />
        ))}
      {label !== undefined && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Text
            style={{
              color: '#fff',
              fontSize: Math.max(9, height * 0.72),
              textAlign: 'center',
              fontFamily: 'Alegreya_700Bold',
              textShadowColor: '#000',
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
              lineHeight: height,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

export function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    const k = 1 + amount;
    r = Math.round(r * k);
    g = Math.round(g * k);
    b = Math.round(b * k);
  }
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

/** Buff/debuff icon with a radial cooldown sweep and stack timer. */
export function BuffBadge({
  color,
  glyph,
  remaining,
  duration,
  size = 30,
}: {
  color: string;
  glyph?: string;
  remaining: number;
  duration: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(1, remaining / Math.max(duration, 0.001)));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: palette.gold[400],
        backgroundColor: '#120d09',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', inset: 0, backgroundColor: color, opacity: 0.28 }} />
      <Text style={{ color: palette.parchment[100], fontSize: size * 0.42, fontFamily: 'Cinzel_700Bold' }}>
        {(glyph ?? '?').slice(0, 1).toUpperCase()}
      </Text>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${(1 - pct) * 100}%`,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      />
      <Text
        style={{
          position: 'absolute',
          bottom: 0,
          fontSize: 8,
          color: '#ffe9a8',
          fontFamily: 'Alegreya_700Bold',
          textShadowColor: '#000',
          textShadowRadius: 2,
        }}
      >
        {Math.ceil(remaining)}s
      </Text>
    </View>
  );
}

/** Text with the heavy WoW-style outline used across labels. */
export function Outlined({
  children,
  style,
  color = palette.parchment[50],
  size = 13,
  font = 'Alegreya_600SemiBold',
  align,
}: {
  children: React.ReactNode;
  style?: StyleProp<import('react-native').TextStyle>;
  color?: string;
  size?: number;
  font?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: size,
          fontFamily: font,
          textAlign: align,
          textShadowColor: 'rgba(0,0,0,0.95)',
          textShadowOffset: { width: 0, height: 1.5 },
          textShadowRadius: 3,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Cast bar with the classic maroon fill and gold border. */
export function CastBar({
  progress,
  label,
  width,
  style,
}: {
  progress: number;
  label: string;
  width: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Frame radius={6} style={[{ width, height: 22 }, style]} contentStyle={{ padding: 2 }}>
      <View style={{ flex: 1, backgroundColor: '#1a0f0a', borderRadius: 4, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
            height: '100%',
            backgroundColor: '#9c3d1a',
          }}
        />
        <View style={StyleSheet.absoluteFill}>
          <Outlined size={11} color="#ffeec2" align="center" style={{ lineHeight: 18 }}>
            {label}
          </Outlined>
        </View>
      </View>
    </Frame>
  );
}
