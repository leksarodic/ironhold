import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '@/theme/tokens';

/**
 * The classic bevelled iron frame: a dark stone plate wrapped in a gold border
 * with an inner highlight and riveted corners. Layered views keep it crisp on
 * every platform and avoid expensive SVG layout maths.
 */
export function Frame({
  style,
  children,
  radius = 10,
  gold = 1,
  fill = palette.stone[700],
  accent = palette.gold[500],
  contentStyle,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  radius?: number;
  /** 0..1 multiplier for border brightness. */
  gold?: number;
  fill?: string;
  accent?: string;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const border = Math.max(1, Math.round(radius * 0.28));
  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: radius + border,
          borderWidth: border,
          borderColor: accent,
          opacity: 1,
          backgroundColor: palette.stone[900],
          borderTopColor: accent,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[fill, palette.stone[800], palette.stone[900]]}
        locations={[0, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Inner gold keyline */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          margin: Math.max(1, border * 0.6),
          borderRadius: Math.max(radius - 2, 2),
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: palette.gold[200],
          opacity: 0.22 * gold,
        }}
      />
      <View style={[{ borderRadius: radius, overflow: 'hidden' }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    // Soft depth: the plate sits above the world.
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

/** A raised gold "button" plate used for menu actions. */
export function GoldPlate({
  style,
  children,
  tone = 'gold',
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  tone?: 'gold' | 'iron' | 'ember';
}) {
  const border =
    tone === 'gold' ? palette.gold[400] : tone === 'ember' ? palette.ember : palette.gold[600];
  const top = tone === 'gold' ? '#4a3718' : tone === 'ember' ? '#3d1a10' : palette.stone[600];
  return (
    <View
      style={[
        {
          borderRadius: 7,
          borderWidth: 2,
          borderColor: border,
          backgroundColor: palette.stone[900],
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.6,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[top, palette.stone[900], '#000']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          margin: 2,
          borderRadius: 4,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: palette.gold[200],
          opacity: 0.2,
        }}
      />
      {children}
    </View>
  );
}

/** Thin ornamental divider with a diamond centerpiece. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 12, justifyContent: 'center' }, style]}>
      <LinearGradient
        colors={['transparent', palette.gold[600], palette.gold[600], 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 1, opacity: 0.75 }}
      />
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          width: 8,
          height: 8,
          backgroundColor: palette.gold[400],
          transform: [{ rotate: '45deg' }],
          borderRadius: 1,
        }}
      />
    </View>
  );
}
