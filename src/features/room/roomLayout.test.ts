import { describe, expect, it } from 'vitest';
import {
  ROOM_LAYOUT,
  ROOM_STAGE,
  formatLayout,
  toRoomStyle,
  toStageX,
  toStageY,
  type RoomLayoutItem,
} from './roomLayout';
import { ROOM_ITEM_CATALOG, ROOM_ITEM_IDS } from './roomCatalog';

const box = (o: Partial<RoomLayoutItem>): RoomLayoutItem => ({
  x: 0,
  y: 0,
  width: 100,
  zIndex: 10,
  ...o,
});

describe('1024×768 좌표 → CSS 퍼센트 변환', () => {
  it('x·y·width를 스테이지 크기 대비 %로 바꾼다', () => {
    const s = toRoomStyle(box({ x: 512, y: 384, width: 256 }));
    expect(s.left).toBe('50%'); // 512 / 1024
    expect(s.top).toBe('50%'); // 384 / 768
    expect(s.width).toBe('25%'); // 256 / 1024
    expect(s.zIndex).toBe(10);
  });

  it('경계값', () => {
    expect(toRoomStyle(box({ x: 0, y: 0 })).left).toBe('0%');
    expect(toRoomStyle(box({ x: ROOM_STAGE.width, y: ROOM_STAGE.height })).left).toBe('100%');
    expect(toRoomStyle(box({ x: 0, y: ROOM_STAGE.height })).top).toBe('100%');
  });

  it('화면 크기와 무관하게 같은 값이 나온다 — 브레이크포인트 보정이 없다', () => {
    const a = toRoomStyle(box({ x: 300, y: 500, width: 200 }));
    const b = toRoomStyle(box({ x: 300, y: 500, width: 200 }));
    expect(a).toEqual(b);
  });
});

describe('anchor 적용', () => {
  it('기본값은 왼쪽 위 기준이라 transform이 없다', () => {
    expect(toRoomStyle(box({ x: 100, y: 100 })).transform).toBeUndefined();
  });

  it('anchorX 0.5는 가로 중앙 정렬', () => {
    expect(toRoomStyle(box({ anchorX: 0.5 })).transform).toBe('translate(-50%, 0%)');
  });

  it('anchorY 1은 바닥 정렬 — 러그·캐릭터가 y를 발밑으로 쓴다', () => {
    expect(toRoomStyle(box({ anchorY: 1 })).transform).toBe('translate(0%, -100%)');
  });

  it('중앙 하단(0.5, 1)', () => {
    expect(toRoomStyle(box({ anchorX: 0.5, anchorY: 1 })).transform).toBe('translate(-50%, -100%)');
  });

  it('러그와 캐릭터는 같은 가로 기준점을 쓴다', () => {
    expect(ROOM_LAYOUT.roundRug.anchorX).toBe(0.5);
    expect(ROOM_LAYOUT.character.anchorX).toBe(0.5);
    expect(ROOM_LAYOUT.roundRug.x).toBe(ROOM_LAYOUT.character.x);
  });

  it('캐릭터는 러그보다 앞에 그려진다', () => {
    expect(ROOM_LAYOUT.character.zIndex).toBeGreaterThan(ROOM_LAYOUT.roundRug.zIndex);
  });
});

describe('화면 좌표 → 스테이지 좌표 역변환 (편집기 드래그)', () => {
  it('비율을 1024×768 좌표로 되돌린다', () => {
    expect(toStageX(0)).toBe(0);
    expect(toStageX(0.5)).toBe(512);
    expect(toStageX(1)).toBe(1024);
    expect(toStageY(0.5)).toBe(384);
    expect(toStageY(1)).toBe(768);
  });
});

describe('편집기 JSON 복사 형식', () => {
  const json = formatLayout(ROOM_LAYOUT);

  it('TypeScript 상수에 그대로 붙여 넣을 수 있는 형태다', () => {
    expect(json.startsWith('export const ROOM_LAYOUT: Record<RoomLayoutKey, RoomLayoutItem> = {')).toBe(
      true,
    );
    expect(json.trimEnd().endsWith('};')).toBe(true);
  });

  it('모든 항목과 필드를 담는다', () => {
    for (const key of [...ROOM_ITEM_IDS, 'character']) {
      expect(json).toContain(`${key}: {`);
    }
    expect(json).toContain('x: ');
    expect(json).toContain('y: ');
    expect(json).toContain('width: ');
    expect(json).toContain('zIndex: ');
  });

  it('anchor는 값이 있을 때만 넣는다', () => {
    const line = json.split('\n').find((l) => l.includes('roundRug:'))!;
    expect(line).toContain('anchorX: 0.5');
    expect(line).toContain('anchorY: 1');

    const wall = json.split('\n').find((l) => l.includes('window:'))!;
    expect(wall).not.toContain('anchorX');
  });

  it('좌표는 정수로 반올림된다', () => {
    const out = formatLayout({ test: box({ x: 10.6, y: 20.4, width: 30.5 }) });
    expect(out).toContain('x: 11');
    expect(out).toContain('y: 20');
  });
});

describe('카탈로그와 레이아웃이 짝을 이룬다', () => {
  it('모든 상품에 위치가 있다', () => {
    for (const id of ROOM_ITEM_IDS) {
      expect(ROOM_LAYOUT[id], `${id} 위치 누락`).toBeDefined();
    }
  });

  it('모든 상품에 이미지·가격·해금 레벨이 있다', () => {
    for (const id of ROOM_ITEM_IDS) {
      const info = ROOM_ITEM_CATALOG[id];
      expect(info.src.startsWith('/room/')).toBe(true);
      expect(info.price).toBeGreaterThan(0);
      expect(info.requiredLevel).toBeGreaterThan(0);
    }
  });

  it('사용자별 좌표를 저장하지 않는다 — 위치는 카탈로그가 아니라 레이아웃에만 있다', () => {
    for (const id of ROOM_ITEM_IDS) {
      expect(ROOM_ITEM_CATALOG[id]).not.toHaveProperty('x');
      expect(ROOM_ITEM_CATALOG[id]).not.toHaveProperty('y');
    }
  });
});
