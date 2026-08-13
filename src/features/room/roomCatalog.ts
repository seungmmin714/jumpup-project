// 방 아이템의 상품 정보. 위치는 여기 두지 않는다(roomLayout.ts).
//
//   구매 여부 → roomStore (사용자 데이터)
//   고정 위치 → ROOM_LAYOUT
//   이미지·상품 정보 → 여기
//
// 상점과 방이 같은 itemId·같은 이미지를 쓴다. 상점 카드에서 필요한 여백은
// CSS로 준다 — 배치용 PNG에는 여백이 없다.

import type { RoomLayoutKey } from './roomLayout';

export type RoomItemId = Exclude<RoomLayoutKey, 'character'>;

export interface RoomItemInfo {
  id: RoomItemId;
  name: string;
  src: string;
  price: number;
  requiredLevel: number;
}

export const ROOM_ITEM_CATALOG: Record<RoomItemId, RoomItemInfo> = {
  shelf: {
    id: 'shelf',
    name: '나무 선반',
    src: '/room/shelf.png',
    price: 300,
    requiredLevel: 5,
  },
  wateringCan: {
    id: 'wateringCan',
    name: '물뿌리개',
    src: '/room/watering-can.png',
    price: 250,
    requiredLevel: 5,
  },
  roundRug: {
    id: 'roundRug',
    name: '동그란 러그',
    src: '/room/round-rug.png',
    price: 400,
    requiredLevel: 10,
  },
  window: {
    id: 'window',
    name: '창문',
    src: '/room/window.png',
    price: 500,
    requiredLevel: 15,
  },
  hangingPlant: {
    id: 'hangingPlant',
    name: '행잉 플랜트',
    src: '/room/hanging-plant.png',
    price: 600,
    requiredLevel: 20,
  },
  botanicalFrame: {
    id: 'botanicalFrame',
    name: '액자',
    src: '/room/botanical-frame.png',
    price: 700,
    requiredLevel: 25,
  },
};

export const ROOM_ITEM_IDS = Object.keys(ROOM_ITEM_CATALOG) as RoomItemId[];

/** 상점 진열 순서 — 필요 레벨이 낮은 것부터, 같으면 가격순 */
export const SHOP_ORDER: readonly RoomItemInfo[] = ROOM_ITEM_IDS.map(
  (id) => ROOM_ITEM_CATALOG[id],
).sort((a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price);

export const isRoomItemId = (v: string): v is RoomItemId => v in ROOM_ITEM_CATALOG;

/** 예전 kebab-case id에서 옮겨오기 위한 표 */
export const LEGACY_ID_MAP: Record<string, RoomItemId> = {
  shelf: 'shelf',
  'watering-can': 'wateringCan',
  rug: 'roundRug',
  window: 'window',
  'hanging-plant': 'hangingPlant',
  frame: 'botanicalFrame',
};
