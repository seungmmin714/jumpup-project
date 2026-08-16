// T-17 — §10.3 게이미피케이션.
// 행복도는 서버가 계산한다(§10.3). 클라이언트는 표시 + 회복 연출만 담당한다.

import { create } from 'zustand';
import { fetchCharacter, type CharacterState } from '@/api/pots';
import type { Mood } from '@/ble/types';

/** mood !== 0이 6시간 이상 지속되면 시무룩 고정 */
const GLOOMY_AFTER_MS = 6 * 60 * 60_000;
export const EXP_ON_WATER = 30;
export const EXP_RECOVERY_BONUS = 20;

interface CharacterStoreState extends CharacterState {
  loaded: boolean;
  /** mood 0 복귀 연출 트리거 (§10.3 핵심 보상) */
  celebrating: boolean;
  celebrationText: string;
  bonusExp: number;
  prevMood: Mood | null;
  badMoodSince: number | null;
  gloomy: boolean;

  load: (potId: string) => Promise<void>;
  observeMood: (m: Mood) => void;
  celebrate: (text: string, exp: number) => void;
  endCelebration: () => void;
  addExp: (n: number) => void;
}

const FALLBACK: CharacterState = {
  level: 1,
  exp: 0,
  expToNext: 100,
  happiness: 0,
  stage: '새싹 단계',
  stageProgress: 0,
};

export const useCharacterStore = create<CharacterStoreState>((set, get) => ({
  ...FALLBACK,
  loaded: false,
  celebrating: false,
  celebrationText: '',
  bonusExp: 0,
  prevMood: null,
  badMoodSince: null,
  gloomy: false,

  load: async (potId) => {
    try {
      const c = await fetchCharacter(potId);
      set({ ...c, loaded: true });
    } catch {
      // 서버가 없어도 화면은 그려져야 한다
      set({ loaded: true });
    }
  },

  observeMood: (m) => {
    const { prevMood, badMoodSince } = get();
    if (prevMood === m) {
      // 지속 시간만 갱신
      if (m !== 0 && badMoodSince !== null && Date.now() - badMoodSince >= GLOOMY_AFTER_MS) {
        if (!get().gloomy) set({ gloomy: true });
      }
      return;
    }

    if (m === 0) {
      if (prevMood !== null && prevMood !== 0) {
        // 나쁜 기분 → 정상 복귀: 회복 연출 + 보너스 EXP
        get().celebrate('회복!', EXP_RECOVERY_BONUS);
        void import('./questStore').then((m) => m.trackQuest('recover'));
      }
      set({ prevMood: 0, badMoodSince: null, gloomy: false });
      return;
    }

    set({
      prevMood: m,
      badMoodSince: prevMood === null || prevMood === 0 ? Date.now() : badMoodSince,
    });
  },

  celebrate: (text, exp) => {
    set({ celebrating: true, celebrationText: text, bonusExp: exp });
    get().addExp(exp);
    setTimeout(() => get().endCelebration(), 2600);
  },

  endCelebration: () => set({ celebrating: false, bonusExp: 0 }),

  addExp: (n) => {
    let { exp, expToNext, level } = get();
    exp += n;
    while (exp >= expToNext) {
      exp -= expToNext;
      level += 1;
      expToNext = Math.round(expToNext * 1.35);
    }
    set({ exp, expToNext, level });
  },
}));

export const STAGE_BY_LEVEL = (level: number): string => {
  if (level < 5) return '씨앗 단계';
  if (level < 15) return '새싹 단계';
  if (level < 30) return '떡잎 단계';
  if (level < 50) return '성장 단계';
  return '개화 단계';
};
