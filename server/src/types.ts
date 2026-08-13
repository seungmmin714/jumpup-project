export type Mood = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TelemetryRow {
  potId: string;
  measuredAt: string;
  soilMoisture: number | null;
  soilRaw: number | null;
  temperature: number | null;
  humidity: number | null;
  lightLevel: number | null;
  lightRaw: number | null;
  mood: Mood;
  seq: number;
  protoVer: number;
  fwVer: string;
  source: string;
}

export type CareLogType = 'water' | 'move' | 'ventilate' | 'note';

export interface CareLogRow {
  id: string;
  potId: string;
  type: CareLogType;
  at: string;
  soilBefore: number | null;
  soilAfter: number | null;
  amountMl: number | null;
  guided: boolean;
  note: string | null;
}

export interface Store {
  init(): Promise<void>;
  /** (potId, seq, measuredAt) 중복은 무시한다(§12.1). 새로 저장했으면 true */
  insertTelemetry(row: TelemetryRow): Promise<boolean>;
  latestTelemetry(potId: string): Promise<TelemetryRow | null>;
  /** 행복도·EXP 계산용 — 오래된 것부터 정렬 */
  telemetrySince(potId: string, sinceIso: string): Promise<TelemetryRow[]>;
  okSecondsTotal(potId: string): Promise<number>;
  insertCareLog(row: Omit<CareLogRow, 'id'>): Promise<CareLogRow>;
  careLogs(potId: string, limit: number): Promise<CareLogRow[]>;
  lastWateredAt(potId: string): Promise<string | null>;
  guidedWaterCount(potId: string): Promise<number>;
  getPlantId(potId: string): Promise<string | null>;
  setPlantId(potId: string, plantId: string): Promise<void>;
}
