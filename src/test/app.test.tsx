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
    expect(screen.getByText('준비 중이에요')).toBeTruthy();
  });
});
