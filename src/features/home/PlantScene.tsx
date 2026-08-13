// 캐릭터 방 — 홈에서 가장 큰 영역.
//
// 배경(room/base.png)에는 가구가 하나도 그려져 있지 않다.
// 창문·선반·러그까지 전부 낱장 레이어로 올린다 — 배경에 합쳐져 있으면
// "구매한 것만 보여주기"가 불가능하기 때문이다.
//
// 겹침 순서
//   0  빈 방 배경
//   10 창문 · 행잉 플랜트 · 액자
//   20 선반
//   30 러그
//   40 물뿌리개
//   50 캐릭터
//   60 말풍선 · 이름표
//
// 캐릭터는 러그 위에 서야 하므로, 러그가 없어도 자리가 흔들리지 않도록
// 배경 그림의 바닥 지점(세로 84%)을 기준으로 고정한다.

import { PlantCharacter, SpeechBubble } from '@/features/character/PlantCharacter';
import { sortedByLayer } from '@/data/roomItems';
import { useRoomStore } from '@/store/roomStore';
import type { Mood, Plant } from '@/ble/types';

/** 캐릭터가 딛는 지점 (러그 중심) */
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
  potId: string;
}

export function PlantScene({
  plant,
  mood,
  stale,
  celebrating,
  speech,
  caption,
  watering = false,
  potId,
}: Props) {
  const placed = useRoomStore((s) => s.placed[potId] ?? []);
  const items = sortedByLayer(placed);

  return (
    <section className="relative aspect-[4/3] w-full overflow-hidden rounded-card shadow-card">
      {/* 1. 빈 방 배경 */}
      <img
        src="/room/base.png"
        alt=""
        aria-hidden
        className="pixelated absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* 2~5. 구매해서 방에 놓은 가구만 그린다 */}
      {items.map((item) => (
        <img
          key={item.id}
          src={`/room/${item.id}.png`}
          alt=""
          aria-hidden
          className="pixelated absolute animate-pop-in"
          style={{
            left: item.pos.left,
            width: item.pos.width,
            ...(item.pos.top !== undefined ? { top: item.pos.top } : null),
            ...(item.pos.bottom !== undefined ? { bottom: item.pos.bottom } : null),
            zIndex: item.layer,
          }}
          draggable={false}
        />
      ))}

      {/* 기분에 따라 방 분위기를 살짝 덮는다 */}
      <div
        className={`absolute inset-0 ${watering ? 'bg-wet/20' : MOOD_WASH[mood]}`}
        style={{ zIndex: 45 }}
        aria-hidden
      />

      {/* 6. 캐릭터 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: FEET_FROM_BOTTOM, height: CHARACTER_HEIGHT, zIndex: 50 }}
      >
        <PlantCharacter plant={plant} mood={mood} stale={stale} celebrating={celebrating} fill />
      </div>

      {/* 7. 말풍선 · 이름표 */}
      <div className="absolute inset-x-0 top-3 flex justify-center px-4" style={{ zIndex: 60 }}>
        <SpeechBubble text={speech} tone={mood === 0 ? 'default' : 'alert'} />
      </div>

      <div className="absolute inset-x-0 bottom-2.5 flex justify-center" style={{ zIndex: 60 }}>
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
