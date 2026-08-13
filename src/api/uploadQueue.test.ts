import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_LIMIT, UploadQueue } from './uploadQueue';

const res = (status: number) =>
  new Response(status === 204 ? null : JSON.stringify({ ok: true }), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve(res(201)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** 큐가 더 진행되지 않을 때까지 타이머와 마이크로태스크를 밀어준다. */
const settle = async (ms = 30_000) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe('T-12 업로드 큐', () => {
  it('성공하면 순서대로 비워진다', async () => {
    const q = new UploadQueue();
    q.enqueue('/telemetry', { seq: 1 });
    q.enqueue('/telemetry', { seq: 2 });
    q.enqueue('/telemetry', { seq: 3 });

    await settle();

    expect(q.status().pending).toBe(0);
    expect(q.status().sent).toBe(3);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies.map((b) => b.seq)).toEqual([1, 2, 3]);
  });

  it('5xx는 최대 3회까지 재시도하고 그 뒤 폐기한다', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(res(500)));
    const q = new UploadQueue();
    q.enqueue('/telemetry', { seq: 1 });

    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(q.status().dropped).toBe(1);
    expect(q.status().pending).toBe(0);
  });

  it('4xx는 재시도하지 않고 즉시 버린다', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(res(400)));
    const q = new UploadQueue();
    q.enqueue('/telemetry', { seq: 1 });

    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(q.status().dropped).toBe(1);
  });

  it('오프라인이면 쌓아뒀다가 복구 시 순서대로 보낸다', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    const q = new UploadQueue();
    q.enqueue('/telemetry', { seq: 1 });
    q.enqueue('/telemetry', { seq: 2 });

    await settle(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q.status().pending).toBe(2);

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
    });
    await q.flush();
    await settle();

    expect(q.status().pending).toBe(0);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies.map((b) => b.seq)).toEqual([1, 2]);
  });

  it('50건을 넘으면 오래된 것부터 버린다', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    const q = new UploadQueue();
    for (let i = 1; i <= QUEUE_LIMIT + 10; i += 1) q.enqueue('/telemetry', { seq: i });

    expect(q.status().pending).toBe(QUEUE_LIMIT);
    expect(q.status().dropped).toBe(10);
    // 가장 오래된 10건(1~10)이 사라지고 11번부터 남는다
    expect((q.peek()[0]!.body as { seq: number }).seq).toBe(11);
  });

  it('구독자는 상태 변화를 통보받는다', async () => {
    const q = new UploadQueue();
    const seen: number[] = [];
    const off = q.subscribe((s) => seen.push(s.pending));
    q.enqueue('/telemetry', { seq: 1 });
    await settle();
    off();

    expect(seen[0]).toBe(0); // 구독 즉시 현재 상태
    expect(seen).toContain(1);
    expect(seen[seen.length - 1]).toBe(0);
  });
});
