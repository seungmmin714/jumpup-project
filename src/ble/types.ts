// §4 데이터 모델 — protoVer 3

export type Mood = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MOOD_OK = 0 as const;
export const MOOD_THIRSTY = 1 as const;
export const MOOD_HOT = 2 as const;
export const MOOD_COLD = 3 as const;
export const MOOD_DARK = 4 as const;
export const MOOD_OVERWATER = 5 as const;
export const MOOD_SENSOR_ERR = 6 as const;

export interface SensorPacket {
  soilRaw: number | null; // 0~1023, 클수록 건조
  tempX10: number | null; // -400~1000
  humi: number | null; // 0~100
  lightRaw: number | null; // 0~1023
  mood: Mood;
  seq: number; // 0~255 순환
}

export interface HelloPacket {
  protoVer: number;
  fwVer: string;
}

/** §5.3에서 웹이 보낼 수 있는 명령. W(급수)·N(영양)은 v2.0에서 삭제됨. */
export type CommandCode = 'F' | 'L' | 'S' | 'Q' | 'P' | 'R';
export type AckCode = CommandCode | 'N' | '?';

export interface AckPacket {
  cmd: AckCode;
  /** 'OK' | 'ERR:RANGE' | 'ERR:CMD' | 'ERR:NOSUP' | Q 응답값(콤마 결합) */
  result: string;
}

export type Uplink =
  | { kind: 'sensor'; packet: SensorPacket }
  | { kind: 'hello'; packet: HelloPacket }
  | { kind: 'ack'; packet: AckPacket };

/** 파싱 실패 사유 — §13 손상 패킷 카운터에 사용 */
export type DropReason =
  | 'unknown-prefix'
  | 'field-count'
  | 'bad-number'
  | 'bad-mood'
  | 'buffer-overflow';

export interface ParseDrop {
  reason: DropReason;
  raw: string;
}

/** 화면 표시용 (변환 후) */
export interface Telemetry {
  potId: string;
  measuredAt: string; // ISO8601 UTC, 브라우저 수신 시각
  soilMoisture: number | null; // 0~100 %
  soilRaw: number | null;
  temperature: number | null; // ℃
  humidity: number | null;
  lightLevel: number | null; // 0~100 지수
  lightRaw: number | null;
  mood: Mood;
  seq: number;
}

/** 화분 EEPROM에 저장되는 임계값 */
export interface PlantProfile {
  soilDry: number; // 350~1023, 이 값 이상이면 건조
  soilWet: number; // 350~1023, 이 값 이하면 과습 (soilDry보다 작아야 함)
  tempMinX10: number; // -100~400
  tempMaxX10: number; // 0~500
  lightMin: number; // 0~1023
}

export interface Plant extends PlantProfile {
  plantId: string;
  nameKo: string;
  emoji: string;
  targetMinPct: number; // 목표 습도 하한 (표시용)
  targetMaxPct: number; // 목표 습도 상한 (표시용)
  waterMl: number; // 1회 권장 급수량
  description: string;
}

export type ConnectionState =
  | 'IDLE'
  | 'REQUESTING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'STALE'
  | 'DISCONNECTED'
  | 'ERROR';

export type ConnectionErrorKind =
  | 'unsupported' // Web Bluetooth 미지원 (iOS 등)
  | 'permission' // 사용자가 권한/선택 거부
  | 'not-found' // 기기 없음
  | 'gatt' // GATT 연결/서비스 실패
  | 'unknown';
