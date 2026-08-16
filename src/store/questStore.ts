// 퀘스트 진행도와 보상 수령.
//
// 진행도는 앱이 이미 하는 일에서 track()으로 올라온다.
// 보상을 받으면 roomStore의 포인트가 늘고, 그 포인트로 상점에서 가구를 산다.
//
// 시연 기준은 건드리지 않는다 — 퀘스트를 하나도 안 깨도 시작 포인트로
// 상점에서 바로 구매할 수 있다(roomStore.STARTING_POINTS).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QUEST_CATALOG, findQuest, type QuestEvent } from '@/features/quest/quests';
import { useRoomStore } from './roomStore';

interface QuestState {
  /** 이벤트별 누적 횟수 */
  counts: Partial<Record<QuestEvent, number>>;
  /** 보상을 이미 받은 퀘스트 id */
  claimed: string[];

  track: (event: QuestEvent) => void;
  progressOf: (questId: string) => number;
  isComplete: (questId: string) => boolean;
  isClaimed: (questId: string) => boolean;
  /** 완료했고 아직 안 받은 퀘스트만 수령된다. 받은 포인트를 돌려준다. */
  claim: (questId: string) => number;
  claimableCount: () => number;
  reset: () => void;
}

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      counts: {},
      claimed: [],

      track: (event) =>
        set((s) => ({ counts: { ...s.counts, [event]: (s.counts[event] ?? 0) + 1 } })),

      progressOf: (questId) => {
        const q = findQuest(questId);
        if (!q) return 0;
        return Math.min(q.goal, get().counts[q.event] ?? 0);
      },

      isComplete: (questId) => {
        const q = findQuest(questId);
        return q ? get().progressOf(questId) >= q.goal : false;
      },

      isClaimed: (questId) => get().claimed.includes(questId),

      claim: (questId) => {
        const q = findQuest(questId);
        if (!q) return 0;
        if (!get().isComplete(questId) || get().isClaimed(questId)) return 0;

        set((s) => ({ claimed: [...s.claimed, questId] }));
        useRoomStore.getState().addPoints(q.reward);
        return q.reward;
      },

      claimableCount: () =>
        QUEST_CATALOG.filter((q) => get().isComplete(q.id) && !get().isClaimed(q.id)).length,

      reset: () => set({ counts: {}, claimed: [] }),
    }),
    { name: 'growme.quests' },
  ),
);

/** 스토어 밖(브리지·훅)에서 부르기 쉬운 단축 함수 */
export const trackQuest = (event: QuestEvent): void => useQuestStore.getState().track(event);
