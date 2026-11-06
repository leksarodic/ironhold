import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CLASSES, type AbilityDef } from '@/game/classes';
import { WORLD } from '@/engine/world';
import type { Combatant } from '@/engine/types';
import { useGameStore } from '@/store/useGameStore';
import { useWorldStore } from '@/store/useWorldStore';
import { useNetStore } from '@/store/useNetStore';
import { useCoopSync, broadcastCast } from '@/net/useCoopSync';
import { palette } from '@/theme/tokens';
import { Joystick, type StickVector } from '@/ui/Joystick';
import { ActionBar, Minimap, TargetFrame } from '@/ui/Hud';
import { Outlined } from '@/ui/ResourceBar';
import { WorldRenderer, type Camera } from '@/ui/WorldRenderer';
import { Frame, GoldPlate } from '@/ui/Frame';
import { PlayerFrame } from '@/ui/Hud';
import { FloatingTexts } from '@/ui/FloatingTexts';

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const character = useGameStore((s) => s.character);
  const setScreen = useGameStore((s) => s.setScreen);
  const {
    start,
    stop,
    snapshot,
    localPlayerId,
    setStick,
    castAbility,
    selectTarget,
    step,
    combatLog,
  } = useWorldStore();

  const netRole = useNetStore((s) => s.role);
  const netSeed = useNetStore((s) => s.seed);
  const selfId = useNetStore((s) => s.selfId);
  const [camera, setCamera] = useState<Camera>({ x: WORLD.center.x, y: WORLD.center.y + 6, zoom: 10 });
  const [paused, setPaused] = useState(false);
  const stickRef = useRef<StickVector>({ x: 0, y: 0, mag: 0 });

  useCoopSync();

  // Boot the world once for this character. In a party the host is authoritative;
  // joiners render the host's stream and forward input instead.
  useEffect(() => {
    const authority = netRole !== 'joiner';
    start({
      name: character.name,
      classId: character.classId,
      level: character.level,
      seed: netRole === 'solo' ? 20260101 : netSeed || 20260101,
      id: netRole === 'solo' ? 'local-player' : selfId || 'local-player',
      authority,
    });
    return () => stop();
  }, [character.name, character.classId, character.level, netRole, netSeed, selfId, start, stop]);

  // Fixed-step simulation loop, decoupled from React rendering.
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let acc = 0;
    const STEP = 1 / 30;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 5) {
        step(STEP);
        acc -= STEP;
        guard++;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const localPlayer = useMemo(
    () => snapshot.players.find((p) => p.id === localPlayerId) ?? null,
    [snapshot.players, localPlayerId],
  );
  const partyOthers = useMemo(
    () => snapshot.players.filter((p) => p.id !== localPlayerId),
    [snapshot.players, localPlayerId],
  );

  // Smoothly track the local player with the camera.
  useEffect(() => {
    if (!localPlayer) return;
    setCamera((c) => ({
      ...c,
      x: c.x + (localPlayer.pos.x - c.x) * 0.18,
      y: c.y + (localPlayer.pos.y - 3.2 - c.y) * 0.18,
    }));
  }, [localPlayer?.pos.x, localPlayer?.pos.y, localPlayer]);

  const target: Combatant | null = useMemo(
    () => snapshot.enemies.find((e) => e.id === snapshot.targetId) ?? null,
    [snapshot.enemies, snapshot.targetId],
  );

  // Auto-target the nearest enemy when tapping the world.
  const autoTarget = useCallback(() => {
    if (!localPlayer) return;
    let best: Combatant | null = null;
    let bestD = Infinity;
    for (const e of snapshot.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - localPlayer.pos.x, e.pos.y - localPlayer.pos.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) selectTarget(best.id);
  }, [localPlayer, snapshot.enemies, selectTarget]);

  const onStick = useCallback(
    (v: StickVector) => {
      stickRef.current = v;
      setStick(v);
    },
    [setStick],
  );

  const minimapBlips = useMemo(() => {
    const blips: Array<{ x: number; y: number; color: string; size?: number }> = [];
    for (const e of snapshot.enemies) {
      if (!e.alive) continue;
      blips.push({ x: e.pos.x / WORLD.width, y: e.pos.y / WORLD.height, color: '#d0453a', size: 3.5 });
    }
    for (const p of snapshot.players) {
      blips.push({
        x: p.pos.x / WORLD.width,
        y: p.pos.y / WORLD.height,
        color: p.id === localPlayerId ? '#ffe08a' : '#6fd0ff',
        size: 5,
      });
    }
    return blips;
  }, [snapshot.enemies, snapshot.players, localPlayerId]);

  if (!localPlayer) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.stone[900], alignItems: 'center', justifyContent: 'center' }}>
        <Outlined size={16} color={palette.gold[300]} font="Cinzel_700Bold">
          Entering the world…
        </Outlined>
      </View>
    );
  }

  const classDef = CLASSES[localPlayer.classId ?? 'warrior'];

  return (
    <View style={{ flex: 1, backgroundColor: palette.stone[900] }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={autoTarget} accessibilityLabel="Select nearest enemy">
        <WorldRenderer
          combatants={[...snapshot.players, ...snapshot.enemies]}
          camera={camera}
          seed={20260101}
          projectiles={snapshot.projectiles}
          targetId={snapshot.targetId}
          localPlayerId={localPlayerId ?? undefined}
        />
      </Pressable>

      <FloatingTexts texts={snapshot.texts} camera={camera} />

      {/* Top HUD */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 8,
          right: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
        pointerEvents="box-none"
      >
        <View pointerEvents="box-none">
          <PlayerFrame player={localPlayer} designated />
        </View>
        <Minimap size={82} zone="ELWYNN VALE" blips={minimapBlips} />
      </View>

      {/* Target frame under minimap */}
      <View
        style={{ position: 'absolute', top: insets.top + 96, right: 10, alignItems: 'flex-end' }}
        pointerEvents="none"
      >
        {target && <TargetFrame target={target} />}
      </View>

      {/* Party frames (co-op) */}
      {partyOthers.length > 0 && (
        <View style={{ position: 'absolute', top: insets.top + 74, left: 8, gap: 4 }} pointerEvents="none">
          {partyOthers.map((p) => (
            <PlayerFrame key={p.id} player={p} compact />
          ))}
        </View>
      )}

      {/* Combat log */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 78,
          left: 8,
          width: 190,
          opacity: partyOthers.length > 0 ? 0 : 1,
        }}
        pointerEvents="none"
      >
        {combatLog.slice(-4).map((l) => (
          <Text
            key={l.id}
            numberOfLines={1}
            style={{
              color: l.color,
              fontFamily: 'Alegreya_400Regular',
              fontSize: 10,
              textShadowColor: '#000',
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {l.text}
          </Text>
        ))}
      </View>

      {/* Physical attacks / status */}
      <View
        style={{ position: 'absolute', left: 10, bottom: insets.bottom + 96 }}
        pointerEvents="box-none"
      >
        <Joystick size={128} onChange={onStick} />
      </View>

      {/* Target / attack button mirroring the joystick on the right */}
      <View
        style={{ position: 'absolute', right: 12, bottom: insets.bottom + 100 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={autoTarget}
          accessibilityRole="button"
          accessibilityLabel="Target nearest enemy"
        >
          {({ pressed }) => (
            <View style={{ width: 66, height: 66, opacity: pressed ? 0.8 : 1 }}>
              <Svg width={66} height={66}>
                <Defs>
                  <RadialGradient id="targetBtn" cx="42%" cy="35%" r="70%">
                    <Stop offset="0" stopColor="#7a2c16" stopOpacity="1" />
                    <Stop offset="0.65" stopColor="#3d1409" stopOpacity="1" />
                    <Stop offset="1" stopColor="#170805" stopOpacity="1" />
                  </RadialGradient>
                </Defs>
                <Circle cx={33} cy={33} r={31} fill="url(#targetBtn)" stroke={palette.gold[400]} strokeWidth={2.5} />
                <Circle cx={33} cy={33} r={25} fill="none" stroke={palette.gold[600]} strokeWidth={1} />
                <Circle cx={33} cy={33} r={13} fill="none" stroke="#e8c66a" strokeWidth={2} />
                <Circle cx={33} cy={33} r={3.5} fill="#e8c66a" />
                <Line x1={33} y1={8} x2={33} y2={16} stroke="#e8c66a" strokeWidth={2} />
                <Line x1={33} y1={50} x2={33} y2={58} stroke="#e8c66a" strokeWidth={2} />
                <Line x1={8} y1={33} x2={16} y2={33} stroke="#e8c66a" strokeWidth={2} />
                <Line x1={50} y1={33} x2={58} y2={33} stroke="#e8c66a" strokeWidth={2} />
              </Svg>
            </View>
          )}
        </Pressable>
      </View>

      {/* Bottom action bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 4,
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        {snapshot.castBar && (
          <Frame radius={6} style={{ width: 200, height: 20, marginBottom: 5 }} contentStyle={{ padding: 2 }}>
            <View style={{ flex: 1, backgroundColor: '#1a0f0a', borderRadius: 4, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${snapshot.castBar.progress * 100}%`,
                  height: '100%',
                  backgroundColor: '#9c3d1a',
                }}
              />
              <View style={StyleSheet.absoluteFill}>
                <Outlined size={10} color="#ffeec2" align="center" style={{ lineHeight: 16 }}>
                  {snapshot.castBar.label}
                </Outlined>
              </View>
            </View>
          </Frame>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <ActionBar
            classId={classDef.id}
            cooldowns={snapshot.cooldowns}
            resource={localPlayer.resource}
            onCast={(a: AbilityDef) => {
              castAbility(a.id);
              const me = snapshot.players.find((p) => p.id === localPlayerId);
              if (netRole !== 'solo' && me) {
                const t = snapshot.enemies.find((e) => e.id === snapshot.targetId);
                broadcastCast(
                  a.id,
                  t ? t.pos.x : me.pos.x + me.facing.x * a.range,
                  t ? t.pos.y : me.pos.y + me.facing.y * a.range,
                  t?.id ?? null,
                );
              }
            }}
            size={46}
          />
          <View style={{ gap: 4 }}>
            <Pressable
              onPress={() => setScreen('menu')}
              accessibilityRole="button"
              accessibilityLabel="Open game menu"
            >
              <GoldPlate
                tone="iron"
                style={{ width: 38, height: 26, alignItems: 'center', justifyContent: 'center' }}
              >
                <Outlined size={8.5} color={palette.gold[200]} font="Cinzel_700Bold">
                  MENU
                </Outlined>
              </GoldPlate>
            </Pressable>
            <Pressable
              onPress={autoTarget}
              accessibilityRole="button"
              accessibilityLabel="Cycle target"
            >
              <GoldPlate
                tone="iron"
                style={{ width: 38, height: 26, alignItems: 'center', justifyContent: 'center' }}
              >
                <Outlined size={8.5} color={palette.gold[200]} font="Cinzel_700Bold">
                  TAB
                </Outlined>
              </GoldPlate>
            </Pressable>
          </View>
        </View>
      </View>

      {paused && <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' }} />}
    </View>
  );
}
