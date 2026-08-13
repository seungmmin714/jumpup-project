// 그로미 백엔드 — §12 API 계약을 그대로 구현한다.
// DATABASE_URL이 있으면 PostgreSQL, 없으면 인메모리로 뜬다.

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { MemoryStore } from './memoryStore.ts';
import { DEFAULT_PLANT_ID, PLANTS } from './plants.ts';
import { happiness, levelOf, stageOf, totalExp } from './gamify.ts';
import type { CareLogType, Mood, Store, TelemetryRow } from './types.ts';

const PORT = Number(process.env.PORT ?? 4000);
const DAY_MS = 24 * 60 * 60_000;

const app = express();
app.use(express.json({ limit: '256kb' }));

// 웹을 다른 오리진에서 띄우는 경우를 위한 최소 CORS
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

let store: Store;

// ───────── 검증 헬퍼 ─────────

class BadRequest extends Error {}

/**
 * Express 4는 async 핸들러가 던진 예외를 오류 미들웨어로 넘기지 않는다.
 * 모든 비동기 라우트를 이 래퍼로 감싼다.
 */
type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;
const ah =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

const potIdOf = (raw: string): string => {
  const id = String(raw ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(id)) throw new BadRequest('potId 형식이 올바르지 않습니다');
  return id;
};

function optNum(v: unknown, lo: number, hi: number): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n >= lo && n <= hi ? n : null; // 범위 이탈은 null (§13)
}

function reqInt(v: unknown, lo: number, hi: number, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new BadRequest(`${name} 값이 올바르지 않습니다`);
  return Math.round(n);
}

function isoOf(v: unknown, name: string): string {
  const t = Date.parse(String(v ?? ''));
  if (Number.isNaN(t)) throw new BadRequest(`${name} 시각 형식이 올바르지 않습니다`);
  return new Date(t).toISOString();
}

// ───────── §12.1 텔레메트리 업로드 ─────────

app.post('/api/telemetry', ah(async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const row: TelemetryRow = {
    potId: potIdOf(b.potId),
    measuredAt: isoOf(b.measuredAt, 'measuredAt'),
    soilMoisture: optNum(b.soilMoisture, 0, 100),
    soilRaw: optNum(b.soilRaw, 0, 1023),
    temperature: optNum(b.temperature, -40, 100),
    humidity: optNum(b.humidity, 0, 100),
    lightLevel: optNum(b.lightLevel, 0, 100),
    lightRaw: optNum(b.lightRaw, 0, 1023),
    mood: reqInt(b.mood, 0, 6, 'mood') as Mood,
    // 서버가 마지막 상태로 되돌려줄 때 쓰는 값이라 -1(서버 유래)도 받아준다
    seq: reqInt(b.seq, -1, 255, 'seq'),
    protoVer: reqInt(b.protoVer, 0, 255, 'protoVer'),
    fwVer: String(b.fwVer ?? '').slice(0, 16) || '0',
    source: String(b.source ?? 'ble-web').slice(0, 32),
  };

  const inserted = await store.insertTelemetry(row);
  res.status(inserted ? 201 : 200).json({ ok: true, duplicate: !inserted });
}));

// ───────── §12.2 마지막 상태 조회 ─────────

app.get('/api/pots/:potId/latest', ah(async (req: Request, res: Response) => {
  const potId = potIdOf(req.params.potId);
  const t = await store.latestTelemetry(potId);
  if (!t) {
    res.status(404).json({ error: '아직 기록이 없는 화분입니다', potId });
    return;
  }
  res.json({
    potId,
    measuredAt: t.measuredAt,
    ageSeconds: Math.max(0, Math.round((Date.now() - Date.parse(t.measuredAt)) / 1000)),
    soilMoisture: t.soilMoisture,
    temperature: t.temperature,
    humidity: t.humidity,
    lightLevel: t.lightLevel,
    mood: t.mood,
    lastWateredAt: await store.lastWateredAt(potId),
    plantId: (await store.getPlantId(potId)) ?? DEFAULT_PLANT_ID,
  });
}));

// ───────── §12.3 급수·돌봄 기록 ─────────

const CARE_TYPES: CareLogType[] = ['water', 'move', 'ventilate', 'note'];

app.post('/api/pots/:potId/care-logs', ah(async (req: Request, res: Response) => {
  const potId = potIdOf(req.params.potId);
  const b = req.body ?? {};
  const type = String(b.type ?? '') as CareLogType;
  if (!CARE_TYPES.includes(type)) throw new BadRequest('type 값이 올바르지 않습니다');

  const saved = await store.insertCareLog({
    potId,
    type,
    at: isoOf(b.at ?? new Date().toISOString(), 'at'),
    soilBefore: optNum(b.soilBefore, 0, 100),
    soilAfter: optNum(b.soilAfter, 0, 100),
    amountMl: optNum(b.amountMl, 0, 5000),
    guided: Boolean(b.guided),
    note: b.note ? String(b.note).slice(0, 500) : null,
  });
  res.status(201).json(saved);
}));

app.get('/api/pots/:potId/care-logs', ah(async (req: Request, res: Response) => {
  const potId = potIdOf(req.params.potId);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
  res.json(await store.careLogs(potId, limit));
}));

// ───────── §12.4 캐릭터 상태 ─────────

app.get('/api/pots/:potId/character', ah(async (req: Request, res: Response) => {
  const potId = potIdOf(req.params.potId);
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [recent, okSeconds, guided] = await Promise.all([
    store.telemetrySince(potId, since),
    store.okSecondsTotal(potId),
    store.guidedWaterCount(potId),
  ]);

  const { level, exp, expToNext } = levelOf(totalExp(okSeconds, guided));
  const { stage, stageProgress } = stageOf(level);

  res.json({ level, exp, expToNext, happiness: happiness(recent), stage, stageProgress });
}));

// ───────── §12.5 도감 ─────────

app.get('/api/plants', (_req: Request, res: Response) => res.json(PLANTS));

/** 화분에 어떤 식물을 심었는지 서버에도 남긴다 (도감 선택 시) */
app.post('/api/pots/:potId/plant', ah(async (req: Request, res: Response) => {
  const potId = potIdOf(req.params.potId);
  const plantId = String(req.body?.plantId ?? '');
  if (!PLANTS.some((p) => p.plantId === plantId)) throw new BadRequest('알 수 없는 plantId 입니다');
  await store.setPlantId(potId, plantId);
  res.status(204).end();
}));

app.get('/api/health', (_req: Request, res: Response) =>
  res.json({ ok: true, store: store instanceof MemoryStore ? 'memory' : 'postgres' }),
);

// ───────── 오류 처리 ─────────

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadRequest) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error('[server]', err);
  res.status(500).json({ error: '서버 오류' });
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { PgStore } = await import('./pgStore.ts');
    store = await PgStore.create(url);
    console.log('[server] PostgreSQL 사용');
  } else {
    store = new MemoryStore();
    console.log('[server] DATABASE_URL이 없어 인메모리 저장소를 사용합니다 (재시작하면 사라짐)');
  }
  await store.init();

  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}/api`));
}

void main();
