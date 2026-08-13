// T-11 — 도감. 정보 탭이 아니라 **설정 진입점**이다(§11.4).
// 식물을 고르면 그 행을 S 명령으로 화분에 쓴다.

import { useEffect, useState } from 'react';
import { cmdQuery, cmdSetProfile } from '@/ble/constants';
import { fetchPlants, setPotPlant } from '@/api/plants';
import { PLANTS } from '@/data/plants';
import { sendCommand } from '@/store/bleBridge';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { profileOf, sameProfile, selectedPlant, usePotStore } from '@/store/potStore';
import { Badge, Banner, Card, SectionTitle } from '@/components/ui';
import { PlantCharacter } from '@/features/character/PlantCharacter';
import type { Plant } from '@/ble/types';

export default function CatalogPage() {
  const [plants, setPlants] = useState<readonly Plant[]>(PLANTS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const current = usePotStore(selectedPlant);
  const setPlant = usePotStore((s) => s.setPlant);
  const potId = usePotStore((s) => s.selectedPotId);
  const live = useConnectionStore(canControl);
  const deviceProfile = useConnectionStore((s) => s.deviceProfile);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchPlants(ctrl.signal).then(setPlants);
    return () => ctrl.abort();
  }, []);

  const mismatch = deviceProfile !== null && !sameProfile(deviceProfile, profileOf(current));

  const apply = async (p: Plant) => {
    setPlant(p.plantId);
    if (potId) setPotPlant(potId, p.plantId);
    setMsg(null);
    if (!live) {
      setMsg({ tone: 'info', text: '앱에만 저장했어요. 화분에 연결하면 자동으로 반영돼요.' });
      return;
    }
    setBusyId(p.plantId);
    try {
      const res = await sendCommand(cmdSetProfile(profileOf(p)), 'S');
      if (!res.ok) {
        setMsg({
          tone: 'error',
          text:
            res.result === 'ERR:RANGE'
              ? '화분이 이 설정값을 거부했어요 (범위 초과).'
              : '화분이 응답하지 않아요. 연결을 확인해 주세요.',
        });
        return;
      }
      await sendCommand(cmdQuery(), 'Q'); // 반영 확인
      setMsg({ tone: 'info', text: `${p.nameKo} 설정을 화분에 저장했어요.` });
    } finally {
      setBusyId(null);
    }
  };

  const resync = async () => {
    setBusyId('__sync');
    try {
      await sendCommand(cmdSetProfile(profileOf(current)), 'S');
      await sendCommand(cmdQuery(), 'Q');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <SectionTitle right={<span className="text-xs text-olive-400">{potId ?? '화분 미선택'}</span>}>
        식물 도감
      </SectionTitle>

      {mismatch ? (
        <Banner
          tone="warn"
          title="화분 설정이 앱과 달라요"
          action={
            <button
              type="button"
              className="btn-secondary py-2 text-sm"
              onClick={() => void resync()}
              disabled={!live || busyId === '__sync'}
            >
              {busyId === '__sync' ? '전송 중…' : `${current.nameKo} 설정으로 덮어쓰기`}
            </button>
          }
        >
          화분에는 다른 식물 기준값이 저장돼 있어요. 덮어쓰면 기분 판정이 정확해져요.
        </Banner>
      ) : null}

      {msg ? (
        <Banner tone={msg.tone === 'error' ? 'error' : 'info'} title={msg.text} />
      ) : null}

      <ul className="space-y-2">
        {plants.map((p) => {
          const active = p.plantId === current.plantId;
          return (
            <li key={p.plantId}>
              <Card
                className={active ? 'ring-2 ring-olive-500' : ''}
                onClick={() => void apply(p)}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-2xl bg-olive-50 p-1 ring-1 ring-olive-100">
                    <PlantCharacter plant={p} mood={0} size="md" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-olive-900">{p.nameKo}</span>
                      {active ? <Badge>선택됨</Badge> : null}
                      {busyId === p.plantId ? (
                        <span className="text-xs text-olive-400">전송 중…</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-olive-600">{p.description}</p>
                    <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-olive-500">
                      <span>
                        💧 목표 {p.targetMinPct}~{p.targetMaxPct}%
                      </span>
                      <span>
                        🌡 {p.tempMinX10 / 10}~{p.tempMaxX10 / 10}℃
                      </span>
                      <span>🚿 1회 {p.waterMl}ml</span>
                    </dl>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {deviceProfile ? (
        <p className="pt-1 text-center text-[11px] text-olive-400">
          화분 저장값 · dry {deviceProfile.soilDry} / wet {deviceProfile.soilWet} / light{' '}
          {deviceProfile.lightMin}
        </p>
      ) : null}
    </div>
  );
}
