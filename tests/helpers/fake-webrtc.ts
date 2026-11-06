/**
 * In-memory fake of the WebRTC surface, faithful enough to drive session logic
 * in tests: offers/answers become strings, candidate gathering is simulated,
 * and data channels are wired between two connected peers.
 *
 * It intentionally models the parts the app depends on: ufrag echo in answers,
 * channel open events, message delivery, and connection state transitions.
 */
import type {
  DataChannelLike,
  IceCandidateLike,
  PeerConnectionLike,
  RTCConfigurationLike,
  SessionDescriptionLike,
  WebRtcAdapter,
} from '../../src/net/webrtc';

let ufragCounter = 0;

class FakeDataChannel implements DataChannelLike {
  label: string;
  readyState = 'connecting';
  onopen: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  peer: FakeDataChannel | null = null;
  sent: string[] = [];

  constructor(label: string) {
    this.label = label;
  }

  send(data: string): void {
    if (this.readyState !== 'open') throw new Error('channel not open');
    this.sent.push(data);
    const target = this.peer;
    if (!target) return;
    // Deliver asynchronously like a real data channel.
    queueMicrotask(() => {
      if (target.readyState === 'open') target.onmessage?.({ data });
    });
  }

  close(): void {
    this.readyState = 'closed';
    this.onclose?.();
    if (this.peer && this.peer.readyState !== 'closed') this.peer.close();
  }

  /** Test helper: open this channel and its peer. */
  open(): void {
    this.readyState = 'open';
    this.onopen?.();
    if (this.peer && this.peer.readyState !== 'open') this.peer.open();
  }
}

export class FakePeerConnection implements PeerConnectionLike {
  localDescription: SessionDescriptionLike | null = null;
  remoteDescription: SessionDescriptionLike | null = null;
  connectionState = 'new';
  iceConnectionState = 'new';
  onicecandidate: ((ev: { candidate: IceCandidateLike | null }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null = null;
  channels: FakeDataChannel[] = [];
  remote: FakePeerConnection | null = null;
  readonly ufrag: string;
  closed = false;
  iceGatheringState = 'complete';
  onicegatheringstatechange: (() => void) | null = null;
  /** Candidates handed to addIceCandidate, so tests can assert they arrive. */
  remoteCandidates: string[] = [];

  constructor(_config: RTCConfigurationLike) {
    this.ufrag = `u${++ufragCounter}${Math.random().toString(36).slice(2, 6)}`;
  }

  async createOffer(): Promise<SessionDescriptionLike> {
    return {
      type: 'offer',
      sdp: [
        'v=0',
        'a=group:BUNDLE 0',
        `a=ice-ufrag:${this.ufrag}`,
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'a=mid:0',
        'a=sctp-port:5000',
        'a=candidate:1 1 udp 2113937151 192.168.1.5 50000 typ host generation 0',
      ].join('\r\n'),
    };
  }

  async createAnswer(): Promise<SessionDescriptionLike> {
    // Echo the remote offer's ufrag, exactly like a real browser answer.
    const remoteUfrag = /a=ice-ufrag:(\S+)/.exec(this.remoteDescription?.sdp ?? '')?.[1] ?? this.ufrag;
    return {
      type: 'answer',
      sdp: [
        'v=0',
        `a=ice-ufrag:${remoteUfrag}`,
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
        'a=mid:0',
        'a=sctp-port:5000',
        `a=candidate:2 1 udp 2113937151 192.168.1.9 50001 typ host generation 0`,
      ].join('\r\n'),
    };
  }

  async setLocalDescription(desc: SessionDescriptionLike): Promise<void> {
    this.localDescription = desc;
    // Emit one candidate like a real gathering peer, then settle.
    queueMicrotask(() => {
      this.onicecandidate?.({
        candidate: {
          candidate: `candidate:1 1 udp 2113937151 192.168.1.5 ${this.ufrag} typ host generation 0`,
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
      });
      this.iceGatheringState = 'complete';
      this.onicegatheringstatechange?.();
    });
  }

  async setRemoteDescription(desc: SessionDescriptionLike): Promise<void> {
    this.remoteDescription = desc;
  }

  async addIceCandidate(c: IceCandidateLike): Promise<void> {
    this.remoteCandidates.push(c.candidate);
  }

  createDataChannel(label: string, _config?: unknown): DataChannelLike {
    const ch = new FakeDataChannel(label);
    this.channels.push(ch);
    return ch;
  }

  close(): void {
    this.closed = true;
    this.connectionState = 'closed';
  }

  /** Test helper: connect two fake PCs and open every channel. */
  static link(a: FakePeerConnection, b: FakePeerConnection): void {
    a.remote = b;
    b.remote = a;
    a.connectionState = 'connected';
    b.connectionState = 'connected';
    a.onconnectionstatechange?.();
    b.onconnectionstatechange?.();

    // Pair channels by label and announce them to the remote side.
    for (const ch of [...a.channels]) {
      const match = b.channels.find((x) => x.label === ch.label);
      if (match) {
        ch.peer = match;
        match.peer = ch;
      } else {
        const mirror = new FakeDataChannel(ch.label);
        mirror.peer = ch;
        ch.peer = mirror;
        b.channels.push(mirror);
        b.ondatachannel?.({ channel: mirror });
      }
    }
    for (const ch of [...b.channels]) {
      if (!ch.peer) continue;
      if (ch.readyState !== 'open') ch.open();
    }
  }
}

export class FakeWebRtcAdapter implements WebRtcAdapter {
  isNative = false;
  connections: FakePeerConnection[] = [];
  /** Links created by the adapter, so tests can connect them. */
  private lastHostPc: FakePeerConnection | null = null;

  createPeerConnection(config: RTCConfigurationLike): PeerConnectionLike {
    const pc = new FakePeerConnection(config);
    this.connections.push(pc);
    return pc;
  }

  get last(): FakePeerConnection | undefined {
    return this.connections[this.connections.length - 1];
  }

  setLastHost(pc: FakePeerConnection | null): void {
    this.lastHostPc = pc;
  }

  get hostPc(): FakePeerConnection | null {
    return this.lastHostPc;
  }
}

/** Wait for pending microtasks/timers to settle. */
export function flush(ms = 25): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
