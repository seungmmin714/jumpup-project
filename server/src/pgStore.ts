// DATABASE_URL이 있으면 쓰는 PostgreSQL 저장소.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { CareLogRow, CareLogType, Mood, Store, TelemetryRow } from './types.ts';

const OK_GAP_CAP_SEC = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Pool = any;

export class PgStore implements Store {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  static async create(connectionString: string): Promise<PgStore> {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString, max: 10 });
    return new PgStore(pool);
  }

  async init(): Promise<void> {
    const sqlPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
    const sql = await readFile(sqlPath, 'utf8');
    await this.pool.query(sql);
  }

  async insertTelemetry(r: TelemetryRow): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO telemetry
         (pot_id, measured_at, soil_moisture, soil_raw, temperature, humidity,
          light_level, light_raw, mood, seq, proto_ver, fw_ver, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT ON CONSTRAINT telemetry_dedupe DO NOTHING`,
      [
        r.potId, r.measuredAt, r.soilMoisture, r.soilRaw, r.temperature, r.humidity,
        r.lightLevel, r.lightRaw, r.mood, r.seq, r.protoVer, r.fwVer, r.source,
      ],
    );
    return res.rowCount > 0;
  }

  async latestTelemetry(potId: string): Promise<TelemetryRow | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM telemetry WHERE pot_id = $1 ORDER BY measured_at DESC LIMIT 1`,
      [potId],
    );
    return rows[0] ? toTelemetry(rows[0]) : null;
  }

  async telemetrySince(potId: string, sinceIso: string): Promise<TelemetryRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM telemetry WHERE pot_id = $1 AND measured_at >= $2 ORDER BY measured_at ASC`,
      [potId, sinceIso],
    );
    return rows.map(toTelemetry);
  }

  /** 연속한 두 샘플 사이 간격을 60초로 잘라 mood=0 유지 시간을 더한다. */
  async okSecondsTotal(potId: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COALESCE(SUM(LEAST(GREATEST(gap, 0), $2)), 0) AS sec FROM (
         SELECT mood,
                EXTRACT(EPOCH FROM (LEAD(measured_at) OVER w - measured_at)) AS gap
         FROM telemetry WHERE pot_id = $1
         WINDOW w AS (ORDER BY measured_at)
       ) t WHERE mood = 0`,
      [potId, OK_GAP_CAP_SEC],
    );
    return Math.round(Number(rows[0]?.sec ?? 0));
  }

  async insertCareLog(row: Omit<CareLogRow, 'id'>): Promise<CareLogRow> {
    const { rows } = await this.pool.query(
      `INSERT INTO care_logs (pot_id, type, at, soil_before, soil_after, amount_ml, guided, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [row.potId, row.type, row.at, row.soilBefore, row.soilAfter, row.amountMl, row.guided, row.note],
    );
    return toCareLog(rows[0]);
  }

  async careLogs(potId: string, limit: number): Promise<CareLogRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM care_logs WHERE pot_id = $1 ORDER BY at DESC LIMIT $2`,
      [potId, limit],
    );
    return rows.map(toCareLog);
  }

  async lastWateredAt(potId: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT at FROM care_logs WHERE pot_id = $1 AND type = 'water' ORDER BY at DESC LIMIT 1`,
      [potId],
    );
    return rows[0] ? new Date(rows[0].at).toISOString() : null;
  }

  async guidedWaterCount(potId: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM care_logs WHERE pot_id = $1 AND type = 'water' AND guided`,
      [potId],
    );
    return rows[0]?.n ?? 0;
  }

  async getPlantId(potId: string): Promise<string | null> {
    const { rows } = await this.pool.query(`SELECT plant_id FROM pots WHERE pot_id = $1`, [potId]);
    return rows[0]?.plant_id ?? null;
  }

  async setPlantId(potId: string, plantId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO pots (pot_id, plant_id) VALUES ($1,$2)
       ON CONFLICT (pot_id) DO UPDATE SET plant_id = EXCLUDED.plant_id`,
      [potId, plantId],
    );
  }
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toTelemetry(r: any): TelemetryRow {
  return {
    potId: r.pot_id,
    measuredAt: new Date(r.measured_at).toISOString(),
    soilMoisture: num(r.soil_moisture),
    soilRaw: num(r.soil_raw),
    temperature: num(r.temperature),
    humidity: num(r.humidity),
    lightLevel: num(r.light_level),
    lightRaw: num(r.light_raw),
    mood: Number(r.mood) as Mood,
    seq: Number(r.seq),
    protoVer: Number(r.proto_ver),
    fwVer: r.fw_ver,
    source: r.source,
  };
}

function toCareLog(r: any): CareLogRow {
  return {
    id: String(r.id),
    potId: r.pot_id,
    type: r.type as CareLogType,
    at: new Date(r.at).toISOString(),
    soilBefore: num(r.soil_before),
    soilAfter: num(r.soil_after),
    amountMl: num(r.amount_ml),
    guided: Boolean(r.guided),
    note: r.note ?? null,
  };
}
