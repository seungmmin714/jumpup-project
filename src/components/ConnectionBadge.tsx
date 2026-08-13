import { useState } from 'react';
import { canUseBle, isIosLike, isMockMode } from '@/ble';
import { SUPPORTED_PROTO_VER } from '@/ble/constants';
import {
  BADGE,
  ERROR_MESSAGE,
  isLive,
  isProtoOk,
  useConnectionStore,
} from '@/store/connectionStore';
import { connectPot, disconnectPot } from '@/store/bleBridge';
import { useTelemetryStore } from '@/store/telemetryStore';
import { Badge, Banner } from './ui';
import { durationAgo } from '@/lib/format';

export function ConnectionBadge() {
  const conn = useConnectionStore();
  const source = useTelemetryStore((s) => s.source);
  const [busy, setBusy] = useState(false);
  const live = isLive(conn);

  const onConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await connectPot();
    } catch {
      /* 상태 머신이 ERROR로 표시한다 */
    } finally {
      setBusy(false);
    }
  };

  const badge = BADGE[conn.state];
  const stamp =
    !live && conn.lastPacketAt
      ? durationAgo(Date.now() - conn.lastPacketAt)
      : source === 'server'
        ? '마지막 확인'
        : null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone={badge.tone}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              live ? 'bg-olive-600' : conn.state === 'ERROR' ? 'bg-red-500' : 'bg-neutral-400'
            }`}
            aria-hidden
          />
          {badge.label}
        </Badge>
        <span className="truncate text-sm font-semibold text-olive-700">
          {conn.deviceName ?? (isMockMode() ? 'GROWME01 (시뮬)' : '화분 미연결')}
        </span>
        {stamp ? <span className="shrink-0 text-xs text-olive-400">{stamp}</span> : null}
      </div>

      {live ? (
        <button type="button" className="tap px-2 text-xs text-olive-500" onClick={() => void disconnectPot()}>
          연결 해제
        </button>
      ) : (
        <button
          type="button"
          className="tap rounded-lg bg-olive-600 px-3 py-1.5 text-xs font-bold text-cream-50 disabled:opacity-40"
          onClick={() => void onConnect()}
          disabled={busy || !canUseBle() || conn.state === 'REQUESTING' || conn.state === 'CONNECTING'}
        >
          {conn.state === 'CONNECTING' ? '연결 중…' : '화분 연결하기'}
        </button>
      )}
    </div>
  );
}

/** protoVer 불일치·미지원 브라우저·통신 불안정 배너를 한곳에서 처리한다. */
export function ConnectionBanners() {
  const conn = useConnectionStore();

  return (
    <div className="space-y-2">
      {!isProtoOk(conn) ? (
        <Banner tone="error" title="화분 펌웨어 업데이트가 필요해요">
          이 앱은 프로토콜 v{SUPPORTED_PROTO_VER}만 지원해요. 화분이 v{conn.protoVer}을 사용 중이라
          모든 제어가 잠겼어요.
        </Banner>
      ) : null}

      {!canUseBle() ? (
        <Banner tone="info" title={ERROR_MESSAGE.unsupported.title}>
          {isIosLike()
            ? '아이폰에서는 마지막으로 확인된 상태만 볼 수 있어요. 안드로이드 Chrome에서 연결해 주세요.'
            : ERROR_MESSAGE.unsupported.hint}
        </Banner>
      ) : null}

      {conn.state === 'ERROR' && conn.errorKind ? (
        <Banner tone="error" title={ERROR_MESSAGE[conn.errorKind].title}>
          {ERROR_MESSAGE[conn.errorKind].hint}
        </Banner>
      ) : null}

      {conn.unstable ? (
        <Banner tone="warn" title="통신이 불안정해요">
          화분을 가까이 두거나 전원을 확인해 주세요.
        </Banner>
      ) : null}
    </div>
  );
}
