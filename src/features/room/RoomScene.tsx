// 방 렌더러 — 홈 화면과 Room Layout Editor가 **같은 컴포넌트**를 쓴다.
// 편집기에서 맞춘 좌표가 실제 화면과 어긋나지 않으려면 렌더링 코드가 하나여야 한다.
//
// 모든 위치는 1024×768 좌표 → 백분율 변환(toRoomStyle)으로만 계산한다.
// 화면 폭별 보정값은 두지 않는다.

import type { CSSProperties, ReactNode } from 'react';
import { PlantCharacter, SpeechBubble } from '@/features/character/PlantCharacter';
import { ROOM_ITEM_CATALOG, type RoomItemId } from './roomCatalog';
import {
  ROOM_LAYOUT,
  ROOM_STAGE,
  ROOM_Z,
  toRoomStyle,
  type RoomLayoutItem,
  type RoomLayoutKey,
} from './roomLayout';
import type { Mood, Plant } from '@/ble/types';

export type RoomLayoutMap = Record<RoomLayoutKey, RoomLayoutItem>;

interface Props {
  plant: Plant;
  mood: Mood;
  stale?: boolean;
  celebrating?: boolean;
  speech?: string;
  /** 이름표 오른쪽에 붙는 짧은 문구 (Lv.12 / 마지막 기분 등) */
  caption?: string;
  watering?: boolean;
  /** 방에 그릴 아이템. 구매하지 않은 아이템은 넘기지 않는다. */
  visibleItemIds: readonly RoomItemId[];
  /** 편집기에서 임시 좌표를 덮어쓸 때 */
  layout?: RoomLayoutMap;
  /** 편집기 전용 — 클릭 선택 */
  onSelect?: (key: RoomLayoutKey) => void;
  selectedKey?: RoomLayoutKey | null;
  /** 편집기 오버레이(격자·핸들 등) */
  overlay?: ReactNode;
  className?: string;
}

export function RoomScene({
  plant,
  mood,
  stale = false,
  celebrating = false,
  speech,
  caption,
  watering = false,
  visibleItemIds,
  layout = ROOM_LAYOUT,
  onSelect,
  selectedKey = null,
  overlay,
  className = '',
}: Props) {
  const characterBox = layout.character;
  // 캐릭터 캔버스는 정사각이므로 높이 = width. 말풍선은 그 위에 띄운다.
  const speechY = Math.max(8, characterBox.y - characterBox.width - 26);

  const selectable = (key: RoomLayoutKey): CSSProperties =>
    onSelect ? { cursor: 'pointer', outline: selectedKey === key ? '2px dashed #d9534f' : undefined } : {};

  return (
    <section
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-card shadow-card ${className}`}
      data-room-scene
    >
      {/* z0 — 빈 방 배경 */}
      <img
        src="/room/base.png"
        alt=""
        aria-hidden
        className="pixel-art absolute inset-0 h-full w-full object-cover"
        style={{ zIndex: ROOM_Z.background }}
        draggable={false}
      />

      {/* z10~35 — 구매해서 방에 놓은 가구만 */}
      {/* z 순서대로 그린다 — DOM 순서와 칠해지는 순서를 일치시켜 둔다 */}
      {[...visibleItemIds]
        .filter((id) => ROOM_ITEM_CATALOG[id] && layout[id])
        .sort((a, b) => layout[a].zIndex - layout[b].zIndex)
        .map((id) => {
        const info = ROOM_ITEM_CATALOG[id];
        const box = layout[id];
        return (
          <img
            key={id}
            src={info.src}
            alt=""
            aria-hidden={onSelect ? undefined : true}
            data-room-item={id}
            className="pixel-art absolute h-auto"
            style={{ ...toRoomStyle(box), ...selectable(id) }}
            onPointerDown={onSelect ? () => onSelect(id) : undefined}
            draggable={false}
          />
        );
      })}

      {/* 기분에 따라 방 분위기를 덮는다 */}
      <div
        className={`pointer-events-none absolute inset-0 ${watering ? 'bg-wet/20' : MOOD_WASH[mood]}`}
        style={{ zIndex: ROOM_Z.rug + 1 }}
        aria-hidden
      />

      {/* z30 — 캐릭터 (발이 layout.character.y에 닿는다) */}
      <div
        className="absolute"
        data-room-item="character"
        style={{ ...toRoomStyle(characterBox), ...selectable('character') }}
        onPointerDown={onSelect ? () => onSelect('character') : undefined}
      >
        <PlantCharacter plant={plant} mood={mood} stale={stale} celebrating={celebrating} fill />
      </div>

      {/* z50 — 말풍선. 캐릭터 좌표에서 계산하므로 캐릭터가 움직이면 같이 움직인다. */}
      {speech ? (
        <div
          className="pointer-events-none absolute flex justify-center px-3"
          style={{
            left: 0,
            right: 0,
            top: `${(speechY / ROOM_STAGE.height) * 100}%`,
            zIndex: ROOM_Z.speech,
          }}
        >
          <SpeechBubble text={speech} tone={mood === 0 ? 'default' : 'alert'} />
        </div>
      ) : null}

      {caption !== undefined ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center"
          style={{ zIndex: ROOM_Z.speech }}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-[12px] font-bold text-ink shadow-card">
            <span aria-hidden>{plant.emoji}</span>
            {plant.nameKo}
            {caption ? (
              <>
                <span className="text-ink-sub">·</span>
                <span className={stale ? 'text-ink-sub' : 'text-primary'}>{caption}</span>
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {overlay}
    </section>
  );
}

/** 기분별 색 덮개 */
const MOOD_WASH: Record<Mood, string> = {
  0: '',
  1: 'bg-warn/10',
  2: 'bg-danger/15',
  3: 'bg-wet/20',
  4: 'bg-indigo-900/35',
  5: 'bg-wet/15',
  6: 'bg-neutral-500/25',
};
