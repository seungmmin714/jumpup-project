// T-07 — 홈 대시보드.
// 레이아웃 골격은 참고 디자인(스탯 카드 → 씬 → 상태 카드)을 따르되,
// 담기는 내용은 §9.2가 요구하는 우리 기능이다.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectionBadge, ConnectionBanners } from '@/components/ConnectionBadge';
import { Banner, Card, ProgressBar } from '@/components/ui';
import { DonutStat, LevelCard, PillButton, StatCard } from '@/components/StatCard';
import { SoilGauge } from '@/components/SoilGauge';
import { CelebrationOverlay } from '@/features/character/Character';
import { PlantCharacter, SpeechBubble, moodScene } from '@/features/character/PlantCharacter';
import { SolutionCard } from './SolutionCard';
import { LedSlider } from './LedSlider';
import { PotPicker } from './PotPicker';
import { BleModeCard } from './BleModeCard';
import { useOfflineLatest } from '@/lib/useOfflineLatest';
import { allSensorsMissing, isFieldWarned, useTelemetryStore } from '@/store/telemetryStore';
import { isLive, isProtoOk, useConnectionStore } from '@/store/connectionStore';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { STAGE_BY_LEVEL, useCharacterStore } from '@/store/characterStore';
import { moodInfo } from '@/lib/mood';
import { timeAgo } from '@/lib/format';
import {
  HUMIDITY_BAND_LABEL,
  LIGHT_BAND_LABEL,
  SOIL_BAND_SHORT,
  TEMP_BAND_LABEL,
  humidityBand,
  lightBand,
  soilBand,
  tempBand,
} from '@/lib/convert';

export default function HomePage() {
  const navigate = useNavigate();
  const [ledBoost, setLedBoost] = useState(0);

  // 셀렉터는 필드 단위로 — 객체를 새로 만들면 매 업데이트마다 리렌더된다.
  const latest = useTelemetryStore((s) => s.latest);
  const streak = useTelemetryStore((s) => s.missingStreak);
  const source = useTelemetryStore((s) => s.source);
  const conn = useConnectionStore();
  const live = isLive(conn);
  const protoOk = isProtoOk(conn);
  const plant = usePotStore(selectedPlant);
  const pots = usePotStore((s) => s.pots);
  const character = useCharacterStore();

  useOfflineLatest();

  const mood = latest?.mood ?? 0;
  const info = moodInfo(mood);
  const stale = !live;

  const temp = tempBand(latest?.temperature ?? null, plant.tempMinX10, plant.tempMaxX10);
  const humi = humidityBand(latest?.humidity ?? null);
  const soil = soilBand(latest?.soilRaw ?? null, plant.soilDry, plant.soilWet);
  const light = lightBand(latest?.lightLevel ?? null);

  return (
    <div className="space-y-3">
      <CelebrationOverlay />

      {/* 연결 상태 — 참고 디자인에는 없지만 BLE 앱에는 반드시 있어야 한다 */}
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
          <p className="text-sm font-bold text-olive-800">아직 등록된 화분이 없어요</p>
          <p className="mt-1 text-xs text-olive-500">
            화분 뒷면 QR을 찍거나, 위의 <b>화분 연결하기</b>를 눌러 시작해 주세요.
          </p>
        </Card>
      ) : null}

      {/* ① 스탯 — 온도 · 습도 · 레벨 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={temp === 'hot' ? '🔥' : temp === 'cold' ? '🥶' : '☀️'}
          value={latest?.temperature === null || !latest ? '--' : `${latest.temperature.toFixed(1)}℃`}
          caption={temp ? TEMP_BAND_LABEL[temp] : '온도'}
          warned={isFieldWarned(streak, 'temp')}
        />
        <DonutStat
          value={latest?.humidity ?? null}
          caption={humi ? HUMIDITY_BAND_LABEL[humi] : '공기 습도'}
          warned={isFieldWarned(streak, 'humi')}
        />
        <LevelCard level={character.level} exp={character.exp} expToNext={character.expToNext} />
      </div>

      {/* ② 스탯 — 토양 · 조도 (우리 앱에만 있는 핵심 지표) */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon="🪴"
          value={
            latest?.soilMoisture === null || !latest ? '--' : `토양 ${latest.soilMoisture}%`
          }
          caption={soil ? SOIL_BAND_SHORT[soil] : '토양 수분'}
          warned={isFieldWarned(streak, 'soil')}
          tone={
            soil === 'dry'
              ? 'text-state-dry'
              : soil === 'wet'
                ? 'text-state-wet'
                : 'text-olive-900'
          }
        />
        <StatCard
          icon="💡"
          value={light ? LIGHT_BAND_LABEL[light] : '--'}
          caption={latest?.lightLevel === null || !latest ? '조도' : `조도 지수 ${latest.lightLevel}`}
          warned={isFieldWarned(streak, 'light')}
        />
      </div>

      {/* ③ 인벤토리 · 이벤트 — 후순위, 자리만 확보 */}
      <div className="grid grid-cols-2 gap-2">
        <PillButton icon="🎒" label="인벤토리" disabled />
        <PillButton icon="🎁" label="이벤트" badge disabled />
      </div>

      {/* ④ 씬 — 캐릭터와 말풍선 */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ring-1 ring-olive-100 ${moodScene(mood)}`}
      >
        <RoomBackdrop />

        <div className="relative flex flex-col items-center px-4 pt-5">
          <SpeechBubble text={info.speech} tone={mood === 0 ? 'default' : 'alert'} />

          {/*
            캐릭터 아트는 전처리 단계에서 발이 이미지 맨 아래에 오도록 바닥 정렬돼 있다.
            그래서 이 줄의 아래끝(top-full)이 곧 발이 닿는 바닥선이고,
            바닥·러그·그림자를 전부 그 선을 기준으로 놓으면 어느 식물이든 어긋나지 않는다.
          */}
          <div className="relative mt-3 flex justify-center">
            {/* 바닥 */}
            <div className="absolute -left-8 -right-8 top-full h-32 border-t border-cream-300/70 bg-gradient-to-b from-cream-200/80 to-cream-300/40" />
            {/* 러그 — 발이 타원 한가운데 오도록 */}
            <span className="absolute left-1/2 top-full h-16 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-cream-200 ring-2 ring-cream-300/60" />
            <span className="absolute left-1/2 top-full h-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[50%] ring-2 ring-cream-300/50" />
            {/* 발밑 그림자 */}
            <span className="absolute left-1/2 top-full h-4 w-24 -translate-x-1/2 -translate-y-[55%] rounded-[50%] bg-olive-800/15 blur-[3px]" />

            <div className="relative z-10">
              <PlantCharacter
                plant={plant}
                mood={mood}
                stale={stale}
                celebrating={character.celebrating}
              />
            </div>
          </div>

          <div className="relative z-10 mb-5 mt-12 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-olive-700 ring-1 ring-olive-100">
            <span aria-hidden>{plant.emoji}</span>
            {plant.nameKo}
            <span className="text-olive-300">·</span>
            <span className={stale ? 'text-olive-400' : ''}>
              {stale ? '마지막 기분' : info.name}
            </span>
          </div>
        </div>
      </section>

      {/* ⑤ 솔루션 카드 — mood !== 0 일 때만 */}
      <SolutionCard mood={mood} onRaiseLed={() => setLedBoost((n) => n + 1)} />

      {/* ⑥ 토양 목표 대역 + 물 주기 */}
      <Card>
        <SoilGauge soilRaw={latest?.soilRaw ?? null} profile={plant} />
        <button
          type="button"
          className={`btn mt-3 w-full ${
            mood === 1
              ? 'bg-state-wet text-white shadow-md animate-pop-in'
              : 'bg-olive-600 text-cream-50'
          }`}
          onClick={() => navigate('/water')}
          disabled={!protoOk}
        >
          💧 물 주기
          {mood === 1 ? <span className="text-xs font-normal">지금 필요해요!</span> : null}
        </button>
      </Card>

      <LedSlider boostSignal={ledBoost} />

      {/* ⑦ 상태 요약 — 참고 디자인의 하단 카드 */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`state-word ${mood === 0 ? 'text-olive-600' : 'text-orange-700'}`}>
              {mood === 0 ? '건강해요!' : '돌봄이 필요해요'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-olive-500">
              {mood === 0 ? `${plant.nameKo}가 ${info.summary.replace('우리 식물이 ', '')}` : info.summary}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <span className="text-2xl" aria-hidden>
              {character.happiness >= 70 ? '😊' : character.happiness >= 40 ? '🙂' : '😥'}
            </span>
            <p className="text-[11px] font-bold text-olive-500">행복도</p>
          </div>
        </div>

        <ProgressBar value={character.happiness} className="mt-3" />
        <p className="mt-1 text-right text-[11px] font-semibold text-olive-400">
          {character.happiness}%
        </p>

        <hr className="my-3 border-olive-100" />

        <div className="flex items-baseline justify-between text-xs">
          <span className="text-olive-500">
            성장 단계 · <b className="text-olive-800">{character.stage || STAGE_BY_LEVEL(character.level)}</b>
          </span>
          <span className="font-bold text-olive-600">{character.stageProgress}%</span>
        </div>
        <ProgressBar value={character.stageProgress} tone="bg-cream-500" className="mt-1.5" />
      </Card>
    </div>
  );
}

/**
 * 씬의 벽 — 창문과 선반만 아주 옅게 깐다.
 * 바닥과 러그는 캐릭터 발밑 기준으로 놓아야 해서 여기 두지 않는다.
 */
function RoomBackdrop() {
  return (
    <svg
      viewBox="0 0 360 120"
      className="pointer-events-none absolute inset-x-0 top-0 h-[62%] w-full opacity-50"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
    >
      {/* 창문 */}
      <rect x="26" y="20" width="88" height="74" rx="8" fill="#ffffff" opacity="0.8" />
      <rect x="26" y="20" width="88" height="74" rx="8" fill="none" stroke="#c7d0a8" strokeWidth="2.5" />
      <line x1="70" y1="20" x2="70" y2="94" stroke="#c7d0a8" strokeWidth="2" />
      <line x1="26" y1="57" x2="114" y2="57" stroke="#c7d0a8" strokeWidth="2" />
      {/* 선반 */}
      <rect x="238" y="60" width="96" height="5" rx="2.5" fill="#d9c9a4" />
      <circle cx="258" cy="52" r="7" fill="#a0ad5e" opacity="0.7" />
      <circle cx="282" cy="53" r="6" fill="#849244" opacity="0.6" />
      <rect x="302" y="44" width="14" height="16" rx="3" fill="#b9c382" opacity="0.7" />
    </svg>
  );
}
