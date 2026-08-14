// T-07 — 홈 대시보드.
// 시안의 정보 순서를 따른다:
//   ① 연결 상태 + 화분명  ② 온도·습도·조도 칩  ③ 캐릭터 방(가장 큰 영역)
//   ④ 토양수분 게이지  ⑤ 물 주기 버튼  ⑥ 건강도·성장 단계
// 그 밖의 §9.2 요구 항목(솔루션 카드·LED·인벤토리/이벤트)은 이 골격을 깨지 않는 자리에 둔다.

import { useState } from 'react';
import { ConnectionBadge, ConnectionBanners } from '@/components/ConnectionBadge';
import { Banner, Card, ProgressBar } from '@/components/ui';
import { PillButton, StatChip } from '@/components/StatCard';
import { HAPPINESS_LABEL, PixelIcon, happinessFace } from '@/components/PixelIcon';
import { SoilGauge } from '@/components/SoilGauge';
import { CelebrationOverlay } from '@/features/character/Character';
import { RoomScene } from '@/features/room/RoomScene';
import { useRoomStore } from '@/store/roomStore';
import { SolutionCard } from './SolutionCard';
import { LedSlider } from './LedSlider';
import { PotPicker } from './PotPicker';
import { BleModeCard } from './BleModeCard';
import { useOfflineLatest } from '@/lib/useOfflineLatest';
import { allSensorsMissing, isFieldWarned, useTelemetryStore } from '@/store/telemetryStore';
import { isLive, useConnectionStore } from '@/store/connectionStore';
import { activePotId, selectedPlant, usePotStore } from '@/store/potStore';
import { STAGE_BY_LEVEL, useCharacterStore } from '@/store/characterStore';
import { moodInfo } from '@/lib/mood';
import { useWateringDetector, wateringSpeech } from '@/lib/useWateringDetector';
import { timeAgo } from '@/lib/format';
import {
  HUMIDITY_BAND_LABEL,
  LIGHT_BAND_LABEL,
  TEMP_BAND_LABEL,
  humidityBand,
  lightBand,
  tempBand,
} from '@/lib/convert';

export default function HomePage() {
  const [ledBoost, setLedBoost] = useState(0);

  // 셀렉터는 필드 단위로 — 객체를 새로 만들면 매 업데이트마다 리렌더된다.
  const latest = useTelemetryStore((s) => s.latest);
  const streak = useTelemetryStore((s) => s.missingStreak);
  const source = useTelemetryStore((s) => s.source);
  const conn = useConnectionStore();
  const live = isLive(conn);
  const plant = usePotStore(selectedPlant);
  const pots = usePotStore((s) => s.pots);
  const potId = usePotStore(activePotId);
  // 구매해서 방에 놓은 아이템만 그린다
  const placedItems = useRoomStore((s) => s.placed[potId] ?? []);
  const character = useCharacterStore();

  useOfflineLatest();
  // 물 주기 버튼 대신, 토양 센서가 급수를 알아채면 캐릭터가 실시간으로 반응한다
  const watering = useWateringDetector();

  const mood = latest?.mood ?? 0;
  const info = moodInfo(mood);
  const stale = !live;

  const temp = tempBand(latest?.temperature ?? null, plant.tempMinX10, plant.tempMaxX10);
  const humi = humidityBand(latest?.humidity ?? null);
  const light = lightBand(latest?.lightLevel ?? null);

  return (
    <div className="space-y-3">
      <CelebrationOverlay />

      {/* ① 연결 상태 + 화분명 */}
      <ConnectionBadge />
      <PotPicker />
      <ConnectionBanners />

      {stale && latest && source === 'server' ? (
        <Banner tone="info" title={`${timeAgo(latest.measuredAt)} 확인된 상태예요`}>
          실시간이 아니에요. 화분 근처에서 연결하면 지금 상태를 볼 수 있어요.
        </Banner>
      ) : null}

      {allSensorsMissing(latest) ? (
        <Banner tone="error" title="센서 연결 확인">
          모든 센서값이 들어오지 않아요. 화분 전원과 센서 케이블을 확인해 주세요.
        </Banner>
      ) : null}

      {!live ? <BleModeCard /> : null}

      {pots.length === 0 ? (
        <Card>
          <p className="text-sm font-bold text-ink">아직 등록된 화분이 없어요</p>
          <p className="mt-1 text-xs text-ink-sub">
            화분 뒷면 QR을 찍거나, 위의 <b>화분 연결하기</b>를 눌러 시작해 주세요.
          </p>
        </Card>
      ) : null}

      {/* ② 온도 · 공기습도 · 조도 */}
      <div className="grid grid-cols-3 gap-2">
        <StatChip
          icon={<PixelIcon name={temp === 'good' ? 'sun' : 'thermometer'} size={22} />}
          value={latest?.temperature === null || !latest ? '--' : `${latest.temperature.toFixed(0)}℃`}
          caption={temp ? TEMP_BAND_LABEL[temp] : '온도'}
          warned={isFieldWarned(streak, 'temp')}
          tone={temp === 'hot' ? 'text-danger' : temp === 'cold' ? 'text-wet' : 'text-ink'}
        />
        <StatChip
          icon={<PixelIcon name="drop" size={22} />}
          value={latest?.humidity === null || !latest ? '--' : `${latest.humidity}%`}
          caption={humi ? HUMIDITY_BAND_LABEL[humi] : '공기 습도'}
          warned={isFieldWarned(streak, 'humi')}
        />
        <StatChip
          icon={<PixelIcon name="bulb" size={22} />}
          value={latest?.lightLevel === null || !latest ? '--' : `${latest.lightLevel}`}
          caption={light ? LIGHT_BAND_LABEL[light] : '조도'}
          warned={isFieldWarned(streak, 'light')}
        />
      </div>

      {/* ③ 캐릭터 방 — 화면에서 가장 큰 영역 */}
      <RoomScene
        plant={plant}
        mood={mood}
        stale={stale}
        celebrating={character.celebrating}
        speech={wateringSpeech(watering.phase, watering.gainedPct) ?? info.speech}
        caption={stale ? '마지막 기분' : `Lv.${character.level}`}
        watering={watering.phase !== 'idle'}
        visibleItemIds={placedItems}
      />

      {/* 솔루션 카드 — 문제가 있을 때만, 캐릭터 바로 아래에 붙는다 */}
      <SolutionCard mood={mood} onRaiseLed={() => setLedBoost((n) => n + 1)} />

      {/* ④ 토양수분 게이지 + ⑤ 물 주기 */}
      <Card>
        <p className="mb-3 flex items-center justify-center gap-1.5 text-sm font-bold text-ink">
          <PixelIcon name="drop-plus" size={20} />
          토양 수분 상태
        </p>
        <SoilGauge soilRaw={latest?.soilRaw ?? null} profile={plant} />

        {watering.phase !== 'idle' ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-primary-soft py-2 text-xs font-bold text-primary">
            <PixelIcon name="splash" size={18} />
            물을 주고 있어요 · +{watering.gainedPct.toFixed(0)}%
          </p>
        ) : mood === 1 ? (
          <p className="mt-3 text-center text-xs font-semibold text-ink-sub">
            흙이 말랐어요. 화분에 물을 부으면 그로미가 바로 반응해요.
          </p>
        ) : null}
      </Card>

      {/* ⑥ 건강도 · 성장 단계 */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`state-word ${mood === 0 ? 'text-primary' : 'text-warn'}`}>
              {mood === 0 ? '건강해요!' : '돌봄이 필요해요'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-sub">
              {mood === 0 ? `${plant.nameKo}가 ${info.summary.replace('우리 식물이 ', '')}` : info.summary}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <PixelIcon
              name={happinessFace(character.happiness)}
              size={40}
              alt={HAPPINESS_LABEL[Math.min(4, Math.floor(character.happiness / 20))]}
            />
            <p className="text-[11px] font-bold text-ink-sub">행복도</p>
          </div>
        </div>

        <ProgressBar value={character.happiness} className="mt-3" />
        <p className="mt-1 text-right text-[11px] font-bold text-ink-sub">{character.happiness}%</p>

        <hr className="my-3 border-line" />

        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-sub">
            성장 단계 · <b className="text-ink">{character.stage || STAGE_BY_LEVEL(character.level)}</b>
          </span>
          <span className="font-bold text-primary">{character.stageProgress}%</span>
        </div>
        <ProgressBar value={character.stageProgress} className="mt-1.5" />
        <p className="mt-1 text-right text-[11px] font-semibold text-ink-sub">
          Lv.{character.level} · {character.exp.toLocaleString()} /{' '}
          {character.expToNext.toLocaleString()} EXP
        </p>
      </Card>

      {/* 나머지 제어 — 시안의 6단계 골격을 흐리지 않도록 아래에 둔다 */}
      <LedSlider boostSignal={ledBoost} />

      <div className="grid grid-cols-2 gap-2">
        <PillButton icon="backpack" label="인벤토리" disabled />
        <PillButton icon="gift" label="이벤트" badge disabled />
      </div>
    </div>
  );
}
