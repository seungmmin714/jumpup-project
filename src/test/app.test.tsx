// @vitest-environment jsdom
// 실제 렌더링 스모크 테스트 — Mock BLE로 홈·급수 가이드 흐름을 검증한다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { getMockClient } from '@/ble';
import { attachBleBridge } from '@/store/bleBridge';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useConnectionStore } from '@/store/connectionStore';
import { usePotStore } from '@/store/potStore';
import { useCharacterStore } from '@/store/characterStore';
import { useRoomStore } from '@/store/roomStore';
import { SHOP_ORDER } from '@/features/room/roomCatalog';
import { ROOM_LAYOUT } from '@/features/room/roomLayout';

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

/** 가짜 타이머를 ms만큼 진행시키며 React 업데이트를 flush한다. */
async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Mock 클라이언트를 연결하고 첫 D 패킷까지 진행시킨다.
 * connect()는 내부에서 sleep을 쓰므로 먼저 await하면 타이머가 멈춘 채 교착된다 —
 * 프라미스를 붙잡아 두고 타이머를 진행시킨 뒤에 await한다.
 */
async function connectAndTick(ms = 6000) {
  const mock = getMockClient()!;
  const connecting = mock.connect();
  await flush(ms);
  await connecting;
  return mock;
}

let detachBridge: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  getMockClient()!.resetSimulation();
  // App도 브리지를 붙이지만, 렌더보다 먼저 연결하는 테스트가 있어 여기서 먼저 붙인다.
  detachBridge = attachBleBridge();
  usePotStore.setState({
    pots: [{ potId: 'growme01', nickname: 'GROWME01', plantId: 'tomato-cherry', addedAt: '' }],
    selectedPotId: 'growme01',
    lastWateredAt: null,
    devicePot: null,
    profileMismatch: false,
  });
  useTelemetryStore.getState().reset();
  useConnectionStore.getState().resetConnection();
  useCharacterStore.setState({ prevMood: null, celebrating: false, gloomy: false, level: 1 });
});

afterEach(async () => {
  cleanup();
  const mock = getMockClient();
  if (mock) await mock.disconnect();
  detachBridge();
  vi.useRealTimers();
});

describe('앱 스모크 (Mock BLE)', () => {
  it('미연결 홈: 연결 버튼과 안내가 보이고 제어가 잠겨 있다', () => {
    renderApp();
    expect(screen.getByRole('button', { name: /화분 연결하기/ })).toBeTruthy();
    expect(screen.getByLabelText('LED 밝기')).toHaveProperty('disabled', true);
  });

  it('연결하면 센서값과 캐릭터가 실시간으로 그려진다', async () => {
    await connectAndTick();

    expect(useConnectionStore.getState().state).toBe('CONNECTED');
    // H 패킷으로 protoVer 3을 받았다
    expect(useConnectionStore.getState().protoVer).toBe(3);

    renderApp();
    const t = useTelemetryStore.getState().latest;
    expect(t).not.toBeNull();
    expect(t!.soilRaw).toBeGreaterThan(0);
    expect(t!.temperature).not.toBeNull();
    expect(screen.getByText(/연결됨/)).toBeTruthy();
  });

  it('mood 7종을 강제 주입하면 말풍선과 솔루션 카드가 모두 바뀐다', async () => {
    const mock = await connectAndTick();
    renderApp();

    const expected: Array<[number, string, string | null]> = [
      [0, '상태가 완벽해요! 기분이 좋네요', null],
      [1, '목이 말라요…', '물을 주세요'],
      [2, '너무 더워요!', '온도를 낮춰주세요'],
      [3, '추워요…', '따뜻한 곳으로 옮겨주세요'],
      [4, '너무 어두워요', '빛이 부족해요'],
      [5, '물을 너무 많이 마셨어요…', '흙이 마를 때까지 기다려주세요'],
      [6, '몸이 이상해요…', '센서 연결을 확인해주세요'],
    ];

    for (const [mood, speech, title] of expected) {
      act(() => mock.forceMood(mood as 0));
      await flush(6000);
      expect(useTelemetryStore.getState().latest?.mood).toBe(mood);
      expect(screen.getByText(speech)).toBeTruthy();
      if (title) expect(screen.getByText(title)).toBeTruthy();
      // HOT일 때만 환기팬 수동 오버라이드(F 명령)가 노출된다
      expect(screen.queryByRole('switch', { name: '환기팬 강제 가동' }) !== null).toBe(mood === 2);
    }
  });

  it('센서 결측은 --로 표시되고 3회 연속이면 경고가 붙는다', async () => {
    const mock = await connectAndTick();
    renderApp();

    act(() => mock.setMissing({ temp: true }));
    await flush(6000);
    expect(useTelemetryStore.getState().latest?.temperature).toBeNull();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(useTelemetryStore.getState().missingStreak.temp).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByLabelText('센서 확인 필요').length).toBeGreaterThan(0);
  });

  it('protoVer가 3이 아니면 업데이트 배너가 뜨고 제어가 잠긴다', async () => {
    const mock = await connectAndTick();
    renderApp();

    act(() => mock.setProtoVer(2));
    await flush(2000);

    expect(screen.getByText(/펌웨어 업데이트가 필요해요/)).toBeTruthy();
    expect(screen.getByLabelText('LED 밝기')).toHaveProperty('disabled', true);
  });

  it('손상 패킷이 5분 내 20건을 넘으면 통신 불안정을 알린다', async () => {
    const mock = await connectAndTick();
    renderApp();

    act(() => mock.injectCorrupt(25));
    await flush(100);

    expect(useConnectionStore.getState().unstable).toBe(true);
    expect(screen.getByText('통신이 불안정해요')).toBeTruthy();
  });
});

describe('급수 가이드 (T-10)', () => {
  it('미연결 진입은 정적 안내 모드다', () => {
    renderApp('/water');
    expect(screen.getByText(/화분에 연결되어 있지 않아요/)).toBeTruthy();
    expect(screen.getByText(/약 250ml/)).toBeTruthy();
  });

  it('연결 후 진입하면 R:1을 보내고 1초 주기로 전환된다', async () => {
    const mock = await connectAndTick();
    renderApp('/water');

    await flush(1000);
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }));

    await flush(2000);
    expect(mock.snapshot().fastSampling).toBe(true);
    expect(screen.getByText(/1초마다 측정하고 있어요/)).toBeTruthy();
  });

  it('목표 구간에 들어오면 "그만! 딱 좋아요"와 햅틱이 발생한다', async () => {
    const mock = await connectAndTick();
    const vibrate = vi.spyOn(navigator, 'vibrate');
    renderApp('/water');

    act(() => mock.setSoilRaw(760)); // 건조 상태에서 시작
    await flush(6000);
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }));

    await flush(6000);
    expect(screen.getByText(/천천히 부어주세요/)).toBeTruthy();

    // 목표 구간(708 > raw > 578)으로 이동
    act(() => mock.setSoilRaw(640));
    await flush(6000);

    expect(screen.getByText(/그만! 딱 좋아요/)).toBeTruthy();
    expect(vibrate).toHaveBeenCalled();
  });

  it('과습이면 경고가 뜬다', async () => {
    const mock = await connectAndTick();
    renderApp('/water');
    await flush(1000);
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }));

    act(() => mock.setSoilRaw(500)); // soilWet(578) 이하
    await flush(6000);
    expect(screen.getByText(/너무 많아요!/)).toBeTruthy();
  });

  it('화면을 벗어나면 R:0을 보낸다', async () => {
    const mock = await connectAndTick();
    const view = renderApp('/water');
    await flush(1000);
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }));
    await flush(2000);
    expect(mock.snapshot().fastSampling).toBe(true);

    view.unmount();
    await flush(2000);
    expect(mock.snapshot().fastSampling).toBe(false);
  });

  it('3분이 지나면 측정이 종료된다', async () => {
    const mock = await connectAndTick();
    renderApp('/water');
    act(() => mock.setSoilRaw(800));
    await flush(1000);
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000 + 2000);
    });
    expect(screen.getByText(/측정 시간이 끝났어요/)).toBeTruthy();
    expect(mock.snapshot().fastSampling).toBe(false);
  });
});

describe('도감 (T-11)', () => {
  it('식물을 고르면 S 명령이 화분에 반영된다', async () => {
    const mock = await connectAndTick();
    renderApp('/catalog');

    const item = screen.getByText('다육식물').closest('button')!;
    fireEvent.click(item);
    await flush(1000);

    // §11.4 다육식물 행이 그대로 전송돼야 한다
    expect(mock.snapshot().profile).toEqual({
      soilDry: 903,
      soilWet: 773,
      tempMinX10: 50,
      tempMaxX10: 350,
      lightMin: 400,
    });
    expect(usePotStore.getState().pots[0]!.plantId).toBe('succulent');
  });

  it('연결 직후 Q로 화분 프로파일을 읽어 앱 선택값과 맞춘다', async () => {
    const mock = getMockClient()!;
    // 화분에는 상추 설정이 저장돼 있다고 가정
    const seeding = mock.send('S:675,545,100,250,350');
    await flush(1000);
    await seeding;

    await connectAndTick(2000);
    await flush(6000);

    // 앱은 방울토마토를 선택 중 → S로 덮어써야 한다
    expect(mock.snapshot().profile.soilDry).toBe(708);
    expect(useConnectionStore.getState().deviceProfile?.soilDry).toBe(708);
  });
});

describe('회복 연출 (T-17)', () => {
  it('mood가 0으로 복귀하면 연출과 보너스 EXP가 발생한다', async () => {
    const mock = await connectAndTick();
    renderApp();

    act(() => mock.forceMood(1));
    await flush(6000);
    const expBefore = useCharacterStore.getState().exp;

    act(() => mock.forceMood(0));
    await flush(6000);

    expect(useCharacterStore.getState().exp).toBeGreaterThan(expBefore);
    expect(screen.getByText('회복!')).toBeTruthy();
  });
});

describe('QR 딥링크 (T-14)', () => {
  it('/p/growme02로 들어오면 해당 화분이 선택되고 홈으로 간다', async () => {
    renderApp('/p/growme02');
    await flush(100);
    expect(usePotStore.getState().selectedPotId).toBe('growme02');
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeTruthy();
  });

  it('알 수 없는 화분 주소는 안내를 보여준다', () => {
    renderApp('/p/unknown');
    expect(screen.getByText('알 수 없는 화분이에요')).toBeTruthy();
  });
});

describe('탭 이동', () => {
  it('하단 탭 4개로 화면이 전환된다', async () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });

    fireEvent.click(within(nav).getByText('도감'));
    await flush(50);
    expect(screen.getByText('식물 도감')).toBeTruthy();

    fireEvent.click(within(nav).getByText('일지'));
    await flush(50);
    expect(screen.getByText('돌봄 일지')).toBeTruthy();

    fireEvent.click(within(nav).getByText('상점'));
    await flush(50);
    expect(screen.getByText('방을 꾸며보세요')).toBeTruthy();
  });
});

describe('캐릭터·디자인', () => {
  it('선택한 식물의 캐릭터 아트를 그린다', async () => {
    await connectAndTick();
    renderApp();

    const img = screen.getByAltText(/방울토마토 캐릭터/) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/characters/tomato-cherry.png');
  });

  it('아트 파일이 없으면 텍스트 표정으로 대체된다', async () => {
    await connectAndTick();
    renderApp();

    const img = screen.getByAltText(/방울토마토 캐릭터/);
    act(() => {
      fireEvent.error(img);
    });

    expect(screen.queryByAltText(/방울토마토 캐릭터/)).toBeNull();
    expect(screen.getByLabelText(/방울토마토 캐릭터/)).toBeTruthy();
  });

  it('식물을 바꾸면 캐릭터도 바뀐다', async () => {
    const mock = await connectAndTick();
    renderApp('/catalog');

    fireEvent.click(screen.getByText('다육식물').closest('button')!);
    await flush(1000);

    expect(mock.snapshot().profile.soilDry).toBe(903);
    expect(
      (screen.getAllByAltText(/다육식물 캐릭터/)[0] as HTMLImageElement).getAttribute('src'),
    ).toBe('/characters/succulent.png');
  });

  it('센서 상태를 숫자가 아니라 문구로 먼저 보여준다', async () => {
    const mock = await connectAndTick();
    renderApp();

    act(() => {
      mock.setTempX10(340); // 방울토마토 상한 30℃ 초과
      mock.setSoilRaw(760); // soilDry 708 이상 → 건조
    });
    await flush(6000);

    expect(screen.getByText('더워요')).toBeTruthy();
    // 게이지 축 라벨에도 '건조'가 있으므로 개수로 확인한다
    expect(screen.getAllByText('건조').length).toBeGreaterThan(0);
    expect(screen.getByText('물이 필요해요')).toBeTruthy();
  });

  it('하단 탭은 홈·일지·도감·상점 네 개다', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    for (const label of ['홈', '일지', '도감', '상점']) {
      expect(within(nav).getByText(label)).toBeTruthy();
    }
  });
});

describe('토양 게이지 — 식물별 목표 구간 (T-09)', () => {
  /** 트랙의 세 구간 너비를 % 로 읽는다 */
  function segmentWidths() {
    const track = screen.getByRole('img', { name: /토양 수분/ });
    return Array.from(track.querySelectorAll('span[style*="width"]')).map(
      (el) => (el as HTMLElement).style.width,
    );
  }

  it('방울토마토는 45~65% 구간으로 그려진다', async () => {
    await connectAndTick();
    renderApp();

    expect(screen.getByRole('img', { name: /목표 45~65%/ })).toBeTruthy();
    expect(segmentWidths()).toEqual(['45%', '20%', '35%']);
  });

  it('식물을 바꾸면 목표 구간이 즉시 따라 움직인다', async () => {
    await connectAndTick();
    const view = renderApp('/catalog');

    // 다육식물: soilDry 903 → 15%, soilWet 773 → 35%
    fireEvent.click(screen.getByText('다육식물').closest('button')!);
    await flush(1000);
    view.unmount();

    renderApp();
    expect(screen.getByRole('img', { name: /목표 15~35%/ })).toBeTruthy();
    expect(segmentWidths()).toEqual(['15%', '20%', '65%']);

    // 경계 숫자도 그림이 아니라 HTML이므로 같이 바뀐다
    expect(screen.getByText('15%')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
  });

  it('같은 화면 안에서 화분 프로파일이 바뀌어도 리렌더로 반영된다', async () => {
    await connectAndTick();
    renderApp();
    expect(segmentWidths()).toEqual(['45%', '20%', '35%']);

    // 스토어를 직접 바꿔 상추(675/545 → 50~70%)로 전환
    act(() => usePotStore.getState().setPlant('lettuce'));
    await flush(100);

    expect(segmentWidths()).toEqual(['50%', '20%', '30%']);
    expect(screen.getByRole('img', { name: /목표 50~70%/ })).toBeTruthy();
  });
});

describe('방 꾸미기 (상점 → 홈)', () => {
  beforeEach(() => {
    useRoomStore.setState({ owned: {}, placed: {}, points: 3000 });
    useCharacterStore.setState({ level: 30 }); // 전 아이템 해금
  });

  const roomItems = () =>
    Array.from(document.querySelectorAll('img[src^="/room/"]')).map((el) =>
      (el as HTMLImageElement).getAttribute('src'),
    );

  it('구매 전에는 방에 가구가 없다 (배경만)', async () => {
    await connectAndTick();
    renderApp();
    expect(roomItems()).toEqual(['/room/base.png']);
  });

  it('구매하면 배치 과정 없이 즉시 방에 나타난다', async () => {
    await connectAndTick();
    const view = renderApp('/shop');

    const card = screen.getByText('동그란 러그').closest('div')!;
    fireEvent.click(within(card).getByRole('button', { name: '구매하기' }));
    await flush(100);
    expect(useRoomStore.getState().placed['growme01']).toContain('roundRug');

    view.unmount();
    renderApp();
    expect(roomItems()).toContain('/room/round-rug.png');
  });

  it('겹침 순서대로 그린다 — 벽 → 선반 → 러그 → 물뿌리개', async () => {
    act(() => {
      useRoomStore.setState({
        owned: { growme01: ['wateringCan', 'roundRug', 'shelf', 'window'] },
        placed: { growme01: ['wateringCan', 'roundRug', 'shelf', 'window'] },
      });
    });
    await connectAndTick();
    renderApp();

    // 구매 순서와 무관하게 레이어 순서로 정렬돼야 한다
    expect(roomItems()).toEqual([
      '/room/base.png',
      '/room/window.png',
      '/room/shelf.png',
      '/room/round-rug.png',
      '/room/watering-can.png',
    ]);
  });

  it('방에서 뺐다가 다시 넣을 수 있다', async () => {
    act(() => {
      useRoomStore.setState({ owned: { growme01: ['shelf'] }, placed: { growme01: ['shelf'] } });
    });
    await connectAndTick();
    const view = renderApp('/shop');

    const card = screen.getByText('나무 선반').closest('div')!;
    fireEvent.click(within(card).getByRole('button', { name: '방에서 빼기' }));
    await flush(50);
    expect(useRoomStore.getState().placed['growme01']).toEqual([]);
    // 보유는 유지된다
    expect(useRoomStore.getState().owned['growme01']).toEqual(['shelf']);

    fireEvent.click(within(card).getByRole('button', { name: '방에 놓기' }));
    await flush(50);

    view.unmount();
    renderApp();
    expect(roomItems()).toContain('/room/shelf.png');
  });

  it('상점은 필요 레벨이 낮은 순서로 진열된다', async () => {
    await connectAndTick();
    renderApp('/shop');

    const names = SHOP_ORDER.map((i: { name: string }) => i.name);
    expect(names).toEqual(['물뿌리개', '나무 선반', '동그란 러그', '창문', '행잉 플랜트', '액자']);
    expect(SHOP_ORDER.map((i: { requiredLevel: number }) => i.requiredLevel)).toEqual([5, 5, 10, 15, 20, 25]);

    // 화면에도 그 순서대로 나온다
    const shown = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
      .filter((t) => names.some((n: string) => t.includes(n)));
    expect(shown[0]).toContain('물뿌리개');
    expect(shown[shown.length - 1]).toContain('액자');
  });

  it('시연용 해금 — Lv.1이어도 전부 구매할 수 있다', async () => {
    act(() => useCharacterStore.setState({ level: 1 }));
    await connectAndTick();
    renderApp('/shop');

    for (const name of ['나무 선반', '액자', '행잉 플랜트']) {
      const card = screen.getByText(name).closest('div')!;
      const btn = within(card).getByRole('button', { name: '구매하기' });
      expect(btn).toHaveProperty('disabled', false);
    }
    expect(screen.queryByText(/필요$/)).toBeNull();
  });

  it('화분마다 방이 따로 저장된다', async () => {
    act(() => {
      useRoomStore.setState({ owned: { growme02: ['roundRug'] }, placed: { growme02: ['roundRug'] } });
    });
    await connectAndTick();
    renderApp();
    // 선택된 화분은 growme01 — growme02의 러그는 보이지 않는다
    expect(roomItems()).toEqual(['/room/base.png']);
  });
});

describe('연결 시 화분 자동 등록', () => {
  beforeEach(() => {
    // 화분이 하나도 없는 상태에서 시작
    usePotStore.setState({ pots: [], selectedPotId: null });
    useRoomStore.setState({ owned: {}, placed: {}, points: 3000 });
  });

  it('연결하면 그 화분이 등록되고 선택된다', async () => {
    expect(usePotStore.getState().selectedPotId).toBeNull();

    await connectAndTick();

    expect(usePotStore.getState().selectedPotId).toBe('growme01');
    expect(usePotStore.getState().pots.map((p) => p.potId)).toEqual(['growme01']);

    renderApp();
    // "아직 등록된 화분이 없어요" 안내가 사라진다
    expect(screen.queryByText('아직 등록된 화분이 없어요')).toBeNull();
  });

  it('화분을 연결하지 않아도 상점에서 구매할 수 있다', async () => {
    renderApp('/shop');

    expect(screen.queryByText('먼저 화분을 선택해 주세요')).toBeNull();

    const card = screen.getByText('나무 선반').closest('div')!;
    fireEvent.click(within(card).getByRole('button', { name: '구매하기' }));
    await flush(50);

    // 자리표시 방에 담긴다
    expect(useRoomStore.getState().placed['my-room']).toEqual(['shelf']);
  });

  it('연결 전에 꾸민 방이 연결 후 그 화분 방으로 옮겨진다', async () => {
    act(() => {
      useRoomStore.setState({ owned: { 'my-room': ['roundRug'] }, placed: { 'my-room': ['roundRug'] } });
    });

    await connectAndTick();

    const room = useRoomStore.getState();
    expect(room.placed['growme01']).toEqual(['roundRug']);
    expect(room.placed['my-room']).toBeUndefined();

    renderApp();
    expect(
      Array.from(document.querySelectorAll('img[src^="/room/"]')).map((el) => el.getAttribute('src')),
    ).toContain('/room/round-rug.png');
  });
});

describe('편집기 노출 조건', () => {
  it('일반 홈 화면에는 편집 UI가 없다', async () => {
    await connectAndTick();
    renderApp();
    expect(screen.queryByText('Room Layout Editor')).toBeNull();
  });

  it('?roomEditor=true가 없으면 열리지 않는다', async () => {
    const { isRoomEditorRequested } = await import('@/features/room/RoomEditorGate');
    window.history.replaceState({}, '', '/?dev=1');
    expect(isRoomEditorRequested()).toBe(false);
    window.history.replaceState({}, '', '/');
  });

  it('개발 서버에서 ?roomEditor=true면 열린다', async () => {
    const { isRoomEditorRequested } = await import('@/features/room/RoomEditorGate');
    window.history.replaceState({}, '', '/?roomEditor=true');
    // vitest는 DEV=true로 돈다 — 프로덕션 빌드에서는 이 분기가 통째로 제거된다
    expect(import.meta.env.DEV).toBe(true);
    expect(isRoomEditorRequested()).toBe(true);
    window.history.replaceState({}, '', '/');
  });
});

describe('구매 → 홈 반영 (ROOM_LAYOUT 위치)', () => {
  beforeEach(() => {
    useRoomStore.setState({ owned: {}, placed: {}, points: 3000 });
  });

  it('구매한 아이템이 ROOM_LAYOUT 좌표로 렌더링된다', async () => {
    await connectAndTick();
    act(() => {
      useRoomStore.getState().purchase('growme01', 'shelf', 99);
    });
    renderApp();

    const img = document.querySelector('img[data-room-item="shelf"]') as HTMLElement;
    expect(img).toBeTruthy();
    const { shelf } = ROOM_LAYOUT;
    expect(img.style.left).toBe(`${(shelf.x / 1024) * 100}%`);
    expect(img.style.top).toBe(`${(shelf.y / 768) * 100}%`);
    expect(img.style.width).toBe(`${(shelf.width / 1024) * 100}%`);
  });

  it('anchor가 있는 아이템은 transform으로 기준점을 맞춘다', async () => {
    await connectAndTick();
    act(() => {
      useRoomStore.getState().purchase('growme01', 'roundRug', 99);
    });
    renderApp();

    const rug = document.querySelector('img[data-room-item="roundRug"]') as HTMLElement;
    expect(rug.style.transform).toBe('translate(-50%, -100%)');

    const character = document.querySelector('[data-room-item="character"]') as HTMLElement;
    expect(character.style.transform).toBe('translate(-50%, -100%)');
  });

  it('구매 즉시 홈에 나타난다 (상점 → 홈)', async () => {
    await connectAndTick();
    const view = renderApp('/shop');

    const card = screen.getByText('나무 선반').closest('div')!;
    fireEvent.click(within(card).getByRole('button', { name: '구매하기' }));
    await flush(50);
    view.unmount();

    renderApp();
    expect(document.querySelector('img[data-room-item="shelf"]')).toBeTruthy();
  });
});
