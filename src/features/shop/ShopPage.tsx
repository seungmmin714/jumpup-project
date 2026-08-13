// 상점 — 후순위(§15). 포인트 시스템이 아직 없으므로 화면 구조만 시안대로 세워 두고,
// 실제 값은 지금 있는 것(캐릭터 레벨)만 쓴다. 없는 재화를 지어내지 않는다.

import { Badge, Card } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { PixelIcon, ShopItemImage, type ShopItemIcon } from '@/components/PixelIcon';
import { useCharacterStore } from '@/store/characterStore';

interface ShopItem {
  id: ShopItemIcon;
  name: string;
  /** 해금에 필요한 레벨 */
  requiredLevel: number;
}

/** 방 꾸미기 아이템 미리보기. 아직 구매 기능은 없다. */
const ITEMS: ShopItem[] = [
  { id: 'shelf', name: '나무 선반', requiredLevel: 5 },
  { id: 'watering-can', name: '물뿌리개', requiredLevel: 5 },
  { id: 'rug', name: '동그란 러그', requiredLevel: 10 },
  { id: 'window', name: '창문', requiredLevel: 15 },
  { id: 'hanging-plant', name: '행잉 플랜트', requiredLevel: 20 },
  { id: 'frame', name: '액자', requiredLevel: 25 },
];

export default function ShopPage() {
  const level = useCharacterStore((s) => s.level);

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
            <p className="text-lg font-black text-ink">준비 중이에요</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-sub">
              화분을 돌보며 모은 포인트로 아이템을 살 수 있게 될 거예요.
            </p>
          </div>
        </div>
      </Card>

      <p className="px-1 pt-1 text-[11px] font-bold text-ink-sub">준비 중인 아이템</p>

      <ul className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => {
          const unlocked = level >= item.requiredLevel;
          return (
            <li key={item.id}>
              <div
                className={`card relative flex flex-col items-center gap-2 py-5 ${
                  unlocked ? '' : 'opacity-70'
                }`}
              >
                {!unlocked ? (
                  <span className="absolute right-3 top-3">
                    <PixelIcon name="lock" size={18} alt="잠김" />
                  </span>
                ) : null}
                <ShopItemImage name={item.id} size={72} className={unlocked ? '' : 'grayscale'} />
                <p className="text-sm font-bold text-ink">{item.name}</p>
                <p className="text-[11px] font-bold text-ink-sub">
                  {unlocked ? '준비 중' : `Lv.${item.requiredLevel} 필요`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
