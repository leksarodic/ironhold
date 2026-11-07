import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { CLASSES } from '@/game/classes';
import type { Combatant, Projectile, Vec2 } from '@/engine/types';
import { WORLD } from '@/engine/world';
import { hashString, Rng } from '@/engine/rng';
import { palette } from '@/theme/tokens';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface Decoration {
  kind: 'tree' | 'rock' | 'bush' | 'ruin' | 'flower';
  x: number;
  y: number;
  s: number;
  r: number;
}

/** Deterministic scatter of world decoration; generated once per seed. */
function buildDecorations(seed: number): Decoration[] {
  const rng = new Rng(seed ^ 0x5eed);
  const out: Decoration[] = [];
  for (let i = 0; i < 150; i++) {
    const x = rng.range(2, WORLD.width - 2);
    const y = rng.range(2, WORLD.height - 2);
    // Keep the spawn clearing around world center open.
    if (Math.hypot(x - WORLD.center.x, y - WORLD.center.y) < 7) continue;
    const roll = rng.next();
    const kind: Decoration['kind'] =
      roll < 0.4 ? 'tree' : roll < 0.62 ? 'rock' : roll < 0.85 ? 'bush' : roll < 0.94 ? 'flower' : 'ruin';
    out.push({ kind, x, y, s: rng.range(0.7, 1.35), r: rng.range(0, Math.PI * 2) });
  }
  // Sorting by y gives correct depth ordering for a 3/4 view.
  return out.sort((a, b) => a.y - b.y);
}

function Tree({ x, y, s }: { x: number; y: number; s: number }) {
  // Heights are in world units: a tree stands roughly 3-4 body widths tall.
  const h = 3.2 * s;
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={0.85 * s} ry={0.3 * s} fill="#000" opacity={0.35} />
      <Rect x={x - 0.14 * s} y={y - h * 0.36} width={0.28 * s} height={h * 0.38} fill="#3a2a1c" />
      <Path d={`M${x} ${y - h} L${x + 0.75 * s} ${y - h * 0.36} L${x - 0.75 * s} ${y - h * 0.36} Z`} fill="#22361f" />
      <Path d={`M${x} ${y - h * 0.86} L${x + 0.92 * s} ${y - h * 0.24} L${x - 0.92 * s} ${y - h * 0.24} Z`} fill="#2c4627" />
      <Path d={`M${x} ${y - h * 0.62} L${x + 0.7 * s} ${y - h * 0.5} L${x} ${y - h * 0.42} Z`} fill="#3a5a33" opacity={0.9} />
    </G>
  );
}

function Rock({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={0.75 * s} ry={0.26 * s} fill="#000" opacity={0.3} />
      <Path d={`M${x - 0.7 * s} ${y} L${x - 0.44 * s} ${y - 0.66 * s} L${x + 0.18 * s} ${y - 0.82 * s} L${x + 0.7 * s} ${y - 0.26 * s} L${x + 0.52 * s} ${y} Z`} fill="#4a4540" />
      <Path d={`M${x - 0.44 * s} ${y - 0.66 * s} L${x + 0.18 * s} ${y - 0.82 * s} L${x + 0.26 * s} ${y - 0.4 * s} Z`} fill="#615a52" />
    </G>
  );
}

function Bush({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G opacity={0.92}>
      <Ellipse cx={x} cy={y} rx={0.62 * s} ry={0.26 * s} fill="#000" opacity={0.25} />
      <Circle cx={x - 0.34 * s} cy={y - 0.26 * s} r={0.38 * s} fill="#2a3f24" />
      <Circle cx={x + 0.26 * s} cy={y - 0.34 * s} r={0.43 * s} fill="#31502a" />
      <Circle cx={x} cy={y - 0.52 * s} r={0.36 * s} fill="#3b5f31" />
    </G>
  );
}

function Flower({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G>
      <Circle cx={x} cy={y - 0.16 * s} r={0.14 * s} fill="#c9a24a" opacity={0.85} />
      <Circle cx={x + 0.26 * s} cy={y} r={0.1 * s} fill="#8a6b3a" opacity={0.7} />
    </G>
  );
}

function Ruin({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={1.15 * s} ry={0.4 * s} fill="#000" opacity={0.3} />
      <Rect x={x - 0.95 * s} y={y - 1.4 * s} width={0.5 * s} height={1.4 * s} fill="#514a40" />
      <Rect x={x + 0.18 * s} y={y - 0.95 * s} width={0.6 * s} height={0.95 * s} fill="#463f36" />
      <Rect x={x - 1.15 * s} y={y - 0.34 * s} width={2.3 * s} height={0.34 * s} fill="#3b352d" />
      <Rect x={x - 0.95 * s} y={y - 1.4 * s} width={0.18 * s} height={1.4 * s} fill="#6b6357" opacity={0.55} />
    </G>
  );
}

/** Player actor drawn as a stylised low-poly hero. */
function PlayerSprite({ c, selected }: { c: Combatant; selected: boolean }) {
  const def = c.classId ? CLASSES[c.classId] : null;
  const dx = c.facing.x;
  const dy = c.facing.y;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const primary = def?.primaryColor ?? '#556';
  const accent = def?.accentColor ?? '#ccc';
  const flash = (c.hitFlash ?? 0) > 0.15;
  return (
    <G opacity={c.alive ? 1 : 0.3}>
      <Ellipse cx={c.pos.x} cy={c.pos.y + 0.28} rx={0.62} ry={0.24} fill="#000" opacity={0.4} />
      {selected && (
        <Ellipse
          cx={c.pos.x}
          cy={c.pos.y + 0.3}
          rx={0.85}
          ry={0.35}
          fill="none"
          stroke={palette.gold[300]}
          strokeWidth={0.06}
          opacity={0.9}
        />
      )}
      {/* Cloak */}
      <Path
        d={`M${c.pos.x - 0.42} ${c.pos.y + 0.16} Q${c.pos.x} ${c.pos.y - 0.15} ${c.pos.x + 0.42} ${c.pos.y + 0.16} L${c.pos.x + 0.3} ${c.pos.y + 0.34} L${c.pos.x - 0.3} ${c.pos.y + 0.34} Z`}
        fill={primary}
      />
      {/* Body */}
      <Ellipse cx={c.pos.x} cy={c.pos.y - 0.02} rx={0.3} ry={0.4} fill={flash ? '#fff' : primary} />
      <Ellipse cx={c.pos.x} cy={c.pos.y - 0.04} rx={0.2} ry={0.26} fill={accent} opacity={0.45} />
      {/* Head */}
      <Circle cx={c.pos.x} cy={c.pos.y - 0.5} r={0.22} fill={flash ? '#fff' : '#d9b48f'} />
      {/* Weapon oriented by facing */}
      <G transform={`rotate(${ang} ${c.pos.x} ${c.pos.y})`}>
        <Rect x={c.pos.x + 0.26} y={c.pos.y - 0.06} width={0.5} height={0.1} rx={0.03} fill={palette.parchment[500]} />
        <Rect x={c.pos.x + 0.7} y={c.pos.y - 0.05} width={0.16} height={0.08} fill={palette.gold[300]} />
      </G>
      {/* Nameplate */}
      <SvgText
        x={c.pos.x}
        y={c.pos.y - 0.92}
        fontSize={0.42}
        fill={palette.gold[200]}
        textAnchor="middle"
        fontFamily="Cinzel_700Bold"
        stroke="#000"
        strokeWidth={0.05}
        opacity={0.95}
      >
        {c.name}
      </SvgText>
    </G>
  );
}

/** Enemy actor: silhouette varies by type, red nameplate. */
function EnemySprite({ c, aggroed }: { c: Combatant; aggroed: boolean }) {
  const t = c.enemyType ?? 'boar';
  const flash = (c.hitFlash ?? 0) > 0.15;
  const body = flash ? '#ffffff' : t === 'wolf' ? '#5c5a58' : t === 'ogre' ? '#6d7a45' : t === 'kobold' ? '#8a7f6a' : '#7a5a3a';
  return (
    <G opacity={c.alive ? 1 : 0.18}>
      <Ellipse cx={c.pos.x} cy={c.pos.y + 0.22} rx={0.55} ry={0.2} fill="#000" opacity={0.38} />
      {t === 'ogre' ? (
        <>
          <Ellipse cx={c.pos.x} cy={c.pos.y - 0.1} rx={0.55} ry={0.6} fill={body} />
          <Circle cx={c.pos.x} cy={c.pos.y - 0.78} r={0.32} fill={flash ? '#fff' : '#8f9c60'} />
          <Rect x={c.pos.x - 0.5} y={c.pos.y - 0.5} width={0.2} height={0.6} rx={0.09} fill={body} />
          <Rect x={c.pos.x + 0.3} y={c.pos.y - 0.5} width={0.2} height={0.6} rx={0.09} fill={body} />
          <Rect x={c.pos.x + 0.35} y={c.pos.y - 0.9} width={0.16} height={0.9} fill="#4a3a28" />
        </>
      ) : t === 'wolf' ? (
        <>
          <Ellipse cx={c.pos.x} cy={c.pos.y - 0.05} rx={0.44} ry={0.26} fill={body} />
          <Circle cx={c.pos.x - 0.38} cy={c.pos.y - 0.2} r={0.2} fill={body} />
          <Path d={`M${c.pos.x - 0.5} ${c.pos.y - 0.34} L${c.pos.x - 0.44} ${c.pos.y - 0.48} L${c.pos.x - 0.38} ${c.pos.y - 0.32} Z`} fill="#3b3a38" />
          <Path d={`M${c.pos.x + 0.42} ${c.pos.y - 0.12} L${c.pos.x + 0.66} ${c.pos.y - 0.32} L${c.pos.x + 0.5} ${c.pos.y + 0.04} Z`} fill="#4a4846" />
          <Circle cx={c.pos.x - 0.46} cy={c.pos.y - 0.22} r={0.04} fill="#ff3b30" />
        </>
      ) : t === 'kobold' ? (
        <>
          <Ellipse cx={c.pos.x} cy={c.pos.y - 0.06} rx={0.26} ry={0.32} fill={body} />
          <Circle cx={c.pos.x} cy={c.pos.y - 0.44} r={0.18} fill={flash ? '#fff' : '#9c907a'} />
          <Path d={`M${c.pos.x - 0.12} ${c.pos.y - 0.56} L${c.pos.x - 0.2} ${c.pos.y - 0.72} L${c.pos.x - 0.02} ${c.pos.y - 0.58} Z`} fill="#c8a94a" />
          <Path d={`M${c.pos.x + 0.12} ${c.pos.y - 0.56} L${c.pos.x + 0.2} ${c.pos.y - 0.72} L${c.pos.x + 0.02} ${c.pos.y - 0.58} Z`} fill="#c8a94a" />
          <Rect x={c.pos.x + 0.18} y={c.pos.y - 0.24} width={0.34} height={0.08} fill="#6b5a42" />
        </>
      ) : (
        <>
          <Ellipse cx={c.pos.x} cy={c.pos.y - 0.04} rx={0.42} ry={0.3} fill={body} />
          <Circle cx={c.pos.x - 0.34} cy={c.pos.y - 0.16} r={0.18} fill={flash ? '#fff' : '#8e6a48'} />
          <Path d={`M${c.pos.x - 0.5} ${c.pos.y - 0.24} L${c.pos.x - 0.6} ${c.pos.y - 0.06} L${c.pos.x - 0.46} ${c.pos.y - 0.1} Z`} fill="#f0e2c0" />
          <Rect x={c.pos.x + 0.3} y={c.pos.y - 0.3} width={0.12} height={0.3} fill={body} />
        </>
      )}
      {aggroed && (
        <G>
          <SvgText x={c.pos.x} y={c.pos.y - 1.0} fontSize={0.5} fill="#ff5a4a" textAnchor="middle" fontFamily="Alegreya_700Bold">
            !
          </SvgText>
        </G>
      )}
      {/* Enemy health bar */}
      <Rect x={c.pos.x - 0.5} y={c.pos.y - 0.82} width={1.0} height={0.11} fill="#1a0c0a" stroke="#000" strokeWidth={0.02} />
      <Rect
        x={c.pos.x - 0.49}
        y={c.pos.y - 0.815}
        width={0.98 * Math.max(0, c.hp / c.maxHp)}
        height={0.09}
        fill="#9e2b25"
      />
      <SvgText x={c.pos.x} y={c.pos.y - 0.9} fontSize={0.34} fill="#d9c9a8" textAnchor="middle" fontFamily="Alegreya_400Regular" stroke="#000" strokeWidth={0.03}>
        {c.name}
      </SvgText>
    </G>
  );
}

export function WorldRenderer({
  combatants,
  camera,
  seed,
  projectiles = [],
  targetId,
  localPlayerId,
  showGrid = true,
}: {
  combatants: Combatant[];
  camera: Camera;
  seed: number;
  projectiles?: Projectile[];
  targetId?: string | null;
  localPlayerId?: string;
  showGrid?: boolean;
}) {
  const decorations = useMemo(() => buildDecorations(seed), [seed]);
  const viewW = 100 / camera.zoom;
  const halfW = viewW / 2;
  const viewH = viewW * 1.9;
  const halfH = viewH / 2;

  const visible = combatants.filter(
    (c) => Math.abs(c.pos.x - camera.x) < halfW + 1.5 && Math.abs(c.pos.y - camera.y) < halfH + 1.5,
  );
  const players = visible.filter((c) => c.kind === 'player');
  const enemies = visible.filter((c) => c.kind === 'enemy');
  const actors = [...enemies, ...players].sort((a, b) => a.pos.y - b.pos.y);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`${camera.x - halfW} ${camera.y - halfH} ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <RadialGradient id="groundGlow" cx="50%" cy="45%" r="70%">
          <Stop offset="0" stopColor="#3c3220" stopOpacity="1" />
          <Stop offset="1" stopColor="#171208" stopOpacity="1" />
        </RadialGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2a4a52" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#152e38" stopOpacity="0.95" />
        </LinearGradient>
        <RadialGradient id="vignette" cx="50%" cy="50%" r="55%">
          <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.65" />
        </RadialGradient>
      </Defs>
      <Rect x={camera.x - halfW} y={camera.y - halfH} width={viewW} height={viewH} fill="url(#groundGlow)" />

      {/* Terrain patches */}
      <G opacity={0.85}>
        <Path d="M6 6 H26 V18 H6 Z" fill="#2f3a1e" opacity={0.35} />
        <Path d="M40 30 H60 V42 H40 Z" fill="#2b3220" opacity={0.3} />
        <Path d="M10 28 H22 V40 H10 Z" fill="#33401f" opacity={0.28} />
      </G>
      {/* Dirt path */}
      <Path
        d="M8 22 Q20 20 30 22 T56 20"
        stroke="#4a3b26"
        strokeWidth={0.55}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      {/* World border */}
      <Rect
        x={0.5}
        y={0.5}
        width={WORLD.width - 1}
        height={WORLD.height - 1}
        fill="none"
        stroke="#5a4626"
        strokeWidth={0.3}
        opacity={0.5}
      />

      {showGrid && (
        <G opacity={0.06}>
          {Array.from({ length: 17 }).map((_, i) => (
            <Line key={`v${i}`} x1={i * 4} y1={0} x2={i * 4} y2={WORLD.height} stroke="#e8c66a" strokeWidth={0.04} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * 4} x2={WORLD.width} y2={i * 4} stroke="#e8c66a" strokeWidth={0.04} />
          ))}
        </G>
      )}

      {/* Decorations behind actors */}
      {decorations
        .filter((d) => d.y < camera.y)
        .map((d, i) => (
          <DecorationView key={`b${i}`} d={d} />
        ))}

      {actors.map((c) =>
        c.kind === 'player' ? (
          <PlayerSprite key={c.id} c={c} selected={c.id === localPlayerId} />
        ) : (
          <EnemySprite key={c.id} c={c} aggroed={!!c.targetId} />
        ),
      )}

      {/* Decorations in front of actors */}
      {decorations
        .filter((d) => d.y >= camera.y)
        .map((d, i) => (
          <DecorationView key={`f${i}`} d={d} />
        ))}

      {/* Projectiles */}
      {projectiles.map((p) => {
        const x = p.from.x + (p.to.x - p.from.x) * p.t;
        const y = p.from.y + (p.to.y - p.from.y) * p.t;
        return (
          <G key={p.id}>
            <Circle cx={x} cy={y} r={0.5} fill={p.color} opacity={0.22} />
            <Circle cx={x} cy={y} r={0.22} fill={p.color} />
            <Circle cx={x} cy={y} r={0.1} fill="#fff8e0" />
          </G>
        );
      })}

      {targetId &&
        (() => {
          const t = combatants.find((c) => c.id === targetId);
          if (!t) return null;
          return (
            <G>
              <Ellipse
                cx={t.pos.x}
                cy={t.pos.y + 0.26}
                rx={0.75}
                ry={0.3}
                fill="none"
                stroke="#ff4b3e"
                strokeWidth={0.06}
                strokeDasharray="0.18 0.12"
                opacity={0.95}
              />
            </G>
          );
        })()}

      <Rect x={camera.x - halfW} y={camera.y - halfH} width={viewW} height={viewH} fill="url(#vignette)" pointerEvents="none" />
    </Svg>
  );
}

function DecorationView({ d }: { d: Decoration }) {
  switch (d.kind) {
    case 'tree':
      return <Tree x={d.x} y={d.y} s={d.s} />;
    case 'rock':
      return <Rock x={d.x} y={d.y} s={d.s} />;
    case 'bush':
      return <Bush x={d.x} y={d.y} s={d.s} />;
    case 'flower':
      return <Flower x={d.x} y={d.y} s={d.s} />;
    case 'ruin':
      return <Ruin x={d.x} y={d.y} s={d.s} />;
  }
}

export const worldSeedHash = hashString;
