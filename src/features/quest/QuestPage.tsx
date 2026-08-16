// 퀘스트 목록. 완료한 퀘스트의 보상을 받으면 상점 포인트가 늘어난다.

import { useNavigate } from 'react-router-dom';
import { Badge, Card, ProgressBar } from '@/components/ui';
import { PageHeader } from '@/components/AppLayout';
import { PixelIcon } from '@/components/PixelIcon';
import { QUEST_CATALOG } from './quests';
import { useQuestStore } from '@/store/questStore';
import { useRoomStore } from '@/store/roomStore';

export default function QuestPage() {
  const navigate = useNavigate();
  const points = useRoomStore((s) => s.points);
  // counts·claimed를 구독해야 수령 후 화면이 갱신된다
  useQuestStore((s) => s.counts);
  useQuestStore((s) => s.claimed);
  const quest = useQuestStore();

  const claimable = quest.claimableCount();

  return (
    <div className="space-y-3">
      <PageHeader
        title="퀘스트"
        sub={claimable > 0 ? `받을 보상 ${claimable}개` : '그로미를 돌보면 자동으로 채워져요'}
        right={
          <Badge tone="muted">
            <PixelIcon name="coin" size={14} />
            {points.toLocaleString()} P
          </Badge>
        }
      />

      <ul className="space-y-3">
        {QUEST_CATALOG.map((q) => {
          const progress = quest.progressOf(q.id);
          const done = quest.isComplete(q.id);
          const claimed = quest.isClaimed(q.id);

          return (
            <li key={q.id}>
              <Card selected={done && !claimed}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-ink">{q.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-sub">
                      {q.description}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-primary">
                    <PixelIcon name="coin" size={14} />
                    {q.reward}
                  </span>
                </div>

                <ProgressBar value={(progress / q.goal) * 100} className="mt-3" height={14} />
                <p className="mt-1 text-right text-[11px] font-bold text-ink-sub">
                  {progress} / {q.goal}
                </p>

                {claimed ? (
                  <p className="mt-2 text-center text-[11px] font-bold text-ink-sub">보상 받음</p>
                ) : done ? (
                  <button
                    type="button"
                    className="btn-primary mt-2 w-full py-2 text-xs"
                    onClick={() => quest.claim(q.id)}
                  >
                    보상 받기
                  </button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <button type="button" className="btn-secondary w-full py-3 text-sm" onClick={() => navigate('/shop')}>
        <PixelIcon name="shop" size={20} /> 상점으로 가기
      </button>
    </div>
  );
}
