// T-08 / §10 — mood → 표정·대사·솔루션.
// mood는 화분 펌웨어가 계산해 D 패킷으로 보낸다. 웹은 절대 재계산하지 않는다(§16).
// (Mock 시뮬레이터만 예외적으로 computeMood를 쓴다.)

import type { Mood, PlantProfile } from '@/ble/types';

export interface SolutionAction {
  label: string;
  /** 앱 내 이동이 필요한 경우 */
  to?: string;
  /** 체크리스트 항목처럼 안내만 하는 경우 */
  hint?: string;
  kind?: 'primary' | 'checklist';
}

export interface MoodInfo {
  mood: Mood;
  key: string;
  name: string;
  /** 픽셀 스프라이트가 준비되기 전까지 쓰는 표정 대체 표기 */
  face: string;
  /** 캐릭터 말풍선 */
  speech: string;
  /** 솔루션 카드 제목 — mood 0이면 null (카드 미표시) */
  title: string | null;
  /** 홈 하단 상태 카드에 쓰는 한 줄 요약. 솔루션 제목과 문구가 겹치지 않게 따로 둔다. */
  summary: string;
  actions: SolutionAction[];
  /** 캐릭터 주변 색 톤 */
  tone: 'good' | 'dry' | 'hot' | 'cold' | 'dark' | 'wet' | 'error';
}

export const MOOD_TABLE: Record<Mood, MoodInfo> = {
  0: {
    mood: 0,
    key: 'OK',
    summary: '우리 식물이 아주 건강하게 잘 자라고 있어요.',
    name: '기분 좋음',
    face: '(◕‿◕)',
    speech: '상태가 완벽해요! 기분이 좋네요',
    title: null,
    actions: [],
    tone: 'good',
  },
  1: {
    mood: 1,
    key: 'THIRSTY',
    summary: '흙이 말랐어요. 물을 주면 금방 기운을 차려요.',
    name: '목마름',
    face: '(´•ω•`)',
    speech: '목이 말라요…',
    title: '물을 주세요',
    actions: [{ label: '물 주기', to: '/water', kind: 'primary' }],
    tone: 'dry',
  },
  2: {
    mood: 2,
    key: 'HOT',
    summary: '온도가 너무 높아요. 시원하게 해주세요.',
    name: '더워함',
    face: '(>﹏<)',
    speech: '너무 더워요!',
    title: '온도를 낮춰주세요',
    actions: [
      { label: '창문 열기', kind: 'checklist' },
      { label: '직사광선 피하기', kind: 'checklist' },
      { label: '에어컨·서큘레이터 켜기', kind: 'checklist' },
    ],
    tone: 'hot',
  },
  3: {
    mood: 3,
    key: 'COLD',
    summary: '온도가 너무 낮아요. 따뜻한 자리가 필요해요.',
    name: '추워함',
    face: '(っ˘̩╭╮˘̩)っ',
    speech: '추워요…',
    title: '따뜻한 곳으로 옮겨주세요',
    actions: [
      { label: '창가에서 안쪽으로 옮기기', kind: 'checklist' },
      { label: '야간 저온 주의', hint: '밤에 창문을 닫아주세요', kind: 'checklist' },
    ],
    tone: 'cold',
  },
  4: {
    mood: 4,
    key: 'DARK',
    summary: '빛이 부족해요. 밝은 곳으로 옮겨주세요.',
    name: '졸림',
    face: '(￣o￣) zzZ',
    speech: '너무 어두워요',
    title: '빛이 부족해요',
    actions: [
      { label: 'LED 밝기 올리기', kind: 'primary' },
      { label: '창가로 옮기기', kind: 'checklist' },
    ],
    tone: 'dark',
  },
  5: {
    mood: 5,
    key: 'OVERWATER',
    summary: '흙이 너무 젖어 있어요. 마를 때까지 기다려요.',
    name: '배부름·힘듦',
    face: '(x_x)',
    speech: '물을 너무 많이 마셨어요…',
    title: '흙이 마를 때까지 기다려주세요',
    actions: [
      { label: '며칠간 물 주지 않기', kind: 'checklist' },
      { label: '통풍 시키기', hint: '창문을 열어 흙을 말려주세요', kind: 'checklist' },
    ],
    tone: 'wet',
  },
  6: {
    mood: 6,
    key: 'SENSOR_ERR',
    summary: '센서값을 읽지 못하고 있어요. 연결을 확인해주세요.',
    name: '상태 확인 불가',
    face: '(・_・?)',
    speech: '몸이 이상해요…',
    title: '센서 연결을 확인해주세요',
    actions: [
      { label: '토양 센서가 흙에 꽂혀 있는지 확인', kind: 'checklist' },
      { label: '화분 전원 케이블 확인', kind: 'checklist' },
      { label: '전원을 껐다 켜기', kind: 'checklist' },
    ],
    tone: 'error',
  },
};

export const moodInfo = (mood: Mood): MoodInfo => MOOD_TABLE[mood] ?? MOOD_TABLE[0];

export const MOOD_ORDER: readonly Mood[] = [0, 1, 2, 3, 4, 5, 6];

/** §10.1 우선순위: 6 > 2 > 3 > 1 > 5 > 4 > 0 */
export const MOOD_PRIORITY: readonly Mood[] = [6, 2, 3, 1, 5, 4, 0];

export const TONE_CLASS: Record<MoodInfo['tone'], { bg: string; text: string; ring: string }> = {
  good: { bg: 'bg-olive-100', text: 'text-olive-800', ring: 'ring-olive-300' },
  dry: { bg: 'bg-orange-100', text: 'text-orange-900', ring: 'ring-orange-300' },
  hot: { bg: 'bg-red-100', text: 'text-red-900', ring: 'ring-red-300' },
  cold: { bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-300' },
  dark: { bg: 'bg-indigo-100', text: 'text-indigo-900', ring: 'ring-indigo-300' },
  wet: { bg: 'bg-blue-100', text: 'text-blue-900', ring: 'ring-blue-300' },
  error: { bg: 'bg-neutral-200', text: 'text-neutral-800', ring: 'ring-neutral-400' },
};

/**
 * ⚠️ Mock 시뮬레이터 전용(§10.1). 실제 연결에서는 절대 호출하지 말 것.
 * 지속 조건(DARK 30분·OVERWATER 60분)은 시뮬레이터가 누적 시간을 넘겨준다.
 */
export function computeMoodForMock(
  s: { soilRaw: number | null; tempX10: number | null; humi: number | null; lightRaw: number | null },
  profile: PlantProfile,
  sustained: { darkMs: number; overWaterMs: number; missStreak: number },
): Mood {
  if (sustained.missStreak >= 3) return 6;
  if (s.tempX10 !== null && s.tempX10 > profile.tempMaxX10) return 2;
  if (s.tempX10 !== null && s.tempX10 < profile.tempMinX10) return 3;
  if (s.soilRaw !== null && s.soilRaw >= profile.soilDry) return 1;
  if (s.soilRaw !== null && s.soilRaw <= profile.soilWet && sustained.overWaterMs >= 60 * 60_000) {
    return 5;
  }
  if (s.lightRaw !== null && s.lightRaw < profile.lightMin && sustained.darkMs >= 30 * 60_000) {
    return 4;
  }
  return 0;
}
