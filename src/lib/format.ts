export const NA = '--';

export const fmtNum = (v: number | null, digits = 0, unit = ''): string =>
  v === null ? NA : `${v.toFixed(digits)}${unit}`;

export const fmtTemp = (v: number | null) => (v === null ? NA : `${v.toFixed(1)}℃`);
export const fmtPct = (v: number | null) => (v === null ? NA : `${Math.round(v)}%`);

/** "N분 전" — 오프라인 배지·마지막 상태 표기(§12.2) */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '기록 없음';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '기록 없음';
  return durationAgo(Math.max(0, now - t));
}

export function durationAgo(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return `${Math.floor(day / 30)}개월 전`;
}

export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
}

export const mmss = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
