// 방 안 배치의 단일 진실 공급원.
//
// 모든 좌표는 **1024×768 가상 해상도** 기준이다. 화면에서는 이 값을 백분율로
// 바꿔 그리므로, 방의 가로·세로가 같은 비율로 축소되고 어떤 화면 폭에서도
// 상대 위치가 그대로 유지된다. 화면 크기별 보정값은 두지 않는다.
//
// 좌표는 눈대중으로 고치지 말고 `?roomEditor=true` 편집기에서 확정한다.

export const ROOM_STAGE = { width: 1024, height: 768 } as const;

/** 겹침 순서 — 명세 §2 */
export const ROOM_Z = {
  background: 0,
  wall: 10, // 창문 · 액자 · 행잉 플랜트
  backFurniture: 15, // 선반
  rug: 20,
  character: 30,
  foreground: 35, // 물뿌리개
  particle: 40,
  speech: 50,
} as const;

export interface RoomLayoutItem {
  x: number;
  y: number;
  width: number;
  zIndex: number;
  /** 0 = 왼쪽, 0.5 = 중앙, 1 = 오른쪽 (기본 0) */
  anchorX?: number;
  /** 0 = 위, 0.5 = 중앙, 1 = 아래 (기본 0) */
  anchorY?: number;
}

export type RoomLayoutKey =
  | 'window'
  | 'hangingPlant'
  | 'botanicalFrame'
  | 'shelf'
  | 'roundRug'
  | 'wateringCan'
  | 'character';

/**
 * 확정 좌표. 편집기(`?roomEditor=true`)의 "JSON 복사"로 나온 값을 그대로 붙여 넣는다.
 *
 * 눈대중으로 숫자를 고치지 말 것. 어긋나 보이면 편집기에서 다시 맞춰 복사한다.
 */
export const ROOM_LAYOUT: Record<RoomLayoutKey, RoomLayoutItem> = {
  window: { x: 32, y: 83, width: 290, zIndex: 10 },
  hangingPlant: { x: 735, y: 23, width: 165, zIndex: 10 },
  botanicalFrame: { x: 517, y: 60, width: 130, zIndex: 10 },
  shelf: { x: 695, y: 318, width: 300, zIndex: 15 },
  roundRug: { x: 500, y: 744, width: 520, zIndex: 20, anchorX: 0.5, anchorY: 1 },
  character: { x: 502, y: 669, width: 300, zIndex: 30, anchorX: 0.5, anchorY: 1 },
  wateringCan: { x: 71, y: 677, width: 180, zIndex: 35, anchorY: 1 },
};

// ───────── 좌표 변환 ─────────

export interface RoomBoxStyle {
  left: string;
  top: string;
  width: string;
  zIndex: number;
  /** anchor를 반영한 이동량 */
  transform?: string;
}

/**
 * 1024×768 좌표 → CSS 백분율.
 *
 * width만 %로 주고 height는 auto로 둔다. 이미지의 종횡비가 그대로 유지되고,
 * 세로 비율까지 따로 계산할 필요가 없다(컨테이너가 4:3으로 고정돼 있으므로
 * 가로 %와 세로 %의 축척이 같다).
 */
export function toRoomStyle(item: RoomLayoutItem): RoomBoxStyle {
  const ax = item.anchorX ?? 0;
  const ay = item.anchorY ?? 0;

  const style: RoomBoxStyle = {
    left: `${(item.x / ROOM_STAGE.width) * 100}%`,
    top: `${(item.y / ROOM_STAGE.height) * 100}%`,
    width: `${(item.width / ROOM_STAGE.width) * 100}%`,
    zIndex: item.zIndex,
  };

  // anchor는 자기 크기 기준이라 %가 아니라 transform으로 옮긴다.
  // (세로 크기는 이미지 종횡비에 따라 달라지므로 translate %가 정확하다)
  if (ax !== 0 || ay !== 0) {
    style.transform = `translate(${-ax * 100}%, ${-ay * 100}%)`;
  }
  return style;
}

/** 편집기에서 드래그한 화면 좌표(0~1 비율)를 1024×768 좌표로 되돌린다 */
export const toStageX = (ratio: number): number => Math.round(ratio * ROOM_STAGE.width);
export const toStageY = (ratio: number): number => Math.round(ratio * ROOM_STAGE.height);

/** 편집기 JSON 복사용 — TypeScript 상수에 그대로 붙여 넣을 수 있는 형태 */
export function formatLayout(layout: Record<string, RoomLayoutItem>): string {
  const entry = (k: string, v: RoomLayoutItem) => {
    const parts = [`x: ${Math.round(v.x)}`, `y: ${Math.round(v.y)}`, `width: ${Math.round(v.width)}`, `zIndex: ${v.zIndex}`];
    if (v.anchorX !== undefined && v.anchorX !== 0) parts.push(`anchorX: ${v.anchorX}`);
    if (v.anchorY !== undefined && v.anchorY !== 0) parts.push(`anchorY: ${v.anchorY}`);
    return `  ${k}: { ${parts.join(', ')} },`;
  };
  const body = Object.entries(layout)
    .map(([k, v]) => entry(k, v))
    .join('\n');
  return `export const ROOM_LAYOUT: Record<RoomLayoutKey, RoomLayoutItem> = {\n${body}\n};`;
}
