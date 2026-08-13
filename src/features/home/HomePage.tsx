// T-07 — 홈 대시보드. §9.2 구성 순서를 그대로 따른다.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectionBadge, ConnectionBanners } from '@/components/ConnectionBadge';
import { Banner, Card, ProgressBar } from '@/components/ui';
import { SoilGauge } from '@/components/SoilGauge';
import { Character, CelebrationOverlay } from '@/features/character/Character';
import { SensorStrip } from './SensorStrip';
import { SolutionCard } from './SolutionCard';
import { LedSlider } from './LedSlider';
import { PotPicker } from './PotPicker';
import { useOfflineLatest } from '@/lib/useOfflineLatest';
import { allSensorsMissing, useTelemetryStore } from '@/store/telemetryStore';
import { isLive, isProtoOk, useConnectionStore } from '@/store/connectionStore';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { useCharacterStore } from '@/store/characterStore';
import { timeAgo } from '@/lib/format';
import { STAGE_BY_LEVEL } from '@/store/characterStore';

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
  const stale = !live;

  return (
    <div className="space-y-4">
      <CelebrationOverlay />

      {/* ① 연결 배지 */}
      <div className="space-y-2">
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
      </div>

      {pots.length === 0 ? (
        <Card>
          <p className="text-sm font-bold text-olive-800">아직 등록된 화분이 없어요</p>
          <p className="mt-1 text-xs text-olive-500">
            화분 뒷면 QR을 찍거나, 위의 <b>화분 연결하기</b>를 눌러 시작해 주세요.
          </p>
        </Card>
      ) : null}

      {/* ② 센서 요약 */}
      <SensorStrip t={latest} streak={streak} />

      {/* ③ 인벤토리 / 이벤트 — 후순위, 자리만 확보 */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary opacity-60" disabled>
          🎒 인벤토리
        </button>
        <button type="button" className="btn-secondary opacity-60" disabled>
          🎪 이벤트
        </button>
      </div>

      {/* ④ 캐릭터 + 말풍선 */}
      <Card className="py-6">
        <Character mood={mood} stale={stale} />
      </Card>

      {/* ⑤ 솔루션 카드 */}
      <SolutionCard mood={mood} onRaiseLed={() => setLedBoost((n) => n + 1)} />

      {/* ⑥ 토양 게이지 + 제어 */}
      <Card>
        <SoilGauge soilRaw={latest?.soilRaw ?? null} profile={plant} />
      </Card>

      <button
        type="button"
        className={`btn w-full ${
          mood === 1 ? 'bg-state-wet text-white shadow-lg animate-pop-in' : 'btn-secondary'
        }`}
        onClick={() => navigate('/water')}
        disabled={!protoOk}
      >
        💧 물 주기
        {mood === 1 ? <span className="text-xs font-normal">지금 필요해요!</span> : null}
      </button>

      <LedSlider boostSignal={ledBoost} />

      {/* ⑦ 행복도·성장 단계 */}
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="state-word text-olive-800">
            {mood === 0 ? '건강해요!' : '돌봄이 필요해요'}
          </span>
          <span className="text-sm font-bold text-olive-600">
            😊 행복도 {character.happiness}%
          </span>
        </div>
        <ProgressBar value={character.happiness} className="mt-2" />

        <div className="mt-4 flex items-baseline justify-between text-xs text-olive-600">
          <span>
            성장 단계 · <b>{character.stage || STAGE_BY_LEVEL(character.level)}</b>
          </span>
          <span>
            Lv.{character.level} · {character.exp}/{character.expToNext} EXP
          </span>
        </div>
        <ProgressBar
          value={(character.exp / Math.max(1, character.expToNext)) * 100}
          tone="bg-cream-500"
          className="mt-1.5"
        />
      </Card>
    </div>
  );
}
