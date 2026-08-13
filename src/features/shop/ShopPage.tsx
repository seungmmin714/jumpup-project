// 상점 — 방 꾸미기 아이템을 구매하고, 방에 넣고 빼는 곳.
//
// 구매하면 별도의 배치 과정 없이 즉시 방에 나타난다.
// 위치는 아이템마다 정해져 있어 사용자가 옮기지 않는다(src/data/roomItems.ts).
// 구매·배치 상태는 화분별로 저장되어 새로고침 후에도 남는다.

import { Badge, Card } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { PixelIcon, ShopItemImage, type ShopItemIcon } from '@/components/PixelIcon';
import { useCharacterStore } from '@/store/characterStore';
import { usePotStore } from '@/store/potStore';
import { useRoomStore } from '@/store/roomStore';
import { ROOM_ITEMS } from '@/data/roomItems';

export default function ShopPage() {
  const level = useCharacterStore((s) => s.level);
  const potId = usePotStore((s) => s.selectedPotId);
  const owned = useRoomStore((s) => (potId ? (s.owned[potId] ?? []) : []));
  const placed = useRoomStore((s) => (potId ? (s.placed[potId] ?? []) : []));
  const purchase = useRoomStore((s) => s.purchase);
  const togglePlaced = useRoomStore((s) => s.togglePlaced);

  return (
    <div className="space-y-3">
      <PageHeader
        title="상점"
        right={
          <Badge tone="muted">
            <PixelIcon name="coin" size={14} />
            Lv.{level}
          </Badge>
        }
      />

      <Card>
        <div className="flex items-center gap-4">
          <ShopItemImage name="gift-box" size={56} />
          <div className="min-w-0">
            <p className="text-lg font-black text-ink">방을 꾸며보세요</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-sub">
              구매한 가구는 바로 방에 놓여요. 자리는 정해져 있어서 옮기지 않아도 돼요.
            </p>
          </div>
        </div>
      </Card>

      {!potId ? (
        <Card>
          <p className="text-sm font-bold text-ink">먼저 화분을 선택해 주세요</p>
          <p className="mt-1 text-xs text-ink-sub">화분마다 방을 따로 꾸밀 수 있어요.</p>
        </Card>
      ) : null}

      <ul className="grid grid-cols-2 gap-3">
        {ROOM_ITEMS.map((item) => {
          const unlocked = level >= item.requiredLevel;
          const isOwned = owned.includes(item.id);
          const isPlaced = placed.includes(item.id);
          const canAct = potId !== null && (isOwned || unlocked);

          return (
            <li key={item.id}>
              <div className={`card flex flex-col items-center gap-2 py-4 ${isOwned ? '' : 'opacity-80'}`}>
                <div className="relative">
                  <ShopItemImage
                    name={item.id as ShopItemIcon}
                    size={64}
                    className={unlocked || isOwned ? '' : 'grayscale'}
                  />
                  {!unlocked && !isOwned ? (
                    <span className="absolute -right-1 -top-1">
                      <PixelIcon name="lock" size={18} alt="잠김" />
                    </span>
                  ) : null}
                </div>

                <p className="text-sm font-bold text-ink">{item.name}</p>

                {isOwned ? (
                  <button
                    type="button"
                    className={`w-full py-2 text-xs ${isPlaced ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => potId && togglePlaced(potId, item.id)}
                  >
                    {isPlaced ? '방에서 빼기' : '방에 놓기'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary w-full py-2 text-xs"
                    disabled={!canAct}
                    onClick={() => potId && purchase(potId, item.id)}
                  >
                    {unlocked ? '구매하기' : `Lv.${item.requiredLevel} 필요`}
                  </button>
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
