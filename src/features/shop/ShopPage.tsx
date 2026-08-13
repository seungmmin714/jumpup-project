// 상점 — 방 꾸미기 아이템을 구매하고, 방에 넣고 빼는 곳.
//
// 구매하면 별도의 배치 화면 없이 ROOM_LAYOUT의 고정 위치에 즉시 나타난다.
// 사용자별 좌표는 저장하지 않는다 — 모두 같은 자리에 놓인다.

import { Badge, Card } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { PixelIcon } from '@/components/PixelIcon';
import { useCharacterStore } from '@/store/characterStore';
import { activePotId, usePotStore } from '@/store/potStore';
import { useRoomStore } from '@/store/roomStore';
import { SHOP_ORDER } from '@/features/room/roomCatalog';

/**
 * 해커톤 시연용 — 레벨 조건을 열어 둔다.
 * 처음 들어온 사람도 Lv.1이라 잠금이 걸려 있으면 방 꾸미기를 아예 못 본다.
 * 포인트 차감과 중복 구매 방지는 그대로 동작한다.
 * 레벨 제한을 되살리려면 이 값만 false로 바꾸면 된다.
 */
const UNLOCK_ALL_FOR_DEMO = true;

export default function ShopPage() {
  const level = useCharacterStore((s) => s.level);
  const potId = usePotStore(activePotId);
  const owned = useRoomStore((s) => s.owned[potId] ?? []);
  const placed = useRoomStore((s) => s.placed[potId] ?? []);
  const points = useRoomStore((s) => s.points);
  const purchase = useRoomStore((s) => s.purchase);
  const togglePlaced = useRoomStore((s) => s.togglePlaced);

  const effectiveLevel = UNLOCK_ALL_FOR_DEMO ? Number.MAX_SAFE_INTEGER : level;

  return (
    <div className="space-y-3">
      <PageHeader
        title="상점"
        right={
          <Badge tone="muted">
            <PixelIcon name="coin" size={14} />
            {points.toLocaleString()} P
          </Badge>
        }
      />

      <Card>
        <div className="flex items-center gap-4">
          <img src="/room/watering-can.png" alt="" aria-hidden className="pixel-art h-14 w-auto" />
          <div className="min-w-0">
            <p className="text-lg font-black text-ink">방을 꾸며보세요</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-sub">
              구매한 가구는 바로 방에 놓여요. 자리는 정해져 있어서 옮기지 않아도 돼요.
            </p>
          </div>
        </div>
      </Card>

      <ul className="grid grid-cols-2 gap-3">
        {SHOP_ORDER.map((item) => {
          const isOwned = owned.includes(item.id);
          const isPlaced = placed.includes(item.id);
          const unlocked = effectiveLevel >= item.requiredLevel;
          const affordable = points >= item.price;

          return (
            <li key={item.id}>
              <div className="card flex flex-col items-center gap-2 py-4">
                {/* 배치용 PNG를 그대로 쓰고 여백은 CSS로 준다 */}
                <div className="relative flex h-16 w-full items-center justify-center px-3">
                  <img
                    src={item.src}
                    alt=""
                    aria-hidden
                    className={`pixel-art max-h-16 w-auto max-w-full object-contain ${
                      unlocked || isOwned ? '' : 'grayscale opacity-60'
                    }`}
                  />
                  {!unlocked && !isOwned ? (
                    <span className="absolute right-0 top-0">
                      <PixelIcon name="lock" size={18} alt="잠김" />
                    </span>
                  ) : null}
                </div>

                <p className="text-sm font-bold text-ink">{item.name}</p>

                {isOwned ? (
                  <>
                    <p className="text-[11px] font-bold text-primary">
                      {isPlaced ? '배치됨' : '보유 중'}
                    </p>
                    <button
                      type="button"
                      className={`w-full py-2 text-xs ${isPlaced ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => togglePlaced(potId, item.id)}
                    >
                      {isPlaced ? '방에서 빼기' : '방에 놓기'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-1 text-[11px] font-bold text-ink-sub">
                      <PixelIcon name="coin" size={12} />
                      {item.price.toLocaleString()} P
                      {unlocked ? null : <span className="ml-1">· Lv.{item.requiredLevel}</span>}
                    </p>
                    <button
                      type="button"
                      className="btn-primary w-full py-2 text-xs"
                      disabled={!unlocked || !affordable}
                      onClick={() => purchase(potId, item.id, effectiveLevel)}
                    >
                      {!unlocked
                        ? `Lv.${item.requiredLevel} 필요`
                        : affordable
                          ? '구매하기'
                          : '포인트 부족'}
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="px-1 pb-1 text-center text-[11px] text-ink-sub">
        보유 {owned.length} · 방에 놓음 {placed.length}
      </p>
    </div>
  );
}
