// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useQuestStore } from './questStore';
import { STARTING_POINTS, useRoomStore } from './roomStore';
import { QUEST_CATALOG, findQuest } from '@/features/quest/quests';

beforeEach(() => {
  useQuestStore.setState({ counts: {}, claimed: [] });
  useRoomStore.setState({ owned: {}, placed: {}, points: STARTING_POINTS });
});

describe('퀘스트 진행도', () => {
  it('앱이 하는 일이 그대로 진행도가 된다', () => {
    const q = useQuestStore.getState();
    expect(q.progressOf('first-water')).toBe(0);
    expect(q.isComplete('first-water')).toBe(false);

    q.track('water');
    expect(useQuestStore.getState().progressOf('first-water')).toBe(1);
    expect(useQuestStore.getState().isComplete('first-water')).toBe(true);
  });

  it('같은 이벤트를 여러 퀘스트가 공유한다', () => {
    const q = useQuestStore.getState();
    q.track('water');
    q.track('water');

    // 물 주기 1회 퀘스트는 완료, 3회 퀘스트는 진행 중
    expect(useQuestStore.getState().isComplete('first-water')).toBe(true);
    expect(useQuestStore.getState().progressOf('water-three')).toBe(2);
    expect(useQuestStore.getState().isComplete('water-three')).toBe(false);

    q.track('water');
    expect(useQuestStore.getState().isComplete('water-three')).toBe(true);
  });

  it('진행도는 목표를 넘지 않는다', () => {
    for (let i = 0; i < 10; i += 1) useQuestStore.getState().track('water');
    expect(useQuestStore.getState().progressOf('first-water')).toBe(1);
  });
});

describe('보상 수령', () => {
  it('완료해야 받을 수 있고, 받으면 포인트가 늘어난다', () => {
    const reward = findQuest('first-water')!.reward;
    const q = useQuestStore.getState();

    expect(q.claim('first-water')).toBe(0); // 아직 미완료
    expect(useRoomStore.getState().points).toBe(STARTING_POINTS);

    q.track('water');
    expect(useQuestStore.getState().claim('first-water')).toBe(reward);
    expect(useRoomStore.getState().points).toBe(STARTING_POINTS + reward);
  });

  it('두 번 받을 수 없다', () => {
    useQuestStore.getState().track('water');
    const first = useQuestStore.getState().claim('first-water');
    const after = useRoomStore.getState().points;

    expect(useQuestStore.getState().claim('first-water')).toBe(0);
    expect(useRoomStore.getState().points).toBe(after);
    expect(first).toBeGreaterThan(0);
  });

  it('받을 보상 개수를 센다', () => {
    expect(useQuestStore.getState().claimableCount()).toBe(0);

    useQuestStore.getState().track('connect');
    expect(useQuestStore.getState().claimableCount()).toBe(1);

    useQuestStore.getState().claim('first-connect');
    expect(useQuestStore.getState().claimableCount()).toBe(0);
  });

  it('퀘스트 보상만으로도 가장 비싼 가구를 살 수 있다', () => {
    // 시연용 시작 포인트가 없다고 가정해도 보상이 의미 있는 규모인지 확인
    useRoomStore.setState({ points: 0 });
    for (const quest of QUEST_CATALOG) {
      useQuestStore.getState().track(quest.event);
      useQuestStore.getState().track(quest.event);
      useQuestStore.getState().track(quest.event);
      useQuestStore.getState().claim(quest.id);
    }
    // 액자 700P가 가장 비싸다
    expect(useRoomStore.getState().points).toBeGreaterThanOrEqual(700);
  });
});

describe('시연 기준은 유지된다', () => {
  it('퀘스트를 하나도 안 깨도 시작 포인트로 바로 구매할 수 있다', () => {
    expect(useRoomStore.getState().points).toBe(STARTING_POINTS);
    // 레벨 조건은 상점에서 UNLOCK_ALL_FOR_DEMO로 열려 있다
    expect(useRoomStore.getState().canPurchase('growme01', 'botanicalFrame', 99)).toBe('ok');
  });
});
