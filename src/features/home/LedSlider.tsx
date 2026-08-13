// T-16 — LED 밝기. 300ms 디바운스 + 응답 대기 중 비활성(§13).

import { useCallback, useEffect, useRef, useState } from 'react';
import { cmdLed } from '@/ble/constants';
import { sendCommand } from '@/store/bleBridge';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { PixelIcon } from '@/components/PixelIcon';

const DEBOUNCE_MS = 300;

export function LedSlider({ boostSignal = 0 }: { boostSignal?: number }) {
  const live = useConnectionStore(canControl);
  const inflight = useConnectionStore((s) => s.inflight.includes('L'));
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(async (pct: number) => {
    const res = await sendCommand(cmdLed(pct), 'L');
    setError(res.ok ? null : res.result === 'ERR:TIMEOUT' ? '화분이 응답하지 않아요' : '설정 실패');
  }, []);

  const commit = useCallback(
    (next: number) => {
      setValue(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void push(next), DEBOUNCE_MS);
    },
    [push],
  );

  // 솔루션 카드의 "LED 밝기 올리기"에서 신호가 오면 한 단계 올린다
  useEffect(() => {
    if (boostSignal > 0) commit(Math.min(100, value + 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boostSignal]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <PixelIcon name="bulb" size={18} />
          LED 밝기
        </span>
        <span className="text-xs font-semibold text-ink-sub">{live ? `${value}%` : '연결 필요'}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={!live || inflight}
        onChange={(e) => commit(Number(e.target.value))}
        className="h-11 w-full accent-primary disabled:opacity-40"
        aria-label="LED 밝기"
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      {!live ? (
        <p className="mt-1 text-xs text-ink-sub">화분에 연결하면 조절할 수 있어요.</p>
      ) : null}
    </div>
  );
}
