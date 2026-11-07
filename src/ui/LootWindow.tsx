import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { itemById } from '@/game/items';
import type { GroundLoot } from '@/engine/types';
import { palette, qualityColor } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { SpellIcon, type GlyphId } from '@/ui/Icons';
import { Outlined } from '@/ui/ResourceBar';

/**
 * Loot window for a slain enemy: the classic "loot roll" plate listing what
 * dropped, with Take All. Items are placed into the local bag on take.
 */
export function LootWindow({
  loot,
  onTake,
  onTakeAll,
  onClose,
}: {
  loot: GroundLoot[];
  onTake: (lootId: string) => void;
  onTakeAll: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Frame
        radius={10}
        style={{ width: 300 }}
        contentStyle={{ padding: 9 }}
        accent={palette.gold[400]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: palette.gold[200], fontFamily: 'Cinzel_700Bold', fontSize: 12.5 }}>
            LOOT
          </Text>
          <View style={{ flex: 1 }} />
          <GoldPlate tone="iron" style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close loot window">
              <Outlined size={8.5} color={palette.gold[200]} font="Cinzel_700Bold">
                X
              </Outlined>
            </Pressable>
          </GoldPlate>
        </View>
        <Divider style={{ marginVertical: 5 }} />
        {loot.length === 0 ? (
          <Outlined size={10} color={palette.parchment[500]} style={{ paddingVertical: 8 }} align="center">
            Nothing left to loot.
          </Outlined>
        ) : (
          loot.map((l) => {
            const def = itemById(l.itemId);
            if (!def) return null;
            const q = qualityColor[def.quality];
            return (
              <Pressable
                key={l.id}
                onPress={() => onTake(l.id)}
                accessibilityRole="button"
                accessibilityLabel={`Loot ${def.name}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  paddingVertical: 4,
                  paddingHorizontal: 3,
                  borderRadius: 4,
                }}
              >
                <SpellIcon glyph={def.icon as GlyphId} tint={q} size={26} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: q, fontFamily: 'Alegreya_600SemiBold', fontSize: 11.5 }}>
                    {def.name}
                    {l.qty > 1 ? ` x${l.qty}` : ''}
                  </Text>
                  <Text style={{ color: palette.parchment[500], fontSize: 8.5, fontFamily: 'Alegreya_400Regular' }}>
                    {def.kind === 'material' ? 'Reagent' : def.slot ? def.slot : def.kind}
                  </Text>
                </View>
                <Outlined size={8.5} color={palette.gold[300]} font="Cinzel_600SemiBold">
                  LOOT
                </Outlined>
              </Pressable>
            );
          })
        )}
        <Divider style={{ marginVertical: 5 }} />
        <Pressable onPress={onTakeAll} accessibilityRole="button" accessibilityLabel="Take all loot">
          <GoldPlate tone="gold">
            <View style={{ paddingVertical: 7, alignItems: 'center' }}>
              <Outlined size={10} color={palette.gold[200]} font="Cinzel_700Bold" style={{ letterSpacing: 1 }}>
                TAKE ALL
              </Outlined>
            </View>
          </GoldPlate>
        </Pressable>
      </Frame>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
