// T-08 — 캐릭터 + 말풍선. 픽셀 스프라이트가 준비되면 face 자리를 <img>로 교체한다.

import { TONE_CLASS, moodInfo } from '@/lib/mood';
import { useCharacterStore } from '@/store/characterStore';
import type { Mood } from '@/ble/types';

interface Props {
  mood: Mood;
  /** 실시간이 아니면 흐리게 — 지금 상태가 아니라는 걸 시각적으로 알린다 */
  stale?: boolean;
  size?: 'sm' | 'lg';
}

export function Character({ mood, stale = false, size = 'lg' }: Props) {
  const info = moodInfo(mood);
  const tone = TONE_CLASS[info.tone];
  const gloomy = useCharacterStore((s) => s.gloomy);
  const celebrating = useCharacterStore((s) => s.celebrating);

  return (
    <div className="relative flex flex-col items-center">
      {/* 말풍선 */}
      <div
        className={`relative mb-3 max-w-[86%] rounded-2xl px-4 py-2.5 text-center text-sm font-bold shadow-sm ring-1 ${tone.bg} ${tone.text} ${tone.ring} animate-pop-in`}
        key={info.key}
      >
        {celebrating ? '다시 건강해졌어요!' : info.speech}
        <span
          className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 ${tone.bg} ring-1 ${tone.ring}`}
          aria-hidden
        />
      </div>

      {/* 캐릭터 */}
      <div
        className={`relative flex items-center justify-center rounded-full ${tone.bg} ring-4 ${tone.ring} ${
          size === 'lg' ? 'h-40 w-40' : 'h-20 w-20'
        } ${celebrating ? 'animate-pop-in' : mood === 0 ? 'animate-bob' : ''} ${
          stale ? 'opacity-50 saturate-50' : ''
        } ${gloomy && mood !== 0 ? 'grayscale-[0.4]' : ''}`}
        role="img"
        aria-label={`화분 기분: ${info.name}`}
      >
        <span
          className={`select-none font-mono ${size === 'lg' ? 'text-3xl' : 'text-base'} ${tone.text}`}
        >
          {info.face}
        </span>
        {celebrating ? <Sparkles /> : null}
      </div>

      <p className="mt-2 text-xs font-semibold text-olive-500">
        {stale ? '마지막으로 확인된 기분' : info.name}
        {gloomy && mood !== 0 ? ' · 오래 힘들어하고 있어요' : ''}
      </p>
    </div>
  );
}

function Sparkles() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {['10%', '30%', '55%', '78%'].map((left, i) => (
        <span
          key={left}
          className="absolute bottom-4 text-xl animate-sparkle-up"
          style={{ left, animationDelay: `${i * 140}ms` }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

/** T-17 — mood 0 복귀 시 재생되는 핵심 보상 연출(§10.3) */
export function CelebrationOverlay() {
  const { celebrating, celebrationText, bonusExp } = useCharacterStore();
  if (!celebrating) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-pop-in rounded-3xl bg-olive-700/95 px-8 py-6 text-center text-cream-50 shadow-2xl">
        <p className="text-3xl font-black">{celebrationText}</p>
        <p className="mt-1 text-sm opacity-90">그로미가 기운을 되찾았어요</p>
        {bonusExp > 0 ? (
          <p className="mt-2 inline-block rounded-full bg-cream-50/20 px-3 py-1 text-sm font-bold">
            +{bonusExp} EXP
          </p>
        ) : null}
      </div>
    </div>
  );
}
