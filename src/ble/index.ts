// T-06 DoD: Mock ↔ 실제 전환이 환경변수만으로 된다.

import { WebBleClient, isWebBluetoothSupported, type BleClient } from './BleClient';
import { MockBleClient } from './MockBleClient';

export * from './types';
export { isWebBluetoothSupported } from './BleClient';
export type { BleClient } from './BleClient';
export { MockBleClient } from './MockBleClient';

const MODE = (import.meta.env.VITE_BLE_MODE ?? 'mock') as 'mock' | 'real';

/** `?dev=1`이면 실제 모드로 빌드했더라도 Mock으로 강제 전환한다. */
function wantsMock(): boolean {
  if (MODE === 'mock') return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ble') === 'mock';
}

let instance: BleClient | null = null;

export function getBleClient(): BleClient {
  if (!instance) instance = wantsMock() ? new MockBleClient() : new WebBleClient();
  return instance;
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
