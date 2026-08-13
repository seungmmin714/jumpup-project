// 시안의 상단 칩 — 아이콘 + 값 + 상태 문구가 한 줄에 들어간다.

import type { ReactNode } from 'react';
import { PixelIcon, type IconName } from './PixelIcon';

/** 온도·습도·조도처럼 한 줄에 셋이 나란히 놓이는 압축 칩 */
export function StatChip({
  icon,
  value,
  caption,
  warned = false,
  tone,
}: {
  icon: ReactNode;
  value: string;
  caption: string;
  warned?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-card bg-card px-2.5 py-2 shadow-card">
      {icon}
      <div className="min-w-0">
        <p className={`truncate text-[13px] font-extrabold leading-tight ${tone ?? 'text-ink'}`}>
          {value}
          {warned ? (
            <span className="ml-0.5 text-warn" aria-label="센서 확인 필요" title="센서 확인 필요">
              ⚠
            </span>
          ) : null}
        </p>
        <p className="truncate text-[10px] font-semibold text-ink-sub">{caption}</p>
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
  icon: IconName;
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
      className="btn-secondary relative w-full text-sm"
    >
      <PixelIcon name={icon} size={22} />
      {label}
      {badge ? (
        <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden />
      ) : null}
    </button>
  );
}
