// T-17 — mood 0 복귀 시 재생되는 핵심 보상 연출(§10.3).
// 캐릭터 자체는 PlantCharacter.tsx가 그린다.

import { useCharacterStore } from '@/store/characterStore';

export function CelebrationOverlay() {
  const { celebrating, celebrationText, bonusExp } = useCharacterStore();
  if (!celebrating) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-pop-in rounded-3xl bg-olive-700/95 px-8 py-6 text-center text-cream-50 shadow-2xl">
        <p className="text-3xl font-black">{celebrationText}</p>
        <p className="mt-1 text-sm opacity-90">그로미가 기운을 되찾았어요</p>
        {bonusExp > 0 ? (
          <p className="mt-2 inline-block rounded-full bg-cream-50/20 px-3 py-1 text-sm font-bold">
            +{bonusExp} EXP
          </p>
        ) : null}
      </div>

      <Confetti />
    </div>
  );
}

function Confetti() {
  const items = ['✨', '🌿', '💚', '✨', '🎉'];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((icon, i) => (
        <span
          key={`${icon}-${i}`}
          className="absolute bottom-1/3 animate-sparkle-up text-2xl"
          style={{ left: `${12 + i * 18}%`, animationDelay: `${i * 120}ms` }}
        >
          {icon}
        </span>
      ))}
    </div>
  );
}
