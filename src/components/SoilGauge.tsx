// T-09 / §9.3 — 단순 퍼센트가 아니라 "목표 대역 대비 위치"를 보여준다.
//
// 트랙은 스프라이트의 **빈 프레임만** 9-슬라이스로 쓴다.
// 건조 / 목표 구간 / 과습의 너비는 선택한 식물의 soilDry·soilWet에서 매번
// 계산하므로, 식물을 바꾸면 경계가 즉시 따라 움직인다.
// 경계 숫자와 현재 위치 마커도 전부 HTML 요소다 — 그림에 박힌 눈금은 쓰지 않는다.

import { SOIL_BAND_LABEL, soilBand, toSoilMoisture } from '@/lib/convert';
import { PixelIcon } from './PixelIcon';
import type { Mood, PlantProfile } from '@/ble/types';

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
  /**
   * F-04 해석 문구는 mood에서 파생시킨다. 게이지가 독자적으로 "적정"이라고
   * 말하면 캐릭터가 "목이 말라요"라고 할 때 화면 안에서 모순이 생긴다.
   */
  mood?: Mood | null;
}

export function SoilGauge({
  soilRaw,
  profile,
  size = 'sm',
  showLabels = true,
  mood,
}: Props) {
  // 원시값은 클수록 건조 → 습도(%)로 바꾸면 축이 왼쪽(건조) → 오른쪽(과습)으로 정렬된다.
  const pct = toSoilMoisture(soilRaw);
  const bandStart = toSoilMoisture(profile.soilDry) ?? 45; // 목표 하한
  const bandEnd = toSoilMoisture(profile.soilWet) ?? 65; // 목표 상한
  const band = soilBand(soilRaw, profile.soilDry, profile.soilWet);
  const hasValue = pct !== null;

  // mood가 있으면 그 해석을 따르고, 없으면 목표 대역 기준으로 말한다
  const verdict =
    mood === 1
      ? { label: '물이 필요해요', tone: BAND_TEXT.dry }
      : mood === 5
        ? { label: '물이 너무 많아요', tone: BAND_TEXT.wet }
        : band
          ? { label: SOIL_BAND_LABEL[band], tone: BAND_TEXT[band] }
          : { label: '측정 불가', tone: 'text-ink-sub' };

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
        {/*
          세 구간 — 너비는 식물 프로파일에서 계산된다.
          F-03 값이 없으면 색을 채우지 않는다. 목표 구간 눈금만 회색으로 남긴다.
        */}
        <span
          className={`h-full ${hasValue ? 'bg-warn/45' : 'bg-transparent'}`}
          style={{ width: `${dryW}%` }}
        />
        <span
          className={`h-full ${hasValue ? 'bg-primary' : 'bg-ink/10'}`}
          style={{ width: `${targetW}%` }}
        />
        <span
          className={`h-full flex-1 ${hasValue ? 'bg-wet/45' : 'bg-transparent'}`}
          style={{ width: `${wetW}%` }}
        />

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
          className={`${size === 'lg' ? 'text-2xl' : 'text-base'} font-extrabold ${verdict.tone}`}
        >
          {verdict.label}
        </span>
        {/* F-12a 같은 말을 두 번 하지 않는다 — 여기는 숫자만 */}
        <span className="text-xs font-semibold text-ink-sub">
          {pct === null ? '--' : `토양 ${pct}%`}
        </span>
      </div>
    </div>
  );
}
