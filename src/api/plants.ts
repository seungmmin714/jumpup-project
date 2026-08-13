// §12.5 — 서버 도감. 실패하면 번들 내장본(§11.4)으로 폴백한다.

import { api } from './client';
import { PLANTS } from '@/data/plants';
import type { Plant } from '@/ble/types';

export async function fetchPlants(signal?: AbortSignal): Promise<readonly Plant[]> {
  try {
    const remote = await api.get<Plant[]>('/plants', signal);
    return Array.isArray(remote) && remote.length > 0 ? remote : PLANTS;
  } catch {
    return PLANTS;
  }
}
