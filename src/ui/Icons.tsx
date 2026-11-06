import React from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { palette } from '@/theme/tokens';

export type GlyphId =
  | 'sword'
  | 'wave'
  | 'shout'
  | 'fireball'
  | 'frost'
  | 'ward'
  | 'smite'
  | 'heal'
  | 'shield'
  | 'skull'
  | 'boot'
  | 'bag'
  | 'scroll'
  | 'crown';

const VB = 100;

/** Glyph geometry authored in a 100x100 view box so it scales to any badge size. */
function Glyph({ id, color }: { id: GlyphId; color: string }) {
  const ink = 'rgba(0,0,0,0.35)';
  switch (id) {
    case 'sword':
      return (
        <G>
          <Path d="M50 12 L60 34 L56 64 L44 64 L40 34 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Path d="M50 14 L55 34 L53 60 L47 60 L45 34 Z" fill="rgba(255,255,255,0.55)" />
          <Rect x={26} y={63} width={48} height={7} rx={3} fill={palette.gold[300]} stroke={ink} strokeWidth={1.2} />
          <Rect x={46} y={69} width={8} height={17} rx={3} fill={palette.parchment[700]} />
          <Circle cx={50} cy={90} r={5.5} fill={palette.gold[300]} stroke={ink} strokeWidth={1.2} />
        </G>
      );
    case 'wave':
      return (
        <G>
          {[0, 1, 2].map((i) => (
            <Path
              key={i}
              d={`M22 ${40 + i * 14} Q36 ${28 + i * 14} 50 ${40 + i * 14} T78 ${40 + i * 14}`}
              stroke={color}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
              opacity={1 - i * 0.22}
            />
          ))}
        </G>
      );
    case 'shout':
      return (
        <G>
          <Path d="M30 34 L44 34 L58 22 L58 78 L44 66 L30 66 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Path d="M64 34 Q76 50 64 66" stroke={palette.gold[200]} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M74 26 Q92 50 74 74" stroke={palette.gold[200]} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
        </G>
      );
    case 'fireball':
      return (
        <G>
          <Circle cx={50} cy={54} r={24} fill={color} />
          <Circle cx={50} cy={54} r={16} fill="#ffd88a" opacity={0.85} />
          <Circle cx={44} cy={48} r={8} fill="#fff6db" opacity={0.9} />
          <Path d="M50 4 Q62 22 50 38 Q38 22 50 4 Z" fill="#ff6a1f" opacity={0.9} />
          <Path d="M22 26 Q34 38 26 50 Q16 38 22 26 Z" fill="#ff8a3d" opacity={0.6} />
        </G>
      );
    case 'frost':
      return (
        <G stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
          {[0, 60, 120].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 50 50)`}>
              <Path d="M50 14 L50 86" />
              <Path d="M50 24 L40 34 M50 24 L60 34" />
              <Path d="M50 76 L40 66 M50 76 L60 66" />
            </G>
          ))}
          <Circle cx={50} cy={50} r={7} fill="#eafcff" stroke="none" />
        </G>
      );
    case 'ward':
      return (
        <G>
          <Path d="M50 16 L80 28 L80 52 Q80 76 50 88 Q20 76 20 52 L20 28 Z" fill={color} opacity={0.35} stroke={color} strokeWidth={3} />
          <Path d="M50 26 L72 34 L72 52 Q72 70 50 79 Q28 70 28 52 L28 34 Z" fill="none" stroke="#e8d9ff" strokeWidth={2} opacity={0.8} />
          <Circle cx={50} cy={52} r={9} fill="#f2e9ff" />
        </G>
      );
    case 'smite':
      return (
        <G>
          <Path d="M50 8 L58 40 L90 48 L58 56 L50 88 L42 56 L10 48 L42 40 Z" fill={color} />
          <Path d="M50 26 L54 44 L72 48 L54 52 L50 70 L46 52 L28 48 L46 44 Z" fill="#fffbe8" />
        </G>
      );
    case 'heal':
      return (
        <G>
          <Path
            d="M50 86 L22 58 Q8 44 22 32 Q36 20 50 36 Q64 20 78 32 Q92 44 78 58 Z"
            fill={color}
            stroke={ink}
            strokeWidth={1.5}
          />
          <Path d="M50 74 L30 54 Q22 45 30 39 Q38 33 50 45 Z" fill="rgba(255,255,255,0.55)" />
          <Path d="M12 20 L16 30 L26 34 L16 38 L12 48 L8 38 L-2 34 L8 30 Z" fill="#fff8dc" opacity={0.85} />
        </G>
      );
    case 'shield':
      return (
        <G>
          <Path d="M50 12 L84 26 L84 52 Q84 78 50 90 Q16 78 16 52 L16 26 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Path d="M50 22 L74 32 L74 51 Q74 70 50 79 Q26 70 26 51 L26 32 Z" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={3} />
          <Path d="M50 34 L54 48 L68 48 L57 57 L61 71 L50 62 L39 71 L43 57 L32 48 L46 48 Z" fill="rgba(255,255,255,0.75)" />
        </G>
      );
    case 'skull':
      return (
        <G>
          <Path d="M50 12 Q80 12 82 44 Q83 58 72 64 L72 80 L28 80 L28 64 Q17 58 18 44 Q20 12 50 12 Z" fill={color} />
          <Ellipse cx={36} cy={46} rx={8} ry={9} fill="#14100c" />
          <Ellipse cx={64} cy={46} rx={8} ry={9} fill="#14100c" />
          <Path d="M50 56 L44 68 L56 68 Z" fill="#14100c" />
          <Rect x={38} y={72} width={6} height={12} fill="#14100c" opacity={0.6} />
          <Rect x={50} y={72} width={6} height={12} fill="#14100c" opacity={0.6} />
        </G>
      );
    case 'boot':
      return (
        <G>
          <Path d="M34 16 L58 16 L58 56 Q58 64 70 68 L80 71 Q86 73 84 82 L34 82 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Path d="M34 74 L84 74" stroke="rgba(255,255,255,0.5)" strokeWidth={3} />
          <Path d="M38 24 L54 24 M38 32 L54 32" stroke="rgba(0,0,0,0.3)" strokeWidth={3} strokeLinecap="round" />
        </G>
      );
    case 'bag':
      return (
        <G>
          <Path d="M36 26 Q36 14 50 14 Q64 14 64 26" stroke={palette.parchment[600]} strokeWidth={6} fill="none" />
          <Path d="M24 30 L76 30 Q84 30 84 40 L82 84 Q82 90 74 90 L26 90 Q18 90 18 84 L16 40 Q16 30 24 30 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Path d="M24 44 L76 44" stroke="rgba(0,0,0,0.3)" strokeWidth={3} />
          <Rect x={42} y={38} width={16} height={12} rx={3} fill={palette.gold[300]} />
        </G>
      );
    case 'scroll':
      return (
        <G>
          <Rect x={24} y={18} width={52} height={64} rx={4} fill={palette.parchment[100]} />
          <Rect x={20} y={12} width={60} height={12} rx={6} fill={palette.parchment[400]} />
          <Rect x={20} y={76} width={60} height={12} rx={6} fill={palette.parchment[400]} />
          <Path d="M34 36 L66 36 M34 48 L66 48 M34 60 L54 60" stroke={palette.inkSoft} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M18 68 L24 30 L40 46 L50 22 L60 46 L76 30 L82 68 Z" fill={color} stroke={ink} strokeWidth={1.5} />
          <Rect x={18} y={70} width={64} height={12} rx={4} fill={palette.gold[400]} />
          <Circle cx={50} cy={76} r={4} fill="#b5322a" />
        </G>
      );
    default:
      return null;
  }
}

/**
 * A square ability/item icon with the classic radial gradient bed and gold frame.
 */
export function SpellIcon({
  glyph,
  tint,
  size = 52,
  dim = false,
  desaturated = false,
}: {
  glyph: GlyphId;
  tint: string;
  size?: number;
  dim?: boolean;
  desaturated?: boolean;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(3, size * 0.1),
        overflow: 'hidden',
        opacity: desaturated ? 0.45 : 1,
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <Defs>
          <RadialGradient id={`bed${id}`} cx="50%" cy="42%" r="70%">
            <Stop offset="0" stopColor={tint} stopOpacity="0.95" />
            <Stop offset="0.55" stopColor={tint} stopOpacity="0.45" />
            <Stop offset="1" stopColor="#0b0806" stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id={`gloss${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={VB} height={VB} fill={`url(#bed${id})`} />
        <Rect x={0} y={0} width={VB} height={VB} fill={`url(#gloss${id})`} />
        <G opacity={dim ? 0.5 : 1}>
          <Glyph id={glyph} color={tint} />
        </G>
        <Rect x={1.5} y={1.5} width={VB - 3} height={VB - 3} rx={6} fill="none" stroke={palette.gold[500]} strokeWidth={3} opacity={0.85} />
      </Svg>
    </View>
  );
}

/** Circular portrait medallion with a class-tinted bed. */
export function Portrait({
  glyph,
  tint,
  size = 56,
  ring = palette.gold[400],
}: {
  glyph: GlyphId;
  tint: string;
  size?: number;
  ring?: string;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <Defs>
          <RadialGradient id="pbg" cx="50%" cy="35%" r="75%">
            <Stop offset="0" stopColor={tint} stopOpacity="0.9" />
            <Stop offset="0.65" stopColor={tint} stopOpacity="0.28" />
            <Stop offset="1" stopColor="#0a0704" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill="url(#pbg)" />
        <G transform="translate(50 52) scale(0.74) translate(-50 -50)">
          <Glyph id={glyph} color={palette.parchment[100]} />
        </G>
        <Circle cx={50} cy={50} r={46} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={5} />
        <Circle cx={50} cy={50} r={47} fill="none" stroke={ring} strokeWidth={4} />
      </Svg>
    </View>
  );
}

/** Small metallic frame used for inventory slots and buffs. */
export function SlotFrame({
  size,
  active = false,
  empty = false,
}: {
  size: number;
  active?: boolean;
  empty?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: Math.max(3, size * 0.1),
        borderWidth: 2,
        borderColor: active ? palette.gold[200] : palette.gold[600],
        backgroundColor: empty ? 'rgba(0,0,0,0.45)' : 'transparent',
      }}
    />
  );
}
