// 사람이 물을 주는 순간을 토양 센서로 알아챈다.
//
// 화분은 물을 주지 않으므로(§1.1) 앱이 급수를 아는 방법은 센서값 변화뿐이다.
// 토양수분이 짧은 시간에 뚜렷하게 오르면 "지금 붓고 있다"로 보고,
// 캐릭터가 실시간으로 반응하게 한다. 홈 화면에 물 주기 버튼을 두지 않아도
// 사용자는 물을 부으면서 바로 피드백을 받는다.
//
// 명령을 보내지 않는다(§16). 기본 5초 주기 D 패킷만 보고 판단한다.

import { useEffect, useRef, useState } from 'react';
import { soilBand, toSoilMoisture } from '@/lib/convert';
import { useTelemetryStore } from '@/store/telemetryStore';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { useCharacterStore, EXP_ON_WATER } from '@/store/characterStore';
import { postCareLog } from '@/api/pots';

/** 이 시간 안에 일어난 상승만 급수로 본다 */
const WINDOW_MS = 60_000;
/** 급수로 인정하는 최소 상승폭 (원시값. 클수록 건조하므로 감소가 곧 상승이다) */
const RISE_RAW = 12;
/** 마지막 상승 이후 이만큼 지나면 급수가 끝난 것으로 본다 */
const SETTLE_MS = 75_000;
/** 기록으로 남길 최소 상승폭(%) */
const LOG_MIN_PCT = 6;
/** 가이드가 방금 기록했으면 중복으로 남기지 않는다 */
const RECENT_LOG_MS = 5 * 60_000;

export type WateringPhase = 'idle' | 'pouring' | 'perfect' | 'too-much';

export interface WateringState {
  phase: WateringPhase;
  /** 이번 급수로 오른 토양수분(%) */
  gainedPct: number;
}

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
};

export function useWateringDetector(): WateringState {
  const latest = useTelemetryStore((s) => s.latest);
  const source = useTelemetryStore((s) => s.source);
  const plant = usePotStore(selectedPlant);
  const potId = usePotStore((s) => s.selectedPotId);
  const lastWateredAt = usePotStore((s) => s.lastWateredAt);
  const setLastWateredAt = usePotStore((s) => s.setLastWateredAt);
  const celebrate = useCharacterStore((s) => s.celebrate);

  const [phase, setPhase] = useState<WateringPhase>('idle');
  const [gainedPct, setGainedPct] = useState(0);

  /** [시각, 원시값] 최근 표본 */
  const samples = useRef<Array<[number, number]>>([]);
  const startedPct = useRef<number | null>(null);
  const lastRiseAt = useRef(0);
  const hitTarget = useRef(false);

  const soilRaw = latest?.soilRaw ?? null;
  const seq = latest?.seq ?? null;

  useEffect(() => {
    // 서버의 마지막 상태로 그린 화면에서는 판단하지 않는다 (실시간이 아니다)
    if (soilRaw === null || source !== 'ble') return;

    const now = Date.now();
    const buf = samples.current;
    buf.push([now, soilRaw]);
    while (buf.length > 0 && now - buf[0]![0] > WINDOW_MS) buf.shift();

    // 창 안에서 가장 건조했던 값 대비 얼마나 젖었는가
    const driest = Math.max(...buf.map(([, v]) => v));
    const rise = driest - soilRaw;
    const band = soilBand(soilRaw, plant.soilDry, plant.soilWet);

    if (rise >= RISE_RAW) {
      if (startedPct.current === null) {
        startedPct.current = toSoilMoisture(driest);
        hitTarget.current = false;
      }
      lastRiseAt.current = now;
      setGainedPct(Math.max(0, (toSoilMoisture(soilRaw) ?? 0) - (startedPct.current ?? 0)));

      if (band === 'wet') {
        setPhase('too-much');
        vibrate([180, 80, 180]);
      } else if (band === 'good') {
        setPhase('perfect');
        if (!hitTarget.current) {
          hitTarget.current = true;
          vibrate([60, 40, 60]); // "그만! 딱 좋아요"
        }
      } else {
        setPhase('pouring');
      }
      return;
    }

    // 상승이 멈춘 뒤 일정 시간이 지나면 한 번의 급수로 마무리한다
    if (startedPct.current !== null && now - lastRiseAt.current > SETTLE_MS) {
      const before = startedPct.current;
      const after = toSoilMoisture(soilRaw);
      const gain = (after ?? 0) - (before ?? 0);
      startedPct.current = null;
      setPhase('idle');
      setGainedPct(0);

      if (gain < LOG_MIN_PCT) return;

      // 급수 가이드가 방금 남겼다면 중복 기록하지 않는다
      const loggedRecently =
        lastWateredAt !== null && now - Date.parse(lastWateredAt) < RECENT_LOG_MS;
      if (loggedRecently) return;

      const at = new Date().toISOString();
      setLastWateredAt(at);
      if (potId) {
        postCareLog(potId, {
          type: 'water',
          at,
          soilBefore: before,
          soilAfter: after,
          amountMl: null,
          guided: false, // 버튼을 누른 게 아니라 센서가 알아챈 급수
        });
      }
      if (band === 'good') celebrate('물 주기 완료!', EXP_ON_WATER);
    }
    // seq를 의존성에 넣어 같은 값이 다시 들어와도 한 번만 처리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return { phase, gainedPct };
}

/** 급수 중에는 기분 대사 대신 이 문구를 쓴다 */
export function wateringSpeech(phase: WateringPhase, gainedPct: number): string | null {
  switch (phase) {
    case 'pouring':
      return gainedPct >= 3 ? '앗, 물이다! 조금만 더 주세요' : '어? 물이 들어와요';
    case 'perfect':
      return '그만! 딱 좋아요 👏';
    case 'too-much':
      return '너무 많아요! 이제 멈춰주세요';
    default:
      return null;
  }
}
