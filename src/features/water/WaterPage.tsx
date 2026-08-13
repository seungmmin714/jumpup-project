// T-10 — 급수 가이드 화면. §11.1 플로우 1~6을 단계형 UI로 구성한다.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoilGauge } from '@/components/SoilGauge';
import { Banner, Card, ProgressBar } from '@/components/ui';
import { CelebrationOverlay } from '@/features/character/Character';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { fmtPct, mmss, timeAgo } from '@/lib/format';
import { SOAK_WAIT_MS, TOTAL_ROUNDS, useWaterGuide } from './useWaterGuide';

export default function WaterPage() {
  const navigate = useNavigate();
  const g = useWaterGuide();
  const plant = usePotStore(selectedPlant);
  const lastWateredAt = usePotStore((s) => s.lastWateredAt);
  const latest = useTelemetryStore((s) => s.latest);

  // 라우트 이탈 시 R:0 (§11.3)
  useEffect(() => () => g.exit(), [g]);

  const close = () => {
    g.exit();
    navigate('/');
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      <CelebrationOverlay />

      <header className="flex items-center justify-between pt-1">
        <button type="button" className="tap -ml-2 px-2 text-olive-600" onClick={close}>
          ← 닫기
        </button>
        <span className="text-sm font-bold text-olive-800">
          {plant.emoji} {plant.nameKo} 물 주기
        </span>
        <span className="w-12 text-right text-xs text-olive-400">
          {g.fastSamplingOn ? mmss(g.remainingMs) : ''}
        </span>
      </header>

      {/* 실시간 게이지 — 정적 안내 모드에서는 마지막 값만 */}
      <Card>
        <SoilGauge soilRaw={g.soilRaw} profile={plant} size="lg" />
        {g.fastSamplingOn ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-olive-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-state-good" aria-hidden />
            1초마다 측정하고 있어요
          </p>
        ) : null}
      </Card>

      {g.phase === 'confirm-recent' ? <ConfirmRecent g={g} lastWateredAt={lastWateredAt} /> : null}
      {g.phase === 'static' ? <StaticMode plantMl={plant.waterMl} /> : null}
      {g.phase === 'intro' ? <Intro g={g} plantMl={plant.waterMl} /> : null}
      {g.phase === 'pour' ? <Pouring g={g} /> : null}
      {g.phase === 'soak' ? <Soaking g={g} /> : null}
      {g.phase === 'check' ? <Checking g={g} /> : null}
      {g.phase === 'done' ? <Done g={g} onClose={close} /> : null}

      {g.phase !== 'done' && g.phase !== 'static' ? (
        <p className="mt-auto pb-2 text-center text-[11px] leading-relaxed text-olive-400">
          💡 물이 스며들기까지 20~30초 걸려요.
          <br />
          한 번에 붓지 말고 조금씩 나눠서 부어주세요.
        </p>
      ) : null}

      {latest?.soilMoisture !== undefined && g.phase === 'static' ? (
        <p className="text-center text-[11px] text-olive-400">
          마지막 측정 {fmtPct(latest?.soilMoisture ?? null)} · {timeAgo(latest?.measuredAt)}
        </p>
      ) : null}
    </div>
  );
}

type G = ReturnType<typeof useWaterGuide>;

/** §11.3 급수 완료 후 30분 내 재진입 */
function ConfirmRecent({ g, lastWateredAt }: { g: G; lastWateredAt: string | null }) {
  return (
    <Card>
      <p className="state-word">방금 물을 줬어요</p>
      <p className="mt-1 text-sm text-olive-600">
        {timeAgo(lastWateredAt)}에 급수했어요. 흙이 마를 때까지 기다리는 게 좋아요.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => history.back()}>
          기다릴게요
        </button>
        <button type="button" className="btn-primary" onClick={g.proceedAnyway}>
          그래도 줄래요
        </button>
      </div>
    </Card>
  );
}

/** §11.3 미연결 진입 — 실시간 게이지 없이 권장량과 마지막 값만 */
function StaticMode({ plantMl }: { plantMl: number }) {
  return (
    <>
      <Banner tone="info" title="화분에 연결되어 있지 않아요">
        연결하면 붓는 동안 실시간으로 "그만!"을 알려드려요. 지금은 권장량만 안내할게요.
      </Banner>
      <Card>
        <p className="label">권장 급수량</p>
        <p className="state-word mt-1">약 {plantMl}ml</p>
        <p className="mt-2 text-sm text-olive-600">
          한 번에 붓지 말고 3번에 나눠, 각 회차 사이에 30초씩 기다려주세요.
        </p>
      </Card>
    </>
  );
}

function Intro({ g, plantMl }: { g: G; plantMl: number }) {
  return (
    <Card>
      <p className="label">이번에 줄 양</p>
      <p className="state-word mt-1">약 {plantMl}ml를 천천히</p>
      <p className="mt-2 text-sm text-olive-600">
        {TOTAL_ROUNDS}번에 나눠서 부을 거예요. 한 회차에 약 <b>{g.perRoundMl}ml</b>씩,
        붓고 나면 30초 기다렸다가 다시 확인해요.
      </p>
      <button type="button" className="btn-primary mt-4 w-full" onClick={g.begin}>
        시작하기
      </button>
    </Card>
  );
}

function Pouring({ g }: { g: G }) {
  const tone =
    g.band === 'wet' ? 'bg-blue-50 ring-blue-200' : g.band === 'good' ? 'bg-olive-50 ring-olive-200' : 'bg-white';

  return (
    <>
      <RoundDots round={g.round} />

      <section className={`rounded-2xl p-4 ring-1 ring-olive-100 ${tone}`}>
        {g.band === 'wet' ? (
          <p className="state-word animate-shake text-state-wet">너무 많아요!</p>
        ) : g.band === 'good' ? (
          <p className="state-word text-state-good">그만! 딱 좋아요 👏</p>
        ) : (
          <p className="state-word text-state-dry">천천히 부어주세요</p>
        )}

        <p className="mt-1 text-sm text-olive-600">
          {g.band === 'wet'
            ? '물이 너무 많으면 뿌리가 숨을 못 쉬어요. 지금 멈춰주세요.'
            : g.band === 'good'
              ? '목표 구간에 들어왔어요. 여기서 멈추면 완벽해요.'
              : `${g.round}회차 · 약 ${g.perRoundMl}ml를 화분 중앙에 부어주세요.`}
        </p>

        {g.stalled ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            센서 근처까지 물이 닿지 않았을 수 있어요. 화분 중앙에 부어주세요.
          </p>
        ) : null}

        <button type="button" className="btn-primary mt-4 w-full" onClick={g.finishPour}>
          다 부었어요
        </button>
      </section>
    </>
  );
}

function Soaking({ g }: { g: G }) {
  const progress = ((SOAK_WAIT_MS - g.soakRemainingMs) / SOAK_WAIT_MS) * 100;
  return (
    <>
      <RoundDots round={g.round} />
      <Card>
        <p className="state-word">스며드는 중…</p>
        <p className="mt-1 text-sm text-olive-600">
          물이 센서까지 닿는 데 시간이 걸려요. <b>{Math.ceil(g.soakRemainingMs / 1000)}초</b> 뒤에
          다시 확인할게요.
        </p>
        <ProgressBar value={progress} className="mt-3" />
        <button type="button" className="btn-ghost mt-3 w-full text-sm" onClick={g.skipSoak}>
          지금 바로 확인하기
        </button>
      </Card>
    </>
  );
}

function Checking({ g }: { g: G }) {
  // 'dry'인 경우에만 이 화면이 남는다 (good/wet은 훅이 즉시 완료 처리)
  const last = g.round >= TOTAL_ROUNDS;
  return (
    <>
      <RoundDots round={g.round} />
      <Card>
        <p className="state-word text-state-dry">아직 조금 부족해요</p>
        <p className="mt-1 text-sm text-olive-600">
          현재 토양 {fmtPct(g.soilPct)} · 목표까지 조금 더 필요해요.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={() => g.complete('incomplete')}>
            여기서 끝낼게요
          </button>
          <button type="button" className="btn-primary" onClick={g.nextRound}>
            {last ? '마무리하기' : `${g.round + 1}회차 붓기`}
          </button>
        </div>
      </Card>
    </>
  );
}

function Done({ g, onClose }: { g: G; onClose: () => void }) {
  const map = {
    perfect: { emoji: '🎉', title: '딱 좋아요!', desc: '목표 구간에 정확히 들어왔어요.' },
    'too-much': {
      emoji: '💦',
      title: '조금 많았어요',
      desc: '며칠간 물을 주지 말고 통풍을 시켜주세요.',
    },
    'need-more': { emoji: '🙂', title: '물을 줬어요', desc: '조금 더 지켜볼게요.' },
    incomplete: { emoji: '🙂', title: '물을 줬어요', desc: '다음에 조금 더 부어도 좋아요.' },
    timeout: {
      emoji: '⏱',
      title: '측정 시간이 끝났어요',
      desc: '3분이 지나 실시간 측정이 종료됐어요. 필요하면 다시 시작해 주세요.',
    },
  } as const;
  const r = map[g.verdict ?? 'incomplete'];

  return (
    <Card>
      <p className="text-4xl" aria-hidden>
        {r.emoji}
      </p>
      <p className="state-word mt-2">{r.title}</p>
      <p className="mt-1 text-sm text-olive-600">{r.desc}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-olive-50 py-2">
          <dt className="label">주기 전</dt>
          <dd className="text-lg font-bold text-olive-800">{fmtPct(g.startedPct)}</dd>
        </div>
        <div className="rounded-xl bg-olive-50 py-2">
          <dt className="label">주고 나서</dt>
          <dd className="text-lg font-bold text-olive-800">{fmtPct(g.soilPct)}</dd>
        </div>
      </dl>

      <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
        홈으로 돌아가기
      </button>
    </Card>
  );
}

function RoundDots({ round }: { round: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`${round}회차`}>
      {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${
            i + 1 === round ? 'w-6 bg-olive-600' : i + 1 < round ? 'w-2 bg-olive-400' : 'w-2 bg-olive-200'
          }`}
        />
      ))}
    </div>
  );
}
