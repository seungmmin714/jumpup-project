// T-06 DoD: Mock ↔ 실제 전환이 환경변수만으로 된다.
// 여기에 더해 런타임 전환(?ble=real / 설정 저장)도 지원한다 — 실기기 확인 때 재빌드가 필요 없도록.

import { WebBleClient, isWebBluetoothSupported, type BleClient } from './BleClient';
import { MockBleClient } from './MockBleClient';
import { resolveBleMode, type BleMode } from './mode';

export * from './types';
export { isWebBluetoothSupported } from './BleClient';
export type { BleClient } from './BleClient';
export { MockBleClient } from './MockBleClient';
export * from './mode';

let instance: BleClient | null = null;
let activeMode: BleMode = 'mock';

export function getBleClient(): BleClient {
  if (!instance) {
    activeMode = resolveBleMode();
    instance = activeMode === 'mock' ? new MockBleClient() : new WebBleClient();
  }
  return instance;
}

/** 실제로 이번 실행에서 쓰이고 있는 모드 */
export function activeBleMode(): BleMode {
  getBleClient();
  return activeMode;
}

export const isMockMode = (): boolean => getBleClient().isMock();

/** 개발자 패널에서만 사용 — Mock이 아니면 null */
export function getMockClient(): MockBleClient | null {
  const c = getBleClient();
  return c instanceof MockBleClient ? c : null;
}

/** iOS 등 미지원 환경 판별 (T-15) */
export const canUseBle = (): boolean => isMockMode() || isWebBluetoothSupported();

export const isIosLike = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
