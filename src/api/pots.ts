// §12.3 / §12.4

import { api } from './client';
import { uploadQueue } from './uploadQueue';

export type CareLogType = 'water' | 'move' | 'ventilate' | 'note';

export interface CareLog {
  id?: string;
  type: CareLogType;
  at: string;
  soilBefore?: number | null;
  soilAfter?: number | null;
  amountMl?: number | null;
  guided?: boolean;
  note?: string;
}

/** 급수 기록은 유실되면 안 되므로 큐를 태운다. */
export function postCareLog(potId: string, log: CareLog): void {
  uploadQueue.enqueue(`/pots/${encodeURIComponent(potId)}/care-logs`, log);
}

export const fetchCareLogs = (potId: string, limit = 50, signal?: AbortSignal) =>
  api.get<CareLog[]>(`/pots/${encodeURIComponent(potId)}/care-logs?limit=${limit}`, signal);

export interface CharacterState {
  level: number;
  exp: number;
  expToNext: number;
  happiness: number;
  stage: string;
  stageProgress: number;
}

export const fetchCharacter = (potId: string, signal?: AbortSignal) =>
  api.get<CharacterState>(`/pots/${encodeURIComponent(potId)}/character`, signal);
