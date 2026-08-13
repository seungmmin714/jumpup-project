// 실기기 전환 + 연결 진단.
// 실기기에 처음 붙일 때 막히는 지점(HTTPS·브라우저·모드)을 한 화면에서 알려준다.

import { useState } from 'react';
import {
  activeBleMode,
  bleDiagnostics,
  clearBleModeOverride,
  envBleMode,
  isLocalhost,
  setBleMode,
  type DiagnosticLevel,
} from '@/ble';
import { Card } from '@/components/ui';

const ICON: Record<DiagnosticLevel, string> = { ok: '✅', warn: '⚠️', blocked: '⛔' };

export function BleModeCard() {
  const mode = activeBleMode();
  const [open, setOpen] = useState(false);
  const items = bleDiagnostics(mode);
  const blocked = items.filter((d) => d.level === 'blocked' && d.key !== 'platform');

  const switchTo = (next: 'mock' | 'real') => {
    setBleMode(next);
    // 클라이언트는 모듈 로드 때 한 번 만들어지므로 새로고침으로 갈아끼운다.
    window.location.reload();
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-olive-800">
            {mode === 'mock' ? '🧪 시뮬레이터 모드' : '📡 실기기 모드'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-olive-500">
            {mode === 'mock'
              ? '화분 없이 가짜 센서값으로 돌고 있어요. 진짜 화분에 붙이려면 전환하세요.'
              : blocked.length > 0
                ? '지금 환경에서는 블루투스를 쓸 수 없어요. 아래를 확인해 주세요.'
                : '실제 GROWME 화분을 찾습니다. 화분 전원을 켜고 연결하기를 눌러주세요.'}
          </p>
        </div>
        <button
          type="button"
          className="tap shrink-0 rounded-lg bg-olive-100 px-3 py-2 text-xs font-bold text-olive-800"
          onClick={() => switchTo(mode === 'mock' ? 'real' : 'mock')}
        >
          {mode === 'mock' ? '실기기로' : '시뮬로'}
        </button>
      </div>

      {mode === 'real' && blocked.length > 0 ? (
        <div className="mt-3 space-y-2">
          {blocked.map((d) => (
            <div key={d.key} className="rounded-xl bg-red-50 px-3 py-2 ring-1 ring-red-200">
              <p className="text-xs font-bold text-red-900">
                {ICON[d.level]} {d.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-red-800">{d.detail}</p>
            </div>
          ))}
          {blocked.some((d) => d.key === 'context') ? <HttpsHelp /> : null}
        </div>
      ) : null}

      <button
        type="button"
        className="tap mt-2 text-[11px] font-semibold text-olive-400"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '진단 접기' : '연결 진단 보기'}
      </button>

      {open ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((d) => (
            <li key={d.key} className="flex gap-2 text-[11px] leading-relaxed">
              <span aria-hidden>{ICON[d.level]}</span>
              <span>
                <b className="text-olive-800">{d.title}</b>
                <span className="ml-1 text-olive-500">{d.detail}</span>
              </span>
            </li>
          ))}
          <li className="pt-1 text-[10px] text-olive-400">
            빌드 기본값 <code>VITE_BLE_MODE={envBleMode()}</code>
            {envBleMode() !== mode ? (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  clearBleModeOverride();
                  window.location.reload();
                }}
              >
                기본값으로 되돌리기
              </button>
            ) : null}
          </li>
        </ul>
      ) : null}
    </Card>
  );
}

/** HTTPS가 아니어서 막힌 경우의 해결 경로 안내 */
function HttpsHelp() {
  const host = typeof window === 'undefined' ? '' : window.location.host;
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-olive-700 ring-1 ring-olive-200">
      <p className="font-bold text-olive-800">해결 방법 (하나만 골라도 돼요)</p>
      <ol className="mt-1 list-decimal space-y-1 pl-4">
        <li>
          <b>HTTPS로 띄우기</b> — 개발 PC에서 <code>npm run dev:https</code> 실행 후 휴대폰에서{' '}
          <code>https://</code> 주소로 접속. 인증서 경고는 &ldquo;고급 → 계속&rdquo;으로 넘어가면 돼요.
        </li>
        <li>
          <b>USB 포트 포워딩</b> — 휴대폰을 USB로 연결하고 PC Chrome에서{' '}
          <code>chrome://inspect/#devices</code> → Port forwarding에 <code>5173 → localhost:5173</code>{' '}
          등록. 휴대폰에서 <code>http://localhost:5173</code>으로 열면 보안 컨텍스트로 인정돼요.
        </li>
        {!isLocalhost() ? (
          <li>
            <b>임시 허용</b> — 휴대폰 Chrome에서{' '}
            <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>에{' '}
            <code>http://{host}</code>를 추가.
          </li>
        ) : null}
      </ol>
    </div>
  );
}
