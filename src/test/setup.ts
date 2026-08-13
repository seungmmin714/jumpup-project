import { afterEach, vi } from 'vitest';

// jsdom에 없는 브라우저 API 보충
if (typeof globalThis.navigator !== 'undefined' && !('vibrate' in globalThis.navigator)) {
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: vi.fn(() => true),
    configurable: true,
  });
}

if (typeof globalThis.window !== 'undefined') {
  // 서버가 없으므로 네트워크는 전부 실패시킨다 — UI가 막히지 않아야 한다.
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error('network disabled in tests')),
  ) as unknown as typeof fetch;

  if (!('matchMedia' in globalThis.window)) {
    Object.defineProperty(globalThis.window, 'matchMedia', {
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }),
      configurable: true,
    });
  }
}

afterEach(() => {
  vi.clearAllTimers();
});
