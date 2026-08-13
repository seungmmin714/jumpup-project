// BLE 클라이언트 ↔ 스토어 배선. App 마운트 시 한 번만 붙인다.

import { getBleClient } from '@/ble';
import { SUPPORTED_PROTO_VER, cmdQuery, cmdSetProfile } from '@/ble/constants';
import { parseQueryAck } from '@/ble/parser';
import { uploadTelemetry } from '@/api/telemetry';
import { useConnectionStore } from './connectionStore';
import { useTelemetryStore } from './telemetryStore';
import { DEFAULT_POT_ID, profileOf, selectedPlant, usePotStore } from './potStore';
import { useRoomStore } from './roomStore';
import { useCharacterStore } from './characterStore';
import type { AckCode, PlantProfile } from '@/ble/types';

let attached = false;
const ACK_TIMEOUT_MS = 3000;

/** cmd별 대기 중인 resolver */
const waiters = new Map<AckCode, (r: { ok: boolean; result: string }) => void>();

export function attachBleBridge(): () => void {
  if (attached) return () => undefined;
  attached = true;

  const client = getBleClient();
  const conn = useConnectionStore.getState();
  const unsubs: Array<() => void> = [];

  unsubs.push(
    client.onStateChange((state, err) => {
      useConnectionStore.getState().setState(state, err ?? null);
      useConnectionStore.getState().setDeviceName(client.getDeviceName());

      if (state === 'CONNECTED') {
        registerConnectedPot(client.getDeviceName());
        void onConnected();
      }
      if (state === 'IDLE') {
        useTelemetryStore.getState().reset();
        useConnectionStore.getState().setDeviceProfile(null);
        usePotStore.getState().setDeviceProfile(null);
      }
    }),
  );

  unsubs.push(
    client.onSensor((p) => {
      const potId = usePotStore.getState().selectedPotId ?? 'growme01';
      const store = useConnectionStore.getState();
      store.markPacket();

      useTelemetryStore.getState().ingest(p, potId);
      useCharacterStore.getState().observeMood(p.mood);

      const t = useTelemetryStore.getState().latest;
      // 방금 커밋된 값만 업로드한다 (스로틀로 걸러진 패킷은 보내지 않는다)
      if (t && t.seq === p.seq) {
        uploadTelemetry({
          ...t,
          protoVer: store.protoVer ?? SUPPORTED_PROTO_VER,
          fwVer: store.fwVer ?? '2.0',
          source: 'ble-web',
        });
      }
    }),
  );

  unsubs.push(
    client.onHello(({ protoVer, fwVer }) => {
      useConnectionStore.getState().setHello(protoVer, fwVer);
    }),
  );

  unsubs.push(
    client.onAck((a) => {
      const ok = !a.result.startsWith('ERR');
      useConnectionStore.getState().pushAck({ cmd: a.cmd, result: a.result, at: Date.now(), ok });
      useConnectionStore.getState().setInflight(a.cmd, false);

      if (a.cmd === 'Q') {
        const p = parseQueryAck(a.result);
        useConnectionStore.getState().setDeviceProfile(p);
        usePotStore.getState().setDeviceProfile(p);
      }
      waiters.get(a.cmd)?.({ ok, result: a.result });
      waiters.delete(a.cmd);
    }),
  );

  unsubs.push(client.onDrop(() => useConnectionStore.getState().markCorrupt()));

  conn.setDeviceName(client.getDeviceName());

  return () => {
    for (const u of unsubs) u();
    attached = false;
  };
}

/**
 * 연결한 화분을 목록에 등록하고 선택한다.
 * 이걸 하지 않으면 연결돼 있는데도 potId가 없어서 홈에는 "등록된 화분이 없어요"가,
 * 상점에는 "먼저 화분을 선택해 주세요"가 뜬다.
 */
function registerConnectedPot(deviceName: string | null): void {
  if (!deviceName) return;
  const potId = deviceName.trim().toLowerCase();
  const pot = usePotStore.getState();
  if (pot.selectedPotId === potId) return;

  pot.addPot(potId, deviceName);
  // 연결 전에 꾸며 둔 방이 있으면 그대로 가져온다
  useRoomStore.getState().adoptRoom(DEFAULT_POT_ID, potId);
}

/**
 * §7 연결 직후 반드시 Q를 보내 화분의 실제 프로파일을 확인하고,
 * 앱에서 선택한 식물과 다르면 S로 덮어쓴다. (자동 전송이 허용된 유일한 예외 — §16)
 */
async function onConnected(): Promise<void> {
  try {
    const res = await sendCommand(cmdQuery(), 'Q');
    if (!res.ok) return;
    const device = parseQueryAck(res.result);
    if (!device) return;

    const want = profileOf(selectedPlant(usePotStore.getState()));
    if (!isSameProfile(device, want)) {
      await sendCommand(cmdSetProfile(want), 'S');
      await sendCommand(cmdQuery(), 'Q'); // 반영 확인
    }
  } catch (e) {
    console.warn('[ble] 프로파일 동기화 실패', e);
  }
}

const isSameProfile = (a: PlantProfile, b: PlantProfile) =>
  a.soilDry === b.soilDry &&
  a.soilWet === b.soilWet &&
  a.tempMinX10 === b.tempMinX10 &&
  a.tempMaxX10 === b.tempMaxX10 &&
  a.lightMin === b.lightMin;

/** 명령 전송 + 응답(A) 대기. 타임아웃이면 ok:false로 돌려주고 UI를 풀어준다. */
export function sendCommand(
  cmd: string,
  expect: AckCode,
): Promise<{ ok: boolean; result: string }> {
  const store = useConnectionStore.getState();
  store.setInflight(expect, true);

  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { ok: boolean; result: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      waiters.delete(expect);
      useConnectionStore.getState().setInflight(expect, false);
      resolve(r);
    };

    const timer = setTimeout(() => finish({ ok: false, result: 'ERR:TIMEOUT' }), ACK_TIMEOUT_MS);
    waiters.set(expect, finish);

    getBleClient()
      .send(cmd)
      .catch((e) => finish({ ok: false, result: `ERR:${String(e)}` }));
  });
}

export async function connectPot(): Promise<void> {
  await getBleClient().connect();
}

export async function disconnectPot(): Promise<void> {
  await getBleClient().disconnect();
  useTelemetryStore.getState().reset();
  useConnectionStore.getState().resetConnection();
}
