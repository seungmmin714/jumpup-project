// S-01 — Web Serial 구현체. 아두이노 Uno를 USB로 직접 연결한다.
//
// BLE의 대체가 아니라 **세 번째 구현체**다. BleClient·MockBleClient는 그대로 둔다.
// 같은 BleClient 인터페이스를 구현하므로 화면·스토어·파서는 한 줄도 바뀌지 않는다.
//
// Uno가 보내는 바이트열은 전송 매체와 무관하게 같다:
//   D,612,235,55,780,1,7\n
// 이 문자열을 기존 UplinkParser에 그대로 넣으면 telemetryStore 이후는 출처를 모른다.

import { STALE_TIMEOUT_MS } from './constants';
import { Emitter, type BleClient } from './BleClient';
import { UplinkParser } from './parser';
import type {
  AckPacket,
  ConnectionErrorKind,
  ConnectionState,
  HelloPacket,
  ParseDrop,
  SensorPacket,
} from './types';

/** 아두이노 스케치와 맞춘 고정값. 다른 값 금지. */
const BAUD_RATE = 9600;

// ───────── Web Serial 최소 타입 ─────────
// @types/w3c-web-serial를 의존성으로 더하지 않기 위해 쓰는 만큼만 선언한다.

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: 'disconnect', listener: () => void): void;
  removeEventListener(type: 'disconnect', listener: () => void): void;
}

interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

const getSerial = (): SerialLike | null => {
  if (typeof navigator === 'undefined') return null;
  const s = (navigator as Navigator & { serial?: SerialLike }).serial;
  return s ?? null;
};

export const isWebSerialSupported = (): boolean => getSerial() !== null;

/** 포트 점유 오류를 구분한다 — 아두이노 IDE 시리얼 모니터가 켜져 있는 경우가 대부분이다 */
function classifySerialError(e: unknown): ConnectionErrorKind {
  if (!isWebSerialSupported()) return 'unsupported';
  const name = (e as { name?: string } | null)?.name ?? '';
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '');

  if (name === 'NotFoundError') return 'permission'; // 포트 선택 창을 닫음
  if (name === 'SecurityError' || name === 'NotAllowedError') return 'permission';
  if (/already open|in use|busy|Failed to open/i.test(msg)) return 'port-busy';
  if (name === 'NetworkError' || name === 'InvalidStateError') return 'port-busy';
  return 'port-open';
}

export class SerialClient implements BleClient {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  /** pipeTo가 끝나기를 기다리기 위한 프라미스 */
  private pipeClosed: Promise<void> | null = null;

  private parser = new UplinkParser();
  private encoder = new TextEncoder();

  private state: ConnectionState = 'IDLE';
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  /** 첫 D 패킷을 받기 전에는 CONNECTING을 유지한다 (S-04) */
  private sawFirstSensor = false;
  /** send()는 순서를 지켜야 하므로 단일 체인으로 직렬화한다 */
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

  /** Web Serial은 장치명을 주지 않는다. MVP는 화분 1대 고정이라 이 값으로 둔다. */
  getDeviceName = () => (this.state === 'IDLE' ? null : 'GROWME01');

  private setState(s: ConnectionState, err?: ConnectionErrorKind) {
    if (this.state === s && !err) return;
    this.state = s;
    this.stateEv.emit(s, err);
  }

  async connect(): Promise<void> {
    const serial = getSerial();
    if (!serial) {
      this.setState('ERROR', 'unsupported');
      throw new Error('Web Serial 미지원');
    }

    this.closing = false;
    this.sawFirstSensor = false;
    this.setState('REQUESTING');

    try {
      // 반드시 사용자 클릭 핸들러 안에서 불려야 한다 (Web Serial도 user gesture 필요)
      this.port = await serial.requestPort();
    } catch (e) {
      this.setState('ERROR', classifySerialError(e));
      throw e;
    }

    this.setState('CONNECTING');

    try {
      await this.port.open({ baudRate: BAUD_RATE });
    } catch (e) {
      this.port = null;
      this.setState('ERROR', classifySerialError(e));
      throw e;
    }

    if (!this.port.readable || !this.port.writable) {
      await this.teardown();
      this.setState('ERROR', 'port-open');
      throw new Error('포트 스트림을 열지 못했습니다');
    }

    this.parser.reset();
    this.writer = this.port.writable.getWriter();

    // readable은 잠기므로 reader를 두 개 만들지 않는다.
    const decoder = new TextDecoderStream();
    // TextDecoderStream.writable은 WritableStream<BufferSource>로 선언돼 있어
    // ReadableStream<Uint8Array>와 직접 맞물리지 않는다. 런타임에는 문제가 없다.
    this.pipeClosed = this.port.readable
      .pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => undefined);
    this.reader = decoder.readable.getReader();

    this.port.addEventListener('disconnect', this.handleUnplug);

    // 끝나지 않는 루프이므로 await 하지 않는다. await하면 connect()가 반환되지 않는다.
    void this.readLoop();

    this.armStaleTimer();
    // CONNECTED로 올리지 않는다 — 첫 D 패킷을 받아야 실제로 말이 통하는 것이다 (S-04)
  }

  private handleUnplug = () => {
    // USB가 물리적으로 뽑힌 경우. 자동 재시도는 하지 않는다(S-03) —
    // requestPort()가 user gesture를 요구해 자동 호출이 불가능하다.
    void this.teardown();
    this.setState('DISCONNECTED');
  };

  private async readLoop(): Promise<void> {
    const reader = this.reader;
    if (!reader) return;

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) this.ingest(value);
      }
    } catch {
      // cancel()로 끝난 정상 종료도 여기로 온다
    }

    if (!this.closing) {
      this.setState('DISCONNECTED');
    }
  }

  /** 수신 문자열을 기존 파서에 그대로 넣는다. 파싱 로직을 새로 짜지 않는다. */
  private ingest(chunk: string): void {
    const { frames, drops } = this.parser.push(chunk);

    for (const f of frames) {
      if (f.kind === 'sensor') {
        this.armStaleTimer(); // D 수신 시에만 되감는다
        if (!this.sawFirstSensor) {
          this.sawFirstSensor = true;
          this.setState('CONNECTED');
        } else if (this.state === 'STALE') {
          this.setState('CONNECTED');
        }
        this.sensorEv.emit(f.packet);
      } else if (f.kind === 'hello') {
        // 포트를 열 때 DTR로 Uno가 재부팅되므로 매 연결마다 온다. 정상이다(S-04).
        this.helloEv.emit(f.packet);
      } else {
        this.ackEv.emit(f.packet);
      }
    }
    for (const d of drops) this.dropEv.emit(d);
  }

  private armStaleTimer() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      if (this.state === 'CONNECTED') this.setState('STALE');
    }, STALE_TIMEOUT_MS);
  }

  /**
   * 시리얼은 20바이트 분할이 필요 없다. BLE 전용 제약이고 여기서는 느려지기만 한다.
   * S:708,578,150,300,500 같은 24바이트 명령도 한 번에 보낸다.
   */
  async send(cmd: string): Promise<void> {
    const line = cmd.endsWith('\n') ? cmd : `${cmd}\n`;
    const run = async () => {
      if (!this.writer) throw new Error('연결되지 않았습니다');
      await this.writer.write(this.encoder.encode(line));
    };
    const next = this.writeChain.then(run, run);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    await this.teardown();
    this.parser.reset();
    this.setState('IDLE');
  }

  /**
   * 해제 순서를 지켜야 한다.
   *   reader.cancel() → releaseLock() → writer.close() → port.close()
   * 어기면 포트가 잠긴 채 남아 새로고침 전까지 재연결이 안 된다.
   */
  private async teardown(): Promise<void> {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }

    try {
      this.port?.removeEventListener('disconnect', this.handleUnplug);
    } catch {
      /* 무시 */
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* 무시 */
      }
      try {
        this.reader.releaseLock();
      } catch {
        /* 무시 */
      }
      this.reader = null;
    }

    if (this.pipeClosed) {
      // pipeTo가 끝나기를 기다리되 무한정 붙잡히지 않는다.
      // 여기서 막히면 port.close()까지 못 가서 포트가 잠긴 채 남는다 —
      // 그러면 새로고침 전까지 재연결이 안 된다.
      await Promise.race([
        this.pipeClosed.catch(() => undefined),
        new Promise<void>((r) => setTimeout(r, 300)),
      ]);
      this.pipeClosed = null;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
        /* 무시 */
      }
      try {
        this.writer.releaseLock();
      } catch {
        /* 이미 닫혔으면 무시 */
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* 무시 */
      }
      this.port = null;
    }

    this.sawFirstSensor = false;
  }
}
