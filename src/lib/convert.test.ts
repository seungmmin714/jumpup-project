import { describe, expect, it } from 'vitest';
import {
  lightBand,
  pctToRaw,
  soilBand,
  toLightLevel,
  toSoilMoisture,
  toTemperature,
} from './convert';

describe('T-04 단위 변환 경계값', () => {
  it('toTemperature: null / 음수 / 경계', () => {
    expect(toTemperature(null)).toBeNull();
    expect(toTemperature(0)).toBe(0);
    expect(toTemperature(235)).toBe(23.5);
    expect(toTemperature(-400)).toBe(-40);
    expect(toTemperature(1000)).toBe(100);
  });

  it('toSoilMoisture: 0/1023/null 및 건습 기준점', () => {
    expect(toSoilMoisture(null)).toBeNull();
    expect(toSoilMoisture(1000)).toBe(0); // 공기 중 = 0%
    expect(toSoilMoisture(350)).toBe(100); // 물속 = 100%
    expect(toSoilMoisture(1023)).toBe(0); // 하한 클램프
    expect(toSoilMoisture(0)).toBe(100); // 상한 클램프
    expect(toSoilMoisture(675)).toBe(50);
    expect(toSoilMoisture(612)).toBe(60);
  });

  it('toLightLevel: 0/1023/null', () => {
    expect(toLightLevel(null)).toBeNull();
    expect(toLightLevel(0)).toBe(0);
    expect(toLightLevel(1023)).toBe(100);
    expect(toLightLevel(780)).toBe(76);
  });

  it('pctToRaw ↔ toSoilMoisture 왕복', () => {
    for (const pct of [0, 15, 35, 45, 65, 70, 100]) {
      expect(toSoilMoisture(pctToRaw(pct))).toBe(pct);
    }
    expect(pctToRaw(45)).toBe(708); // §11.4 방울토마토 soilDry
    expect(pctToRaw(65)).toBe(578); // §11.4 방울토마토 soilWet
  });

  it('lightBand 구간 경계', () => {
    expect(lightBand(null)).toBeNull();
    expect(lightBand(0)).toBe('dark');
    expect(lightBand(20)).toBe('dark');
    expect(lightBand(21)).toBe('dim');
    expect(lightBand(45)).toBe('dim');
    expect(lightBand(46)).toBe('good');
    expect(lightBand(80)).toBe('good');
    expect(lightBand(81)).toBe('bright');
    expect(lightBand(100)).toBe('bright');
  });

  it('soilBand: 원시값 기준 3구간 (방울토마토 708/578)', () => {
    expect(soilBand(null, 708, 578)).toBeNull();
    expect(soilBand(708, 708, 578)).toBe('dry'); // 이상 → 건조
    expect(soilBand(709, 708, 578)).toBe('dry');
    expect(soilBand(707, 708, 578)).toBe('good');
    expect(soilBand(579, 708, 578)).toBe('good');
    expect(soilBand(578, 708, 578)).toBe('wet'); // 이하 → 과습
    expect(soilBand(350, 708, 578)).toBe('wet');
  });
});
