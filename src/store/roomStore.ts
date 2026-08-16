// 방 꾸미기 — 구매(보유)와 배치 상태, 그리고 포인트 잔액.
//
// 위치는 여기 저장하지 않는다. 모든 사용자가 같은 고정 위치(ROOM_LAYOUT)를 쓴다.
//   구매 여부 → 이 스토어
//   고정 위치 → ROOM_LAYOUT
//   상품 정보 → ROOM_ITEM_CATALOG
//
// 화분마다 방이 따로이므로 potId별로 나눈다. 새로고침 후에도 남아야 하므로
// localStorage에 persist한다 (§16이 금지하는 건 센서 히스토리이지 사용자 설정이 아니다).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEGACY_ID_MAP, ROOM_ITEM_CATALOG, isRoomItemId, type RoomItemId } from '@/features/room/roomCatalog';

type ByPot = Record<string, RoomItemId[]>;

/** 포인트 시스템이 서버에 아직 없어 로컬에서만 관리한다. 시연용 초기 잔액. */
export const STARTING_POINTS = 3000;

export type PurchaseResult = 'ok' | 'already-owned' | 'locked' | 'not-enough-points';

interface RoomState {
  owned: ByPot;
  placed: ByPot;
  points: number;

  isOwned: (potId: string, id: RoomItemId) => boolean;
  isPlaced: (potId: string, id: RoomItemId) => boolean;

  /** 구매 가능 여부 판정 — UI 표시와 실제 구매가 같은 규칙을 쓴다 */
  canPurchase: (potId: string, id: RoomItemId, level: number) => PurchaseResult;
  /** 구매하면 배치까지 한 번에 — 별도 배치 화면을 두지 않는다 */
  purchase: (potId: string, id: RoomItemId, level: number) => PurchaseResult;

  place: (potId: string, id: RoomItemId) => void;
  remove: (potId: string, id: RoomItemId) => void;
  togglePlaced: (potId: string, id: RoomItemId) => void;
  /** 자리표시 방에서 꾸민 걸 실제 화분 방으로 옮긴다 */
  adoptRoom: (fromPotId: string, toPotId: string) => void;
  addPoints: (n: number) => void;
}

const add = (list: RoomItemId[] | undefined, id: RoomItemId) =>
  list?.includes(id) ? list : [...(list ?? []), id];

/** 예전 kebab-case id를 새 camelCase로 옮긴다 */
function migrateIds(byPot: ByPot | undefined): ByPot {
  const out: ByPot = {};
  for (const [pot, ids] of Object.entries(byPot ?? {})) {
    const next = (ids ?? [])
      .map((raw) => (isRoomItemId(raw) ? raw : LEGACY_ID_MAP[raw]))
      .filter((v): v is RoomItemId => Boolean(v));
    out[pot] = [...new Set(next)];
  }
  return out;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      owned: {},
      placed: {},
      points: STARTING_POINTS,

      isOwned: (potId, id) => get().owned[potId]?.includes(id) ?? false,
      isPlaced: (potId, id) => get().placed[potId]?.includes(id) ?? false,

      canPurchase: (potId, id, level) => {
        if (get().isOwned(potId, id)) return 'already-owned';
        const info = ROOM_ITEM_CATALOG[id];
        if (!info) return 'locked';
        if (level < info.requiredLevel) return 'locked';
        if (get().points < info.price) return 'not-enough-points';
        return 'ok';
      },

      purchase: (potId, id, level) => {
        const verdict = get().canPurchase(potId, id, level);
        if (verdict !== 'ok') return verdict;

        const info = ROOM_ITEM_CATALOG[id];
        set((s) => ({
          points: s.points - info.price,
          owned: { ...s.owned, [potId]: add(s.owned[potId], id) },
          placed: { ...s.placed, [potId]: add(s.placed[potId], id) },
        }));
        void import('./questStore').then((m) => m.trackQuest('decorate'));
        return 'ok';
      },

      place: (potId, id) => {
        set((s) => ({ placed: { ...s.placed, [potId]: add(s.placed[potId], id) } }));
        // 순환 import를 피하려고 동적으로 부른다
        void import('./questStore').then((m) => m.trackQuest('decorate'));
      },

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

      addPoints: (n) => set((s) => ({ points: Math.max(0, s.points + n) })),
    }),
    {
      name: 'growme.room',
      version: 2,
      // v1은 kebab-case id를 저장했다
      migrate: (state) => {
        const s = state as Partial<RoomState>;
        return {
          ...s,
          owned: migrateIds(s.owned),
          placed: migrateIds(s.placed),
          points: s.points ?? STARTING_POINTS,
        } as RoomState;
      },
    },
  ),
);
