import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import type { FloatingText } from '@/engine/types';
import type { Camera } from './WorldRenderer';

/**
 * World-anchored floating combat text. Rendered in its own SVG layer so it
 * never forces the world scene to re-layout.
 */
export function FloatingTexts({ texts, camera }: { texts: FloatingText[]; camera: Camera }) {
  const viewW = 100 / camera.zoom;
  const halfW = viewW / 2;
  const viewH = viewW * 1.9;
  const halfH = viewH / 2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`${camera.x - halfW} ${camera.y - halfH} ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {texts.map((t, i) => (
          <G key={t.id}>
            <SvgText
              x={t.pos.x + (i % 3) * 0.18 - 0.18}
              y={t.pos.y - 0.9 - (i % 4) * 0.16}
              fontSize={t.kind === 'crit' ? 0.62 : 0.44}
              fill={t.color}
              textAnchor="middle"
              fontFamily="Cinzel_700Bold"
              stroke="#000"
              strokeWidth={0.06}
            >
              {t.text}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}
