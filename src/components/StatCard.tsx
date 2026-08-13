// 참고 디자인의 상단 스탯 카드. 숫자보다 상태 문구가 커야 한다(§14).

import type { ReactNode } from 'react';

export function StatCard({
  icon,
  value,
  caption,
  warned = false,
  tone = 'text-olive-900',
  right,
}: {
  icon: ReactNode;
  value: string;
  caption: string;
  warned?: boolean;
  tone?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-olive-100">
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 text-[15px] font-extrabold leading-tight ${tone}`}>
          <span className="truncate">{value}</span>
          {warned ? (
            <span className="shrink-0 text-state-warn" aria-label="센서 확인 필요" title="센서 확인 필요">
              ⚠
            </span>
          ) : null}
        </p>
        <p className="truncate text-[11px] font-semibold text-olive-400">{caption}</p>
      </div>
      {right}
    </div>
  );
}

/** 습도 도넛 — 참고 디자인의 원형 게이지 */
export function DonutStat({
  value,
  caption,
  warned = false,
}: {
  value: number | null;
  caption: string;
  warned?: boolean;
}) {
  const pct = value ?? 0;
  const r = 13;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-olive-100">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="#e9ecd6" strokeWidth="5" />
        {value !== null ? (
          <circle
            cx="16"
            cy="16"
            r={r}
            fill="none"
            stroke="#3b82c4"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        ) : null}
      </svg>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[15px] font-extrabold leading-tight text-olive-900">
          <span>{value === null ? '--' : `${value}%`}</span>
          {warned ? (
            <span className="shrink-0 text-state-warn" aria-label="센서 확인 필요" title="센서 확인 필요">
              ⚠
            </span>
          ) : null}
        </p>
        <p className="truncate text-[11px] font-semibold text-olive-400">{caption}</p>
      </div>
    </div>
  );
}

/** 레벨 카드 — 아이콘 + Lv.N + 경험치 막대 */
export function LevelCard({
  level,
  exp,
  expToNext,
}: {
  level: number;
  exp: number;
  expToNext: number;
}) {
  const pct = Math.min(100, (exp / Math.max(1, expToNext)) * 100);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-olive-100">
      <span className="text-xl leading-none" aria-hidden>
        🌱
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold leading-tight text-olive-900">Lv. {level}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-olive-100">
          <div
            className="h-full rounded-full bg-olive-500 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-olive-400">
          {exp.toLocaleString()} / {expToNext.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/** 인벤토리·이벤트 같은 알약형 버튼 */
export function PillButton({
  icon,
  label,
  badge = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  badge?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap relative flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-olive-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-olive-100 transition active:scale-[0.98] disabled:opacity-50"
    >
      <span className="text-base" aria-hidden>
        {icon}
      </span>
      {label}
      {badge ? (
        <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-500" aria-hidden />
      ) : null}
    </button>
  );
}
