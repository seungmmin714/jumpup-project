// 방 꾸미기 아이템.
//
// 사용자가 위치를 옮기는 기능은 없다. 아이템마다 방 안의 자리가 정해져 있고,
// 구매하고 배치하면 그 자리에 바로 나타난다.
//
// 배경(room/base.png)에는 아무 가구도 그려져 있지 않다. 창문·선반·러그까지
// 전부 이 표의 낱장 레이어로 올린다 — 배경에 합쳐져 있으면 "구매한 것만
// 보여주기"가 불가능하기 때문이다.

export type RoomItemId =
  | 'window'
  | 'hanging-plant'
  | 'frame'
  | 'shelf'
  | 'rug'
  | 'watering-can';

/** 겹침 순서. 배경 0, 캐릭터 50, 말풍선·파티클 60 */
export const ROOM_LAYER = {
  wall: 10, // 창문 · 행잉 플랜트 · 액자
  furniture: 20, // 선반
  floor: 30, // 러그
  prop: 40, // 물뿌리개
} as const;

export interface RoomItem {
  id: RoomItemId;
  name: string;
  /** 상점 해금에 필요한 레벨 */
  requiredLevel: number;
  layer: number;
  /**
   * 방 안의 고정 위치. 방 카드 크기 대비 %로 준다.
   * top을 주면 위 기준, bottom을 주면 바닥 기준으로 붙는다.
   */
  pos: {
    left: string;
    width: string;
    top?: string;
    bottom?: string;
  };
}

export const ROOM_ITEMS: readonly RoomItem[] = [
  {
    id: 'window',
    name: '창문',
    requiredLevel: 15,
    layer: ROOM_LAYER.wall,
    pos: { left: '3%', top: '4%', width: '30%' },
  },
  {
    id: 'hanging-plant',
    name: '행잉 플랜트',
    requiredLevel: 20,
    layer: ROOM_LAYER.wall,
    pos: { left: '62%', top: '0%', width: '21%' },
  },
  {
    id: 'frame',
    name: '액자',
    requiredLevel: 25,
    layer: ROOM_LAYER.wall,
    pos: { left: '84%', top: '6%', width: '14%' },
  },
  {
    id: 'shelf',
    name: '나무 선반',
    requiredLevel: 5,
    layer: ROOM_LAYER.furniture,
    pos: { left: '70%', top: '34%', width: '30%' },
  },
  {
    id: 'rug',
    name: '동그란 러그',
    requiredLevel: 10,
    layer: ROOM_LAYER.floor,
    pos: { left: '19%', bottom: '4%', width: '62%' },
  },
  {
    id: 'watering-can',
    name: '물뿌리개',
    requiredLevel: 5,
    layer: ROOM_LAYER.prop,
    pos: { left: '4%', bottom: '9%', width: '19%' },
  },
] as const;

/**
 * 상점 진열 순서 — 필요 레벨이 낮은 것부터.
 * 방 안에서의 겹침 순서(layer)와는 무관하다.
 */
export const SHOP_ORDER: readonly RoomItem[] = [...ROOM_ITEMS].sort(
  (a, b) => a.requiredLevel - b.requiredLevel || a.name.localeCompare(b.name, 'ko'),
);

export const findRoomItem = (id: string): RoomItem | undefined =>
  ROOM_ITEMS.find((i) => i.id === id);

/** 겹침 순서대로 정렬해 돌려준다 */
export const sortedByLayer = (ids: readonly string[]): RoomItem[] =>
  ids
    .map(findRoomItem)
    .filter((i): i is RoomItem => i !== undefined)
    .sort((a, b) => a.layer - b.layer);
