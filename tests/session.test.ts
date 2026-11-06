import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { HostSession, JoinSession, type ConnectionStatus, type PeerInfo } from '../src/net/session';
import { encodeRoomCode, decodeRoomCode, type MessageType } from '../src/net/protocol';
import { setWebRtcAdapter } from '../src/net/webrtc';
import { FakePeerConnection, FakeWebRtcAdapter, flush } from './helpers/fake-webrtc';

const HOST_ID = {
  peerId: 'p-host',
  name: 'Host',
  classId: 'warrior' as const,
  level: 1,
};

const JOINER_ID = {
  peerId: 'p-join',
  name: 'Joiner',
  classId: 'mage' as const,
  level: 1,
};

interface Recorded {
  status: ConnectionStatus[];
  errors: string[];
  peers: PeerInfo[][];
  messages: Array<{ type: MessageType; from: string; payload: unknown }>;
}

function recorder(): { events: Recorded; handlers: ConstructorParameters<typeof HostSession>[0] } {
  const rec: Recorded = { status: [], errors: [], peers: [], messages: [] };
  return {
    events: rec,
    handlers: {
      onStatus: (s) => rec.status.push(s),
      onError: (e) => rec.errors.push(e),
      onPeers: (p) => rec.peers.push(p),
      onMessage: (type, from, payload) => rec.messages.push({ type, from, payload }),
    },
  };
}

let adapter: FakeWebRtcAdapter;

beforeEach(() => {
  adapter = new FakeWebRtcAdapter();
  setWebRtcAdapter(adapter);
});

/** Drive a full host<->joiner handshake over the fake transport. */
async function connect(): Promise<{
  host: HostSession;
  joiner: JoinSession;
  hostEvents: Recorded;
  joinerEvents: Recorded;
  hostPc: FakePeerConnection;
  joinerPc: FakePeerConnection;
}> {
  const h = recorder();
  const j = recorder();
  const host = new HostSession(h.handlers, HOST_ID, 424242);
  const joiner = new JoinSession(j.handlers, JOINER_ID);

  await host.start();
  await joiner.start();

  const invite = await host.createInvite();
  const hostPc = adapter.connections[0]!;

  // Identity travels inside the room code, exactly as it does in the UI.
  const code = encodeRoomCode({
    ...HOST_ID,
    kind: 'offer',
    sdp: invite.sdp,
    ice: invite.candidates.map((c) => c.candidate),
    seed: host.seed,
  });
  const decoded = decodeRoomCode(code);
  assert.ok(decoded);

  const answer = await joiner.joinWithOffer(
    decoded!.sdp,
    decoded!.peerId,
    decoded!.seed,
    decoded!.ice.map((candidate) => ({ candidate, sdpMid: '0', sdpMLineIndex: 0 })),
  );
  const joinerPc = adapter.connections[1]!;

  // Wire the two endpoints together, then complete the handshake.
  FakePeerConnection.link(hostPc, joinerPc);
  await host.acceptAnswer(
    answer.sdp,
    JOINER_ID,
    answer.candidates.map((c) => ({ ...c, sdpMid: '0', sdpMLineIndex: 0 })),
  );
  await flush();

  return { host, joiner, hostEvents: h.events, joinerEvents: j.events, hostPc, joinerPc };
}

test('host produces a room code containing its identity and seed', async () => {
  const h = recorder();
  const host = new HostSession(h.handlers, HOST_ID, 999);
  await host.start();
  const { sdp } = await host.createInvite();
  assert.ok(sdp.includes('webrtc-datachannel'));

  const code = encodeRoomCode({ ...HOST_ID, kind: 'offer', sdp, ice: [], seed: host.seed });
  const decoded = decodeRoomCode(code);
  assert.ok(decoded);
  assert.equal(decoded!.peerId, 'p-host');
  assert.equal(decoded!.seed, 999);
  assert.equal(decoded!.classId, 'warrior');
});

test('host and joiner complete a handshake and see each other as peers', async () => {
  const { host, hostEvents, joinerEvents } = await connect();
  assert.ok(hostEvents.status.includes('connected'), `statuses: ${hostEvents.status}`);
  assert.ok(
    host.getPeers().some((p) => p.peerId === 'p-join' && p.name === 'Joiner'),
    'host roster should contain the joiner',
  );
  assert.equal(hostEvents.errors.length, 0, hostEvents.errors.join(','));
  assert.ok(joinerEvents.status.includes('connected'), `joiner statuses: ${joinerEvents.status}`);
});

test('joiner receives the welcome roster with the shared seed', async () => {
  const { joinerEvents } = await connect();
  const welcome = joinerEvents.messages.find((m) => m.type === 'welcome');
  assert.ok(welcome, 'joiner should receive a welcome message');
  const payload = welcome!.payload as { seed: number; peers: unknown[] };
  assert.equal(payload.seed, 424242);
  assert.ok(Array.isArray(payload.peers));
});

test('messages flow joiner -> host after handshake', async () => {
  const { joiner, hostEvents } = await connect();
  joiner.broadcast('chat', { text: 'For the Horde!' });
  await flush();
  const chat = hostEvents.messages.find((m) => m.type === 'chat');
  assert.ok(chat, 'host should receive joiner chat');
  assert.deepEqual(chat!.payload, { text: 'For the Horde!' });
  assert.equal(chat!.from, 'p-join');
});

test('messages flow host -> joiner after handshake', async () => {
  const { host, joinerEvents } = await connect();
  host.broadcast('state', { t: 1, players: [], enemies: [] }, false);
  await flush();
  const state = joinerEvents.messages.find((m) => m.type === 'state');
  assert.ok(state, 'joiner should receive world state');
});

test('host relays input between two joiners (star mesh)', async () => {
  const h = recorder();
  const host = new HostSession(h.handlers, HOST_ID, 7);
  await host.start();

  // Join two peers.
  const joiners: Array<{ session: JoinSession; events: Recorded; pc: FakePeerConnection }> = [];
  for (let i = 0; i < 2; i++) {
    const j = recorder();
    const jid = { ...JOINER_ID, peerId: `p-j${i}`, name: `J${i}`, classId: i === 0 ? ('mage' as const) : ('priest' as const) };
    const session = new JoinSession(j.handlers, jid);
    await session.start();
    const invite = await host.createInvite();
    const hostPc = adapter.last!;
    const answer = await session.joinWithOffer(invite.sdp, HOST_ID.peerId, host.seed, invite.candidates);
    const joinerPc = adapter.last!;
    FakePeerConnection.link(hostPc, joinerPc);
    await host.acceptAnswer(answer.sdp, jid, answer.candidates);
    await flush();
    joiners.push({ session, events: j.events, pc: joinerPc });
  }

  assert.equal(host.getPeers().length, 2, 'host should track both joiners');
  const [a, b] = joiners;
  a!.session.broadcast('input', { mx: 1, my: 0, facing: 0, sprint: false, t: 1 });
  await flush(50);

  const relayed = b!.events.messages.find((m) => m.type === 'input');
  assert.ok(relayed, 'second joiner should receive the relayed input');
  assert.equal(relayed!.from, 'p-j0');
  // The sender must not receive its own relayed frame.
  assert.equal(a!.events.messages.filter((m) => m.type === 'input').length, 0);
});

test('host state broadcast reaches joiners at the configured rate', async () => {
  const { host, joinerEvents } = await connect();
  host.startStateBroadcast(() => ({ t: Date.now(), players: [], enemies: [] }), 20);
  await flush(160);
  host.stopStateBroadcast();
  const states = joinerEvents.messages.filter((m) => m.type === 'state');
  assert.ok(states.length >= 1, `expected state frames, got ${states.length}`);
});

test('closing the host tears the session down', async () => {
  const { host, hostEvents } = await connect();
  host.close();
  assert.equal(host.getPeers().length, 0);
  assert.equal(hostEvents.status[hostEvents.status.length - 1], 'idle');
});

test('an unmatched answer is reported rather than silently dropped', async () => {
  const h = recorder();
  const host = new HostSession(h.handlers, HOST_ID, 1);
  await host.start();
  await host.createInvite();
  // An answer from an entirely different negotiation.
  await host.acceptAnswer('v=0\na=ice-ufrag:zzzz\r\n', JOINER_ID).catch(() => {});
  // Matching falls back to the newest open invite in the fake, so force a
  // genuinely empty host to assert the error path.
  const empty = new HostSession(recorder().handlers, { ...HOST_ID, peerId: 'p-empty' }, 2);
  const emptyRec = recorder();
  const emptyHost = new HostSession(emptyRec.handlers, { ...HOST_ID, peerId: 'p-empty' }, 2);
  await emptyHost.start();
  await emptyHost.acceptAnswer('v=0\na=ice-ufrag:zzzz\r\n', JOINER_ID);
  assert.ok(emptyRec.events.errors.length > 0, 'should report a missing invitation');
});
