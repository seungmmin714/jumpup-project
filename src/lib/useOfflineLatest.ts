// T-13 — BLE 미연결이면 §12.2 마지막 상태로 화면을 그린다.
// 실시간 모니터링이 아니라 "마지막 확인 시점"임을 UI가 명시해야 한다(§16).

import { useEffect, useState } from 'react';
import { fetchLatest, type LatestState } from '@/api/telemetry';
import { pctToRaw } from '@/lib/convert';
import { isLive, useConnectionStore } from '@/store/connectionStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { usePotStore } from '@/store/potStore';

const POLL_MS = 60_000;

export function useOfflineLatest() {
  const potId = usePotStore((s) => s.selectedPotId);
  const live = useConnectionStore(isLive);
  const setFromServer = useTelemetryStore((s) => s.setFromServer);
  const setLastWateredAt = usePotStore((s) => s.setLastWateredAt);
  const [latest, setLatest] = useState<LatestState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (live || !potId) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const l = await fetchLatest(potId, ctrl.signal);
        setLatest(l);
        setFailed(false);
        setLastWateredAt(l.lastWateredAt);
        setFromServer({
          potId: l.potId,
          measuredAt: l.measuredAt,
          soilMoisture: l.soilMoisture,
          soilRaw: l.soilMoisture === null ? null : pctToRaw(l.soilMoisture),
          temperature: l.temperature,
          humidity: l.humidity,
          lightLevel: l.lightLevel,
          lightRaw: l.lightLevel === null ? null : Math.round((l.lightLevel / 100) * 1023),
          mood: l.mood,
          seq: -1,
        });
      } catch {
        setFailed(true); // 서버가 없어도 화면은 계속 동작한다
      }
    };

    void run();
    timer = setInterval(() => void run(), POLL_MS);
    return () => {
      ctrl.abort();
      if (timer) clearInterval(timer);
    };
  }, [live, potId, setFromServer, setLastWateredAt]);

  return { latest, failed };
}
