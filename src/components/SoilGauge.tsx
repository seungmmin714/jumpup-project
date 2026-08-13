// T-09 / §9.3 — 단순 퍼센트가 아니라 "목표 대역 대비 위치"를 보여준다.
//
// 트랙은 스프라이트의 **빈 프레임만** 9-슬라이스로 쓴다.
// 건조 / 목표 구간 / 과습의 너비는 선택한 식물의 soilDry·soilWet에서 매번
// 계산하므로, 식물을 바꾸면 경계가 즉시 따라 움직인다.
// 경계 숫자와 현재 위치 마커도 전부 HTML 요소다 — 그림에 박힌 눈금은 쓰지 않는다.

import { SOIL_BAND_LABEL, SOIL_BAND_SHORT, soilBand, toSoilMoisture } from '@/lib/convert';
import { PixelIcon } from './PixelIcon';
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

  const dryW = Math.max(0, Math.min(100, bandStart));
  const targetW = Math.max(0, Math.min(100 - dryW, bandEnd - bandStart));
  const wetW = Math.max(0, 100 - dryW - targetW);

  return (
    <div className="w-full">
      <div
        className="pixel-track w-full"
        style={{ height: size === 'lg' ? 38 : 30 }}
        role="img"
        aria-label={`토양 수분 ${pct === null ? '측정 불가' : `${pct}%`}, 목표 ${bandStart}~${bandEnd}%`}
      >
        {/* 세 구간 — 너비는 식물 프로파일에서 계산된다 */}
        <span className="h-full bg-warn/45" style={{ width: `${dryW}%` }} />
        <span className="h-full bg-primary" style={{ width: `${targetW}%` }} />
        <span className="h-full bg-wet/45" style={{ width: `${wetW}%` }} />

        {/* 현재 위치 — 픽셀 포인터 */}
        {pct !== null ? (
          <span
            className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink transition-[left] duration-500"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      {showLabels ? (
        <>
          {/* 경계 마커 — 그림이 아니라 HTML 요소 */}
          <div className="relative h-5">
            {[bandStart, bandEnd].map((v) => (
              <span
                key={v}
                className="absolute -translate-x-1/2"
                style={{ left: `${v}%` }}
                aria-hidden
              >
                <PixelIcon name="drop" size={14} />
              </span>
            ))}
          </div>

          <div className="relative h-4 text-[11px] font-bold">
            <span className="absolute left-0 text-ink-sub">건조</span>
            <span className="absolute right-0 text-ink-sub">과습</span>
            <span
              className="absolute -translate-x-1/2 text-primary"
              style={{ left: `${bandStart}%` }}
            >
              {bandStart}%
            </span>
            <span
              className="absolute -translate-x-1/2 text-primary"
              style={{ left: `${bandEnd}%` }}
            >
              {bandEnd}%
            </span>
          </div>
        </>
      ) : null}

      <div className="mt-2 flex items-baseline justify-between">
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
