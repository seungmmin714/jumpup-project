import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card w-full text-left ${onClick ? 'active:scale-[0.99] transition' : ''} ${className}`}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'bg-olive-200 text-olive-900',
  className = '',
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone} ${className}`}
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
    warn: 'bg-amber-50 ring-amber-200 text-amber-900',
    error: 'bg-red-50 ring-red-200 text-red-900',
    info: 'bg-sky-50 ring-sky-200 text-sky-900',
  } as const;
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${tones[tone]}`} role="status">
      <p className="text-sm font-bold">{title}</p>
      {children ? <div className="mt-1 text-xs leading-relaxed opacity-90">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-bold text-olive-700">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/60 px-6 py-12 text-center ring-1 ring-olive-100">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-bold text-olive-800">{title}</p>
      {hint ? <p className="text-xs text-olive-500">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'bg-olive-500',
  className = '',
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-olive-100 ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
