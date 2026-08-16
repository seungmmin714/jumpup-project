// T-10 — 급수 가이드 상태 머신 (§11).
// 화분은 물을 주지 않는다. 사람이 붓고, 앱은 "지금 멈춰야 하는지"를 알려준다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FAST_SAMPLING_MAX_MS, cmdFastSampling } from '@/ble/constants';
import { soilBand, toSoilMoisture } from '@/lib/convert';
import { sendCommand } from '@/store/bleBridge';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { EXP_ON_WATER, useCharacterStore } from '@/store/characterStore';
import { postCareLog } from '@/api/pots';
import { trackQuest } from '@/store/questStore';

/** §11.2 물이 스며들어 센서에 닿기까지 걸리는 시간 */
export const SOAK_WAIT_MS = 30_000;
export const TOTAL_ROUNDS = 3;
/** §11.3 급수 완료 후 30분 내 재진입이면 확인 단계 */
export const RECENT_WATER_MS = 30 * 60_000;
/**
 * F-01 급수로 인정하는 최소 변화량(원시값).
 * 절대 위치로 판정하면 이미 촉촉한 흙에서 시작할 때 물을 붓기도 전에
 * "그만! 딱 좋아요"가 떠 버린다. 세션 시작값(baseline) 대비 변화를 본다.
 */
const MIN_RISE_RAW = 20;

/** §11.2 60초간 변화가 없으면 안내 */
const NO_CHANGE_MS = 60_000;
const NO_CHANGE_EPSILON = 6; // raw 기준

export type WaterPhase =
  | 'confirm-recent' // 방금 물을 줬어요 — 정말 더 줄까요?
  | 'confirm-moist' // F-02 흙이 이미 촉촉함 — 그래도 줄까요?
  | 'blocked-wet' // F-02 과습 — 진입 차단
  | 'intro' // 권장량 안내
  | 'pour' // 붓는 중 (실시간 게이지)
  | 'soak' // 30초 스며드는 중
  | 'check' // 회차 판정
  | 'done' // 완료
  | 'static'; // 미연결 — 정적 안내 모드

export type WaterVerdict = 'need-more' | 'perfect' | 'too-much' | 'timeout' | 'incomplete';

export interface WaterGuide {
  phase: WaterPhase;
  round: number;
  verdict: WaterVerdict | null;
  soilRaw: number | null;
  soilPct: number | null;
  band: ReturnType<typeof soilBand>;
  startedPct: number | null;
  perRoundMl: number;
  /** 3분 타임아웃까지 남은 시간(ms) */
  remainingMs: number;
  soakRemainingMs: number;
  fastSamplingOn: boolean;
  /** 값이 60초간 움직이지 않음 */
  stalled: boolean;
  /** 목표 구간에 처음 진입한 순간 true (햅틱 트리거용) */
  reachedTarget: boolean;
  /** 세션 시작 시점의 원시값. 종료 시 폐기한다 */
  baselineRaw: number | null;
  /** 세션 시작 이후 늘어난 양(원시값 감소분). 아직 안 부었으면 0 */
  risenRaw: number;
  /** 물이 실제로 들어왔다고 볼 만큼 값이 움직였는가 */
  hasRisen: boolean;
  overWatered: boolean;
  live: boolean;

  begin: () => void;
  proceedAnyway: () => void;
  finishPour: () => void;
  skipSoak: () => void;
  nextRound: () => void;
  complete: (v: WaterVerdict) => void;
  exit: () => void;
}

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
};

export function useWaterGuide(): WaterGuide {
  const live = useConnectionStore(canControl);
  const plant = usePotStore(selectedPlant);
  const potId = usePotStore((s) => s.selectedPotId);
  const lastWateredAt = usePotStore((s) => s.lastWateredAt);
  const setLastWateredAt = usePotStore((s) => s.setLastWateredAt);
  const latest = useTelemetryStore((s) => s.latest);
  const addExp = useCharacterStore((s) => s.addExp);
  const celebrate = useCharacterStore((s) => s.celebrate);

  const recentlyWatered =
    lastWateredAt !== null && Date.now() - Date.parse(lastWateredAt) < RECENT_WATER_MS;

  /**
   * F-02 진입 가드.
   * 과습이 이 제품의 주된 실패 모드라 관성이 "안 주는 쪽"을 향하게 한다.
   * 우선순위: 미연결 → 과습 차단 → 최근 급수 → 촉촉함 확인 → 안내
   */
  const [phase, setPhase] = useState<WaterPhase>(() => {
    if (!live) return 'static';
    const raw = latest?.soilRaw ?? null;
    if (raw === null) return 'static'; // 센서값 결측도 정적 안내로
    const entryBand = soilBand(raw, plant.soilDry, plant.soilWet);
    if (entryBand === 'wet') return 'blocked-wet';
    if (recentlyWatered) return 'confirm-recent';
    if (entryBand === 'good') return 'confirm-moist';
    return 'intro';
  });
  const [round, setRound] = useState(1);
  const [verdict, setVerdict] = useState<WaterVerdict | null>(null);
  const [startedPct, setStartedPct] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(FAST_SAMPLING_MAX_MS);
  const [soakRemainingMs, setSoakRemainingMs] = useState(SOAK_WAIT_MS);
  const [fastSamplingOn, setFastSamplingOn] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [reachedTarget, setReachedTarget] = useState(false);
  const [baselineRaw, setBaselineRaw] = useState<number | null>(null);

  const soilRaw = latest?.soilRaw ?? null;
  const soilPct = toSoilMoisture(soilRaw);
  const band = soilBand(soilRaw, plant.soilDry, plant.soilWet);
  const overWatered = band === 'wet';

  // F-01 판정의 기준은 절대 위치가 아니라 세션 시작 대비 변화량이다.
  // soilRaw는 클수록 건조하므로 물을 부으면 값이 감소한다.
  const risenRaw = baselineRaw === null || soilRaw === null ? 0 : Math.max(0, baselineRaw - soilRaw);
  const hasRisen = risenRaw >= MIN_RISE_RAW;
  const perRoundMl = Math.round(plant.waterMl / TOTAL_ROUNDS / 10) * 10;

  const startedAt = useRef<number | null>(null);
  const lastChangeAt = useRef<number>(Date.now());
  const lastRawSeen = useRef<number | null>(null);
  const completed = useRef(false);
  const targetHit = useRef(false);

  // ── R:1 / R:0 ────────────────────────────────────────────────
  const setFast = useCallback(
    async (on: boolean) => {
      if (!live && on) return;
      const res = await sendCommand(cmdFastSampling(on), 'R');
      if (res.ok) setFastSamplingOn(on);
    },
    [live],
  );

  // 차단·확인 단계에서는 R:1을 보내지 않는다 (F-02 DoD)
  const isActive = phase === 'pour' || phase === 'soak' || phase === 'check';

  useEffect(() => {
    if (!isActive) return;
    void setFast(true);
    startedAt.current = Date.now();
    // 화면 이탈·언마운트 시 반드시 R:0 (§11.3, §13)
    return () => {
      void setFast(false);
    };
  }, [isActive, setFast]);

  // 백그라운드로 넘어가도 R:0
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && fastSamplingOn) void setFast(false);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [fastSamplingOn, setFast]);

  // ── 3분 타임아웃 (§11.3) ─────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      const elapsed = Date.now() - (startedAt.current ?? Date.now());
      const left = FAST_SAMPLING_MAX_MS - elapsed;
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        setVerdict('timeout');
        setPhase('done');
      }
    }, 500);
    return () => clearInterval(t);
  }, [isActive]);

  // ── 30초 스며듦 대기 ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'soak') return;
    const startedSoakAt = Date.now();
    setSoakRemainingMs(SOAK_WAIT_MS);
    const t = setInterval(() => {
      const left = SOAK_WAIT_MS - (Date.now() - startedSoakAt);
      setSoakRemainingMs(Math.max(0, left));
      if (left <= 0) setPhase('check');
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  // ── 값 변화 감시 (§11.2 60초간 무변화) ───────────────────────
  useEffect(() => {
    if (!isActive || soilRaw === null) return;
    if (lastRawSeen.current === null || Math.abs(soilRaw - lastRawSeen.current) >= NO_CHANGE_EPSILON) {
      lastRawSeen.current = soilRaw;
      lastChangeAt.current = Date.now();
      setStalled(false);
    }
  }, [soilRaw, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      setStalled(Date.now() - lastChangeAt.current > NO_CHANGE_MS);
    }, 2000);
    return () => clearInterval(t);
  }, [isActive]);

  // ── 목표 진입 / 초과 감지 (§11.1 4·5단계) ────────────────────
  useEffect(() => {
    if (!isActive || band === null) return;
    // 아직 물이 들어오지 않았으면 "그만" 계열 문구를 띄우지 않는다
    if (band === 'good' && hasRisen && !targetHit.current) {
      targetHit.current = true;
      setReachedTarget(true);
      vibrate([60, 40, 60]); // "그만! 딱 좋아요"
    }
    if (band === 'wet') {
      vibrate([180, 80, 180]); // "너무 많아요!"
    }
  }, [band, isActive, hasRisen]);

  // ── 완료 처리 ────────────────────────────────────────────────
  const complete = useCallback(
    (v: WaterVerdict) => {
      if (completed.current) return;
      completed.current = true;
      setVerdict(v);
      setPhase('done');
      setBaselineRaw(null); // F-01 세션 종료 — baseline 폐기
      void setFast(false);

      const at = new Date().toISOString();
      setLastWateredAt(at);
      trackQuest('water');

      if (potId) {
        postCareLog(potId, {
          type: 'water',
          at,
          soilBefore: startedPct,
          soilAfter: soilPct,
          amountMl: plant.waterMl,
          guided: true,
        });
      }
      // §10.3 급수 가이드 정상 완료 시 +30 EXP
      if (v === 'perfect') celebrate('물 주기 완료!', EXP_ON_WATER);
      else if (v === 'need-more' || v === 'incomplete') addExp(Math.round(EXP_ON_WATER / 2));
    },
    [addExp, celebrate, plant.waterMl, potId, setFast, setLastWateredAt, soilPct, startedPct],
  );

  const begin = useCallback(() => {
    completed.current = false;
    targetHit.current = false;
    setStartedPct(soilPct);
    setBaselineRaw(soilRaw); // F-01 세션 시작값
    setVerdict(null);
    setRound(1);
    setReachedTarget(false);
    setPhase('pour');
  }, [soilPct, soilRaw]);

  const proceedAnyway = useCallback(() => setPhase('intro'), []);
  const finishPour = useCallback(() => setPhase('soak'), []);
  const skipSoak = useCallback(() => setPhase('check'), []);

  const nextRound = useCallback(() => {
    if (round >= TOTAL_ROUNDS) {
      complete('incomplete');
      return;
    }
    setRound((r) => r + 1);
    setPhase('pour');
  }, [complete, round]);

  const exit = useCallback(() => {
    void setFast(false);
  }, [setFast]);

  // 판정 단계 자동 결론
  useEffect(() => {
    if (phase !== 'check') return;
    if (band === 'wet') complete('too-much');
    else if (band === 'good' && hasRisen) complete('perfect');
    // 'dry'면 사용자가 다음 회차로 진행한다
  }, [phase, band, hasRisen, complete]);

  return useMemo(
    () => ({
      phase,
      round,
      verdict,
      soilRaw,
      soilPct,
      band,
      startedPct,
      perRoundMl,
      remainingMs,
      soakRemainingMs,
      fastSamplingOn,
      stalled,
      reachedTarget,
      baselineRaw,
      risenRaw,
      hasRisen,
      overWatered,
      live,
      begin,
      proceedAnyway,
      finishPour,
      skipSoak,
      nextRound,
      complete,
      exit,
    }),
    [
      phase, round, verdict, soilRaw, soilPct, band, startedPct, perRoundMl, remainingMs,
      soakRemainingMs, fastSamplingOn, stalled, reachedTarget, baselineRaw, risenRaw, hasRisen,
      overWatered, live,
      begin, proceedAnyway, finishPour, skipSoak, nextRound, complete, exit,
    ],
  );
}
