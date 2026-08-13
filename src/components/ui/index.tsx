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

export function ProgressBar({
  value,
  tone = 'bg-primary',
  className = '',
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-primary-soft ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
