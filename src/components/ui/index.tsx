import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  onClick,
  selected = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card w-full text-left ${onClick ? 'transition active:scale-[0.99]' : ''} ${
        selected ? 'ring-2 ring-primary' : ''
      } ${className}`}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'soft',
  className = '',
}: {
  children: ReactNode;
  tone?: 'soft' | 'primary' | 'warn' | 'danger' | 'muted';
  className?: string;
}) {
  const tones = {
    soft: 'bg-primary-soft text-primary',
    primary: 'bg-primary text-white',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    muted: 'bg-line text-ink-sub',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Banner({
  tone = 'warn',
  title,
  children,
  action,
}: {
  tone?: 'warn' | 'error' | 'info';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    warn: 'bg-warn/10 text-ink',
    error: 'bg-danger/10 text-ink',
    info: 'bg-primary-soft text-ink',
  } as const;
  const dot = { warn: 'text-warn', error: 'text-danger', info: 'text-primary' } as const;
  return (
    <div className={`rounded-card px-4 py-3 ${tones[tone]}`} role="status">
      <p className={`text-sm font-bold ${dot[tone]}`}>{title}</p>
      {children ? <div className="mt-1 text-xs leading-relaxed text-ink-sub">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-bold text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      {icon}
      <p className="font-bold text-ink">{title}</p>
      {hint ? <p className="text-xs text-ink-sub">{hint}</p> : null}
    </div>
  );
}

/**
 * 픽셀 트랙 프레임 + CSS 채움.
 * 스프라이트에서 쓰는 건 빈 트랙뿐이고, 채운 길이는 값에 따라 계산한다.
 * 채움은 부드러운 그라데이션 대신 단색 + 계단형 하이라이트(.pixel-fill)다.
 */
export function ProgressBar({
  value,
  tone,
  className = '',
  height = 18,
}: {
  value: number;
  /** 채움 색을 바꿀 때만 준다 (CSS 색상값) */
  tone?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`pixel-track w-full ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="pixel-fill"
        style={{ width: `${pct}%`, ...(tone ? { backgroundColor: tone } : null) }}
      />
    </div>
  );
}
