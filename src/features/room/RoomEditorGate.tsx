// 편집기 진입 관문.
//
//   개발 서버에서 ?roomEditor=true 일 때만 편집 UI를 띄운다.
//   프로덕션 빌드에서는 import.meta.env.DEV가 false라 아래 동적 import가
//   실행되지 않고, Vite가 해당 청크를 아예 만들지 않는다.

import { Suspense, lazy, useEffect, useState } from 'react';

/*
 * 삼항식을 모듈 최상단에 두어야 프로덕션에서 청크 자체가 안 만들어진다.
 * import.meta.env.DEV가 false로 치환되면 dynamic import가 도달 불가가 되어
 * Rollup이 통째로 지운다. 게이트 함수 안에서 검사하면 참조는 지워져도
 * 청크 파일은 남는다.
 */
const LazyEditor = import.meta.env.DEV ? lazy(() => import('./RoomLayoutEditor')) : null;

export function isRoomEditorRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('roomEditor') === 'true';
}

/** 편집기를 띄워야 하면 그 화면을, 아니면 null을 돌려준다 */
export function RoomEditorGate() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isRoomEditorRequested()), []);
  if (!on || !LazyEditor) return null;
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-bg">
      <Suspense fallback={<p className="p-6 text-sm text-ink-sub">편집기를 불러오는 중…</p>}>
        <LazyEditor />
      </Suspense>
    </div>
  );
}
