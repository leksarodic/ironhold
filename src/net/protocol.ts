import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

/**
 * Wire protocol.
 *
 * Room codes carry a compressed SDP blob. SDP for a single data channel is
 * ~1.2 kB of highly repetitive text, so deflate plus base32 gets it down to
 * roughly 400 characters — short enough to paste into a chat message.
 */

export const PROTOCOL_VERSION = 1;

export type MessageType =
  | 'hello'
  | 'welcome'
  | 'state'
  | 'input'
  | 'cast'
  | 'damage'
  | 'spawn'
  | 'loot_drop'
  | 'loot_claim'
  | 'inventory'
  | 'chat'
  | 'ping'
  | 'pong'
  | 'ice'
  | 'bye';

export interface PeerIdentity {
  peerId: string;
  name: string;
  classId: 'warrior' | 'mage' | 'priest';
  level: number;
}

export interface WorldStatePayload {
  /** Simulation clock on the host, ms. */
  t: number;
  players: Array<{
    id: string;
    name: string;
    classId: 'warrior' | 'mage' | 'priest';
    x: number;
    y: number;
    fx: number;
    fy: number;
    hp: number;
    maxHp: number;
    res: number;
    maxRes: number;
    lvl: number;
    alive: boolean;
    buffs: Array<{ id: string; r: number; d: number }>;
  }>;
  enemies: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    fx: number;
    fy: number;
    hp: number;
    maxHp: number;
    lvl: number;
    alive: boolean;
    target: string | null;
  }>;
}

export interface Envelope<T = unknown> {
  v: number;
  type: MessageType;
  from: string;
  seq: number;
  ts: number;
  payload: T;
}

export interface HelloPayload extends PeerIdentity {
  seed: number;
  hostPeerId: string;
}

export interface WelcomePayload {
  peerId: string;
  /** Roster of everybody already in the session. */
  peers: PeerIdentity[];
  seed: number;
  hostPeerId: string;
}

export interface InputPayload {
  /** Movement axis, -1..1. */
  mx: number;
  my: number;
  /** Facing angle in radians. */
  facing: number;
  sprint: boolean;
  /** Client simulation time, used for interpolation. */
  t: number;
}

export interface CastPayload {
  abilityId: string;
  x: number;
  y: number;
  targetId: string | null;
  t: number;
}

export interface DamagePayload {
  targetId: string;
  amount: number;
  abilityId: string;
  sourceId: string;
  t: number;
}

export interface LootDropPayload {
  lootId: string;
  itemId: string;
  qty: number;
  quality: number;
  x: number;
  y: number;
  ownerId: string | null;
}

export interface LootClaimPayload {
  lootId: string;
  playerId: string;
  t: number;
}

export interface IcePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface ChatPayload {
  text: string;
}

let seqCounter = 0;

export function makeEnvelope<T>(type: MessageType, from: string, payload: T): Envelope<T> {
  return {
    v: PROTOCOL_VERSION,
    type,
    from,
    seq: ++seqCounter,
    ts: Date.now(),
    payload,
  };
}

/** Compact JSON: short keys keep state packets small on the radio. */
export function encodeMessage(env: Envelope): string {
  return JSON.stringify(env);
}

export function decodeMessage(raw: string): Envelope | null {
  try {
    const parsed = JSON.parse(raw) as Envelope;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== PROTOCOL_VERSION) return null;
    if (typeof parsed.type !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Room codes: SDP <-> compact base32 string
// ---------------------------------------------------------------------------

/**
 * base64url (A-Z a-z 0-9 - _). Chosen over base32 because SDP is large enough
 * that the 33% overhead of base64 still beats base32's 60%.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX: Record<string, number> = Object.fromEntries(
  [...B64].map((ch, i) => [ch, i]),
);

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
  } else if (rem === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]!;
  }
  return out;
}

function base64UrlToBytes(input: string): Uint8Array {
  let s = input.replace(/[^A-Za-z0-9\-_]/g, '');
  const pad = s.length % 4;
  if (pad === 1) return new Uint8Array();
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    const vals = [...chunk].map((ch) => (ch === '=' ? 0 : B64_INDEX[ch] ?? 0));
    if (vals.length < 4) break;
    const n = (vals[0]! << 18) | (vals[1]! << 12) | (vals[2]! << 6) | vals[3]!;
    out.push((n >> 16) & 255);
    if (chunk[2] !== '=') out.push((n >> 8) & 255);
    if (chunk[3] !== '=') out.push(n & 255);
  }
  return new Uint8Array(out);
}

export interface RoomCodeData {
  kind: 'offer' | 'answer';
  sdp: string;
  peerId: string;
  name: string;
  classId: 'warrior' | 'mage' | 'priest';
  level: number;
  /** World seed chosen by the host, so both peers generate the same map. */
  seed: number;
  /**
   * ICE candidates gathered so far. Browsers only accept candidates that are
   * addIceCandidate'd *after* the remote description is applied, so they travel
   * alongside the SDP instead of being left inline.
   */
  ice: string[];
}

/** Encode an SDP offer/answer plus identity into a paste-friendly room code. */
export function encodeRoomCode(data: RoomCodeData): string {
  // Keep the SDP byte-for-byte: browsers are strict about structure, and a
  // dropped trailing line break alone is enough to make it unparseable.
  const body = JSON.stringify(data);
  const compressed = deflateSync(strToU8(body), { level: 9 });
  return bytesToBase64Url(compressed);
}

export function decodeRoomCode(code: string): RoomCodeData | null {
  try {
    const bytes = base64UrlToBytes(code);
    if (bytes.length === 0) return null;
    const inflated = inflateSync(bytes);
    const obj = JSON.parse(strFromU8(inflated)) as RoomCodeData;
    if (obj.kind !== 'offer' && obj.kind !== 'answer') return null;
    if (!obj.sdp || typeof obj.sdp !== 'string') return null;
    if (!obj.peerId || typeof obj.peerId !== 'string') return null;
    if (typeof obj.seed !== 'number') obj.seed = 0;
    if (!Array.isArray(obj.ice)) obj.ice = [];
    return obj;
  } catch {
    return null;
  }
}

/**
 * Group a long code into readable chunks. Spaces are used as the separator
 * because base64url itself contains '-' and '_'.
 */
export function formatCode(code: string, group = 5): string {
  const out: string[] = [];
  for (let i = 0; i < code.length; i += group) out.push(code.slice(i, i + group));
  return out.join(' ');
}

/**
 * Normalise a pasted code. base64url is case-sensitive, so only whitespace
 * (which grouping and chat clients insert) is removed — never '-' or '_'.
 */
export function stripCodeFormatting(code: string): string {
  return code.replace(/\s+/g, '');
}
