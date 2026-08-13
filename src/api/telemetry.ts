// §12.1 / §12.2

import { api } from './client';
import { uploadQueue } from './uploadQueue';
import type { Mood, Telemetry } from '@/ble/types';

export interface TelemetryUpload extends Omit<Telemetry, 'potId'> {
  potId: string;
  protoVer: number;
  fwVer: string;
  source: 'ble-web';
}

export function uploadTelemetry(t: TelemetryUpload): void {
  // 큐에만 넣고 즉시 반환한다 — 렌더링을 막지 않는다.
  uploadQueue.enqueue('/telemetry', t);
}

/** §12.2 마지막 상태. BLE 미연결 시 이 값으로 화면을 그린다. */
export interface LatestState {
  potId: string;
  measuredAt: string;
  ageSeconds: number;
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lightLevel: number | null;
  mood: Mood;
  lastWateredAt: string | null;
  plantId: string;
}

export const fetchLatest = (potId: string, signal?: AbortSignal) =>
  api.get<LatestState>(`/pots/${encodeURIComponent(potId)}/latest`, signal);
