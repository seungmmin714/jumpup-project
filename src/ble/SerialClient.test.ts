// @vitest-environment jsdom
// S-01 검증 — 아두이노 없이 가짜 시리얼 포트로 실제 코드 경로를 태운다.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SerialClient, isWebSerialSupported } from './SerialClient';
import type { ConnectionErrorKind, ConnectionState, SensorPacket } from './types';

/** 테스트가 바이트를 밀어 넣을 수 있는 가짜 포트 */
class FakePort {
  writes: string[] = [];
  opened: { baudRate: number } | null = null;
  closed = false;
  private push!: (chunk: Uint8Array) => void;
  private closeStream!: () => void;

  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;

  constructor(private failOpen?: { name: string; message?: string }) {
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.push = (c) => controller.enqueue(c);
        this.closeStream = () => {
          try {
            controller.close();
          } catch {
            /* 이미 닫힘 */
          }
        };
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        this.writes.push(new TextDecoder().decode(chunk));
      },
    });
  }

  async open(options: { baudRate: number }) {
    if (this.failOpen) {
      throw Object.assign(new Error(this.failOpen.message ?? 'open failed'), {
        name: this.failOpen.name,
      });
    }
    this.opened = options;
  }

  async close() {
    this.closed = true;
  }

  addEventListener() {}
  removeEventListener() {}

  /** 아두이노가 한 줄 보낸 상황 */
  emit(text: string) {
    this.push(new TextEncoder().encode(text));
  }

  endStream() {
    this.closeStream();
  }
}

function installSerial(port: FakePort | null, reject?: { name: string; message?: string }) {
  Object.defineProperty(navigator, 'serial', {
    value:
      port === null && !reject
        ? undefined
        : {
            requestPort: () =>
              reject
                ? Promise.reject(
                    Object.assign(new Error(reject.message ?? 'rejected'), { name: reject.name }),
                  )
                : Promise.resolve(port),
          },
    configurable: true,
  });
}

let states: Array<[ConnectionState, ConnectionErrorKind | undefined]>;

const makeClient = () => {
  const c = new SerialClient();
  c.onStateChange((s, e) => states.push([s, e]));
  return c;
};

/** 스트림 파이프가 한 바퀴 돌 때까지 기다린다 */
const tick = async (n = 6) => {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  states = [];
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serial');
});

describe('S-01 연결', () => {
  it('9600 baud로 포트를 연다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();

    expect(port.opened).toEqual({ baudRate: 9600 });
    expect(client.getDeviceName()).toBe('GROWME01');
  });

  it('S-04 첫 D 패킷을 받기 전에는 CONNECTING을 유지한다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();
    expect(states.map((s) => s[0])).toEqual(['REQUESTING', 'CONNECTING']);

    // 리셋 직후 H가 먼저 와도 CONNECTED로 올리지 않는다
    port.emit('H,GROWME,3,2.0\n');
    await tick();
    expect(states.at(-1)![0]).toBe('CONNECTING');

    port.emit('D,612,235,55,780,1,7\n');
    await tick();
    expect(states.at(-1)![0]).toBe('CONNECTED');
  });

  it('Web Serial 미지원이면 unsupported로 전이한다', async () => {
    installSerial(null);
    expect(isWebSerialSupported()).toBe(false);
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'unsupported']);
  });

  it('포트를 다른 프로그램이 쓰고 있으면 port-busy', async () => {
    const port = new FakePort({ name: 'InvalidStateError', message: 'The port is already open.' });
    installSerial(port);
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'port-busy']);
  });

  it('포트 선택 창을 닫으면 permission', async () => {
    installSerial(null, { name: 'NotFoundError', message: 'No port selected by the user.' });
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'permission']);
  });
});

describe('S-01 업링크 — 기존 파서를 그대로 쓴다', () => {
  it('D·H·A를 각 채널로 올린다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();
    const sensors: SensorPacket[] = [];
    const hellos: unknown[] = [];
    const acks: unknown[] = [];
    client.onSensor((p) => sensors.push(p));
    client.onHello((p) => hellos.push(p));
    client.onAck((p) => acks.push(p));

    await client.connect();
    port.emit('D,612,235,55,780,1,7\nH,GROWME,3,2.0\nA,Q,708,578,150,300,500\n');
    await tick();

    expect(sensors).toEqual([
      { soilRaw: 612, tempX10: 235, humi: 55, lightRaw: 780, mood: 1, seq: 7 },
    ]);
    expect(hellos).toEqual([{ protoVer: 3, fwVer: '2.0' }]);
    expect(acks).toEqual([{ cmd: 'Q', result: '708,578,150,300,500' }]);
  });

  it('라인이 쪼개져 들어와도 재조립된다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();
    const sensors: SensorPacket[] = [];
    client.onSensor((p) => sensors.push(p));

    await client.connect();
    port.emit('D,612,235,');
    await tick();
    expect(sensors).toHaveLength(0);

    port.emit('55,780,0,8\n');
    await tick();
    expect(sensors).toHaveLength(1);
    expect(sensors[0]!.seq).toBe(8);
  });

  it('손상된 줄은 폐기한다 (§5.5 규칙 그대로)', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();
    const drops: unknown[] = [];
    const sensors: SensorPacket[] = [];
    client.onDrop((d) => drops.push(d));
    client.onSensor((p) => sensors.push(p));

    await client.connect();
    port.emit('X,1,2,3\nD,612,235,55,780,0,9\n');
    await tick();

    expect(drops).toHaveLength(1);
    expect(sensors).toHaveLength(1);
  });
});

describe('S-01 다운링크 — 분할하지 않는다', () => {
  it('24바이트 S 명령도 한 번에 보낸다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();
    await client.send('S:708,578,150,300,500');

    // BLE와 달리 20바이트로 쪼개지 않는다
    expect(port.writes).toEqual(['S:708,578,150,300,500\n']);
  });

  it('개행을 한 번만 붙이고 순서를 지킨다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();
    await Promise.all([client.send('R:1'), client.send('L:50'), client.send('Q\n')]);

    expect(port.writes).toEqual(['R:1\n', 'L:50\n', 'Q\n']);
  });

  it('연결 전에는 전송이 실패한다', async () => {
    installSerial(new FakePort());
    const client = makeClient();
    await expect(client.send('P')).rejects.toThrow('연결되지 않았습니다');
  });
});

describe('S-01 해제', () => {
  it('포트를 닫고 IDLE로 돌아간다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();
    await client.disconnect();

    expect(port.closed).toBe(true);
    expect(states.at(-1)![0]).toBe('IDLE');
  });

  it('S-03 자동 재연결을 시도하지 않는다', async () => {
    const port = new FakePort();
    installSerial(port);
    const client = makeClient();

    await client.connect();
    port.emit('D,612,235,55,780,0,1\n');
    await tick();
    expect(states.at(-1)![0]).toBe('CONNECTED');

    // 케이블이 뽑힌 상황 — 스트림이 끝난다
    port.endStream();
    await tick(20);

    expect(states.at(-1)![0]).toBe('DISCONNECTED');
    // 재연결을 시도했다면 REQUESTING이 다시 찍혔을 것이다
    expect(states.filter((s) => s[0] === 'REQUESTING')).toHaveLength(1);
  });
});
