// 상점 — 후순위(§15). 라우트와 탭 자리만 확보한다.

import { EmptyState, SectionTitle } from '@/components/ui';

export default function ShopPage() {
  return (
    <div className="space-y-3">
      <SectionTitle>상점</SectionTitle>
      <EmptyState
        icon="🛍️"
        title="준비 중이에요"
        hint="화분을 돌보며 모은 포인트로 아이템을 살 수 있게 될 거예요."
      />
    </div>
  );
}
