import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PLANT_ID, PLANTS, findPlant } from '@/data/plants';
import type { Plant, PlantProfile } from '@/ble/types';

export interface PotEntry {
  potId: string;
  nickname: string;
  plantId: string;
  addedAt: string;
}

interface PotState {
  pots: PotEntry[];
  selectedPotId: string | null;
  /** 연결 직후 Q로 읽어온 화분의 실제 프로파일 (§7) */
  devicePot: PlantProfile | null;
  /** 앱 선택값과 화분 값이 다른 상태 */
  profileMismatch: boolean;
  lastWateredAt: string | null;

  addPot: (potId: string, nickname?: string) => void;
  selectPot: (potId: string) => void;
  setPlant: (plantId: string) => void;
  removePot: (potId: string) => void;
  setDeviceProfile: (p: PlantProfile | null) => void;
  setLastWateredAt: (iso: string | null) => void;
}

/**
 * 화분을 아직 연결하지 않았을 때 쓰는 자리표시 id.
 * 방 꾸미기처럼 화분 없이도 둘러볼 수 있어야 하는 기능이 이 키를 쓴다.
 * 실제 화분에 연결되면 그쪽으로 옮겨 붙인다(roomStore.adoptRoom).
 */
export const DEFAULT_POT_ID = 'my-room';

export const profileOf = (p: Plant): PlantProfile => ({
  soilDry: p.soilDry,
  soilWet: p.soilWet,
  tempMinX10: p.tempMinX10,
  tempMaxX10: p.tempMaxX10,
  lightMin: p.lightMin,
});

export const sameProfile = (a: PlantProfile | null, b: PlantProfile | null): boolean =>
  a !== null &&
  b !== null &&
  a.soilDry === b.soilDry &&
  a.soilWet === b.soilWet &&
  a.tempMinX10 === b.tempMinX10 &&
  a.tempMaxX10 === b.tempMaxX10 &&
  a.lightMin === b.lightMin;

export const usePotStore = create<PotState>()(
  persist(
    (set, get) => ({
      pots: [],
      selectedPotId: null,
      devicePot: null,
      profileMismatch: false,
      lastWateredAt: null,

      addPot: (potId, nickname) => {
        const id = potId.trim().toLowerCase();
        if (!id) return;
        const exists = get().pots.some((p) => p.potId === id);
        if (!exists) {
          set({
            pots: [
              ...get().pots,
              {
                potId: id,
                nickname: nickname ?? id.toUpperCase(),
                plantId: DEFAULT_PLANT_ID,
                addedAt: new Date().toISOString(),
              },
            ],
          });
        }
        set({ selectedPotId: id });
      },

      selectPot: (potId) => set({ selectedPotId: potId, devicePot: null, profileMismatch: false }),

      setPlant: (plantId) => {
        const { pots, selectedPotId, devicePot } = get();
        if (!selectedPotId) return;
        const next = pots.map((p) => (p.potId === selectedPotId ? { ...p, plantId } : p));
        set({
          pots: next,
          profileMismatch: devicePot ? !sameProfile(devicePot, profileOf(findPlant(plantId))) : false,
        });
      },

      removePot: (potId) => {
        const pots = get().pots.filter((p) => p.potId !== potId);
        const selected = get().selectedPotId === potId ? (pots[0]?.potId ?? null) : get().selectedPotId;
        set({ pots, selectedPotId: selected });
      },

      setDeviceProfile: (p) => {
        const plant = findPlant(
          get().pots.find((x) => x.potId === get().selectedPotId)?.plantId ?? DEFAULT_PLANT_ID,
        );
        set({ devicePot: p, profileMismatch: p ? !sameProfile(p, profileOf(plant)) : false });
      },

      setLastWateredAt: (iso) => set({ lastWateredAt: iso }),
    }),
    {
      name: 'growme.pots',
      // 센서 히스토리는 저장하지 않는다(§16). 화분 목록·선택만 남긴다.
      partialize: (s) => ({
        pots: s.pots,
        selectedPotId: s.selectedPotId,
        lastWateredAt: s.lastWateredAt,
      }),
    },
  ),
);

// ───────── 셀렉터 ─────────

/** 선택된 화분이 없으면 자리표시 id를 돌려준다 — 화면이 막히지 않게 */
export const activePotId = (s: PotState): string => s.selectedPotId ?? DEFAULT_POT_ID;

export const selectedPot = (s: PotState): PotEntry | null =>
  s.pots.find((p) => p.potId === s.selectedPotId) ?? null;

export const selectedPlant = (s: PotState): Plant =>
  findPlant(selectedPot(s)?.plantId ?? DEFAULT_PLANT_ID);

export { PLANTS, findPlant };
