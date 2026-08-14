// §5.3 F 명령 — 환기팬 수동 오버라이드. 화분이 10분 뒤 자동 제어로 되돌린다.

import { useEffect, useRef, useState } from 'react';
import { cmdFan } from '@/ble/constants';
import { sendCommand } from '@/store/bleBridge';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { mmss } from '@/lib/format';
import { PixelIcon } from '@/components/PixelIcon';

const OVERRIDE_MS = 10 * 60_000;
const DEBOUNCE_MS = 300;

export function FanToggle() {
  const live = useConnectionStore(canControl);
  const inflight = useConnectionStore((s) => s.inflight.includes('F'));
  const [on, setOn] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number | null>(null);

  // 10분 오버라이드 잔여 시간 표시 — 끝나면 자동 제어로 돌아간 것으로 본다
  useEffect(() => {
    if (!on) {
      setRemaining(0);
      return;
    }
    const t = setInterval(() => {
      const left = OVERRIDE_MS - (Date.now() - (startedAt.current ?? Date.now()));
      setRemaining(Math.max(0, left));
      if (left <= 0) setOn(false);
    }, 1000);
    return () => clearInterval(t);
  }, [on]);

  useEffect(() => () => void (debounce.current && clearTimeout(debounce.current)), []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    startedAt.current = next ? Date.now() : null;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await sendCommand(cmdFan(next), 'F');
      if (!res.ok) {
        setOn(!next); // 실패하면 되돌린다
        setError('화분이 응답하지 않아요');
      } else {
        setError(null);
      }
    }, DEBOUNCE_MS);
  };

  return (
    <div className="rounded-xl bg-primary-soft/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <PixelIcon name="fan" size={18} />
            환기팬 강제 가동
          </p>
          <p className="text-[11px] text-ink-sub">
            {on
              ? `켜짐 · ${mmss(remaining)} 뒤 자동 제어로 돌아가요`
              : '꺼짐 · 평소에는 화분이 알아서 켜고 꺼요'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="환기팬 강제 가동"
          onClick={toggle}
          disabled={!live || inflight}
          className={`tap relative h-8 w-14 shrink-0 rounded-full ring-2 transition disabled:opacity-40 ${
            on ? 'bg-primary ring-primary-dark' : 'bg-ink/30 ring-ink/40'
          }`}
        >
          {/* F-10 OFF도 트랙이 충분히 어두워야 켜짐/꺼짐이 한눈에 구분된다 */}
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.3)] transition-all ${
              on ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
