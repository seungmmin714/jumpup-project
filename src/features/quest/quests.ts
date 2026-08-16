// 퀘스트 정의.
//
// 목표는 전부 **앱이 이미 하는 일**에서 나온다. 새로운 행동을 요구하지 않는다.
// 화분을 연결하고, 물을 주고, 식물을 고르는 것이 그대로 진행도가 된다.
// 보상은 포인트이고, 그 포인트로 상점에서 방 아이템을 산다.

export type QuestEvent =
  | 'connect' // 화분에 연결했다
  | 'water' // 급수를 완료했다 (가이드·센서 감지 둘 다)
  | 'plant' // 도감에서 식물을 골라 화분에 설정했다
  | 'recover' // 나쁜 기분에서 mood 0으로 회복했다
  | 'decorate'; // 방에 가구를 놓았다

export interface Quest {
  id: string;
  title: string;
  description: string;
  event: QuestEvent;
  /** 몇 번 해야 완료인가 */
  goal: number;
  /** 완료 후 받는 포인트 */
  reward: number;
}

export const QUEST_CATALOG: readonly Quest[] = [
  {
    id: 'first-connect',
    title: '첫 만남',
    description: '화분을 앱에 연결해 보세요.',
    event: 'connect',
    goal: 1,
    reward: 200,
  },
  {
    id: 'pick-plant',
    title: '무엇을 심을까',
    description: '도감에서 키울 식물을 골라주세요.',
    event: 'plant',
    goal: 1,
    reward: 200,
  },
  {
    id: 'first-water',
    title: '첫 물 주기',
    description: '흙이 마르면 물을 주세요. 센서가 알아서 알아챕니다.',
    event: 'water',
    goal: 1,
    reward: 300,
  },
  {
    id: 'water-three',
    title: '꾸준한 돌봄',
    description: '물을 세 번 주세요.',
    event: 'water',
    goal: 3,
    reward: 500,
  },
  {
    id: 'first-recover',
    title: '다시 건강하게',
    description: '기분이 나빠진 그로미를 정상으로 되돌려 주세요.',
    event: 'recover',
    goal: 1,
    reward: 400,
  },
  {
    id: 'first-decorate',
    title: '방 꾸미기',
    description: '상점에서 산 가구를 방에 놓아보세요.',
    event: 'decorate',
    goal: 1,
    reward: 300,
  },
] as const;

export const findQuest = (id: string): Quest | undefined =>
  QUEST_CATALOG.find((q) => q.id === id);
