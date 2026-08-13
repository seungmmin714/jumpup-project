// T-18 — 일지. §12.3 care-logs 타임라인.
// 시안 구성: 마지막 급수 카드 → 수분 변화 그래프 → 기록 타임라인 → 안내 카드

import { useEffect, useState } from 'react';
import { fetchCareLogs, type CareLog } from '@/api/pots';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { Badge, Card, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { fmtClock, fmtDay, fmtPct, timeAgo } from '@/lib/format';
import { uploadQueue, type QueueStatus } from '@/api/uploadQueue';

const TYPE_META: Record<CareLog['type'], { icon: string; label: string }> = {
  water: { icon: '💧', label: '물 주기' },
  move: { icon: '📦', label: '자리 옮김' },
  ventilate: { icon: '🌬', label: '환기' },
  note: { icon: '📝', label: '메모' },
};

export default function JournalPage() {
  const potId = usePotStore((s) => s.selectedPotId);
  const lastWateredAt = usePotStore((s) => s.lastWateredAt);
  const plant = usePotStore(selectedPlant);
  const [logs, setLogs] = useState<CareLog[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<QueueStatus | null>(null);

  useEffect(() => uploadQueue.subscribe(setQueue), []);

  useEffect(() => {
    if (!potId) {
      setLogs([]);
      return;
    }
    const ctrl = new AbortController();
    fetchCareLogs(potId, 50, ctrl.signal)
      .then((l) => {
        setLogs(l);
        setFailed(false);
      })
      .catch(() => {
        setLogs([]);
        setFailed(true);
      });
    return () => ctrl.abort();
  }, [potId]);

  const sorted = [...(logs ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const lastWater = sorted.find((l) => l.type === 'water') ?? null;
  const groups = groupByDay(sorted);

  return (
    <div className="space-y-3">
      <PageHeader
        title="돌봄 일지"
        sub="최근 7일"
        right={
          queue && queue.pending > 0 ? (
            <Badge tone="muted">동기화 대기 {queue.pending}</Badge>
          ) : null
        }
      />

      {/* 마지막 급수 */}
      <Card>
        <div className="flex items-center gap-4">
          <span className="pixelated text-4xl leading-none" aria-hidden>
            🪣
          </span>
          <div className="min-w-0 flex-1">
            <Badge>마지막 급수</Badge>
            <p className="mt-1 text-2xl font-black leading-tight text-ink">
              {timeAgo(lastWateredAt)}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-ink-sub">
              {lastWater
                ? [
                    fmtClock(lastWater.at),
                    lastWater.amountMl ? `${lastWater.amountMl}ml` : null,
                    lastWater.soilAfter !== null && lastWater.soilAfter !== undefined
                      ? `토양 ${fmtPct(lastWater.soilBefore ?? null)} → ${fmtPct(lastWater.soilAfter)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '아직 급수 기록이 없어요'}
            </p>
          </div>
        </div>
      </Card>

      {/* 수분 변화 — 새로 불러오지 않고 위에서 받은 급수 기록만으로 그린다 */}
      <MoistureChart
        logs={sorted}
        targetMin={plant.targetMinPct}
        targetMax={plant.targetMaxPct}
      />

      {/* 타임라인 */}
      {logs === null ? (
        <p className="py-8 text-center text-sm text-ink-sub">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="📔"
          title={failed ? '기록을 불러오지 못했어요' : '아직 기록이 없어요'}
          hint={
            failed
              ? '서버에 연결되면 지난 기록이 여기에 나타나요.'
              : '물 주기를 완료하면 자동으로 기록돼요.'
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-1.5 px-1 text-[11px] font-bold text-ink-sub">{fmtDay(day)}</h3>
              <ul className="space-y-2">
                {items.map((log, i) => {
                  const meta = TYPE_META[log.type] ?? TYPE_META.note;
                  return (
                    <li key={log.id ?? `${log.at}-${i}`}>
                      <div className="card flex items-center gap-3 py-3">
                        <span className="pixelated text-xl leading-none" aria-hidden>
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">
                            {meta.label}
                            {log.guided ? (
                              <span className="ml-1.5 text-[10px] font-bold text-primary">가이드</span>
                            ) : null}
                          </p>
                          {log.type === 'water' ? (
                            <p className="mt-0.5 truncate text-[11px] text-ink-sub">
                              토양 {fmtPct(log.soilBefore ?? null)} → {fmtPct(log.soilAfter ?? null)}
                              {log.amountMl ? ` · 약 ${log.amountMl}ml` : ''}
                            </p>
                          ) : null}
                          {log.note ? (
                            <p className="mt-0.5 truncate text-[11px] text-ink-sub">{log.note}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-ink-sub">
                          {fmtClock(log.at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 급수 기록의 `soilAfter`만으로 그리는 간이 꺾은선.
 * 별도 API를 부르지 않는다 — 위에서 이미 받아온 care-logs를 그대로 쓴다.
 */
function MoistureChart({
  logs,
  targetMin,
  targetMax,
}: {
  logs: CareLog[];
  targetMin: number;
  targetMax: number;
}) {
  const points = logs
    .filter((l) => l.type === 'water' && typeof l.soilAfter === 'number')
    .slice(0, 7)
    .reverse()
    .map((l) => ({ at: l.at, value: l.soilAfter as number }));

  const W = 300;
  const H = 120;
  const padY = 8;
  const y = (v: number) => padY + (1 - v / 100) * (H - padY * 2);
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W);

  return (
    <Card>
      <p className="mb-2 text-sm font-bold text-ink">수분 변화</p>

      {points.length < 2 ? (
        <p className="py-6 text-center text-xs text-ink-sub">
          급수 기록이 두 번 이상 쌓이면 그래프가 나타나요.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="수분 변화 그래프">
            {/* 적정 범위 */}
            <rect
              x="0"
              y={y(targetMax)}
              width={W}
              height={Math.max(1, y(targetMin) - y(targetMax))}
              fill="var(--primary-soft)"
            />
            {[0, 25, 50, 75, 100].map((v) => (
              <line
                key={v}
                x1="0"
                x2={W}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            ))}
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle
                key={p.at}
                cx={x(i)}
                cy={y(p.value)}
                r="4.5"
                fill="var(--primary)"
                stroke="#fff"
                strokeWidth="2"
              />
            ))}
          </svg>

          <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink-sub">
            <span>{fmtClock(points[0]!.at)}</span>
            <span className="text-primary">
              적정 {targetMin}~{targetMax}%
            </span>
            <span>{fmtClock(points[points.length - 1]!.at)}</span>
          </div>
        </>
      )}
    </Card>
  );
}

function groupByDay(sorted: CareLog[]): Array<[string, CareLog[]]> {
  const map = new Map<string, CareLog[]>();
  for (const log of sorted) {
    const day = log.at.slice(0, 10);
    const arr = map.get(day);
    if (arr) arr.push(log);
    else map.set(day, [log]);
  }
  return [...map.entries()];
}
