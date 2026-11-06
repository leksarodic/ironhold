import {
  decodeMessage,
  encodeMessage,
  makeEnvelope,
  type Envelope,
  type MessageType,
  type PeerIdentity,
  type WelcomePayload,
  type WorldStatePayload,
} from './protocol';
import {
  ICE_SERVERS,
  getWebRtc,
  type DataChannelLike,
  type IceCandidateLike,
  type PeerConnectionLike,
  type RTCConfigurationLike,
} from './webrtc';

export type ConnectionStatus =
  | 'idle'
  | 'preparing'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface PeerInfo {
  peerId: string;
  name: string;
  classId: 'warrior' | 'mage' | 'priest';
  level: number;
  /** 1 = direct link to host, 2+ = relayed through the host. */
  hops: number;
  latencyMs: number;
}

export interface SessionEvents {
  onStatus: (status: ConnectionStatus, detail?: string) => void;
  onPeers: (peers: PeerInfo[]) => void;
  onMessage: (type: MessageType, from: string, payload: unknown) => void;
  onError: (message: string) => void;
}

const RELIABLE_LABEL = 'ironhold-reliable';
const FAST_LABEL = 'ironhold-fast';

/** One live connection. `peerId` is mutable: it starts as a placeholder. */
interface Link {
  peerId: string;
  pc: PeerConnectionLike;
  reliable: DataChannelLike | null;
  fast: DataChannelLike | null;
  /** The identity claimed by the remote peer once it says hello. */
  identity?: PeerIdentity;
}

function ufragOf(sdp: string): string | undefined {
  return /a=ice-ufrag:(\S+)/.exec(sdp)?.[1];
}

/**
 * ICE strategy.
 *
 * Room codes are pasted between devices seconds later, so each code carries a
 * complete SDP: we wait for gathering to finish (bounded) and ship the
 * candidates inline. Once connected, both ends also keep trickling newly
 * gathered candidates over the control channel, which is what keeps NAT
 * rebinding and late candidates working mid-session.
 */
function gatherForCode(
  pc: PeerConnectionLike,
  timeoutMs = 3000,
): Promise<{ sdp: string; candidates: IceCandidateLike[] }> {
  return new Promise((resolve) => {
    const collected: IceCandidateLike[] = [];
    const seen = new Set<string>();

    const sink = (ev: { candidate: IceCandidateLike | null }) => {
      const c = ev.candidate;
      if (!c || !c.candidate) return;
      if (seen.has(c.candidate)) return;
      seen.add(c.candidate);
      collected.push(c);
    };

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const sdp = pc.localDescription?.sdp ?? '';
      resolve({ sdp, candidates: collected });
    };

    // Assign via both paths: native and web historically differ on which fires.
    pc.onicecandidate = sink;
    if (typeof pc.addEventListener === 'function') {
      pc.addEventListener('icecandidate', () => {
        /* sink already receives this through onicecandidate */
      });
    }

    const gatheringComplete = () =>
      typeof pc.iceGatheringState === 'string' && pc.iceGatheringState === 'complete';

    if (gatheringComplete()) {
      setTimeout(finish, 50);
      return;
    }

    pc.onicegatheringstatechange = () => {
      if (gatheringComplete()) setTimeout(finish, 50);
    };
    const start = Date.now();
    const poll = () => {
      if (done) return;
      if (gatheringComplete() || Date.now() - start > timeoutMs) finish();
      else setTimeout(poll, 100);
    };
    setTimeout(poll, 100);
  });
}

/**
 * Apply a peer's candidates after the remote description is in place. This is
 * also used for mid-session trickle, so it never re-sends inline candidates.
 */
async function applyIce(
  pc: PeerConnectionLike,
  candidates: IceCandidateLike[],
  remoteSdp?: string,
): Promise<void> {
  if (remoteSdp && remoteSdp.includes('a=candidate')) {
    // The description already carries them; adding again is harmless but noisy.
  }
  for (const c of candidates) {
    try {
      await pc.addIceCandidate(c);
    } catch {
      /* one unusable candidate must not abort the rest */
    }
  }
}

abstract class SessionBase {
  abstract readonly role: 'host' | 'joiner';
  protected status: ConnectionStatus = 'idle';
  protected peers = new Map<string, PeerInfo>();
  protected events: SessionEvents;
  readonly self: PeerIdentity;

  constructor(events: SessionEvents, self: PeerIdentity) {
    this.events = events;
    this.self = self;
  }

  abstract close(): void;
  protected abstract forEachLink(fn: (link: Link) => void): void;

  protected setStatus(s: ConnectionStatus, detail?: string): void {
    this.status = s;
    this.events.onStatus(s, detail);
  }

  protected emitPeers(): void {
    this.events.onPeers([...this.peers.values()]);
  }

  /**
   * Decode and route an inbound frame. `channelPeerId` identifies the link the
   * bytes arrived on; it wins over the envelope's `from` for relayed messages.
   */
  protected dispatch(raw: string, linkPeerId: string): void {
    const env = decodeMessage(raw);
    if (!env) return;
    const peer = this.peers.get(env.from);
    if (peer) peer.latencyMs = Math.max(0, Date.now() - env.ts);
    this.route(env.type as MessageType, env.from, env.payload, linkPeerId);
  }

  /** Overridable hook so the host can relay frames it is not the target of. */
  protected route(type: MessageType, from: string, payload: unknown, linkPeerId: string): void {
    void linkPeerId;
    this.events.onMessage(type, from, payload);
  }

  broadcast<T>(type: MessageType, payload: T, reliable = true): void {
    const raw = encodeMessage(makeEnvelope(type, this.self.peerId, payload));
    this.forEachLink((link) => {
      const ch = reliable ? link.reliable : link.fast;
      if (!ch || ch.readyState !== 'open') return;
      try {
        ch.send(raw);
      } catch {
        /* a dying peer must not break the loop */
      }
    });
  }

  /**
   * Send to everybody except one peer (used when relaying). `from` preserves
   * the original sender so relayed frames keep their attribution.
   */
  broadcastExcept<T>(type: MessageType, payload: T, except: string, reliable = true, from?: string): void {
    const raw = encodeMessage(makeEnvelope(type, from ?? this.self.peerId, payload));
    this.forEachLink((link) => {
      if (link.peerId === except) return;
      const ch = reliable ? link.reliable : link.fast;
      if (!ch || ch.readyState !== 'open') return;
      try {
        ch.send(raw);
      } catch {
        /* ignore */
      }
    });
  }

  getPeers(): PeerInfo[] {
    return [...this.peers.values()];
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  protected attachChannels(link: Link, reliable: DataChannelLike | null, fast: DataChannelLike | null): void {
    link.reliable = reliable;
    link.fast = fast;
    const wire = (ch: DataChannelLike | null, _isReliable: boolean) => {
      if (!ch) return;
      ch.onopen = () => this.setStatus('connected', 'Party link established.');
      ch.onclose = () => this.handleLinkClosed(link.peerId);
      ch.onerror = () => this.events.onError('Data channel error.');
      // Both channels carry protocol frames. The fast channel is unordered and
      // unreliable, so position/state frames tolerate loss; reliable frames
      // (casts, loot, chat) ride the ordered channel.
      ch.onmessage = (ev) => {
        if (typeof ev.data === 'string') this.dispatch(ev.data, link.peerId);
      };
    };
    wire(reliable, true);
    wire(fast, false);
  }

  protected handleLinkClosed(peerId: string): void {
    if (this.peers.delete(peerId)) this.emitPeers();
  }
}

/**
 * HOST — owns the session. Creates one RTCPeerConnection per joiner and relays
 * traffic between joiners so the party forms a star mesh: each phone holds a
 * single peer connection instead of N-1.
 */
export class HostSession extends SessionBase {
  readonly role = 'host' as const;
  readonly seed: number;
  private links = new Map<string, Link>();
  /** Offer SDP ufrag -> the link awaiting its answer. */
  private pending = new Map<string, Link>();
  private stateTimer: ReturnType<typeof setInterval> | null = null;
  private inviteCounter = 0;

  constructor(events: SessionEvents, self: PeerIdentity, seed?: number) {
    super(events, self);
    this.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
  }

  async start(): Promise<void> {
    this.setStatus('waiting', 'Generate a room code and send it to a friend.');
  }

  /**
   * Create an invite. The returned SDP must be embedded in a room code and
   * handed to the joiner; it already contains the gathered ICE candidates.
   */
  async createInvite(): Promise<{ sdp: string; candidates: IceCandidateLike[] }> {
    this.setStatus('preparing', 'Gathering network candidates…');
    const rtc = getWebRtc();
    const pc = rtc.createPeerConnection(ICE_SERVERS as RTCConfigurationLike);
    const placeholder = `invite-${++this.inviteCounter}`;
    const link: Link = { peerId: placeholder, pc, reliable: null, fast: null };

    pc.onicecandidate = () => {};
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState ?? pc.iceConnectionState ?? '';
      if (st === 'failed' || st === 'closed') this.dropLink(link.peerId);
    };
    // The answerer never creates channels, but guard anyway.
    pc.ondatachannel = (ev) => {
      if (ev.channel.label === RELIABLE_LABEL) this.attachChannels(link, ev.channel, link.fast);
      else if (ev.channel.label === FAST_LABEL) this.attachChannels(link, link.reliable, ev.channel);
    };

    const reliable = pc.createDataChannel(RELIABLE_LABEL, { ordered: true });
    const fast = pc.createDataChannel(FAST_LABEL, { ordered: false, maxRetransmits: 0 });
    this.attachChannels(link, reliable, fast);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const { sdp, candidates } = await gatherForCode(pc);

    this.links.set(placeholder, link);
    const ufrag = ufragOf(pc.localDescription?.sdp ?? '');
    if (ufrag) this.pending.set(ufrag, link);
    this.setStatus('waiting', 'Room code ready — send it to your friend.');
    return { sdp, candidates };
  }

  /**
   * Complete a link with the joiner's answer. The answer echoes the host's
   * ufrag, which is how we match it to the right pending invitation.
   */
  async acceptAnswer(
    answerSdp: string,
    joiner: PeerIdentity,
    candidates: IceCandidateLike[] = [],
  ): Promise<void> {
    const ufrag = ufragOf(answerSdp);
    let link: Link | undefined = ufrag ? this.pending.get(ufrag) : undefined;

    if (!link) {
      // Some browsers omit the echoed ufrag: fall back to any link not yet
      // identified, preferring the most recently created one.
      const candidates = [...this.links.values()].filter((l) => !l.identity);
      link = candidates[candidates.length - 1];
    }
    if (!link) {
      this.events.onError('No open invitation matches that answer. Generate a new room code.');
      return;
    }

    try {
      await link.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      await applyIce(link.pc, candidates, answerSdp);
    } catch (err) {
      this.events.onError(`Could not accept the answer: ${(err as Error).message}`);
      return;
    }

    this.identify(link, joiner);
    // Keep answering late candidates: some gatherers emit more after the code
    // was produced (e.g. a second interface coming up).
    this.trickleLateCandidates(link);
    this.setStatus('connected', `${joiner.name} joined the party.`);

    // Tell the newcomer who else is here, and tell everyone about them.
    const roster = [...this.peers.values()].map((p) => ({
      peerId: p.peerId,
      name: p.name,
      classId: p.classId,
      level: p.level,
    }));
    const raw = encodeMessage(
      makeEnvelope<WelcomePayload>('welcome', this.self.peerId, {
        peerId: joiner.peerId,
        peers: roster,
        seed: this.seed,
        hostPeerId: this.self.peerId,
      }),
    );
    try {
      link.reliable?.send(raw);
    } catch {
      /* the newcomer can re-request the roster */
    }
    this.broadcastExcept('spawn', { peer: joiner }, joiner.peerId);
    this.emitPeers();
  }

  /**
   * Forward any candidate produced after the room code was created. These are
   * rare but matter on multi-homed networks (Wi-Fi + cellular).
   */
  private trickleLateCandidates(link: Link): void {
    const pc = link.pc;
    const seen = new Set<string>();
    const original = pc.onicecandidate;
    pc.onicecandidate = (ev) => {
      original?.(ev);
      const c = ev.candidate;
      if (!c || !c.candidate || seen.has(c.candidate)) return;
      seen.add(c.candidate);
      if (c.candidate === '') return;
      // Nothing to send to until the peer id is known.
      if (!link.identity) return;
      try {
        link.reliable?.send(
          encodeMessage(makeEnvelope('ice', this.self.peerId, { candidate: c.candidate, sdpMid: c.sdpMid ?? '0' })),
        );
      } catch {
        /* channel not ready yet */
      }
    };
  }

  /** Promote a placeholder link to a real peer id without losing its channels. */
  private identify(link: Link, identity: PeerIdentity): void {
    const oldId = link.peerId;
    link.peerId = identity.peerId;
    link.identity = identity;
    this.links.delete(oldId);
    this.links.set(identity.peerId, link);
    this.pending.delete(ufragOf(link.pc.localDescription?.sdp ?? '') ?? '');
    this.peers.set(identity.peerId, {
      peerId: identity.peerId,
      name: identity.name,
      classId: identity.classId,
      level: identity.level,
      hops: 1,
      latencyMs: 0,
    });
  }

  /** Apply a late ICE candidate that a joiner trickled to us. */
  private applyRemoteIce(linkPeerId: string, payload: unknown): void {
    const link = this.links.get(linkPeerId);
    const data = payload as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
    if (!link || !data?.candidate) return;
    link.pc
      .addIceCandidate({
        candidate: data.candidate,
        sdpMid: data.sdpMid ?? '0',
        sdpMLineIndex: data.sdpMLineIndex ?? 0,
      })
      .catch(() => {});
  }

  /** Relay a frame from one joiner to all the others (star mesh). */
  protected override route(type: MessageType, from: string, payload: unknown, linkPeerId: string): void {
    if (type === 'ice') {
      this.applyRemoteIce(linkPeerId, payload);
      return;
    }
    const relayable: MessageType[] = ['input', 'cast', 'damage', 'loot_drop', 'loot_claim', 'chat', 'inventory'];
    if (relayable.includes(type)) {
      // Preserve the originator so receivers can attribute the action.
      this.broadcastExcept(type, payload, linkPeerId, type !== 'input', from);
      // Hosts must also observe state that arrives from a joiner.
    }
    this.events.onMessage(type, from, payload);
  }

  protected forEachLink(fn: (link: Link) => void): void {
    for (const link of this.links.values()) {
      if (!link.identity) continue; // not yet joined
      fn(link);
    }
  }

  private dropLink(peerId: string): void {
    const link = this.links.get(peerId);
    if (!link) return;
    try {
      link.pc.close();
    } catch {
      /* ignore */
    }
    this.links.delete(peerId);
    this.handleLinkClosed(peerId);
  }

  /** Push authoritative world state to every joiner at a fixed rate. */
  startStateBroadcast(provider: () => WorldStatePayload | null, hz = 12): void {
    this.stopStateBroadcast();
    this.stateTimer = setInterval(() => {
      const state = provider();
      if (state) this.broadcast('state', state, false);
    }, 1000 / hz);
  }

  stopStateBroadcast(): void {
    if (this.stateTimer) clearInterval(this.stateTimer);
    this.stateTimer = null;
  }

  close(): void {
    this.stopStateBroadcast();
    this.broadcast('bye', {});
    for (const link of this.links.values()) {
      try {
        link.pc.close();
      } catch {
        /* ignore */
      }
    }
    this.links.clear();
    this.pending.clear();
    this.peers.clear();
    this.setStatus('idle');
    this.emitPeers();
  }
}

/**
 * JOINER — consumes the host's offer, produces an answer code, then exchanges
 * messages with the host over the two data channels.
 */
export class JoinSession extends SessionBase {
  readonly role = 'joiner' as const;
  private link: Link | null = null;
  private hostPeerId: string | null = null;
  seed = 0;

  async start(): Promise<void> {
    this.setStatus('waiting', 'Paste the host room code.');
  }

  /** Build the answer SDP for a host offer. */
  protected override route(type: MessageType, from: string, payload: unknown, _linkPeerId: string): void {
    if (type === 'ice') {
      const d = payload as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
      if (this.link && d?.candidate) {
        this.link.pc
          .addIceCandidate({
            candidate: d.candidate,
            sdpMid: d.sdpMid ?? '0',
            sdpMLineIndex: d.sdpMLineIndex ?? 0,
          })
          .catch(() => {});
      }
      return;
    }
    this.events.onMessage(type, from, payload);
  }

  /** Forward candidates discovered after the answer code was generated. */
  private startLateTrickle(): void {
    const link = this.link;
    if (!link) return;
    const seen = new Set<string>();
    const original = link.pc.onicecandidate;
    link.pc.onicecandidate = (ev) => {
      original?.(ev);
      const c = ev.candidate;
      if (!c || !c.candidate || seen.has(c.candidate)) return;
      seen.add(c.candidate);
      this.broadcast('ice', { candidate: c.candidate, sdpMid: c.sdpMid ?? '0' }, true);
    };
  }

  async joinWithOffer(
    offerSdp: string,
    hostPeerId: string,
    seed: number,
    hostCandidates: IceCandidateLike[] = [],
  ): Promise<{ sdp: string; candidates: IceCandidateLike[] }> {
    this.hostPeerId = hostPeerId;
    this.seed = seed;
    this.setStatus('connecting', 'Negotiating a direct link…');

    const rtc = getWebRtc();
    const pc = rtc.createPeerConnection(ICE_SERVERS as RTCConfigurationLike);
    const link: Link = { peerId: hostPeerId, pc, reliable: null, fast: null };
    this.link = link;

    pc.onicecandidate = () => {};
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState ?? pc.iceConnectionState ?? '';
      if (st === 'connected') this.setStatus('connected', 'Joined the party.');
      else if (st === 'failed') this.setStatus('error', 'The link failed. Ask the host for a new room code.');
      else if (st === 'closed') this.setStatus('disconnected');
    };
    pc.ondatachannel = (ev) => {
      if (ev.channel.label === RELIABLE_LABEL) {
        this.attachChannels(link, ev.channel, link.fast);
        // The host announces the roster once the channel opens.
        const prev = ev.channel.onopen;
        ev.channel.onopen = () => {
          prev?.();
          this.sendHello();
        };
      } else if (ev.channel.label === FAST_LABEL) {
        this.attachChannels(link, link.reliable, ev.channel);
      }
    };

    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    await applyIce(pc, hostCandidates, offerSdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const { sdp, candidates } = await gatherForCode(pc);
    this.startLateTrickle();
    return { sdp, candidates };
  }

  private sendHello(): void {
    this.broadcast(
      'hello',
      { ...this.self, seed: this.seed, hostPeerId: this.hostPeerId ?? 'host' },
      true,
    );
  }

  protected forEachLink(fn: (link: Link) => void): void {
    if (this.link) fn(this.link);
  }

  getHostPeerId(): string | null {
    return this.hostPeerId;
  }

  close(): void {
    try {
      this.link?.pc.close();
    } catch {
      /* ignore */
    }
    this.link = null;
    this.setStatus('idle');
    this.emitPeers();
  }
}

export function generatePeerId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = 'p-';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
