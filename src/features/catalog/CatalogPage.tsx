// T-11 — 도감. 정보 탭이 아니라 **설정 진입점**이다(§11.4).
// 식물을 고르면 그 행을 S 명령으로 화분에 쓴다.
// 시안 구성: 썸네일 + 이름/설명 + 지표 행. 선택된 항목만 테두리 강조 + "선택됨".

import { useEffect, useState } from 'react';
import { cmdQuery, cmdSetProfile } from '@/ble/constants';
import { fetchPlants, setPotPlant } from '@/api/plants';
import { PLANTS } from '@/data/plants';
import { sendCommand } from '@/store/bleBridge';
import { canControl, useConnectionStore } from '@/store/connectionStore';
import { profileOf, sameProfile, selectedPlant, usePotStore } from '@/store/potStore';
import { Badge, Banner, Card } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { PlantCharacter } from '@/features/character/PlantCharacter';
import { PixelIcon } from '@/components/PixelIcon';
import { useDevMode } from '@/features/dev/DevPanel';
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
  const devMode = useDevMode();

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
      <PageHeader
        title="식물 도감"
        right={
          <span className="shrink-0 text-xs font-bold text-ink-sub">
            {potId ? potId.toUpperCase() : '화분 미선택'}
          </span>
        }
      />

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

      {msg ? <Banner tone={msg.tone === 'error' ? 'error' : 'info'} title={msg.text} /> : null}

      <ul className="space-y-3">
        {plants.map((p) => {
          const active = p.plantId === current.plantId;
          return (
            <li key={p.plantId}>
              <Card selected={active} onClick={() => void apply(p)}>
                <div className="flex gap-3">
                  {/* 썸네일 */}
                  <div className="flex h-[86px] w-[86px] shrink-0 items-end justify-center rounded-2xl bg-primary-soft">
                    <PlantCharacter plant={p} mood={0} size="md" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg font-black leading-tight text-ink">{p.nameKo}</span>
                      {active ? <Badge tone="primary">선택됨</Badge> : null}
                      {busyId === p.plantId ? (
                        <span className="shrink-0 text-[11px] text-ink-sub">전송 중…</span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-ink-sub">{p.description}</p>

                    <dl className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-ink">
                      <span className="flex items-center gap-1">
                        <PixelIcon name="drop" size={16} />
                        {p.targetMinPct}~{p.targetMaxPct}%
                      </span>
                      <span className="flex items-center gap-1">
                        <PixelIcon name="thermometer" size={16} />
                        {p.tempMinX10 / 10}~{p.tempMaxX10 / 10}℃
                      </span>
                      <span className="flex items-center gap-1">
                        <PixelIcon name="watering-can" size={16} />
                        {p.waterMl}ml
                      </span>
                    </dl>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {/* F-07 내부 임계값은 개발용이다 */}
      {devMode && deviceProfile ? (
        <p className="pt-1 text-center text-[11px] text-ink-sub">
          화분 저장값 · dry {deviceProfile.soilDry} / wet {deviceProfile.soilWet} / light{' '}
          {deviceProfile.lightMin}
        </p>
      ) : null}
    </div>
  );
}
