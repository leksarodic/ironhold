import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeMessage,
  decodeRoomCode,
  encodeMessage,
  encodeRoomCode,
  formatCode,
  makeEnvelope,
  stripCodeFormatting,
  PROTOCOL_VERSION,
} from '../src/net/protocol';

/** A realistic data-channel SDP as Chrome emits it (~2 kB with candidates). */
const SAMPLE_SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=ice-ufrag:4ZcD',
  'a=ice-pwd:2/1muCWoOi3uLifh0NuRHlZw',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 8F:1C:2A:6B:00:9D:0A:6F:2E:8A:77:3A:9C:2B:0C:6E:5D:4B:1A:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  ...Array.from({ length: 10 }, (_, i) =>
    `a=candidate:842163049 ${i} udp 1677729535 192.168.1.${40 + i} ${54321 + i} typ host generation 0 network-id 1 network-cost 10`,
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    `a=candidate:1510613863 ${i} udp 1686052607 203.0.113.${10 + i} ${61000 + i} typ srflx raddr 192.168.1.42 rport 54321 generation 0 network-id 1`,
  ),
].join('\r\n');

test('envelope round-trips through encode/decode', () => {
  const env = makeEnvelope('input', 'p-abc123', { mx: 1, my: 0, facing: 0, sprint: false, t: 10 });
  const raw = encodeMessage(env);
  const back = decodeMessage(raw);
  assert.ok(back);
  assert.equal(back!.type, 'input');
  assert.equal(back!.from, 'p-abc123');
  assert.deepEqual(back!.payload, { mx: 1, my: 0, facing: 0, sprint: false, t: 10 });
  assert.equal(back!.v, PROTOCOL_VERSION);
});

test('garbage and mismatched versions are rejected', () => {
  assert.equal(decodeMessage('not json'), null);
  assert.equal(decodeMessage('{}'), null);
  assert.equal(decodeMessage(JSON.stringify({ v: 999, type: 'input', from: 'x', ts: 0, seq: 1, payload: {} })), null);
});

test('room codes compress SDP substantially', () => {
  const code = encodeRoomCode({
    kind: 'offer',
    sdp: SAMPLE_SDP,
    peerId: 'p-host01',
    name: 'Arthas',
    classId: 'warrior',
    level: 1,
    seed: 123456,
    ice: ['candidate:1 1 udp 2113937151 192.168.1.5 50000 typ host generation 0'],
  });
  assert.ok(code.length > 0);
  assert.ok(
    code.length < SAMPLE_SDP.length * 0.5,
    `expected compression, SDP ${SAMPLE_SDP.length} chars -> code ${code.length}`,
  );
  // Only base64url alphabet characters.
  assert.match(code, /^[A-Za-z0-9\-_]+$/);
});

test('room code round-trips with identity and seed', () => {
  const input = {
    kind: 'answer' as const,
    sdp: SAMPLE_SDP,
    peerId: 'p-join02',
    name: 'Jaina',
    classId: 'mage' as const,
    level: 3,
    seed: 987654,
    ice: [],
  };
  const decoded = decodeRoomCode(encodeRoomCode(input));
  assert.ok(decoded);
  // The SDP must round-trip byte-for-byte: browsers reject anything altered.
  assert.equal(decoded!.sdp, input.sdp);
  assert.equal(decoded!.peerId, 'p-join02');
  assert.equal(decoded!.name, 'Jaina');
  assert.equal(decoded!.classId, 'mage');
  assert.equal(decoded!.level, 3);
  assert.equal(decoded!.seed, 987654);
  assert.deepEqual(decoded!.ice, []);
});

test('room codes survive formatting characters pasted by users', () => {
  const code = encodeRoomCode({
    kind: 'offer',
    sdp: SAMPLE_SDP,
    peerId: 'p-x',
    name: 'X',
    classId: 'priest',
    level: 1,
    seed: 1,
    ice: [],
  });
  const pretty = formatCode(code, 5);
  assert.ok(pretty.includes(' '));
  const restored = decodeRoomCode(stripCodeFormatting(pretty));
  assert.ok(restored);
  assert.equal(restored!.peerId, 'p-x');
});

test('invalid room codes fail closed', () => {
  assert.equal(decodeRoomCode(''), null);
  assert.equal(decodeRoomCode('!!!!'), null);
  assert.equal(decodeRoomCode('AAAAAAAAAAAAAAAA'), null);
});

test('formatCode groups evenly and strips back', () => {
  const raw = 'ABCDEFGHIJ';
  assert.equal(formatCode(raw, 4), 'ABCD EFGH IJ');
  assert.equal(stripCodeFormatting(formatCode(raw, 4)), raw);
  // base64url characters must survive normalisation untouched.
  const withUrlChars = 'ab-_CD12';
  assert.equal(stripCodeFormatting(`  ${withUrlChars}\n`), withUrlChars);
});
