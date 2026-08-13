// T-03 — 하드웨어보다 먼저 웹을 완성하기 위한 시뮬레이터(§8).
// 실제 클라이언트와 같은 경로를 타도록, 가짜 패킷도 ASCII 라인으로 만들어
// 20바이트로 쪼갠 뒤 UplinkParser에 밀어 넣는다.

import {
  BLE_CHUNK_BYTES,
  FAST_SAMPLING_MAX_MS,
  HEARTBEAT_PERIOD_MS,
  SENSOR_FAST_PERIOD_MS,
  SENSOR_PERIOD_MS,
  SUPPORTED_PROTO_VER,
} from './constants';
import { Emitter, chunkForBle, sleep, type BleClient } from './BleClient';
import { UplinkParser } from './parser';
import { computeMoodForMock } from '@/lib/mood';
import { PLANTS } from '@/data/plants';
import type {
  AckPacket,
  ConnectionErrorKind,
  ConnectionState,
  HelloPacket,
  Mood,
  ParseDrop,
  PlantProfile,
  SensorPacket,
} from './types';

export interface MockMissing {
  soil: boolean;
  temp: boolean;
  humi: boolean;
  light: boolean;
}

export interface MockSnapshot {
  soilRaw: number;
  tempX10: number;
  humi: number;
  lightRaw: number;
  mood: Mood;
  forcedMood: Mood | null;
  missing: MockMissing;
  pouring: boolean;
  fastSampling: boolean;
  fanOn: boolean;
  ledPct: number;
  profile: PlantProfile;
  protoVer: number;
  seq: number;
}

const DEFAULT: PlantProfile = {
  soilDry: PLANTS[0]!.soilDry,
  soilWet: PLANTS[0]!.soilWet,
  tempMinX10: PLANTS[0]!.tempMinX10,
  tempMaxX10: PLANTS[0]!.tempMaxX10,
  lightMin: PLANTS[0]!.lightMin,
};

const noise = (base: number, spread: number) => base + Math.round((Math.random() * 2 - 1) * spread);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class MockBleClient implements BleClient {
  private parser = new UplinkParser();
  private state: ConnectionState = 'IDLE';
  private deviceName = 'GROWME01';

  // 시뮬레이션 상태
  private soilRaw = 690;
  private tempX10 = 235;
  private humi = 55;
  private lightRaw = 620;
  private seq = 0;
  private profile: PlantProfile = { ...DEFAULT };
  private protoVer = SUPPORTED_PROTO_VER;
  private fwVer = '2.0';
  private fanOn = false;
  private ledPct = 0;

  private forcedMood: Mood | null = null;
  private missing: MockMissing = { soil: false, temp: false, humi: false, light: false };
  private pouring = false;
  private fastSampling = false;
  private lastMood: Mood = 0;

  // 지속 조건 누적 (§10.1 DARK 30분 / OVERWATER 60분)
  private darkMs = 0;
  private overWaterMs = 0;
  private missStreak = 0;

  private sensorTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pourTimer: ReturnType<typeof setInterval> | null = null;
  private fastTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTickAt = Date.now();

  private sensorEv = new Emitter<[SensorPacket]>();
  private helloEv = new Emitter<[HelloPacket]>();
  private ackEv = new Emitter<[AckPacket]>();
  private dropEv = new Emitter<[ParseDrop]>();
  private stateEv = new Emitter<[ConnectionState, ConnectionErrorKind | undefined]>();
  private snapshotEv = new Emitter<[MockSnapshot]>();

  onSensor = (cb: (p: SensorPacket) => void) => this.sensorEv.on(cb);
  onHello = (cb: (p: HelloPacket) => void) => this.helloEv.on(cb);
  onAck = (cb: (p: AckPacket) => void) => this.ackEv.on(cb);
  onDrop = (cb: (d: ParseDrop) => void) => this.dropEv.on(cb);
  onStateChange = (cb: (s: ConnectionState, e?: ConnectionErrorKind) => void) => this.stateEv.on(cb);
  /** 개발자 패널이 시뮬레이터 내부값을 보여주기 위한 채널 */
  onSnapshot = (cb: (s: MockSnapshot) => void) => this.snapshotEv.on(cb);

  isMock = () => true;
  getDeviceName = () => (this.state === 'IDLE' ? null : this.deviceName);

  private setState(s: ConnectionState, err?: ConnectionErrorKind) {
    this.state = s;
    this.stateEv.emit(s, err);
  }

  /** 실제 경로와 동일하게: 라인 → 20바이트 청크 → 파서 */
  private feed(line: string) {
    for (const chunk of chunkForBle(line, BLE_CHUNK_BYTES)) {
      const { frames, drops } = this.parser.push(chunk);
      for (const f of frames) {
        if (f.kind === 'sensor') this.sensorEv.emit(f.packet);
        else if (f.kind === 'hello') this.helloEv.emit(f.packet);
        else this.ackEv.emit(f.packet);
      }
      for (const d of drops) this.dropEv.emit(d);
    }
  }

  async connect(): Promise<void> {
    this.setState('REQUESTING');
    await sleep(250);
    this.setState('CONNECTING');
    await sleep(400);
    this.parser.reset();
    this.lastTickAt = Date.now();
    this.setState('CONNECTED');

    // 부팅 직후 1회 H
    setTimeout(() => this.feed(`H,GROWME,${this.protoVer},${this.fwVer}\n`), 150);
    this.startSensorLoop();
    this.heartbeatTimer = setInterval(
      () => this.feed(`H,GROWME,${this.protoVer},${this.fwVer}\n`),
      HEARTBEAT_PERIOD_MS,
    );
  }

  async disconnect(): Promise<void> {
    this.stopTimers();
    this.parser.reset();
    this.setState('IDLE');
  }

  private stopTimers() {
    for (const t of [this.sensorTimer, this.heartbeatTimer]) if (t) clearInterval(t);
    if (this.pourTimer) clearInterval(this.pourTimer);
    if (this.fastTimeout) clearTimeout(this.fastTimeout);
    this.sensorTimer = this.heartbeatTimer = this.pourTimer = null;
    this.fastTimeout = null;
  }

  private startSensorLoop() {
    if (this.sensorTimer) clearInterval(this.sensorTimer);
    const period = this.fastSampling ? SENSOR_FAST_PERIOD_MS : SENSOR_PERIOD_MS;
    this.sensorTimer = setInterval(() => this.tick(period), period);
  }

  private tick(periodMs: number) {
    if (this.state !== 'CONNECTED' && this.state !== 'STALE') return;
    const now = Date.now();
    const dt = now - this.lastTickAt;
    this.lastTickAt = now;

    // 흙은 시간이 지나면 마른다: 분당 +2
    if (!this.pouring) this.soilRaw = clamp(this.soilRaw + (2 * periodMs) / 60_000, 0, 1023);

    // 온·습·조도는 기준값 ± 노이즈
    this.tempX10 = clamp(noise(this.tempX10, 4), -400, 1000);
    this.humi = clamp(noise(this.humi, 2), 0, 100);
    const ledBoost = Math.round((this.ledPct / 100) * 260);
    this.lightRaw = clamp(noise(600 + ledBoost, 40), 0, 1023);

    // 지속 조건 누적
    this.darkMs = this.lightRaw < this.profile.lightMin ? this.darkMs + dt : 0;
    this.overWaterMs = this.soilRaw <= this.profile.soilWet ? this.overWaterMs + dt : 0;

    const anyMissing = this.missing.soil || this.missing.temp || this.missing.humi;
    this.missStreak = anyMissing ? this.missStreak + 1 : 0;

    const raw = {
      soilRaw: this.missing.soil ? null : Math.round(this.soilRaw),
      tempX10: this.missing.temp ? null : Math.round(this.tempX10),
      humi: this.missing.humi ? null : Math.round(this.humi),
      lightRaw: this.missing.light ? null : Math.round(this.lightRaw),
    };

    const mood =
      this.forcedMood ??
      computeMoodForMock(raw, this.profile, {
        darkMs: this.darkMs,
        overWaterMs: this.overWaterMs,
        missStreak: this.missStreak,
      });
    this.lastMood = mood;
    this.seq = (this.seq + 1) % 256;

    const f = (v: number | null) => (v === null ? '' : String(v));
    this.feed(
      `D,${f(raw.soilRaw)},${f(raw.tempX10)},${f(raw.humi)},${f(raw.lightRaw)},${mood},${this.seq}\n`,
    );
    this.emitSnapshot();
  }

  async send(cmd: string): Promise<void> {
    const line = cmd.replace(/\n$/, '').trim();
    await sleep(60); // 왕복 지연 흉내

    if (line === 'Q') {
      const p = this.profile;
      this.feed(
        `A,Q,${p.soilDry},${p.soilWet},${p.tempMinX10},${p.tempMaxX10},${p.lightMin}\n`,
      );
      return;
    }
    if (line === 'P') return this.feed('A,P,OK\n');

    const [head, arg = ''] = line.split(':') as [string, string?];

    if (head === 'F') {
      this.fanOn = arg === '1';
      this.feed('A,F,OK\n');
      return this.emitSnapshot();
    }
    if (head === 'L') {
      const pct = Number(arg);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return this.feed('A,L,ERR:RANGE\n');
      this.ledPct = pct;
      this.feed('A,L,OK\n');
      return this.emitSnapshot();
    }
    if (head === 'R') {
      const on = arg === '1';
      this.setFastSampling(on);
      this.feed('A,R,OK\n');
      return this.emitSnapshot();
    }
    if (head === 'S') {
      const n = arg.split(',').map(Number);
      if (n.length !== 5 || n.some((v) => !Number.isFinite(v))) return this.feed('A,S,ERR:RANGE\n');
      const [soilDry, soilWet, tempMinX10, tempMaxX10, lightMin] = n as [
        number, number, number, number, number,
      ];
      const ok =
        soilDry >= 350 && soilDry <= 1023 &&
        soilWet >= 350 && soilWet <= 1023 && soilWet < soilDry &&
        tempMinX10 >= -100 && tempMinX10 <= 400 &&
        tempMaxX10 >= 0 && tempMaxX10 <= 500 && tempMaxX10 > tempMinX10 &&
        lightMin >= 0 && lightMin <= 1023;
      if (!ok) return this.feed('A,S,ERR:RANGE\n');
      this.profile = { soilDry, soilWet, tempMinX10, tempMaxX10, lightMin };
      this.feed('A,S,OK\n');
      return this.emitSnapshot();
    }
    // v2.0에 없는 명령(W/N 포함)
    this.feed('A,?,ERR:CMD\n');
  }

  // ───────── 개발자 패널 전용 API (?dev=1) ─────────

  private setFastSampling(on: boolean) {
    this.fastSampling = on;
    if (this.fastTimeout) clearTimeout(this.fastTimeout);
    this.fastTimeout = null;
    if (on) {
      // 화분은 3분 뒤 스스로 해제한다(§5.3)
      this.fastTimeout = setTimeout(() => {
        this.fastSampling = false;
        this.startSensorLoop();
        this.emitSnapshot();
      }, FAST_SAMPLING_MAX_MS);
    }
    if (this.state === 'CONNECTED' || this.state === 'STALE') this.startSensorLoop();
  }

  /** 물 붓기: 누르고 있는 동안 soilRaw 초당 -25 */
  setPouring(on: boolean) {
    this.pouring = on;
    if (this.pourTimer) clearInterval(this.pourTimer);
    this.pourTimer = null;
    if (on) {
      this.pourTimer = setInterval(() => {
        this.soilRaw = clamp(this.soilRaw - 25, 0, 1023);
        this.emitSnapshot();
      }, 1000);
    }
    this.emitSnapshot();
  }

  forceMood(m: Mood | null) {
    this.forcedMood = m;
    this.emitSnapshot();
  }

  forceState(s: ConnectionState) {
    if (s === 'CONNECTED' && this.state !== 'CONNECTED') {
      this.lastTickAt = Date.now();
      this.startSensorLoop();
    }
    if (s === 'IDLE' || s === 'DISCONNECTED' || s === 'ERROR') this.stopTimers();
    this.setState(s, s === 'ERROR' ? 'gatt' : undefined);
    this.emitSnapshot();
  }

  setMissing(patch: Partial<MockMissing>) {
    this.missing = { ...this.missing, ...patch };
    if (!this.missing.soil && !this.missing.temp && !this.missing.humi) this.missStreak = 0;
    this.emitSnapshot();
  }

  setSoilRaw(v: number) {
    this.soilRaw = clamp(v, 0, 1023);
    this.emitSnapshot();
  }

  setTempX10(v: number) {
    this.tempX10 = clamp(v, -400, 1000);
    this.emitSnapshot();
  }

  setProtoVer(v: number) {
    this.protoVer = v;
    this.feed(`H,GROWME,${this.protoVer},${this.fwVer}\n`);
    this.emitSnapshot();
  }

  /** 손상 패킷 주입 — §13 "통신이 불안정해요" 검수용 */
  injectCorrupt(count = 1) {
    for (let i = 0; i < count; i += 1) this.feed('D,612,235,55\n');
  }

  /** 시뮬레이션을 초기 상태로 되돌린다 (개발자 패널 · 테스트용) */
  resetSimulation(): void {
    this.stopTimers();
    this.parser.reset();
    this.soilRaw = 690;
    this.tempX10 = 235;
    this.humi = 55;
    this.lightRaw = 620;
    this.seq = 0;
    this.profile = { ...DEFAULT };
    this.protoVer = SUPPORTED_PROTO_VER;
    this.fanOn = false;
    this.ledPct = 0;
    this.forcedMood = null;
    this.missing = { soil: false, temp: false, humi: false, light: false };
    this.pouring = false;
    this.fastSampling = false;
    this.lastMood = 0;
    this.darkMs = 0;
    this.overWaterMs = 0;
    this.missStreak = 0;
    this.state = 'IDLE';
    this.emitSnapshot();
  }

  snapshot(): MockSnapshot {
    return {
      soilRaw: Math.round(this.soilRaw),
      tempX10: Math.round(this.tempX10),
      humi: Math.round(this.humi),
      lightRaw: Math.round(this.lightRaw),
      mood: this.lastMood,
      forcedMood: this.forcedMood,
      missing: { ...this.missing },
      pouring: this.pouring,
      fastSampling: this.fastSampling,
      fanOn: this.fanOn,
      ledPct: this.ledPct,
      profile: { ...this.profile },
      protoVer: this.protoVer,
      seq: this.seq,
    };
  }

  private emitSnapshot() {
    this.snapshotEv.emit(this.snapshot());
  }
}
