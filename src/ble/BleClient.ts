// T-06 — Web Bluetooth 네이티브 구현. 라이브러리 사용 금지(§2).

import {
  BLE_CHUNK_BYTES,
  CHUNK_INTERVAL_MS,
  DEVICE_NAME_PREFIX,
  GATT_CHAR_UUID,
  GATT_SERVICE_UUID,
  RECONNECT_DELAYS_MS,
  STALE_TIMEOUT_MS,
} from './constants';
import { UplinkParser } from './parser';
import type {
  AckPacket,
  ConnectionErrorKind,
  ConnectionState,
  HelloPacket,
  ParseDrop,
  SensorPacket,
} from './types';

export interface BleClient {
  /** 반드시 사용자 클릭 핸들러 내에서 호출 (Web Bluetooth 제약) */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** 개행 자동 부착 + 20바이트 분할 */
  send(cmd: string): Promise<void>;
  onSensor(cb: (p: SensorPacket) => void): () => void;
  onHello(cb: (p: HelloPacket) => void): () => void;
  onAck(cb: (p: AckPacket) => void): () => void;
  onStateChange(cb: (s: ConnectionState, err?: ConnectionErrorKind) => void): () => void;
  onDrop(cb: (d: ParseDrop) => void): () => void;
  getDeviceName(): string | null;
  isMock(): boolean;
}

type Listener<T extends unknown[]> = (...args: T) => void;

export class Emitter<T extends unknown[]> {
  private fns = new Set<Listener<T>>();
  on(fn: Listener<T>): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  emit(...args: T): void {
    for (const fn of [...this.fns]) {
      try {
        fn(...args);
      } catch (e) {
        console.error('[ble] listener error', e);
      }
    }
  }
  clear(): void {
    this.fns.clear();
  }
}

export const isWebBluetoothSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 20바이트 청크로 자른다. ASCII 전제이므로 문자 수 == 바이트 수(§5.5). */
export function chunkForBle(line: string, size = BLE_CHUNK_BYTES): string[] {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += size) out.push(line.slice(i, i + size));
  return out;
}

function classifyError(e: unknown): ConnectionErrorKind {
  if (!isWebBluetoothSupported()) return 'unsupported';
  const name = (e as { name?: string } | null)?.name ?? '';
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '');
  if (name === 'NotFoundError') {
    // 사용자가 팝업을 닫은 경우와 기기가 없는 경우가 같은 에러로 온다.
    return /user cancel|chooser/i.test(msg) ? 'permission' : 'not-found';
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') return 'permission';
  if (name === 'NetworkError' || /GATT/i.test(msg)) return 'gatt';
  return 'unknown';
}

export class WebBleClient implements BleClient {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private parser = new UplinkParser();
  private encoder = new TextEncoder();

  private state: ConnectionState = 'IDLE';
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  /** send()는 청크 순서를 보장해야 하므로 단일 체인으로 직렬화한다. */
  private writeChain: Promise<void> = Promise.resolve();

  private sensorEv = new Emitter<[SensorPacket]>();
  private helloEv = new Emitter<[HelloPacket]>();
  private ackEv = new Emitter<[AckPacket]>();
  private dropEv = new Emitter<[ParseDrop]>();
  private stateEv = new Emitter<[ConnectionState, ConnectionErrorKind | undefined]>();

  onSensor = (cb: (p: SensorPacket) => void) => this.sensorEv.on(cb);
  onHello = (cb: (p: HelloPacket) => void) => this.helloEv.on(cb);
  onAck = (cb: (p: AckPacket) => void) => this.ackEv.on(cb);
  onDrop = (cb: (d: ParseDrop) => void) => this.dropEv.on(cb);
  onStateChange = (cb: (s: ConnectionState, e?: ConnectionErrorKind) => void) => this.stateEv.on(cb);

  isMock = () => false;
  getDeviceName = () => this.device?.name ?? null;

  private setState(s: ConnectionState, err?: ConnectionErrorKind) {
    if (this.state === s && !err) return;
    this.state = s;
    this.stateEv.emit(s, err);
  }

  async connect(): Promise<void> {
    if (!isWebBluetoothSupported()) {
      this.setState('ERROR', 'unsupported');
      throw new Error('Web Bluetooth 미지원');
    }
    this.manualDisconnect = false;
    this.setState('REQUESTING');

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
        optionalServices: [GATT_SERVICE_UUID],
      });
    } catch (e) {
      this.setState('ERROR', classifyError(e));
      throw e;
    }

    this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);
    await this.openGatt();
  }

  private async openGatt(): Promise<void> {
    if (!this.device?.gatt) {
      this.setState('ERROR', 'gatt');
      throw new Error('GATT 없음');
    }
    this.setState('CONNECTING');
    try {
      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(GATT_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(GATT_CHAR_UUID);
      this.parser.reset();
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotify);
      this.reconnectAttempt = 0;
      this.setState('CONNECTED');
      this.armStaleTimer();
    } catch (e) {
      this.setState('ERROR', classifyError(e));
      throw e;
    }
  }

  private handleNotify = (ev: Event) => {
    const value = (ev.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const { frames, drops } = this.parser.push(bytes);

    for (const f of frames) {
      if (f.kind === 'sensor') {
        this.armStaleTimer(); // D 수신 시에만 STALE 타이머를 되감는다(§7)
        if (this.state === 'STALE') this.setState('CONNECTED');
        this.sensorEv.emit(f.packet);
      } else if (f.kind === 'hello') {
        this.helloEv.emit(f.packet);
      } else {
        this.ackEv.emit(f.packet);
      }
    }
    for (const d of drops) this.dropEv.emit(d);
  };

  private armStaleTimer() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      if (this.state === 'CONNECTED') this.setState('STALE');
    }, STALE_TIMEOUT_MS);
  }

  private handleDisconnected = () => {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.characteristic = null;
    this.setState('DISCONNECTED');
    if (!this.manualDisconnect) void this.retry();
  };

  /** §7 성공 후 끊긴 경우에만 1s → 2s → 4s, 최대 3회 */
  private async retry(): Promise<void> {
    while (this.reconnectAttempt < RECONNECT_DELAYS_MS.length && !this.manualDisconnect) {
      const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt]!;
      this.reconnectAttempt += 1;
      await sleep(delay);
      if (this.manualDisconnect) return;
      try {
        await this.openGatt();
        return;
      } catch {
        // 다음 시도로
      }
    }
    if (!this.manualDisconnect) this.setState('DISCONNECTED');
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    try {
      this.characteristic?.removeEventListener('characteristicvaluechanged', this.handleNotify);
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } catch (e) {
      console.warn('[ble] disconnect', e);
    }
    this.characteristic = null;
    this.parser.reset();
    this.setState('IDLE');
  }

  /** 개행 부착 → 20바이트 분할 → 20ms 간격 순차 전송(§5.5) */
  async send(cmd: string): Promise<void> {
    const line = cmd.endsWith('\n') ? cmd : `${cmd}\n`;
    const run = async () => {
      const ch = this.characteristic;
      if (!ch) throw new Error('연결되지 않았습니다');
      const chunks = chunkForBle(line);
      for (let i = 0; i < chunks.length; i += 1) {
        const bytes = this.encoder.encode(chunks[i]!);
        if (ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(bytes);
        else await ch.writeValue(bytes);
        if (i < chunks.length - 1) await sleep(CHUNK_INTERVAL_MS);
      }
    };
    // 앞선 전송이 실패해도 체인이 끊기지 않게 한다.
    const next = this.writeChain.then(run, run);
    this.writeChain = next.catch(() => undefined);
    return next;
  }
}
