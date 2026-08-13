// 캐릭터 방 — 홈에서 가장 큰 영역.
//
// 바닥·러그·그림자는 모두 **캐릭터 줄의 아래끝(top-full)** 을 기준으로 놓는다.
// 캐릭터 아트가 전처리 단계에서 바닥 정렬돼 있으므로, 그 선이 곧 발이 닿는 지점이다.
// 이 줄은 반드시 w-full이어야 한다 — 캐릭터 폭(176px)만큼만 잡히면
// 바닥이 기둥처럼 좁게 서 버린다.

import { PlantCharacter, SpeechBubble, moodScene } from '@/features/character/PlantCharacter';
import type { Mood, Plant } from '@/ble/types';

interface Props {
  plant: Plant;
  mood: Mood;
  stale: boolean;
  celebrating: boolean;
  speech: string;
  caption: string;
}

export function PlantScene({ plant, mood, stale, celebrating, speech, caption }: Props) {
  return (
    <section
      className={`relative overflow-hidden rounded-card bg-gradient-to-b shadow-card ${moodScene(mood)}`}
    >
      <RoomWall />

      <div className="relative flex flex-col items-center px-4 pt-4">
        <SpeechBubble text={speech} tone={mood === 0 ? 'default' : 'alert'} />

        <div className="relative mt-2 flex w-full justify-center">
          {/* 바닥 — 좌우 padding을 상쇄해 카드 끝까지 채운다 */}
          <div className="absolute -left-4 -right-4 top-full h-28 border-t-2 border-[#b08d5f]/30 bg-[#c9a06a]/35" />
          {/* 러그 — 발이 타원 한가운데 오도록 */}
          <span className="absolute left-1/2 top-full h-[70px] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#e8d5ab]" />
          <span className="absolute left-1/2 top-full h-[46px] w-[10.5rem] -translate-x-1/2 -translate-y-1/2 rounded-[50%] ring-2 ring-[#d2b782]/60" />
          {/* 발밑 그림자 */}
          <span className="absolute left-1/2 top-full h-3.5 w-24 -translate-x-1/2 -translate-y-[60%] rounded-[50%] bg-black/15 blur-[3px]" />

          <div className="relative z-10">
            <PlantCharacter
              plant={plant}
              mood={mood}
              stale={stale}
              celebrating={celebrating}
            />
          </div>
        </div>

        {/* 이름표 — 시안처럼 씬 하단에 겹쳐 놓는다 */}
        <div className="relative z-10 mb-4 mt-11 flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-[12px] font-bold text-ink shadow-card">
          <span className="pixelated" aria-hidden>
            {plant.emoji}
          </span>
          {plant.nameKo}
          <span className="text-ink-sub">·</span>
          <span className={stale ? 'text-ink-sub' : 'text-primary'}>{caption}</span>
        </div>
      </div>
    </section>
  );
}

/** 벽 장식 — 창문과 선반. 캐릭터가 주인공이므로 아주 옅게만 깐다. */
function RoomWall() {
  return (
    <svg
      viewBox="0 0 360 130"
      className="pointer-events-none absolute inset-x-0 top-0 h-[58%] w-full opacity-60"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
    >
      {/* 창문 */}
      <rect x="20" y="16" width="92" height="78" rx="6" fill="#eaf3fb" />
      <rect x="20" y="16" width="92" height="78" rx="6" fill="none" stroke="#b08d5f" strokeWidth="5" />
      <line x1="66" y1="16" x2="66" y2="94" stroke="#b08d5f" strokeWidth="4" />
      <line x1="20" y1="55" x2="112" y2="55" stroke="#b08d5f" strokeWidth="4" />
      <circle cx="46" cy="38" r="9" fill="#ffffff" opacity="0.85" />
      <circle cx="88" cy="72" r="7" fill="#ffffff" opacity="0.7" />

      {/* 선반 */}
      <rect x="238" y="70" width="104" height="6" rx="3" fill="#b08d5f" />
      <rect x="252" y="52" width="16" height="18" rx="3" fill="#7f9e4a" />
      <rect x="276" y="46" width="14" height="24" rx="3" fill="#5f7f3a" />
      <rect x="298" y="56" width="18" height="14" rx="3" fill="#a8894f" />

      {/* 액자 */}
      <rect x="150" y="20" width="34" height="28" rx="3" fill="#f4ead6" stroke="#b08d5f" strokeWidth="3" />
    </svg>
  );
}
