// T-09 / §9.3 — 단순 퍼센트가 아니라 "목표 대역 대비 위치"를 보여준다.
// 시안대로 건조 / 목표 구간 / 과습 3구간을 한 줄 바에 나눠 칠하고,
// 현재 위치는 그 위에 마커로 얹는다.

import { SOIL_BAND_LABEL, SOIL_BAND_SHORT, soilBand, toSoilMoisture } from '@/lib/convert';
import type { PlantProfile } from '@/ble/types';

export const BAND_TEXT = {
  dry: 'text-warn',
  good: 'text-primary',
  wet: 'text-wet',
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

  const trackH = size === 'lg' ? 'h-8' : 'h-6';

  return (
    <div className="w-full">
      <div className={`relative flex w-full overflow-hidden rounded-full ${trackH}`}>
        {/* 건조 */}
        <div className="h-full bg-warn/30" style={{ width: `${bandStart}%` }} />
        {/* 목표 구간 */}
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.max(0, bandEnd - bandStart)}%` }}
        />
        {/* 과습 */}
        <div className="h-full flex-1 bg-wet/30" />

        {/* 현재 위치 */}
        {pct !== null ? (
          <div
            className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-ink shadow transition-[left] duration-700"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      {showLabels ? (
        <div className="relative mt-1.5 h-8">
          <span className="absolute left-0 text-[11px] font-bold text-ink-sub">건조</span>
          <span className="absolute right-0 text-[11px] font-bold text-ink-sub">과습</span>
          <span
            className="absolute -translate-x-1/2 text-[11px] font-bold text-primary"
            style={{ left: `${(bandStart + bandEnd) / 2}%` }}
          >
            목표 구간
          </span>
          <span
            className="absolute top-4 -translate-x-1/2 text-[11px] font-bold text-primary"
            style={{ left: `${bandStart}%` }}
          >
            {bandStart}%
          </span>
          <span
            className="absolute top-4 -translate-x-1/2 text-[11px] font-bold text-primary"
            style={{ left: `${bandEnd}%` }}
          >
            {bandEnd}%
          </span>
        </div>
      ) : null}

      <div className="mt-1 flex items-baseline justify-between">
        <span
          className={`${size === 'lg' ? 'text-2xl' : 'text-base'} font-extrabold ${
            band ? BAND_TEXT[band] : 'text-ink-sub'
          }`}
        >
          {band ? SOIL_BAND_LABEL[band] : '측정 불가'}
        </span>
        <span className="text-xs font-semibold text-ink-sub">
          {pct === null ? '--' : `토양 ${pct}%`}
          {band ? ` · ${SOIL_BAND_SHORT[band]}` : ''}
        </span>
      </div>
    </div>
  );
}
