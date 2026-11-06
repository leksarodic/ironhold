import { create } from 'zustand';
import type { ClassId } from '@/game/classes';
import {
  HostSession,
  JoinSession,
  generatePeerId,
  type ConnectionStatus,
  type PeerInfo,
} from '@/net/session';
import {
  decodeRoomCode,
  encodeRoomCode,
  formatCode,
  stripCodeFormatting,
  type MessageType,
} from '@/net/protocol';
import { webrtcAvailable } from '@/net/webrtc';

export type NetRole = 'solo' | 'host' | 'joiner';

export interface NetState {
  role: NetRole;
  status: ConnectionStatus;
  statusDetail: string;
  peers: PeerInfo[];
  /** Host's offer code (joiner pastes this). */
  localCode: string;
  /** Answer the joiner must send back to the host. */
  answerCode: string;
  error: string | null;
  seed: number;
  selfId: string;
  connecting: boolean;
  /** Whether WebRTC can actually run on this platform. */
  available: boolean;
  /** Messages received, for the game layer to consume. */
  lastMessage: { type: MessageType; from: string; payload: unknown; at: number } | null;
}

interface NetActions {
  initSelf: () => void;
  hostSession: (identity: { name: string; classId: ClassId; level: number }) => Promise<void>;
  createInvite: () => Promise<void>;
  acceptJoinerAnswer: (
    answerCode: string,
    identity: { name: string; classId: ClassId; level: number },
  ) => Promise<void>;
  prepareJoin: (offerCode: string, identity: { name: string; classId: ClassId; level: number }) => Promise<void>;
  completeJoin: (answerCode: string, identity: { name: string; classId: ClassId; level: number }) => Promise<void>;
  leave: () => void;
  send: (type: MessageType, payload: unknown, reliable?: boolean) => void;
  consumeMessages: () => Array<{ type: MessageType; from: string; payload: unknown }>;
}

let hostSessionRef: HostSession | null = null;
let joinSessionRef: JoinSession | null = null;
const inbox: Array<{ type: MessageType; from: string; payload: unknown }> = [];

function uid(): string {
  return generatePeerId();
}

export const useNetStore = create<NetState & NetActions>((set, get) => ({
  role: 'solo',
  status: 'idle',
  statusDetail: '',
  peers: [],
  localCode: '',
  answerCode: '',
  error: null,
  seed: 0,
  selfId: '',
  connecting: false,
  available: true,
  lastMessage: null,

  initSelf: () => {
    if (get().selfId) return;
    set({ selfId: uid(), available: webrtcAvailable() });
  },

  hostSession: async (identity) => {
    get().initSelf();
    if (hostSessionRef) hostSessionRef.close();
    const self = {
      peerId: get().selfId || uid(),
      name: identity.name,
      classId: identity.classId,
      level: identity.level,
    };
    const session = new HostSession(
      {
        onStatus: (status, detail) =>
          set({ status, statusDetail: detail ?? '', connecting: status === 'connecting' || status === 'preparing' }),
        onPeers: (peers) => set({ peers }),
        onError: (error) => set({ error }),
        onMessage: (type, from, payload) => {
          inbox.push({ type, from, payload });
          set({ lastMessage: { type, from, payload, at: Date.now() } });
        },
      },
      self,
    );
    hostSessionRef = session;
    await session.start();
    set({ role: 'host', seed: session.seed, selfId: self.peerId, error: null });
  },

  createInvite: async () => {
    const session = hostSessionRef;
    if (!session) {
      set({ error: 'Start hosting first.' });
      return;
    }
    set({ connecting: true, error: null });
    try {
      const { sdp, candidates } = await session.createInvite();
      const code = encodeRoomCode({
        kind: 'offer',
        sdp,
        ice: candidates.map((c) => c.candidate),
        peerId: session.self.peerId,
        name: session.self.name,
        classId: session.self.classId,
        level: session.self.level,
        seed: session.seed,
      });
      set({ localCode: code, answerCode: '', connecting: false, status: 'waiting' });
    } catch (err) {
      set({ error: (err as Error).message, connecting: false });
    }
  },

  acceptJoinerAnswer: async (answerCode, identity) => {
    const session = hostSessionRef;
    if (!session) return;
    const cleaned = stripCodeFormatting(answerCode);
    const decoded = decodeRoomCode(cleaned);
    if (!decoded) {
      set({ error: 'That answer code is not valid.' });
      return;
    }
    set({ connecting: true, error: null });
    try {
      await session.acceptAnswer(
        decoded.sdp,
        {
          peerId: decoded.peerId,
          name: decoded.name,
          classId: decoded.classId,
          level: decoded.level,
        },
        decoded.ice.map((candidate) => ({ candidate, sdpMid: '0', sdpMLineIndex: 0 })),
      );
      set({ connecting: false, answerCode: '' });
    } catch (err) {
      set({ error: (err as Error).message, connecting: false });
    }
  },

  prepareJoin: async (offerCode, identity) => {
    get().initSelf();
    const cleaned = stripCodeFormatting(offerCode);
    const decoded = decodeRoomCode(cleaned);
    if (!decoded || decoded.kind !== 'offer') {
      set({ error: 'That room code is not valid. Copy the full code from the host.' });
      return;
    }
    if (joinSessionRef) joinSessionRef.close();
    const self = {
      peerId: get().selfId || uid(),
      name: identity.name,
      classId: identity.classId,
      level: identity.level,
    };
    const session = new JoinSession(
      {
        onStatus: (status, detail) =>
          set({ status, statusDetail: detail ?? '', connecting: status === 'connecting' }),
        onPeers: (peers) => set({ peers }),
        onError: (error) => set({ error }),
        onMessage: (type, from, payload) => {
          inbox.push({ type, from, payload });
          set({ lastMessage: { type, from, payload, at: Date.now() } });
        },
      },
      self,
    );
    joinSessionRef = session;
    set({ connecting: true, error: null, role: 'joiner', seed: decoded.seed });
    try {
      await session.start();
      const answer = await session.joinWithOffer(
        decoded.sdp,
        decoded.peerId,
        decoded.seed,
        decoded.ice.map((candidate) => ({ candidate, sdpMid: '0', sdpMLineIndex: 0 })),
      );
      const answerCodeData = encodeRoomCode({
        kind: 'answer',
        sdp: answer.sdp,
        ice: answer.candidates.map((c) => c.candidate),
        peerId: self.peerId,
        name: self.name,
        classId: self.classId,
        level: self.level,
        seed: decoded.seed,
      });
      set({ answerCode: answerCodeData, connecting: false, selfId: self.peerId });
    } catch (err) {
      set({ error: (err as Error).message, connecting: false });
    }
  },

  completeJoin: async (answerCode, identity) => {
    if (!hostSessionRef) return;
    await get().acceptJoinerAnswer(answerCode, identity);
  },

  leave: () => {
    hostSessionRef?.close();
    joinSessionRef?.close();
    hostSessionRef = null;
    joinSessionRef = null;
    inbox.length = 0;
    set({
      role: 'solo',
      status: 'idle',
      statusDetail: '',
      peers: [],
      localCode: '',
      answerCode: '',
      error: null,
      connecting: false,
    });
  },

  send: (type, payload, reliable = true) => {
    const session = hostSessionRef ?? joinSessionRef;
    session?.broadcast(type, payload, reliable);
  },

  consumeMessages: () => inbox.splice(0, inbox.length),
}));

/** Present a long code in readable groups without breaking copy/paste. */
export function prettyCode(code: string): string {
  return formatCode(code, 45);
}

export function getHostSession(): HostSession | null {
  return hostSessionRef;
}

export function getJoinSession(): JoinSession | null {
  return joinSessionRef;
}
