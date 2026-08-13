import { create } from 'zustand';
import { RENDER_THROTTLE_MS, MISSING_WARN_COUNT } from '@/ble/constants';
import { seqGap } from '@/ble/parser';
import { toLightLevel, toSoilMoisture, toTemperature } from '@/lib/convert';
import type { Mood, SensorPacket, Telemetry } from '@/ble/types';

export interface MissingStreak {
  soil: number;
  temp: number;
  humi: number;
  light: number;
}

const ZERO_STREAK: MissingStreak = { soil: 0, temp: 0, humi: 0, light: 0 };

export interface TelemetryState {
  latest: Telemetry | null;
  /** 메모리 전용 히스토리. localStorage에 쌓지 않는다(§16). */
  history: Telemetry[];
  lastSeq: number | null;
  lostPackets: number;
  duplicatePackets: number;
  missingStreak: MissingStreak;
  /** 소스 표시: 실시간 BLE인지, 서버의 마지막 상태인지 */
  source: 'ble' | 'server' | null;

  ingest: (p: SensorPacket, potId: string) => void;
  /** §12.2 latest 응답을 그대로 화면에 올릴 때 사용 (T-13) */
  setFromServer: (t: Telemetry) => void;
  reset: () => void;
}

const HISTORY_LIMIT = 720; // 5초 주기 기준 약 1시간

/** 초당 1회만 렌더링(§5.6). 파서 → 스토어 사이의 유일한 스로틀 지점. */
let pending: { packet: SensorPacket; potId: string } | null = null;
let lastCommitAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useTelemetryStore = create<TelemetryState>((set, get) => {
  const commit = (packet: SensorPacket, potId: string) => {
    lastCommitAt = Date.now();
    const t: Telemetry = {
      potId,
      measuredAt: new Date().toISOString(), // 화분에 RTC가 없다 → 브라우저가 부여(§6)
      soilRaw: packet.soilRaw,
      soilMoisture: toSoilMoisture(packet.soilRaw),
      temperature: toTemperature(packet.tempX10),
      humidity: packet.humi,
      lightRaw: packet.lightRaw,
      lightLevel: toLightLevel(packet.lightRaw),
      mood: packet.mood,
      seq: packet.seq,
    };

    const prev = get();
    const streak: MissingStreak = {
      soil: packet.soilRaw === null ? prev.missingStreak.soil + 1 : 0,
      temp: packet.tempX10 === null ? prev.missingStreak.temp + 1 : 0,
      humi: packet.humi === null ? prev.missingStreak.humi + 1 : 0,
      light: packet.lightRaw === null ? prev.missingStreak.light + 1 : 0,
    };

    set({
      latest: t,
      history: [...prev.history, t].slice(-HISTORY_LIMIT),
      missingStreak: streak,
      source: 'ble',
    });
  };

  return {
    latest: null,
    history: [],
    lastSeq: null,
    lostPackets: 0,
    duplicatePackets: 0,
    missingStreak: { ...ZERO_STREAK },
    source: null,

    ingest: (packet, potId) => {
      const { lastSeq } = get();
      const gap = seqGap(lastSeq, packet.seq);

      if (gap === -1) {
        set({ duplicatePackets: get().duplicatePackets + 1 }); // 동일 seq는 무시(§5.6)
        return;
      }
      if (gap >= 2) set({ lostPackets: get().lostPackets + (gap - 1) });
      set({ lastSeq: packet.seq });

      const now = Date.now();
      if (now - lastCommitAt >= RENDER_THROTTLE_MS) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        pending = null;
        commit(packet, potId);
        return;
      }
      // 스로틀 구간이면 마지막 값만 남겼다가 한 번에 반영한다.
      pending = { packet, potId };
      if (!flushTimer) {
        flushTimer = setTimeout(
          () => {
            flushTimer = null;
            if (pending) {
              const { packet: p, potId: id } = pending;
              pending = null;
              commit(p, id);
            }
          },
          Math.max(0, RENDER_THROTTLE_MS - (now - lastCommitAt)),
        );
      }
    },

    setFromServer: (t) => set({ latest: t, source: 'server' }),

    reset: () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      pending = null;
      lastCommitAt = 0;
      set({
        latest: null,
        history: [],
        lastSeq: null,
        lostPackets: 0,
        duplicatePackets: 0,
        missingStreak: { ...ZERO_STREAK },
        source: null,
      });
    },
  };
});

// ───────── 파생 셀렉터 ─────────

export const selectMood = (s: TelemetryState): Mood => s.latest?.mood ?? 0;

/** §9.2 같은 필드 3회 연속 결측이면 경고 아이콘 */
export const isFieldWarned = (streak: MissingStreak, key: keyof MissingStreak): boolean =>
  streak[key] >= MISSING_WARN_COUNT;

/** §9.2 전 필드 결측이면 "센서 연결 확인" 배너 */
export const allSensorsMissing = (t: Telemetry | null): boolean =>
  t !== null &&
  t.soilRaw === null &&
  t.temperature === null &&
  t.humidity === null &&
  t.lightRaw === null;
