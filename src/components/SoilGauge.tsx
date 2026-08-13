// T-09 / §9.3 — 단순 퍼센트가 아니라 "목표 대역 대비 위치"를 보여준다.

import { SOIL_BAND_LABEL, SOIL_BAND_SHORT, soilBand, toSoilMoisture } from '@/lib/convert';
import type { PlantProfile } from '@/ble/types';

export const BAND_COLOR = {
  dry: { bar: 'bg-state-dry', text: 'text-state-dry', soft: 'bg-orange-100' },
  good: { bar: 'bg-state-good', text: 'text-state-good', soft: 'bg-olive-100' },
  wet: { bar: 'bg-state-wet', text: 'text-state-wet', soft: 'bg-blue-100' },
} as const;

interface Props {
  soilRaw: number | null;
  profile: Pick<PlantProfile, 'soilDry' | 'soilWet'>;
  /** 급수 가이드에서는 크게, 홈에서는 작게 */
  size?: 'sm' | 'lg';
  showLabels?: boolean;
}

export function SoilGauge({ soilRaw, profile, size = 'sm', showLabels = true }: Props) {
  // 원시값은 클수록 건조 → 습도(%)로 바꾸면 축이 왼쪽(건조) → 오른쪽(과습)으로 정렬된다.
  const pct = toSoilMoisture(soilRaw);
  const bandStart = toSoilMoisture(profile.soilDry) ?? 45; // 목표 하한
  const bandEnd = toSoilMoisture(profile.soilWet) ?? 65; // 목표 상한
  const band = soilBand(soilRaw, profile.soilDry, profile.soilWet);
  const color = band ? BAND_COLOR[band] : BAND_COLOR.good;

  const trackH = size === 'lg' ? 'h-7' : 'h-4';

  return (
    <div className="w-full">
      {showLabels ? (
        <div className="mb-1 flex justify-between text-[10px] font-semibold text-olive-400">
          <span>건조</span>
          <span className="text-olive-500">목표 구간</span>
          <span>과습</span>
        </div>
      ) : null}

      <div className={`relative w-full overflow-hidden rounded-full bg-olive-100 ${trackH}`}>
        {/* 목표 구간 */}
        <div
          className="absolute inset-y-0 bg-olive-300/70"
          style={{ left: `${bandStart}%`, width: `${Math.max(0, bandEnd - bandStart)}%` }}
        />
        {/* 현재 위치까지 채움 */}
        {pct !== null ? (
          <div
            className={`absolute inset-y-0 left-0 rounded-r-full opacity-70 transition-[width] duration-700 ${color.bar}`}
            style={{ width: `${pct}%` }}
          />
        ) : null}
        {/* 현재 마커 */}
        {pct !== null ? (
          <div
            className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-olive-900 shadow transition-[left] duration-700"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      {showLabels ? (
        <div className="relative mt-1 h-4 text-[10px] font-semibold text-olive-400">
          <span className="absolute -translate-x-1/2" style={{ left: `${bandStart}%` }}>
            {bandStart}%
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${bandEnd}%` }}>
            {bandEnd}%
          </span>
        </div>
      ) : null}

      <div className="mt-1 flex items-baseline justify-between">
        <span className={`${size === 'lg' ? 'text-2xl' : 'text-base'} font-bold ${color.text}`}>
          {band ? SOIL_BAND_LABEL[band] : '측정 불가'}
        </span>
        <span className="state-num">
          {pct === null ? '--' : `토양 ${pct}%`}
          {band ? ` · ${SOIL_BAND_SHORT[band]}` : ''}
        </span>
      </div>
    </div>
  );
}
