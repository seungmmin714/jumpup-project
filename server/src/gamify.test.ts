import { describe, expect, it } from 'vitest';
import { happiness, levelOf, stageOf, totalExp } from './gamify.ts';
import type { Mood, TelemetryRow } from './types.ts';

const row = (minutesAgo: number, mood: Mood): TelemetryRow => ({
  potId: 'growme01',
  measuredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  soilMoisture: 60,
  soilRaw: 612,
  temperature: 23.5,
  humidity: 55,
  lightLevel: 76,
  lightRaw: 780,
  mood,
  seq: 0,
  protoVer: 3,
  fwVer: '2.0',
  source: 'ble-web',
});

/** minutes 배열을 5초 간격 샘플로 펼친다 */
function series(spec: Array<[minutes: number, mood: Mood]>): TelemetryRow[] {
  const out: TelemetryRow[] = [];
  let t = 0;
  for (const [minutes, mood] of spec) {
    for (let s = 0; s < minutes * 12; s += 1) {
      out.push(row(1000 - t / 12, mood));
      t += 1;
    }
  }
  return out.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
}

describe('행복도 (§10.3)', () => {
  it('표본이 부족하면 0', () => {
    expect(happiness([])).toBe(0);
    expect(happiness([row(1, 0)])).toBe(0);
    expect(happiness(series([[2, 0]]))).toBe(0); // 5분 미만
  });

  it('전 구간 정상이면 100%', () => {
    expect(happiness(series([[60, 0]]))).toBe(100);
  });

  it('절반만 정상이면 약 50%', () => {
    const h = happiness(series([
      [30, 0],
      [30, 1],
    ]));
    expect(h).toBeGreaterThanOrEqual(48);
    expect(h).toBeLessThanOrEqual(52);
  });

  it('끊긴 구간은 60초로 잘라 통계를 지배하지 않게 한다', () => {
    // 10분 정상 샘플 뒤 12시간 공백, 그 다음 나쁜 샘플 한 개
    const rows = [...series([[10, 0]]), row(1, 1), row(0.9, 1)];
    const h = happiness(rows);
    expect(h).toBeGreaterThan(80); // 공백이 1분으로만 계산됨
  });
});

describe('EXP·레벨 (§10.3)', () => {
  it('mood 0 유지 1시간당 +10, 가이드 급수당 +30', () => {
    expect(totalExp(0, 0)).toBe(0);
    expect(totalExp(3600, 0)).toBe(10);
    expect(totalExp(3599, 0)).toBe(0); // 1시간을 채워야 한다
    expect(totalExp(7200, 2)).toBe(20 + 60);
  });

  it('레벨은 100 EXP에서 시작해 1.35배씩 늘어난다', () => {
    expect(levelOf(0)).toEqual({ level: 1, exp: 0, expToNext: 100 });
    expect(levelOf(99)).toEqual({ level: 1, exp: 99, expToNext: 100 });
    expect(levelOf(100)).toEqual({ level: 2, exp: 0, expToNext: 135 });
    expect(levelOf(240)).toEqual({ level: 3, exp: 5, expToNext: 182 });
  });

  it('성장 단계는 레벨 구간으로 나뉜다', () => {
    expect(stageOf(1).stage).toBe('씨앗 단계');
    expect(stageOf(12).stage).toBe('새싹 단계');
    expect(stageOf(20).stage).toBe('떡잎 단계');
    expect(stageOf(40).stage).toBe('성장 단계');
    expect(stageOf(80).stage).toBe('개화 단계');
    expect(stageOf(10).stageProgress).toBe(50);
  });
});
