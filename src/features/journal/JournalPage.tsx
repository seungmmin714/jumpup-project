// T-18 — 일지. §12.3 care-logs 타임라인.

import { useEffect, useState } from 'react';
import { fetchCareLogs, type CareLog } from '@/api/pots';
import { usePotStore } from '@/store/potStore';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
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

  const groups = groupByDay(logs ?? []);

  return (
    <div className="space-y-3">
      <SectionTitle
        right={
          queue && queue.pending > 0 ? (
            <span className="text-xs text-olive-400">동기화 대기 {queue.pending}건</span>
          ) : null
        }
      >
        돌봄 일지
      </SectionTitle>

      <Card>
        <p className="label">마지막 급수</p>
        <p className="state-word mt-0.5">{timeAgo(lastWateredAt)}</p>
        <p className="state-num mt-0.5">{lastWateredAt ? fmtClock(lastWateredAt) : '기록이 없어요'}</p>
      </Card>

      {logs === null ? (
        <p className="py-8 text-center text-sm text-olive-400">불러오는 중…</p>
      ) : logs.length === 0 ? (
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
        <div className="space-y-4">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-2 text-xs font-bold text-olive-500">{fmtDay(day)}</h3>
              <ul className="space-y-2 border-l-2 border-olive-100 pl-3">
                {items.map((log, i) => {
                  const meta = TYPE_META[log.type] ?? TYPE_META.note;
                  return (
                    <li key={log.id ?? `${log.at}-${i}`} className="relative">
                      <span
                        className="absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full bg-olive-300 ring-2 ring-cream-100"
                        aria-hidden
                      />
                      <Card className="py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-olive-800">
                            {meta.icon} {meta.label}
                            {log.guided ? (
                              <span className="ml-1 text-[10px] font-semibold text-olive-400">
                                가이드
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-olive-400">{fmtClock(log.at)}</span>
                        </div>
                        {log.type === 'water' ? (
                          <p className="mt-1 text-xs text-olive-600">
                            토양 {fmtPct(log.soilBefore ?? null)} → {fmtPct(log.soilAfter ?? null)}
                            {log.amountMl ? ` · 약 ${log.amountMl}ml` : ''}
                          </p>
                        ) : null}
                        {log.note ? <p className="mt-1 text-xs text-olive-600">{log.note}</p> : null}
                      </Card>
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

function groupByDay(logs: CareLog[]): Array<[string, CareLog[]]> {
  const map = new Map<string, CareLog[]>();
  for (const log of [...logs].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const day = log.at.slice(0, 10);
    const arr = map.get(day);
    if (arr) arr.push(log);
    else map.set(day, [log]);
  }
  return [...map.entries()];
}
