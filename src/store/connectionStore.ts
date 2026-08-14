// T-05 — 연결 상태 머신. §7의 7개 상태를 그대로 노출한다.

import { create } from 'zustand';
import { CORRUPT_THRESHOLD, CORRUPT_WINDOW_MS, SUPPORTED_PROTO_VER } from '@/ble/constants';
import type { AckCode, ConnectionErrorKind, ConnectionState, PlantProfile } from '@/ble/types';

export interface AckRecord {
  cmd: AckCode;
  result: string;
  at: number;
  ok: boolean;
}

interface ConnectionStoreState {
  state: ConnectionState;
  errorKind: ConnectionErrorKind | null;
  deviceName: string | null;
  protoVer: number | null;
  fwVer: string | null;
  /** 마지막으로 D를 받은 시각 — "N분 전 상태" 계산용 */
  lastPacketAt: number | null;
  /** 손상 패킷 타임스탬프 (5분 창) */
  corruptAt: number[];
  unstable: boolean;
  lastAck: AckRecord | null;
  /** 응답 대기 중인 명령 — 버튼 비활성에 사용(§13) */
  inflight: AckCode[];
  /** 화분에서 읽은 프로파일 (A,Q 결과) */
  deviceProfile: PlantProfile | null;

  setState: (s: ConnectionState, e?: ConnectionErrorKind | null) => void;
  setDeviceName: (n: string | null) => void;
  setHello: (protoVer: number, fwVer: string) => void;
  markPacket: () => void;
  markCorrupt: () => void;
  pushAck: (a: AckRecord) => void;
  setInflight: (cmd: AckCode, on: boolean) => void;
  setDeviceProfile: (p: PlantProfile | null) => void;
  resetConnection: () => void;
}

export const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  state: 'IDLE',
  errorKind: null,
  deviceName: null,
  protoVer: null,
  fwVer: null,
  lastPacketAt: null,
  corruptAt: [],
  unstable: false,
  lastAck: null,
  inflight: [],
  deviceProfile: null,

  setState: (s, e) =>
    set({
      state: s,
      errorKind: e === undefined ? (s === 'ERROR' ? get().errorKind : null) : e,
      ...(s === 'IDLE' || s === 'DISCONNECTED' ? { inflight: [] } : {}),
    }),

  setDeviceName: (n) => set({ deviceName: n }),

  setHello: (protoVer, fwVer) => set({ protoVer, fwVer }),

  markPacket: () => set({ lastPacketAt: Date.now() }),

  markCorrupt: () => {
    const now = Date.now();
    const corruptAt = [...get().corruptAt, now].filter((t) => now - t <= CORRUPT_WINDOW_MS);
    set({ corruptAt, unstable: corruptAt.length > CORRUPT_THRESHOLD });
  },

  pushAck: (a) => set({ lastAck: a }),

  setInflight: (cmd, on) => {
    const cur = get().inflight;
    set({ inflight: on ? [...new Set([...cur, cmd])] : cur.filter((c) => c !== cmd) });
  },

  setDeviceProfile: (p) => set({ deviceProfile: p }),

  resetConnection: () =>
    set({
      state: 'IDLE',
      errorKind: null,
      deviceName: null,
      protoVer: null,
      fwVer: null,
      lastPacketAt: null,
      corruptAt: [],
      unstable: false,
      lastAck: null,
      inflight: [],
      deviceProfile: null,
    }),
}));

// ───────── 파생 상태 ─────────

/** 실시간 제어가 가능한 상태인가 */
export const isLive = (s: ConnectionStoreState): boolean =>
  s.state === 'CONNECTED' || s.state === 'STALE';

/** §5.2 protoVer !== 3 → 전 제어 잠금 */
export const isProtoOk = (s: ConnectionStoreState): boolean =>
  s.protoVer === null || s.protoVer === SUPPORTED_PROTO_VER;

/** 제어 명령을 보낼 수 있는가 (§9.2 비활성 규칙) */
export const canControl = (s: ConnectionStoreState): boolean => isLive(s) && isProtoOk(s);

export const BADGE: Record<ConnectionState, { label: string; tone: string; dot: string }> = {
  IDLE: { label: '연결 안 됨', tone: 'bg-line text-ink-sub', dot: 'bg-ink-sub' },
  REQUESTING: { label: '기기 선택 중', tone: 'bg-primary-soft text-primary', dot: 'bg-primary' },
  CONNECTING: { label: '연결 중…', tone: 'bg-primary-soft text-primary', dot: 'bg-primary' },
  CONNECTED: { label: '연결됨', tone: 'bg-primary-soft text-primary', dot: 'bg-primary' },
  STALE: { label: '동기화 지연', tone: 'bg-warn/15 text-warn', dot: 'bg-warn' },
  DISCONNECTED: { label: '연결 끊김', tone: 'bg-line text-ink-sub', dot: 'bg-ink-sub' },
  ERROR: { label: '연결 오류', tone: 'bg-danger/15 text-danger', dot: 'bg-danger' },
};

export const ERROR_MESSAGE: Record<ConnectionErrorKind, { title: string; hint: string }> = {
  unsupported: {
    title: '이 브라우저는 화분 연결을 지원하지 않아요',
    hint: '블루투스는 안드로이드 Chrome, USB는 PC 크롬에서 연결해 주세요.',
  },
  permission: {
    title: '블루투스 권한이 필요해요',
    hint: '기기 선택 창에서 GROWME 화분을 선택해 주세요.',
  },
  'not-found': {
    title: '화분을 찾지 못했어요',
    hint: '화분 전원이 켜져 있는지, 3m 이내에 있는지 확인해 주세요.',
  },
  gatt: {
    title: '연결에 실패했어요',
    hint: '화분 전원을 껐다 켠 뒤 다시 시도해 주세요.',
  },
  'port-busy': {
    title: '포트를 사용할 수 없어요',
    hint: '다른 프로그램이 포트를 사용 중입니다. 아두이노 IDE의 시리얼 모니터를 닫아주세요.',
  },
  'port-open': {
    title: '포트를 열지 못했어요',
    hint: 'USB 케이블을 다시 꽂고 시도해 주세요.',
  },
  unknown: {
    title: '알 수 없는 오류가 발생했어요',
    hint: '잠시 후 다시 시도해 주세요.',
  },
};
