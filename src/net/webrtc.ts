/**
 * Thin WebRTC facade.
 *
 * The native module (`react-native-webrtc`) and the browser share almost the
 * same API, so we resolve one adapter at startup and let the rest of the app be
 * platform agnostic. Keeping this in one file also makes the transport testable
 * with a fake implementation.
 */

export interface DataChannelLike {
  label: string;
  readyState: string;
  send: (data: string) => void;
  close: () => void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface SessionDescriptionLike {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface IceCandidateLike {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface PeerConnectionLike {
  localDescription: SessionDescriptionLike | null;
  connectionState?: string;
  iceConnectionState?: string;
  createOffer: (opts?: unknown) => Promise<SessionDescriptionLike>;
  createAnswer: () => Promise<SessionDescriptionLike>;
  setLocalDescription: (desc: SessionDescriptionLike) => Promise<void>;
  setRemoteDescription: (desc: SessionDescriptionLike) => Promise<void>;
  addIceCandidate: (c: IceCandidateLike) => Promise<void>;
  createDataChannel: (label: string, config?: unknown) => DataChannelLike;
  close: () => void;
  onicecandidate: ((ev: { candidate: IceCandidateLike | null }) => void) | null;
  onicegatheringstatechange?: (() => void) | null;
  iceGatheringState?: string;
  /** Present on browsers; used to detect when gathering has finished. */
  addEventListener?: (type: string, fn: () => void) => void;
  oniceconnectionstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null;
}

export interface WebRtcAdapter {
  createPeerConnection: (config: RTCConfigurationLike) => PeerConnectionLike;
  /** True when running against the real native module rather than a shim. */
  isNative: boolean;
}

export interface RTCConfigurationLike {
  iceServers: Array<{ urls: string | string[] }>;
  iceTransportPolicy?: 'all' | 'relay';
}

/**
 * Public STUN only — no TURN, therefore no relay infrastructure to run.
 * Peers on the same network connect over host candidates; peers across NATs
 * use the reflexive candidates discovered through these servers.
 */
export const ICE_SERVERS: RTCConfigurationLike = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
};

let cached: WebRtcAdapter | null = null;

/**
 * Resolve the platform adapter. Falls back to the global `RTCPeerConnection`
 * (Chrome/Safari) for the web preview, and throws a helpful error otherwise.
 */
export function getWebRtc(): WebRtcAdapter {
  if (cached) return cached;

  const g = globalThis as unknown as {
    RTCPeerConnection?: new (cfg: unknown) => PeerConnectionLike;
    RTCSessionDescription?: new (d: unknown) => SessionDescriptionLike;
    RTCIceCandidate?: new (d: unknown) => IceCandidateLike;
  };

  if (typeof g.RTCPeerConnection === 'function') {
    cached = {
      isNative: false,
      createPeerConnection: (config) => new g.RTCPeerConnection!(config),
    };
    return cached;
  }

  // Native path. `require` is resolved lazily so the web bundle never pulls the
  // native-only module into the graph.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native-webrtc') as {
      RTCPeerConnection: new (cfg: unknown) => PeerConnectionLike;
    };
    cached = {
      isNative: true,
      createPeerConnection: (config) => new rn.RTCPeerConnection(config),
    };
    return cached;
  } catch (err) {
    throw new Error(
      'WebRTC is unavailable. On device, install react-native-webrtc and rebuild the native app ' +
        `(npx expo run:ios). Details: ${(err as Error).message}`,
    );
  }
}

/** Inject a custom adapter (used by tests and native bootstraps). */
export function setWebRtcAdapter(adapter: WebRtcAdapter | null): void {
  cached = adapter;
}

export function webrtcAvailable(): boolean {
  const g = globalThis as unknown as { RTCPeerConnection?: unknown };
  if (typeof g.RTCPeerConnection === 'function') return true;
  try {
    getWebRtc();
    return true;
  } catch {
    return false;
  }
}
