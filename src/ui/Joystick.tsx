import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { palette } from '@/theme/tokens';

export interface StickVector {
  x: number;
  y: number;
  /** 0..1 magnitude. */
  mag: number;
}

export const ZERO_STICK: StickVector = { x: 0, y: 0, mag: 0 };

/**
 * A draggable analog stick. Reports a normalised vector where (0,-1) is "up"
 * in world space. Tracks absolute page coordinates against the measured base
 * centre, so it behaves identically on iOS and in the web preview.
 */
export function Joystick({
  size = 132,
  onChange,
  onRelease,
  disabled = false,
}: {
  size?: number;
  onChange: (v: StickVector) => void;
  onRelease?: () => void;
  disabled?: boolean;
}) {
  const radius = size / 2;
  const maxTravel = radius * 0.62;
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const center = useRef<{ x: number; y: number } | null>(null);
  const baseRef = useRef<View | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const measure = useCallback(() => {
    baseRef.current?.measureInWindow((x, y, w, h) => {
      center.current = { x: x + w / 2, y: y + h / 2 };
    });
  }, []);

  const onLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      measure();
    },
    [measure],
  );

  const apply = useCallback(
    (pageX: number, pageY: number, origin: { x: number; y: number }) => {
      let dx = pageX - origin.x;
      let dy = pageY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > maxTravel) {
        dx = (dx / len) * maxTravel;
        dy = (dy / len) * maxTravel;
      }
      setPos({ x: dx, y: dy });
      const nx = dx / maxTravel;
      const ny = dy / maxTravel;
      onChange({ x: nx, y: ny, mag: Math.min(1, len / maxTravel) });
    },
    [maxTravel, onChange],
  );

  const release = useCallback(() => {
    setPos({ x: 0, y: 0 });
    onChange(ZERO_STICK);
    onRelease?.();
  }, [onChange, onRelease]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: (e) => {
          if (disabledRef.current) return;
          if (!center.current) {
            measure();
            // Fall back to the touch point as the origin for the first gesture.
            center.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          }
          apply(e.nativeEvent.pageX, e.nativeEvent.pageY, center.current);
        },
        onPanResponderMove: (e) => {
          if (disabledRef.current || !center.current) return;
          apply(e.nativeEvent.pageX, e.nativeEvent.pageY, center.current);
        },
        onPanResponderRelease: release,
        onPanResponderTerminate: release,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [apply, measure, release],
  );

  return (
    <View
      ref={baseRef}
      onLayout={onLayout}
      style={{ width: size, height: size }}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Movement joystick"
      accessibilityHint="Drag to move your character"
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="stickBed" cx="50%" cy="45%" r="60%">
              <Stop offset="0" stopColor="#241c12" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.6" />
            </RadialGradient>
          </Defs>
          <Circle cx={radius} cy={radius} r={radius - 2} fill="url(#stickBed)" stroke={palette.gold[600]} strokeWidth={3} />
          <Circle cx={radius} cy={radius} r={radius * 0.62} fill="none" stroke={palette.gold[700]} strokeWidth={1} opacity={0.85} />
          <Circle cx={radius} cy={radius} r={radius - 8} fill="none" stroke={palette.gold[200]} strokeWidth={1} opacity={0.14} />
          {/* Cardinal ticks */}
          <Circle cx={radius} cy={9} r={2} fill={palette.gold[500]} opacity={0.75} />
          <Circle cx={radius} cy={size - 9} r={2} fill={palette.gold[500]} opacity={0.75} />
          <Circle cx={9} cy={radius} r={2} fill={palette.gold[500]} opacity={0.75} />
          <Circle cx={size - 9} cy={radius} r={2} fill={palette.gold[500]} opacity={0.75} />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            width: size * 0.44,
            height: size * 0.44,
            borderRadius: size,
            left: radius - size * 0.22 + pos.x,
            top: radius - size * 0.22 + pos.y,
          },
        ]}
      >
        <Svg width={size * 0.44} height={size * 0.44}>
          <Defs>
            <RadialGradient id="knobFace" cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor="#6b5a3c" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#3a2e1e" stopOpacity="1" />
              <Stop offset="1" stopColor="#1a140d" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={size * 0.22}
            cy={size * 0.22}
            r={size * 0.2}
            fill="url(#knobFace)"
            stroke={palette.gold[400]}
            strokeWidth={2.5}
          />
          <Circle cx={size * 0.22} cy={size * 0.22} r={size * 0.1} fill="none" stroke={palette.gold[600]} strokeWidth={1.5} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  knob: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
