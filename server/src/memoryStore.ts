// DATABASE_URL이 없으면 쓰는 인메모리 저장소.
// 하드웨어·DB 없이도 웹을 끝까지 돌려보기 위한 것이며, 프로세스가 죽으면 사라진다.

import type { CareLogRow, Store, TelemetryRow } from './types.ts';

const OK_GAP_CAP_MS = 60_000;

export class MemoryStore implements Store {
  private telemetry = new Map<string, TelemetryRow[]>();
  private seen = new Set<string>();
  private logs = new Map<string, CareLogRow[]>();
  private plants = new Map<string, string>();
  private nextId = 1;

  async init(): Promise<void> {
    /* 준비할 것 없음 */
  }

  async insertTelemetry(row: TelemetryRow): Promise<boolean> {
    const key = `${row.potId}|${row.seq}|${row.measuredAt}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);

    const arr = this.telemetry.get(row.potId) ?? [];
    arr.push(row);
    arr.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
    // 메모리 보호: 화분당 최근 20000건만 남긴다
    this.telemetry.set(row.potId, arr.slice(-20_000));
    return true;
  }

  async latestTelemetry(potId: string): Promise<TelemetryRow | null> {
    const arr = this.telemetry.get(potId);
    return arr && arr.length > 0 ? arr[arr.length - 1]! : null;
  }

  async telemetrySince(potId: string, sinceIso: string): Promise<TelemetryRow[]> {
    const since = Date.parse(sinceIso);
    return (this.telemetry.get(potId) ?? []).filter((r) => Date.parse(r.measuredAt) >= since);
  }

  async okSecondsTotal(potId: string): Promise<number> {
    const rows = this.telemetry.get(potId) ?? [];
    let ms = 0;
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i - 1]!.mood !== 0) continue;
      const gap = Date.parse(rows[i]!.measuredAt) - Date.parse(rows[i - 1]!.measuredAt);
      ms += Math.min(Math.max(0, gap), OK_GAP_CAP_MS);
    }
    return Math.round(ms / 1000);
  }

  async insertCareLog(row: Omit<CareLogRow, 'id'>): Promise<CareLogRow> {
    const full: CareLogRow = { ...row, id: String(this.nextId++) };
    const arr = this.logs.get(row.potId) ?? [];
    arr.push(full);
    this.logs.set(row.potId, arr);
    return full;
  }

  async careLogs(potId: string, limit: number): Promise<CareLogRow[]> {
    return [...(this.logs.get(potId) ?? [])]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, limit);
  }

  async lastWateredAt(potId: string): Promise<string | null> {
    const water = (this.logs.get(potId) ?? []).filter((l) => l.type === 'water');
    if (water.length === 0) return null;
    return water.reduce((a, b) => (Date.parse(a.at) > Date.parse(b.at) ? a : b)).at;
  }

  async guidedWaterCount(potId: string): Promise<number> {
    return (this.logs.get(potId) ?? []).filter((l) => l.type === 'water' && l.guided).length;
  }

  async getPlantId(potId: string): Promise<string | null> {
    return this.plants.get(potId) ?? null;
  }

  async setPlantId(potId: string, plantId: string): Promise<void> {
    this.plants.set(potId, plantId);
  }
}
