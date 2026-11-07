import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BAG_COLS, BAG_ROWS, itemById, type ItemDef, type ItemSlot } from '@/game/items';
import type { Equipment, ItemStack } from '@/engine/inventory';
import { palette, qualityColor, type Quality } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { SpellIcon, type GlyphId } from '@/ui/Icons';
import { Outlined } from '@/ui/ResourceBar';

const CELL = 46;

const SLOT_LABEL: Record<ItemSlot, string> = {
  head: 'Head',
  chest: 'Chest',
  legs: 'Legs',
  feet: 'Feet',
  mainhand: 'Main Hand',
  offhand: 'Off Hand',
  trinket: 'Trinket',
};

/** Classic bordered slot with a quality-tinted border and stack count. */
function Slot({
  stack,
  index,
  selected,
  onPress,
  onHover,
  size = CELL,
  dimmed = false,
}: {
  stack: ItemStack | null;
  index: number;
  selected?: boolean;
  onPress?: () => void;
  onHover?: (index: number | null) => void;
  size?: number;
  dimmed?: boolean;
}) {
  const def = stack ? itemById(stack.itemId) : undefined;
  const qColor = def ? qualityColor[def.quality] : palette.gold[700];
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => onHover?.(index)}
      onHoverOut={() => onHover?.(null)}
      accessibilityRole="button"
      accessibilityLabel={def ? `${def.name} x${stack?.qty ?? 1}` : `Empty slot ${index + 1}`}
      testID={`inv-slot-${index}`}
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: selected ? palette.gold[200] : def ? qColor : 'rgba(120,96,50,0.5)',
        opacity: dimmed ? 0.5 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {def ? (
        <>
          <SpellIcon glyph={(def.icon as GlyphId) ?? 'scroll'} tint={qColor} size={size - 8} />
          {(stack?.qty ?? 1) > 1 && (
            <Text
              style={{
                position: 'absolute',
                right: 2,
                bottom: 0,
                color: '#fff',
                fontFamily: 'Alegreya_700Bold',
                fontSize: 10,
                textShadowColor: '#000',
                textShadowRadius: 2,
              }}
            >
              {stack!.qty}
            </Text>
          )}
        </>
      ) : null}
    </Pressable>
  );
}

/** Rich item tooltip: name, slot, stats, flavour, sell price. */
export function ItemTooltip({ item, equipped }: { item: ItemDef; equipped?: boolean }) {
  const q = qualityColor[item.quality];
  const stats: string[] = [];
  if (item.stats.attack) stats.push(`+${item.stats.attack} Attack Power`);
  if (item.stats.armor) stats.push(`+${item.stats.armor} Armor`);
  if (item.stats.hp) stats.push(`+${item.stats.hp} Health`);
  if (item.stats.resource) stats.push(`+${item.stats.resource} Mana`);
  if (item.stats.spellPower) stats.push(`+${item.stats.spellPower} Spell Power`);
  if (item.stats.healing) stats.push(`+${item.stats.healing} Healing`);
  return (
    <View
      style={{
        maxWidth: 214,
        backgroundColor: 'rgba(9,7,5,0.97)',
        borderWidth: 2,
        borderColor: q,
        borderRadius: 5,
        padding: 8,
      }}
      testID="item-tooltip"
    >
      <Text style={{ color: q, fontFamily: 'Cinzel_700Bold', fontSize: 12 }}>{item.name}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
        <Text style={{ color: palette.parchment[400], fontFamily: 'Alegreya_400Regular', fontSize: 10 }}>
          {item.kind === 'weapon' || item.kind === 'armor' ? SLOT_LABEL[item.slot ?? 'chest'] : item.kind}
        </Text>
        <Text style={{ color: palette.parchment[500], fontFamily: 'Alegreya_400Regular', fontSize: 10 }}>
          iLvl {item.ilvl}
        </Text>
      </View>
      {equipped ? (
        <Text style={{ color: '#8ef08e', fontSize: 9.5, fontFamily: 'Alegreya_600SemiBold' }}>Equipped</Text>
      ) : null}
      <Divider style={{ marginVertical: 4 }} />
      {stats.length > 0 ? (
        stats.map((s) => (
          <Text key={s} style={{ color: '#7bf07b', fontFamily: 'Alegreya_500Medium', fontSize: 10.5 }}>
            {s}
          </Text>
        ))
      ) : (
        <Text style={{ color: palette.parchment[500], fontFamily: 'Alegreya_400Regular', fontSize: 10 }}>
          {item.kind === 'material' ? 'Tradeskill material' : 'No combat stats'}
        </Text>
      )}
      {item.flavor ? (
        <Text
          style={{
            color: palette.gold[300],
            fontFamily: 'Alegreya_400Regular_Italic',
            fontSize: 9.5,
            marginTop: 4,
            lineHeight: 13,
          }}
        >
          {item.flavor}
        </Text>
      ) : null}
      <Divider style={{ marginVertical: 4 }} />
      <Text style={{ color: palette.parchment[400], fontFamily: 'Alegreya_400Regular', fontSize: 9.5 }}>
        Sell price: {item.sellPrice > 0 ? `${item.sellPrice} copper` : '—'}
      </Text>
    </View>
  );
}

/** The character sheet: equipment slots on the left, bag grid on the right. */
export function InventoryPanel({
  slots,
  equipment,
  onClose,
  onEquip,
  onMove,
  onUse,
  selected,
  onSelect,
  onHover,
  hovered,
}: {
  slots: Array<ItemStack | null>;
  equipment: Equipment;
  onClose: () => void;
  onEquip: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onUse: (index: number) => void;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onHover: (index: number | null) => void;
  hovered: number | null;
}) {
  const hoveredItem = hovered !== null && slots[hovered] ? itemById(slots[hovered]!.itemId) : undefined;
  const selectedItem = selected !== null && slots[selected] ? itemById(slots[selected]!.itemId) : undefined;
  const tooltipItem = hoveredItem ?? selectedItem;

  return (
    <View style={styles.backdrop}>
      <Frame
        radius={12}
        style={{ width: '95%', maxWidth: 380 }}
        contentStyle={{ padding: 10 }}
        accent={palette.gold[500]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: palette.gold[200], fontFamily: 'Cinzel_700Bold', fontSize: 14, letterSpacing: 1.4 }}>
            ADVENTURER'S PACK
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close inventory">
            <GoldPlate tone="iron" style={{ width: 44, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Outlined size={9} color={palette.gold[200]} font="Cinzel_700Bold">
                CLOSE
              </Outlined>
            </GoldPlate>
          </Pressable>
        </View>
        <Divider style={{ marginVertical: 6 }} />

        {/* Equipment row */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {(Object.keys(SLOT_LABEL) as ItemSlot[]).slice(0, 4).map((slot) => {
            const itemId = equipment[slot];
            const def = itemId ? itemById(itemId) : undefined;
            return (
              <View key={slot} style={{ alignItems: 'center', flex: 1 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${SLOT_LABEL[slot]} slot${def ? `, ${def.name}` : ', empty'}`}
                  onPress={() => {}}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: def ? qualityColor[def.quality] : 'rgba(120,96,50,0.5)',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {def ? <SpellIcon glyph={def.icon as GlyphId} tint={qualityColor[def.quality]} size={30} /> : null}
                </Pressable>
                <Text style={{ color: palette.parchment[500], fontSize: 7.5, fontFamily: 'Alegreya_500Medium', marginTop: 1 }}>
                  {SLOT_LABEL[slot].toUpperCase()}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Bag grid */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Outlined size={8.5} color={palette.gold[300]} font="Cinzel_700Bold">
                BAG
              </Outlined>
              <Outlined size={8.5} color={palette.parchment[400]}>
                {slots.filter(Boolean).length}/{slots.length}
              </Outlined>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {slots.map((stack, i) => (
                <Slot
                  key={i}
                  index={i}
                  stack={stack}
                  selected={selected === i}
                  onPress={() => {
                    // Tap always selects so the details rail shows the item;
                    // a second tap on the selected item performs its action.
                    if (selected !== null && selected !== i) {
                      const src = slots[selected];
                      const dst = slots[i];
                      // Only move when the bag slots differ in item; otherwise act.
                      if (src && dst && src.itemId !== dst.itemId) onMove(selected, i);
                      else onSelect(i);
                      return;
                    }
                    if (selected === i && stack) {
                      const def = itemById(stack.itemId);
                      if (def?.kind === 'consumable') onUse(i);
                      else if (def?.slot) onEquip(i);
                      return;
                    }
                    onSelect(stack ? i : null);
                  }}
                  onHover={onHover}
                />
              ))}
            </View>
          </View>

          {/* Tooltip rail */}
          <View style={{ width: 126 }}>
            <Outlined size={8.5} color={palette.gold[300]} font="Cinzel_700Bold" style={{ marginBottom: 3 }}>
              DETAILS
            </Outlined>
            {tooltipItem ? (
              <ScrollView style={{ maxHeight: 250 }}>
                <ItemTooltip item={tooltipItem} />
              </ScrollView>
            ) : (
              <Outlined size={9} color={palette.parchment[500]}>
                Tap an item to inspect or equip it.
              </Outlined>
            )}
          </View>
        </View>

        <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
          <Text style={{ color: palette.parchment[400], fontSize: 9, fontFamily: 'Alegreya_400Regular', flex: 1 }}>
            Consumables are used on tap. Drag is emulated: tap one item, then tap a destination slot.
          </Text>
        </View>
      </Frame>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,4,3,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
});

export { BAG_ROWS };
