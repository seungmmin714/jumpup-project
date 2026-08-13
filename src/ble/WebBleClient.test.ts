// 실기기 경로 검증 — 화분이 없어도 WebBleClient가 규격대로 동작하는지 본다.
// navigator.bluetooth부터 GATT 서비스·특성까지 가짜로 세워, 실제 코드가 타는 길을 그대로 태운다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebBleClient } from './BleClient';
import { DEVICE_NAME_PREFIX, GATT_CHAR_UUID, GATT_SERVICE_UUID } from './constants';
import type { ConnectionErrorKind, ConnectionState, SensorPacket } from './types';

// ───────── 가짜 GATT 스택 ─────────

class FakeCharacteristic extends EventTarget {
  value: DataView | null = null;
  writes: string[] = [];
  notifying = false;

  async startNotifications() {
    this.notifying = true;
    return this;
  }

  async writeValueWithoutResponse(data: BufferSource) {
    const bytes =
      data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array((data as Uint8Array));
    this.writes.push(new TextDecoder().decode(bytes));
  }

  /** 화분이 Notify로 바이트를 밀어 넣는 상황 */
  emit(text: string) {
    const bytes = new TextEncoder().encode(text);
    this.value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }

  /** 20바이트씩 쪼개 보내는 실제 BLE 동작 흉내 */
  emitChunked(text: string, size = 20) {
    for (let i = 0; i < text.length; i += size) this.emit(text.slice(i, i + size));
  }
}

class FakeServer {
  connected = false;
  constructor(
    private device: FakeDevice,
    private char: FakeCharacteristic,
    private opts: { failService?: boolean } = {},
  ) {}

  async connect() {
    this.connected = true;
    return this;
  }

  async getPrimaryService(uuid: string) {
    this.device.requestedServices.push(uuid);
    if (this.opts.failService) throw Object.assign(new Error('GATT Error'), { name: 'NetworkError' });
    return {
      getCharacteristic: async (charUuid: string) => {
        this.device.requestedChars.push(charUuid);
        return this.char;
      },
    };
  }

  disconnect() {
    this.connected = false;
    this.device.dispatchEvent(new Event('gattserverdisconnected'));
  }
}

class FakeDevice extends EventTarget {
  requestedServices: string[] = [];
  requestedChars: string[] = [];
  gatt: FakeServer;

  constructor(
    public name: string,
    public char: FakeCharacteristic,
    opts: { failService?: boolean } = {},
  ) {
    super();
    this.gatt = new FakeServer(this, char, opts);
  }

  /** 화분이 범위를 벗어나 연결이 끊긴 상황 */
  dropConnection() {
    this.gatt.connected = false;
    this.dispatchEvent(new Event('gattserverdisconnected'));
  }
}

interface Harness {
  device: FakeDevice;
  char: FakeCharacteristic;
  requestArgs: unknown[];
}

function installBluetooth(
  opts: { reject?: { name: string; message?: string }; failService?: boolean } = {},
): Harness {
  const char = new FakeCharacteristic();
  const device = new FakeDevice('GROWME01', char, { failService: opts.failService ?? false });
  const requestArgs: unknown[] = [];

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
      bluetooth: {
        requestDevice: (args: unknown) => {
          requestArgs.push(args);
          if (opts.reject) {
            return Promise.reject(
              Object.assign(new Error(opts.reject.message ?? 'rejected'), { name: opts.reject.name }),
            );
          }
          return Promise.resolve(device);
        },
      },
    },
    configurable: true,
  });

  return { device, char, requestArgs };
}

// ───────── 테스트 ─────────

let states: Array<[ConnectionState, ConnectionErrorKind | undefined]>;

beforeEach(() => {
  vi.useFakeTimers();
  states = [];
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, 'navigator');
});

function makeClient() {
  const client = new WebBleClient();
  client.onStateChange((s, e) => states.push([s, e]));
  return client;
}

describe('실기기 연결 — 기기 탐색', () => {
  it('GROWME 접두어와 ffe0 서비스로 기기를 찾는다', async () => {
    const h = installBluetooth();
    const client = makeClient();

    await client.connect();

    expect(h.requestArgs[0]).toEqual({
      filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
      optionalServices: [GATT_SERVICE_UUID],
    });
    expect(h.device.requestedServices).toEqual([GATT_SERVICE_UUID]);
    expect(h.device.requestedChars).toEqual([GATT_CHAR_UUID]);
    expect(h.char.notifying).toBe(true);
    expect(client.getDeviceName()).toBe('GROWME01');
    expect(states.map((s) => s[0])).toEqual(['REQUESTING', 'CONNECTING', 'CONNECTED']);
  });

  it('사용자가 기기 선택을 취소하면 permission 오류로 분류한다', async () => {
    installBluetooth({ reject: { name: 'NotFoundError', message: 'User cancelled the chooser' } });
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'permission']);
  });

  it('주변에 화분이 없으면 not-found로 분류한다', async () => {
    installBluetooth({ reject: { name: 'NotFoundError', message: 'No devices found' } });
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'not-found']);
  });

  it('GATT 서비스를 못 찾으면 gatt 오류로 분류한다', async () => {
    installBluetooth({ failService: true });
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'gatt']);
  });

  it('Web Bluetooth가 없는 환경이면 unsupported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'iPhone' },
      configurable: true,
    });
    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
    expect(states.at(-1)).toEqual(['ERROR', 'unsupported']);
  });
});

describe('실기기 연결 — 업링크 수신', () => {
  it('20바이트로 쪼개져 들어와도 D 패킷으로 재조립된다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    const packets: SensorPacket[] = [];
    client.onSensor((p) => packets.push(p));

    await client.connect();
    h.char.emitChunked('D,612,235,55,780,0,7\nD,613,236,54,781,1,8\n');

    expect(packets).toEqual([
      { soilRaw: 612, tempX10: 235, humi: 55, lightRaw: 780, mood: 0, seq: 7 },
      { soilRaw: 613, tempX10: 236, humi: 54, lightRaw: 781, mood: 1, seq: 8 },
    ]);
  });

  it('H와 A 패킷도 각각의 채널로 올라온다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    const hellos: unknown[] = [];
    const acks: unknown[] = [];
    client.onHello((p) => hellos.push(p));
    client.onAck((p) => acks.push(p));

    await client.connect();
    h.char.emit('H,GROWME,3,2.0\n');
    h.char.emit('A,Q,708,578,150,300,500\n');

    expect(hellos).toEqual([{ protoVer: 3, fwVer: '2.0' }]);
    expect(acks).toEqual([{ cmd: 'Q', result: '708,578,150,300,500' }]);
  });

  it('연결 직후 잘린 첫 줄은 폐기되고 이후 정상 수신된다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    const drops: unknown[] = [];
    const packets: SensorPacket[] = [];
    client.onDrop((d) => drops.push(d));
    client.onSensor((p) => packets.push(p));

    await client.connect();
    h.char.emit('35,55,780,0,6\nD,612,235,55,780,0,7\n');

    expect(drops).toHaveLength(1);
    expect(packets).toHaveLength(1);
    expect(packets[0]!.seq).toBe(7);
  });

  it('15초간 D가 없으면 STALE, 다시 들어오면 CONNECTED로 복귀한다', async () => {
    const h = installBluetooth();
    const client = makeClient();

    await client.connect();
    h.char.emit('D,612,235,55,780,0,7\n');

    await vi.advanceTimersByTimeAsync(14_000);
    expect(states.at(-1)![0]).toBe('CONNECTED');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(states.at(-1)![0]).toBe('STALE');

    h.char.emit('D,613,235,55,780,0,8\n');
    expect(states.at(-1)![0]).toBe('CONNECTED');
  });

  it('H만 들어오는 동안에는 STALE 판정을 막지 못한다 (D 기준)', async () => {
    const h = installBluetooth();
    const client = makeClient();

    await client.connect();
    await vi.advanceTimersByTimeAsync(10_000);
    h.char.emit('H,GROWME,3,2.0\n');
    await vi.advanceTimersByTimeAsync(6_000);

    expect(states.at(-1)![0]).toBe('STALE');
  });
});

describe('실기기 연결 — 다운링크 전송', () => {
  it('개행을 붙이고 20바이트씩 순서대로 쓴다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    await client.connect();

    const p = client.send('S:708,578,150,300,500');
    await vi.advanceTimersByTimeAsync(100);
    await p;

    expect(h.char.writes).toEqual(['S:708,578,150,300,50', '0\n']);
  });

  it('연속 호출도 순서가 뒤섞이지 않는다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    await client.connect();

    const a = client.send('R:1');
    const b = client.send('L:50');
    const c = client.send('Q');
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([a, b, c]);

    expect(h.char.writes).toEqual(['R:1\n', 'L:50\n', 'Q\n']);
  });

  it('연결 전에 보내면 실패하지만 이후 전송은 계속 가능하다', async () => {
    const h = installBluetooth();
    const client = makeClient();

    await expect(client.send('P')).rejects.toThrow('연결되지 않았습니다');

    await client.connect();
    const p = client.send('P');
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(h.char.writes).toEqual(['P\n']);
  });
});

describe('실기기 연결 — 끊김과 재연결', () => {
  it('예기치 않게 끊기면 1초 뒤 자동으로 다시 붙는다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    await client.connect();
    states.length = 0;

    h.device.dropConnection();
    expect(states.at(-1)![0]).toBe('DISCONNECTED');

    await vi.advanceTimersByTimeAsync(1_100);
    expect(states.at(-1)![0]).toBe('CONNECTED');
    expect(h.char.notifying).toBe(true);
  });

  it('사용자가 직접 끊으면 재연결하지 않는다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    await client.connect();

    await client.disconnect();
    expect(states.at(-1)![0]).toBe('IDLE');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(states.at(-1)![0]).toBe('IDLE');
    expect(h.device.gatt.connected).toBe(false);
  });

  it('재연결에 실패하면 1초·2초·4초로 세 번만 시도한다', async () => {
    const h = installBluetooth();
    const client = makeClient();
    await client.connect();

    // 이후 모든 재연결 시도를 실패시킨다
    let attempts = 0;
    h.device.gatt.connect = () => {
      attempts += 1;
      return Promise.reject(Object.assign(new Error('GATT fail'), { name: 'NetworkError' }));
    };

    h.device.dropConnection();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(4_100);
    expect(attempts).toBe(3);

    // 더는 시도하지 않는다
    await vi.advanceTimersByTimeAsync(30_000);
    expect(attempts).toBe(3);
    expect(states.at(-1)![0]).toBe('DISCONNECTED');
  });
});
