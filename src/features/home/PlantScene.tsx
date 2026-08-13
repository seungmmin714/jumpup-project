// 캐릭터 방 — 홈에서 가장 큰 영역.
//
// 배경은 도트 방 이미지 한 장(public/sprites/room.png)을 쓴다.
// 그림 안의 러그 중심이 가로 50.5% / 세로 84% 지점이라, 캐릭터 발을 그 자리에 맞춘다.
// (이전에는 바닥과 러그를 CSS로 그렸는데, 캐릭터 줄 폭에 묶여 기둥처럼 보였다.)

import { PlantCharacter, SpeechBubble } from '@/features/character/PlantCharacter';
import type { Mood, Plant } from '@/ble/types';

/** 러그 중심 = 캐릭터가 딛는 지점 */
const FEET_FROM_BOTTOM = '15%';
const CHARACTER_HEIGHT = '52%';

interface Props {
  plant: Plant;
  mood: Mood;
  stale: boolean;
  celebrating: boolean;
  speech: string;
  caption: string;
  /** 급수가 감지되는 동안엔 기분 색 덮개 대신 물빛으로 */
  watering?: boolean;
}

export function PlantScene({
  plant,
  mood,
  stale,
  celebrating,
  speech,
  caption,
  watering = false,
}: Props) {
  return (
    <section className="relative aspect-[4/3] w-full overflow-hidden rounded-card shadow-card">
      <img
        src="/sprites/room.png"
        alt=""
        aria-hidden
        className="pixelated absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* 기분에 따라 방 분위기를 살짝 덮는다 */}
      <div className={`absolute inset-0 ${watering ? 'bg-wet/20' : MOOD_WASH[mood]}`} aria-hidden />

      {/* 말풍선 */}
      <div className="absolute inset-x-0 top-3 flex justify-center px-4">
        <SpeechBubble text={speech} tone={mood === 0 ? 'default' : 'alert'} />
      </div>

      {/* 캐릭터 — 발이 러그 중심에 오도록 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: FEET_FROM_BOTTOM, height: CHARACTER_HEIGHT }}
      >
        <PlantCharacter
          plant={plant}
          mood={mood}
          stale={stale}
          celebrating={celebrating}
          fill
        />
      </div>

      {/* 이름표 */}
      <div className="absolute inset-x-0 bottom-2.5 flex justify-center">
        <span className="flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-[12px] font-bold text-ink shadow-card">
          <span aria-hidden>{plant.emoji}</span>
          {plant.nameKo}
          <span className="text-ink-sub">·</span>
          <span className={stale ? 'text-ink-sub' : 'text-primary'}>{caption}</span>
        </span>
      </div>
    </section>
  );
}

/** 기분별 색 덮개. 캐릭터 필터와 방향을 맞춘다. */
const MOOD_WASH: Record<Mood, string> = {
  0: '',
  1: 'bg-warn/10',
  2: 'bg-danger/15',
  3: 'bg-wet/20',
  4: 'bg-indigo-900/35',
  5: 'bg-wet/15',
  6: 'bg-neutral-500/25',
};
