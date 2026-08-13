// 식물별 캐릭터 아트 렌더러.
//
// 아트는 식물당 한 장이면 된다. 기분 7종은 이미지를 갈아끼우는 대신
// 색 필터 · 움직임 · 오버레이 아이콘을 얹어 표현한다.
// (기분별 전용 아트가 생기면 plant.characterMoodImages가 우선 사용된다.)

import { useEffect, useState } from 'react';
import { moodInfo } from '@/lib/mood';
import { PixelIcon, type IconName } from '@/components/PixelIcon';
import type { Mood, Plant } from '@/ble/types';

interface MoodStyle {
  /** 이미지에 얹는 CSS 필터 */
  filter: string;
  animation: string;
  /** 캐릭터 주위에 떠다니는 아이콘 */
  particles: IconName[];
  /** 씬 배경 그라데이션 */
  scene: string;
}

const MOOD_STYLE: Record<Mood, MoodStyle> = {
  0: {
    filter: 'saturate(1.05)',
    animation: 'animate-bob',
    particles: [],
    scene: 'from-[#dfe9c8] via-[#f0e7cf] to-[#e4d3b0]',
  },
  1: {
    filter: 'saturate(0.6) brightness(0.97)',
    animation: 'animate-droop',
    particles: ['drop'],
    scene: 'from-[#f3e3c4] via-[#f2e6cd] to-[#e4d3b0]',
  },
  2: {
    filter: 'saturate(1.15) hue-rotate(-12deg) brightness(1.05)',
    animation: 'animate-shiver',
    particles: ['fire'],
    scene: 'from-[#f7dcc8] via-[#f4e4cd] to-[#e4d3b0]',
  },
  3: {
    filter: 'saturate(0.85) hue-rotate(15deg) brightness(0.98)',
    animation: 'animate-shiver',
    particles: ['snow'],
    scene: 'from-[#d8e6f0] via-[#eee9d8] to-[#e4d3b0]',
  },
  4: {
    filter: 'brightness(0.72) saturate(0.8)',
    animation: 'animate-sleep',
    particles: ['zzz'],
    scene: 'from-[#c8cbe0] via-[#e2ddd6] to-[#ddcdae]',
  },
  5: {
    filter: 'saturate(0.9) hue-rotate(12deg) brightness(0.96)',
    animation: 'animate-sway',
    particles: ['splash'],
    scene: 'from-[#d3e4f2] via-[#eae9d9] to-[#e4d3b0]',
  },
  6: {
    filter: 'grayscale(0.8) brightness(0.95)',
    animation: 'animate-glitch',
    particles: ['question'],
    scene: 'from-[#dedcd6] via-[#e9e6dd] to-[#e0d5c0]',
  },
};

export const moodScene = (mood: Mood): string => MOOD_STYLE[mood].scene;

interface Props {
  plant: Plant;
  mood: Mood;
  /** 실시간이 아니면 흐리게 — 지금 상태가 아님을 알린다 */
  stale?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** 회복 연출 중에는 기분과 무관하게 밝게 */
  celebrating?: boolean;
  /** 부모가 크기를 정하는 경우(씬처럼 % 높이) 고정 크기를 쓰지 않는다 */
  fill?: boolean;
}

// 전처리(scripts/prep-characters.mjs)를 거친 아트는 정사각형이고 발이 아래끝에 맞춰져 있다.
// 그래서 박스도 정사각으로 두면 박스의 아래끝 = 캐릭터가 딛는 바닥선이 된다.
// 전처리를 안 거친 세로형 이미지도 object-contain + object-bottom이면 바닥이 맞는다.
const SIZE = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-44 w-44',
} as const;

export function PlantCharacter({
  plant,
  mood,
  stale = false,
  size = 'lg',
  celebrating = false,
  fill = false,
}: Props) {
  const src = plant.characterMoodImages?.[mood] ?? plant.characterImage;
  const [failed, setFailed] = useState(false);
  const style = MOOD_STYLE[mood];
  const info = moodInfo(mood);

  // 식물을 바꾸면 다시 시도한다
  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`relative shrink-0 ${fill ? 'aspect-square w-full' : SIZE[size]}`}>
      {failed ? (
        // 아트가 아직 없을 때의 대체 표정
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-card ring-4 ring-primary-soft ${style.animation}`}
          role="img"
          aria-label={`${plant.nameKo} 캐릭터: ${info.name}`}
        >
          <span className="select-none font-mono text-2xl text-ink-sub">{info.face}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={`${plant.nameKo} 캐릭터: ${info.name}`}
          className={`pixel-art h-full w-full object-contain object-bottom transition-[filter] duration-700 ${
            celebrating ? 'animate-pop-in' : style.animation
          }`}
          style={{
            // 실시간이 아닐 때는 투명하게 하지 않는다 — 방 배경이 비쳐 캐릭터가 유령처럼 보인다.
            // 채도만 살짝 낮추고, 실시간 여부는 이름표의 "마지막 기분"으로 알린다.
            filter: celebrating
              ? 'saturate(1.2) brightness(1.05)'
              : `${style.filter}${stale ? ' saturate(0.75)' : ''}`,
          }}
          onError={() => setFailed(true)}
          draggable={false}
        />
      )}

      {!stale ? <Particles icons={celebrating ? ['face-happy'] : style.particles} /> : null}
    </div>
  );
}

function Particles({ icons }: { icons: IconName[] }) {
  if (icons.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {icons.map((icon, i) => (
        <span
          key={`${icon}-${i}`}
          className="absolute animate-float-away text-lg"
          style={{
            left: `${18 + i * 34}%`,
            bottom: '62%',
            animationDelay: `${i * 700}ms`,
          }}
        >
          <PixelIcon name={icon} size={22} />
        </span>
      ))}
    </div>
  );
}

/** 말풍선 — 참고 디자인처럼 캐릭터 위에 둥글게 띄운다 */
export function SpeechBubble({ text, tone = 'default' }: { text: string; tone?: 'default' | 'alert' }) {
  return (
    <div
      className={`relative max-w-[88%] rounded-2xl px-4 py-2.5 text-center text-sm font-bold leading-snug shadow-sm ring-1 animate-pop-in ${
        tone === 'alert'
          ? 'bg-card text-ink ring-warn/40'
          : 'bg-card text-ink ring-line'
      }`}
    >
      {text}
      <span
        className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 ring-1 ${
          tone === 'alert' ? 'bg-card ring-warn/40' : 'bg-card ring-line'
        }`}
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
        aria-hidden
      />
    </div>
  );
}
