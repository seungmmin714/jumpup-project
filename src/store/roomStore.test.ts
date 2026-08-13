// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { STARTING_POINTS, useRoomStore } from './roomStore';
import { ROOM_ITEM_CATALOG } from '@/features/room/roomCatalog';

const POT = 'growme01';
const reset = (points = STARTING_POINTS) =>
  useRoomStore.setState({ owned: {}, placed: {}, points });

beforeEach(() => reset());

describe('구매 검증', () => {
  it('레벨이 모자라면 잠금', () => {
    // 액자는 Lv.25 필요
    expect(useRoomStore.getState().canPurchase(POT, 'botanicalFrame', 10)).toBe('locked');
    expect(useRoomStore.getState().purchase(POT, 'botanicalFrame', 10)).toBe('locked');
    expect(useRoomStore.getState().owned[POT]).toBeUndefined();
    expect(useRoomStore.getState().points).toBe(STARTING_POINTS);
  });

  it('포인트가 모자라면 구매 불가', () => {
    reset(100); // 나무 선반 300P
    expect(useRoomStore.getState().canPurchase(POT, 'shelf', 99)).toBe('not-enough-points');
    expect(useRoomStore.getState().purchase(POT, 'shelf', 99)).toBe('not-enough-points');
    expect(useRoomStore.getState().owned[POT]).toBeUndefined();
    expect(useRoomStore.getState().points).toBe(100);
  });

  it('구매하면 포인트가 차감되고 보유·배치에 동시에 들어간다', () => {
    const price = ROOM_ITEM_CATALOG.shelf.price;
    expect(useRoomStore.getState().purchase(POT, 'shelf', 99)).toBe('ok');

    const s = useRoomStore.getState();
    expect(s.points).toBe(STARTING_POINTS - price);
    expect(s.owned[POT]).toEqual(['shelf']);
    expect(s.placed[POT]).toEqual(['shelf']); // 별도 배치 과정 없음
  });

  it('이미 산 아이템은 중복 구매되지 않고 포인트도 빠지지 않는다', () => {
    useRoomStore.getState().purchase(POT, 'shelf', 99);
    const after = useRoomStore.getState().points;

    expect(useRoomStore.getState().purchase(POT, 'shelf', 99)).toBe('already-owned');
    expect(useRoomStore.getState().points).toBe(after);
    expect(useRoomStore.getState().owned[POT]).toEqual(['shelf']);
  });

  it('방에서 빼도 보유와 포인트는 그대로다', () => {
    useRoomStore.getState().purchase(POT, 'shelf', 99);
    const after = useRoomStore.getState().points;

    useRoomStore.getState().remove(POT, 'shelf');
    expect(useRoomStore.getState().placed[POT]).toEqual([]);
    expect(useRoomStore.getState().owned[POT]).toEqual(['shelf']);
    expect(useRoomStore.getState().points).toBe(after);

    useRoomStore.getState().place(POT, 'shelf');
    expect(useRoomStore.getState().placed[POT]).toEqual(['shelf']);
  });

  it('화분마다 방이 따로다', () => {
    useRoomStore.getState().purchase(POT, 'shelf', 99);
    expect(useRoomStore.getState().placed['growme02']).toBeUndefined();
  });
});

describe('새로고침 후 유지 (persist)', () => {
  it('localStorage에 구매·배치·포인트가 남는다', () => {
    useRoomStore.getState().purchase(POT, 'shelf', 99);

    const raw = localStorage.getItem('growme.room');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!).state;
    expect(saved.owned[POT]).toEqual(['shelf']);
    expect(saved.placed[POT]).toEqual(['shelf']);
    expect(saved.points).toBe(STARTING_POINTS - ROOM_ITEM_CATALOG.shelf.price);
  });
});
