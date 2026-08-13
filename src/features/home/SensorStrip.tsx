// T-07 — 센서 카드. 결측은 `--`, 3회 연속 결측이면 경고 아이콘(§9.2).

import { LIGHT_BAND_LABEL, SOIL_BAND_SHORT, lightBand, soilBand } from '@/lib/convert';
import { fmtPct, fmtTemp } from '@/lib/format';
import { isFieldWarned, useTelemetryStore, type MissingStreak } from '@/store/telemetryStore';
import { selectedPlant, usePotStore } from '@/store/potStore';
import { useCharacterStore } from '@/store/characterStore';
import type { Telemetry } from '@/ble/types';

function Cell({
  icon,
  label,
  value,
  sub,
  warned,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  warned?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/70 px-2 py-2.5 ring-1 ring-olive-100">
      <span className="text-lg" aria-hidden>
        {icon}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-sm font-bold text-olive-800">
        {value}
        {warned ? (
          <span className="text-state-warn" title="센서 확인 필요" aria-label="센서 확인 필요">
            ⚠
          </span>
        ) : null}
      </span>
      <span className="label">{sub ?? label}</span>
    </div>
  );
}

export function SensorStrip({ t, streak }: { t: Telemetry | null; streak: MissingStreak }) {
  const plant = usePotStore(selectedPlant);
  const level = useCharacterStore((s) => s.level);

  const soil = soilBand(t?.soilRaw ?? null, plant.soilDry, plant.soilWet);
  const light = lightBand(t?.lightLevel ?? null);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Cell
        icon="🌡"
        label="온도"
        value={fmtTemp(t?.temperature ?? null)}
        warned={isFieldWarned(streak, 'temp')}
      />
      <Cell
        icon="💧"
        label="습도"
        value={fmtPct(t?.humidity ?? null)}
        warned={isFieldWarned(streak, 'humi')}
      />
      <Cell icon="🌱" label="레벨" value={`Lv.${level}`} />
      <Cell
        icon="🪴"
        label="토양"
        value={t?.soilMoisture === null || t === null ? '--' : `${t.soilMoisture}%`}
        sub={soil ? SOIL_BAND_SHORT[soil] : '토양'}
        warned={isFieldWarned(streak, 'soil')}
      />
      <Cell
        icon="☀"
        label="조도"
        value={light ? LIGHT_BAND_LABEL[light] : '--'}
        sub={t?.lightLevel === null || t === null ? '조도' : `지수 ${t.lightLevel}`}
        warned={isFieldWarned(streak, 'light')}
      />
      <Cell icon="🌿" label="식물" value={plant.emoji} sub={plant.nameKo} />
    </div>
  );
}

/** 전 필드 결측 시 배너 */
export function useSensorAlarm() {
  const t = useTelemetryStore((s) => s.latest);
  const allMissing =
    t !== null &&
    t.soilRaw === null &&
    t.temperature === null &&
    t.humidity === null &&
    t.lightRaw === null;
  return { allMissing };
}
