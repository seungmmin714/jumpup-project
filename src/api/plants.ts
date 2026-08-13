// §12.5 — 서버 도감. 실패하면 번들 내장본(§11.4)으로 폴백한다.

import { api } from './client';
import { PLANTS } from '@/data/plants';
import type { Plant } from '@/ble/types';

import { uploadQueue } from './uploadQueue';

/** 어떤 식물을 심었는지 서버에도 남긴다 — /latest의 plantId가 이 값을 따른다. */
export function setPotPlant(potId: string, plantId: string): void {
  uploadQueue.enqueue(`/pots/${encodeURIComponent(potId)}/plant`, { plantId });
}

export async function fetchPlants(signal?: AbortSignal): Promise<readonly Plant[]> {
  try {
    const remote = await api.get<Plant[]>('/plants', signal);
    return Array.isArray(remote) && remote.length > 0 ? remote : PLANTS;
  } catch {
    return PLANTS;
  }
}
