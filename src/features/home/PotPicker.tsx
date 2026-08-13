// 다중 화분 전환 (후순위 항목이지만 QR 진입과 맞물려 최소 형태로 제공)

import { usePotStore } from '@/store/potStore';

export function PotPicker() {
  const pots = usePotStore((s) => s.pots);
  const selectedPotId = usePotStore((s) => s.selectedPotId);
  const selectPot = usePotStore((s) => s.selectPot);

  if (pots.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-ink-sub">
      화분
      <select
        className="tap flex-1 rounded-lg bg-white px-2 py-1.5 text-sm font-semibold text-ink ring-1 ring-line"
        value={selectedPotId ?? ''}
        onChange={(e) => selectPot(e.target.value)}
      >
        {pots.map((p) => (
          <option key={p.potId} value={p.potId}>
            {p.nickname}
          </option>
        ))}
      </select>
    </label>
  );
}
