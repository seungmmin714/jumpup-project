// §10.3 게이미피케이션 — 행복도·EXP·레벨은 **서버가 계산**한다.

import type { TelemetryRow } from './types.ts';

/** 샘플 간 간격을 이만큼으로 자른다. 오래 끊긴 구간이 통계를 지배하지 않게 한다. */
const GAP_CAP_MS = 60_000;

export const EXP_PER_OK_HOUR = 10;
export const EXP_PER_GUIDED_WATER = 30;

/**
 * 행복도 = 최근 24시간 중 mood === 0 이었던 시간 비율(%).
 * 표본이 거의 없으면(5분 미만) 아직 판단하지 않고 0을 돌려준다.
 */
export function happiness(rows: TelemetryRow[]): number {
  if (rows.length < 2) return 0;
  let okMs = 0;
  let totalMs = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const gap = Math.min(
      Math.max(0, Date.parse(rows[i]!.measuredAt) - Date.parse(rows[i - 1]!.measuredAt)),
      GAP_CAP_MS,
    );
    totalMs += gap;
    if (rows[i - 1]!.mood === 0) okMs += gap;
  }

  if (totalMs < 5 * 60_000) return 0;
  return Math.round((okMs / totalMs) * 100);
}

/** mood 0 유지 1시간마다 +10, 가이드 급수 완료마다 +30 */
export function totalExp(okSeconds: number, guidedWaterCount: number): number {
  return (
    Math.floor(okSeconds / 3600) * EXP_PER_OK_HOUR + guidedWaterCount * EXP_PER_GUIDED_WATER
  );
}

export interface LevelInfo {
  level: number;
  exp: number;
  expToNext: number;
}

/** 레벨당 필요 EXP는 100에서 시작해 1.35배씩 늘어난다 (웹의 표시 규칙과 동일). */
export function levelOf(totalExpValue: number): LevelInfo {
  let level = 1;
  let need = 100;
  let remaining = totalExpValue;
  while (remaining >= need && level < 999) {
    remaining -= need;
    level += 1;
    need = Math.round(need * 1.35);
  }
  return { level, exp: remaining, expToNext: need };
}

export function stageOf(level: number): { stage: string; stageProgress: number } {
  const bands: Array<[number, number, string]> = [
    [1, 5, '씨앗 단계'],
    [5, 15, '새싹 단계'],
    [15, 30, '떡잎 단계'],
    [30, 50, '성장 단계'],
    [50, 100, '개화 단계'],
  ];
  for (const [from, to, stage] of bands) {
    if (level < to) {
      return { stage, stageProgress: Math.round(((level - from) / (to - from)) * 100) };
    }
  }
  return { stage: '개화 단계', stageProgress: 100 };
}
