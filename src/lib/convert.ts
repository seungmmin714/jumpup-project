// T-04 / §6 단위 변환. 아두이노는 원시값만 보낸다 — 변환은 전부 여기서.

export const SOIL_RAW_DRY = 1000; // 공기 중 기준
export const SOIL_RAW_WET = 350; // 물속 기준

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const toTemperature = (x: number | null): number | null => (x === null ? null : x / 10);

export const toSoilMoisture = (raw: number | null): number | null =>
  raw === null
    ? null
    : clamp(Math.round(((SOIL_RAW_DRY - raw) / (SOIL_RAW_DRY - SOIL_RAW_WET)) * 100), 0, 100);

export const toLightLevel = (raw: number | null): number | null =>
  raw === null ? null : clamp(Math.round((raw / 1023) * 100), 0, 100);

/** 목표 습도(%) → 임계 원시값. S 명령 생성 시 사용 */
export const pctToRaw = (pct: number): number =>
  Math.round(SOIL_RAW_DRY - (pct / 100) * (SOIL_RAW_DRY - SOIL_RAW_WET));

export type LightBand = 'dark' | 'dim' | 'good' | 'bright';

/** §6 조도 표시 구간 */
export function lightBand(level: number | null): LightBand | null {
  if (level === null) return null;
  if (level <= 20) return 'dark';
  if (level <= 45) return 'dim';
  if (level <= 80) return 'good';
  return 'bright';
}

export const LIGHT_BAND_LABEL: Record<LightBand, string> = {
  dark: '어두움',
  dim: '약간 어두움',
  good: '적정',
  bright: '매우 밝음',
};

export type SoilBand = 'dry' | 'good' | 'wet';

/**
 * §9.3 토양수분 상태. 임계 판단은 화분과 동일하게 **원시값** 기준으로 한다.
 * soilRaw >= soilDry → 건조 / soilRaw <= soilWet → 과습 / 그 사이 → 적정
 */
export function soilBand(soilRaw: number | null, soilDry: number, soilWet: number): SoilBand | null {
  if (soilRaw === null) return null;
  if (soilRaw >= soilDry) return 'dry';
  if (soilRaw <= soilWet) return 'wet';
  return 'good';
}

export const SOIL_BAND_LABEL: Record<SoilBand, string> = {
  dry: '물이 필요해요',
  good: '적정',
  wet: '충분해요',
};

export const SOIL_BAND_SHORT: Record<SoilBand, string> = {
  dry: '건조',
  good: '적정',
  wet: '과습 주의',
};

/**
 * 게이지 위치(0~100, 왼쪽=건조·오른쪽=과습)로 정규화한다.
 * 원시값은 클수록 건조하므로 축이 뒤집힌다 → 습도(%)를 그대로 쓰면 된다.
 */
export const soilGaugePos = (soilRaw: number | null): number | null => toSoilMoisture(soilRaw);
