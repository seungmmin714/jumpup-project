// T-08 §10.2 — mood !== 0 일 때만 표시되는 솔루션 카드.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TONE_CLASS, moodInfo } from '@/lib/mood';
import { usePotStore, selectedPlant } from '@/store/potStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { timeAgo } from '@/lib/format';
import { toSoilMoisture } from '@/lib/convert';
import { FanToggle } from './FanToggle';
import type { Mood } from '@/ble/types';

interface Props {
  mood: Mood;
  onRaiseLed?: () => void;
}

export function SolutionCard({ mood, onRaiseLed }: Props) {
  const navigate = useNavigate();
  const info = moodInfo(mood);
  const tone = TONE_CLASS[info.tone];
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const live = useConnectionStore(canControl);

  if (mood === 0 || info.title === null) return null;

  const toggle = (label: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <section className={`rounded-2xl p-4 ring-1 ${tone.bg} ${tone.ring}`}>
      <h2 className={`text-base font-bold ${tone.text}`}>{info.title}</h2>

      {/* §10.2 HOT — 환기팬 작동 안내 겸 수동 오버라이드(F 명령) */}
      {mood === 2 ? (
        <div className="mt-3">
          <FanToggle />
        </div>
      ) : null}

      {mood === 5 ? <OverWaterHint /> : null}

      <ul className="mt-3 space-y-2">
        {info.actions.map((a) => {
          if (a.kind === 'primary') {
            return (
              <li key={a.label}>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => {
                    if (a.to) navigate(a.to);
                    else onRaiseLed?.();
                  }}
                  disabled={!a.to && !live}
                >
                  {a.label}
                </button>
              </li>
            );
          }
          const done = checked.has(a.label);
          return (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => toggle(a.label)}
                className={`tap flex w-full items-center gap-3 rounded-xl bg-primary-soft/50 px-3 py-2.5 text-left text-sm transition ${
                  done ? 'opacity-50' : ''
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs ring-1 ${
                    done ? 'bg-primary text-white ring-olive-600' : 'bg-white ring-line'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : ''}
                </span>
                <span className={done ? 'line-through' : ''}>
                  <span className="font-semibold text-ink">{a.label}</span>
                  {a.hint ? <span className="ml-1 text-xs text-ink-sub">{a.hint}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** §10.2 mood 5 — 다음 급수 예상 시점을 함께 안내한다. */
function OverWaterHint() {
  const soilRaw = useTelemetryStore((s) => s.latest?.soilRaw ?? null);
  const plant = usePotStore(selectedPlant);
  const lastWateredAt = usePotStore((s) => s.lastWateredAt);

  const pct = toSoilMoisture(soilRaw);
  // 흙은 분당 약 2 raw씩 마른다(Mock 관측치 기준). soilDry까지 남은 시간을 어림한다.
  const hours = soilRaw === null ? null : Math.max(0, Math.round(((plant.soilDry - soilRaw) / 2 / 60) * 10) / 10);

  return (
    <div className="mt-2 rounded-xl bg-primary-soft/50 px-3 py-2 text-xs text-ink">
      <p>
        현재 토양 <b>{pct === null ? '--' : `${pct}%`}</b> · 마지막 급수 {timeAgo(lastWateredAt)}
      </p>
      {hours !== null ? (
        <p className="mt-0.5 text-ink-sub">
          지금 속도라면 약 <b>{hours < 1 ? '1시간 이내' : `${hours}시간 뒤`}</b>에 물을 줄 때가 돼요.
        </p>
      ) : null}
    </div>
  );
}
