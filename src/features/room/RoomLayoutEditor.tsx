// 개발자 전용 Room Layout Editor.
//
// 여는 법:  npm run dev  →  http://localhost:5173/?roomEditor=true
//
// 실제 홈 화면과 **같은 RoomScene**을 그린다. 편집기에서 맞춘 좌표가 홈에서
// 어긋나지 않으려면 렌더링 코드가 하나여야 하기 때문이다.
// 이 파일은 import.meta.env.DEV에서만 동적 import되므로 프로덕션 번들에 없다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomScene, type RoomLayoutMap } from './RoomScene';
import { ROOM_ITEM_CATALOG, ROOM_ITEM_IDS } from './roomCatalog';
import {
  ROOM_LAYOUT,
  ROOM_STAGE,
  formatLayout,
  type RoomLayoutItem,
  type RoomLayoutKey,
} from './roomLayout';
import { findPlant } from '@/data/plants';

const STORAGE_KEY = 'growme.roomLayout.draft';
const KEYS: RoomLayoutKey[] = [...ROOM_ITEM_IDS, 'character'];

const loadDraft = (): RoomLayoutMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...ROOM_LAYOUT };
    return { ...ROOM_LAYOUT, ...(JSON.parse(raw) as Partial<RoomLayoutMap>) };
  } catch {
    return { ...ROOM_LAYOUT };
  }
};

export default function RoomLayoutEditor() {
  const [layout, setLayout] = useState<RoomLayoutMap>(loadDraft);
  const [selected, setSelected] = useState<RoomLayoutKey>('character');
  const [copied, setCopied] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  /** 드래그 중인 대상과 잡은 지점의 오프셋(스테이지 좌표) */
  const drag = useRef<{ key: RoomLayoutKey; dx: number; dy: number } | null>(null);

  // 임시 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* 저장 못 해도 편집은 계속된다 */
    }
  }, [layout]);

  const patch = useCallback((key: RoomLayoutKey, next: Partial<RoomLayoutItem>) => {
    setLayout((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }));
  }, []);

  /** 화면 좌표 → 1024×768 스테이지 좌표 */
  const toStage = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current?.querySelector('[data-room-scene]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * ROOM_STAGE.width,
      y: ((clientY - r.top) / r.height) * ROOM_STAGE.height,
    };
  }, []);

  // ── 드래그 (마우스 + 터치 공용: Pointer Events) ──
  const onPointerDown = (e: React.PointerEvent) => {
    const target = (e.target as HTMLElement).closest('[data-room-item]') as HTMLElement | null;
    if (!target) return;
    const key = target.dataset.roomItem as RoomLayoutKey;
    if (!key || !layout[key]) return;

    const p = toStage(e.clientX, e.clientY);
    if (!p) return;
    setSelected(key);
    drag.current = { key, dx: p.x - layout[key].x, dy: p.y - layout[key].y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toStage(e.clientX, e.clientY);
    if (!p) return;
    patch(d.key, { x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) });
    e.preventDefault();
  };

  const endDrag = () => {
    drag.current = null;
  };

  // ── 방향키 이동 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      const cur = layout[selected];
      if (e.key === 'ArrowLeft') patch(selected, { x: cur.x - step });
      else if (e.key === 'ArrowRight') patch(selected, { x: cur.x + step });
      else if (e.key === 'ArrowUp') patch(selected, { y: cur.y - step });
      else if (e.key === 'ArrowDown') patch(selected, { y: cur.y + step });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, selected, patch]);

  const copyJson = async () => {
    const text = formatLayout(layout);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.log(text); // 클립보드가 막히면 콘솔로
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const reset = () => {
    setLayout({ ...ROOM_LAYOUT });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 무시 */
    }
  };

  const box = layout[selected];
  const num = (label: string, key: keyof RoomLayoutItem, step = 1) => (
    <label className="flex items-center gap-1 text-[11px] font-bold text-ink-sub">
      {label}
      <input
        type="number"
        step={step}
        value={Math.round((box[key] as number) ?? 0)}
        onChange={(e) => patch(selected, { [key]: Number(e.target.value) })}
        className="w-16 rounded border border-line px-1.5 py-1 text-xs text-ink"
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-3 p-4">
      <header>
        <h1 className="page-title">Room Layout Editor</h1>
        <p className="page-sub mt-0.5">
          개발 전용 · 좌표계 {ROOM_STAGE.width}×{ROOM_STAGE.height}
        </p>
      </header>

      {/* 편집 대상 — 구매 여부와 관계없이 전부 보여준다 */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: 'none' }}
      >
        <RoomScene
          plant={findPlant('tomato-cherry')}
          mood={0}
          visibleItemIds={ROOM_ITEM_IDS}
          layout={layout}
          selectedKey={selected}
          onSelect={setSelected}
          caption=""
          overlay={<Guides />}
        />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                selected === k ? 'bg-primary text-white' : 'bg-primary-soft text-primary'
              }`}
            >
              {k === 'character' ? '캐릭터' : ROOM_ITEM_CATALOG[k].name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {num('x', 'x')}
          {num('y', 'y')}
          {num('w', 'width')}
          {num('z', 'zIndex')}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-ink-sub">
          <span>크기</span>
          <button type="button" className="rounded bg-primary-soft px-2 py-1" onClick={() => patch(selected, { width: box.width - 10 })}>
            −10
          </button>
          <button type="button" className="rounded bg-primary-soft px-2 py-1" onClick={() => patch(selected, { width: box.width + 10 })}>
            +10
          </button>
          <span className="ml-2">z</span>
          <button type="button" className="rounded bg-primary-soft px-2 py-1" onClick={() => patch(selected, { zIndex: box.zIndex - 5 })}>
            뒤로
          </button>
          <button type="button" className="rounded bg-primary-soft px-2 py-1" onClick={() => patch(selected, { zIndex: box.zIndex + 5 })}>
            앞으로
          </button>
        </div>

        <p className="rounded-lg bg-primary-soft/60 px-2 py-1.5 font-mono text-[11px] text-ink">
          {selected} · x{Math.round(box.x)} y{Math.round(box.y)} w{Math.round(box.width)} z{box.zIndex}
          {box.anchorX !== undefined ? ` ax${box.anchorX}` : ''}
          {box.anchorY !== undefined ? ` ay${box.anchorY}` : ''}
        </p>

        <p className="text-[11px] leading-relaxed text-ink-sub">
          드래그로 이동 · 방향키 1px · Shift+방향키 10px
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary py-2 text-xs" onClick={() => void copyJson()}>
            {copied ? '복사했어요' : 'ROOM_LAYOUT 복사'}
          </button>
          <button type="button" className="btn-secondary py-2 text-xs" onClick={reset}>
            초기화
          </button>
        </div>
      </div>

      <pre className="card overflow-x-auto whitespace-pre text-[10px] leading-relaxed text-ink">
        {formatLayout(layout)}
      </pre>
    </div>
  );
}

/** 경계선 · 중앙선 · 바닥 기준선 */
function Guides() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 60 }} aria-hidden>
      <div className="absolute inset-0 border-2 border-dashed border-red-400/50" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-red-400/40" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-red-400/40" />
      {/* 바닥 기준선 — 러그·캐릭터가 벽으로 올라가지 않게 */}
      <div className="absolute inset-x-0 bg-sky-400/60" style={{ top: '72%', height: 1 }} />
      <span className="absolute left-1 text-[9px] font-bold text-sky-600" style={{ top: '72%' }}>
        floor
      </span>
    </div>
  );
}
