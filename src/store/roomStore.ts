// 방 꾸미기 — 구매(보유)와 배치 상태.
//
// 화분마다 방이 따로이므로 potId별로 나눠 저장한다.
// 새로고침 후에도 남아야 하므로 localStorage에 persist한다 (§16이 금지하는 건
// 센서 히스토리이지 사용자 설정이 아니다).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomItemId } from '@/data/roomItems';

type ByPot = Record<string, RoomItemId[]>;

interface RoomState {
  /** 구매한 아이템 */
  owned: ByPot;
  /** 그중 지금 방에 놓여 있는 아이템 */
  placed: ByPot;

  isOwned: (potId: string | null, id: RoomItemId) => boolean;
  isPlaced: (potId: string | null, id: RoomItemId) => boolean;
  placedItems: (potId: string | null) => RoomItemId[];

  /** 구매하면 배치까지 한 번에 — 별도 배치 과정을 두지 않는다 */
  purchase: (potId: string, id: RoomItemId) => void;
  place: (potId: string, id: RoomItemId) => void;
  remove: (potId: string, id: RoomItemId) => void;
  togglePlaced: (potId: string, id: RoomItemId) => void;
  /** 자리표시 방에서 꾸민 걸 실제 화분 방으로 옮긴다 */
  adoptRoom: (fromPotId: string, toPotId: string) => void;
}

const add = (list: RoomItemId[] | undefined, id: RoomItemId) =>
  list?.includes(id) ? list : [...(list ?? []), id];

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      owned: {},
      placed: {},

      isOwned: (potId, id) => (potId ? (get().owned[potId]?.includes(id) ?? false) : false),
      isPlaced: (potId, id) => (potId ? (get().placed[potId]?.includes(id) ?? false) : false),
      placedItems: (potId) => (potId ? (get().placed[potId] ?? []) : []),

      purchase: (potId, id) =>
        set((s) => ({
          owned: { ...s.owned, [potId]: add(s.owned[potId], id) },
          // 구매 즉시 방에 나타난다
          placed: { ...s.placed, [potId]: add(s.placed[potId], id) },
        })),

      place: (potId, id) =>
        set((s) => ({ placed: { ...s.placed, [potId]: add(s.placed[potId], id) } })),

      remove: (potId, id) =>
        set((s) => ({
          placed: { ...s.placed, [potId]: (s.placed[potId] ?? []).filter((x) => x !== id) },
        })),

      togglePlaced: (potId, id) =>
        get().isPlaced(potId, id) ? get().remove(potId, id) : get().place(potId, id),

      adoptRoom: (fromPotId, toPotId) =>
        set((s) => {
          const fromOwned = s.owned[fromPotId] ?? [];
          const fromPlaced = s.placed[fromPotId] ?? [];
          if (fromOwned.length === 0 && fromPlaced.length === 0) return s;

          const merge = (a: RoomItemId[] = [], b: RoomItemId[] = []) => [...new Set([...a, ...b])];
          const { [fromPotId]: _o, ...restOwned } = s.owned;
          const { [fromPotId]: _p, ...restPlaced } = s.placed;
          return {
            owned: { ...restOwned, [toPotId]: merge(s.owned[toPotId], fromOwned) },
            placed: { ...restPlaced, [toPotId]: merge(s.placed[toPotId], fromPlaced) },
          };
        }),
    }),
    { name: 'growme.room' },
  ),
);
