import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chunkForBle, withTerminator, writeLineInChunks } from './BleClient';
import { BLE_CHUNK_BYTES, cmdFan, cmdLed, cmdSetProfile, cmdFastSampling } from './constants';

const decode = (v: BufferSource) =>
  new TextDecoder().decode(v instanceof ArrayBuffer ? new Uint8Array(v) : (v as Uint8Array));

function fakeChar(withoutResponse = true) {
  const writes: string[] = [];
  const fn = vi.fn((v: BufferSource) => {
    writes.push(decode(v));
    return Promise.resolve();
  });
  return {
    writes,
    fn,
    char: (withoutResponse
      ? { writeValueWithoutResponse: fn }
      : { writeValue: fn }) as never,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('T-06 다운링크 20바이트 분할', () => {
  it('짧은 명령은 한 번에 나간다', () => {
    expect(chunkForBle('R:1\n')).toEqual(['R:1\n']);
    expect(chunkForBle('Q\n')).toEqual(['Q\n']);
  });

  it('S 명령(25바이트)은 20 + 5로 쪼개진다', () => {
    const line = withTerminator(cmdSetProfile({
      soilDry: 708, soilWet: 578, tempMinX10: 150, tempMaxX10: 300, lightMin: 500,
    }));
    expect(line).toBe('S:708,578,150,300,500\n');
    expect(line.length).toBe(22);

    const chunks = chunkForBle(line);
    expect(chunks).toEqual(['S:708,578,150,300,50', '0\n']);
    expect(chunks[0]!.length).toBe(BLE_CHUNK_BYTES);
    expect(chunks.join('')).toBe(line);
  });

  it('어떤 길이든 청크는 20바이트를 넘지 않는다', () => {
    for (const line of ['x'.repeat(1), 'x'.repeat(20), 'x'.repeat(21), 'x'.repeat(40)]) {
      for (const c of chunkForBle(line)) expect(c.length).toBeLessThanOrEqual(BLE_CHUNK_BYTES);
    }
  });

  it('개행은 자동으로 한 번만 붙는다', () => {
    expect(withTerminator('P')).toBe('P\n');
    expect(withTerminator('P\n')).toBe('P\n');
  });

  it('청크를 20ms 간격으로 순서대로 쓴다', async () => {
    const { char, writes, fn } = fakeChar();
    const line = 'S:903,773,50,350,400\n'; // 21바이트 → 2청크

    const p = writeLineInChunks(char, line);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1); // 첫 청크만 나갔다

    await vi.advanceTimersByTimeAsync(20);
    await p;

    expect(writes).toEqual(['S:903,773,50,350,400', '\n']);
  });

  it('writeValueWithoutResponse가 없으면 writeValue로 떨어진다', async () => {
    const { char, writes } = fakeChar(false);
    const p = writeLineInChunks(char, 'L:50\n');
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(writes).toEqual(['L:50\n']);
  });
});

describe('명령 생성기 (§5.3)', () => {
  it('규격대로 문자열을 만든다', () => {
    expect(cmdFan(true)).toBe('F:1');
    expect(cmdFan(false)).toBe('F:0');
    expect(cmdLed(0)).toBe('L:0');
    expect(cmdLed(100)).toBe('L:100');
    expect(cmdFastSampling(true)).toBe('R:1');
    expect(cmdFastSampling(false)).toBe('R:0');
  });

  it('LED 밝기는 0~100으로 제한된다', () => {
    expect(cmdLed(-20)).toBe('L:0');
    expect(cmdLed(150)).toBe('L:100');
    expect(cmdLed(33.6)).toBe('L:34');
  });

  it('모든 명령은 한 줄 최대 40바이트를 넘지 않는다', () => {
    const longest = withTerminator(
      cmdSetProfile({ soilDry: 1023, soilWet: 1023, tempMinX10: -100, tempMaxX10: 500, lightMin: 1023 }),
    );
    expect(longest.length).toBeLessThanOrEqual(40);
  });
});
