import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { palette } from '@/theme/tokens';

/**
 * A dimly lit isometric valley used behind menus. Purely decorative: layered
 * SVG shapes plus a vignette, no per-frame work, so it stays cheap on mobile.
 */
export function WorldBackdrop({ dim = false }: { dim?: boolean }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 34 }).map((_, i) => ({
        x: (i * 137.508) % 100,
        y: ((i * 53.7) % 45) + 2,
        r: ((i * 7) % 3) * 0.14 + 0.18,
        o: 0.15 + ((i * 13) % 40) / 100,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0b0906', '#16110b', '#241a11', '#1a130d']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="moon" cx="50%" cy="30%" r="60%">
            <Stop offset="0" stopColor="#e8d9b0" stopOpacity="0.85" />
            <Stop offset="0.55" stopColor="#c8b184" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#c8b184" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="horizonGlow" cx="50%" cy="100%" r="80%">
            <Stop offset="0" stopColor="#c4702c" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#c4702c" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={400} height={800} fill="transparent" />
        {stars.map((s, i) => (
          <Circle key={i} cx={(s.x / 100) * 400} cy={(s.y / 100) * 800} r={s.r * 2.4} fill="#f6ecd2" opacity={s.o} />
        ))}
        <Circle cx={310} cy={92} r={110} fill="url(#moon)" />
        <Circle cx={310} cy={92} r={26} fill="#efe3c4" opacity={0.5} />
        <Circle cx={302} cy={86} r={5} fill="#cbbd9d" opacity={0.35} />
        <Circle cx={318} cy={101} r={3.4} fill="#cbbd9d" opacity={0.3} />
        <Ellipse cx={200} cy={640} rx={300} ry={150} fill="url(#horizonGlow)" />
        {/* Distant mountains */}
        <Path d="M0 470 L60 402 L110 448 L170 372 L230 442 L290 396 L350 452 L400 410 L400 560 L0 560 Z" fill="#0f0b07" opacity={0.85} />
        <Path d="M0 505 L70 462 L140 500 L210 452 L280 498 L350 466 L400 496 L400 620 L0 620 Z" fill="#0a0705" />
        {/* Foreground hills */}
        <Path d="M0 600 Q90 556 190 596 T400 590 L400 800 L0 800 Z" fill="#080604" />
        {/* Pine silhouettes */}
        {[
          [44, 566, 1],
          [66, 574, 0.8],
          [318, 560, 1.1],
          [346, 572, 0.85],
          [374, 566, 0.7],
        ].map(([x, y, s], i) => (
          <Path
            key={`pine${i}`}
            d={`M${x} ${y} L${(x as number) + 11 * (s as number)} ${y} L${x} ${(y as number) + 46 * (s as number)} L${(x as number) - 11 * (s as number)} ${y} Z`}
            fill="#050403"
          />
        ))}
      </Svg>
      {dim && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,4,3,0.45)' }]} />}
      <LinearGradient
        colors={['rgba(5,4,3,0.9)', 'transparent', 'transparent', 'rgba(5,4,3,0.95)']}
        locations={[0, 0.22, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export const backdropPalette = palette;
