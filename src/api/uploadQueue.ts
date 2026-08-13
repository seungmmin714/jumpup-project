// T-12 — 업로드 큐. 실패 시 최대 3회 재시도, 큐 최대 50건, 초과 시 오래된 것부터 폐기(§12.1).
// UI 차단 금지: 모든 실패는 조용히 큐에 쌓인다.

import { api, isRetryable } from './client';

export const QUEUE_LIMIT = 50;
export const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 4_000, 10_000];

export interface QueueItem {
  id: number;
  path: string;
  body: unknown;
  attempts: number;
}

export interface QueueStatus {
  pending: number;
  dropped: number;
  sent: number;
  flushing: boolean;
  lastError: string | null;
}

type StatusListener = (s: QueueStatus) => void;

export class UploadQueue {
  private items: QueueItem[] = [];
  private nextId = 1;
  private flushing = false;
  private dropped = 0;
  private sent = 0;
  private lastError: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<StatusListener>();

  subscribe(fn: StatusListener): () => void {
    this.listeners.add(fn);
    fn(this.status());
    return () => this.listeners.delete(fn);
  }

  status(): QueueStatus {
    return {
      pending: this.items.length,
      dropped: this.dropped,
      sent: this.sent,
      flushing: this.flushing,
      lastError: this.lastError,
    };
  }

  private notify() {
    const s = this.status();
    for (const fn of this.listeners) fn(s);
  }

  enqueue(path: string, body: unknown): void {
    this.items.push({ id: this.nextId++, path, body, attempts: 0 });
    // 초과분은 오래된 것부터 버린다
    while (this.items.length > QUEUE_LIMIT) {
      this.items.shift();
      this.dropped += 1;
    }
    this.notify();
    void this.flush();
  }

  /** 큐를 순서대로 비운다. 앞 항목이 막히면 뒤도 기다린다(순서 보장). */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    this.flushing = true;
    this.notify();

    try {
      while (this.items.length > 0) {
        const item = this.items[0]!;
        try {
          await api.post(item.path, item.body);
          this.items.shift();
          this.sent += 1;
          this.lastError = null;
          this.notify();
        } catch (e) {
          item.attempts += 1;
          this.lastError = e instanceof Error ? e.message : String(e);

          if (!isRetryable(e) || item.attempts >= MAX_ATTEMPTS) {
            this.items.shift();
            this.dropped += 1;
            this.notify();
            continue;
          }
          // 재시도 대기 후 다시 flush
          const delay = RETRY_DELAYS_MS[Math.min(item.attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
          this.notify();
          this.scheduleRetry(delay);
          return;
        }
      }
    } finally {
      this.flushing = false;
      this.notify();
    }
  }

  private scheduleRetry(delay: number) {
    this.flushing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  /** 테스트·개발자 패널용 */
  peek(): readonly QueueItem[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
    if (this.timer) clearTimeout(this.timer);
    this.notify();
  }
}

export const uploadQueue = new UploadQueue();

if (typeof window !== 'undefined') {
  // 오프라인에서 복구되면 큐가 순서대로 비워진다 (T-12 DoD)
  window.addEventListener('online', () => void uploadQueue.flush());
}
