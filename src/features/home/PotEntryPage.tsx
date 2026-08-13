// T-14 — QR 딥링크 `/p/:potId`. 해당 화분을 선택한 뒤 홈으로 보낸다.

import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { usePotStore } from '@/store/potStore';

const VALID = /^growme\d{2}$/i;

export default function PotEntryPage() {
  const { potId } = useParams<{ potId: string }>();
  const addPot = usePotStore((s) => s.addPot);
  const id = (potId ?? '').trim().toLowerCase();
  const ok = VALID.test(id);

  useEffect(() => {
    if (ok) addPot(id, id.toUpperCase());
  }, [ok, id, addPot]);

  if (!ok) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>
          🔍
        </span>
        <p className="font-bold text-ink">알 수 없는 화분이에요</p>
        <p className="text-xs text-ink-sub">
          QR 주소가 올바른지 확인해 주세요. (예: /p/growme01)
        </p>
        <a className="btn-primary mt-2" href="/">
          홈으로
        </a>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
