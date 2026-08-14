// BLE 모드 결정과 실기기 연결 진단.
//
// 우선순위: URL 쿼리(?ble=real|mock) > 저장된 설정 > 빌드 환경변수(VITE_BLE_MODE)
// 빌드를 다시 하지 않고도 실기기로 넘어갈 수 있어야 현장에서 확인이 가능하다.

export type BleMode = 'mock' | 'serial' | 'ble';

const STORAGE_KEY = 'growme.bleMode';

const asMode = (v: string | undefined): BleMode | null =>
  v === 'mock' || v === 'serial' || v === 'ble' ? v : v === 'real' ? 'ble' : null;

/** 미지정이면 ble (WEB-PRD 기준 경로) */
const ENV_MODE: BleMode = asMode(import.meta.env.VITE_BLE_MODE) ?? 'ble';

const readStored = (): BleMode | null => {
  try {
    return asMode(localStorage.getItem(STORAGE_KEY) ?? undefined);
  } catch {
    return null; // 사파리 프라이빗 모드 등
  }
};

const readQuery = (): BleMode | null => {
  if (typeof window === 'undefined') return null;
  return asMode(new URLSearchParams(window.location.search).get('ble') ?? undefined);
};

/** 이번 실행에서 사용할 모드 */
export function resolveBleMode(): BleMode {
  const q = readQuery();
  if (q) {
    // 쿼리로 들어온 선택은 다음 방문에도 유지한다
    try {
      localStorage.setItem(STORAGE_KEY, q);
    } catch {
      /* 저장 못 해도 이번 실행에는 적용된다 */
    }
    return q;
  }
  return readStored() ?? ENV_MODE;
}

/** 모드를 바꾼다. 클라이언트는 모듈 로드 시점에 한 번 만들어지므로 새로고침이 필요하다. */
export function setBleMode(mode: BleMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* 무시 */
  }
}

export function clearBleModeOverride(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}

export const envBleMode = (): BleMode => ENV_MODE;

// ───────── 실기기 연결 진단 ─────────

export type DiagnosticLevel = 'ok' | 'warn' | 'blocked';

export interface DiagnosticItem {
  key: 'context' | 'api' | 'platform' | 'mode';
  level: DiagnosticLevel;
  title: string;
  detail: string;
}

/**
 * Web Bluetooth는 **보안 컨텍스트(HTTPS 또는 localhost)** 에서만 동작한다.
 * 휴대폰에서 `http://192.168.x.x:5173` 으로 접속하면 navigator.bluetooth 자체가 없다 —
 * 실기기 연결이 안 되는 이유의 대부분이 이것이다.
 */
export function isSecureContextForBle(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === true;
}

export const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export function bleDiagnostics(mode: BleMode): DiagnosticItem[] {
  const items: DiagnosticItem[] = [];
  const secure = isSecureContextForBle();
  const hasApi = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChromium = /Chrome|Chromium|Edg/.test(ua) && !/OPR|SamsungBrowser/.test(ua);

  const MODE_TITLE: Record<BleMode, string> = {
    mock: '시뮬레이터 모드',
    serial: 'USB 시리얼 모드',
    ble: '블루투스 모드',
  };
  items.push({
    key: 'mode',
    level: mode === 'mock' ? 'warn' : 'ok',
    title: MODE_TITLE[mode],
    detail:
      mode === 'mock'
        ? '가짜 센서값으로 동작 중이에요. 실기기에 붙이려면 모드를 바꿔주세요.'
        : mode === 'serial'
          ? 'USB로 연결한 아두이노를 찾습니다. PC 크롬에서만 됩니다.'
          : '실제 GROWME 화분을 블루투스로 찾습니다.',
  });

  items.push({
    key: 'context',
    level: secure ? 'ok' : 'blocked',
    title: secure ? '보안 연결 확인됨' : 'HTTPS가 아니라 블루투스를 쓸 수 없어요',
    detail: secure
      ? isLocalhost()
        ? 'localhost는 보안 컨텍스트로 인정돼요.'
        : 'HTTPS로 접속돼 있어요.'
      : '휴대폰에서 http://로 접속하면 브라우저가 블루투스를 막아요. HTTPS로 열거나 USB 포트 포워딩을 쓰세요.',
  });

  const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
  const apiOk = mode === 'serial' ? hasSerial : hasApi;
  items.push({
    key: 'api',
    level: apiOk ? 'ok' : 'blocked',
    title: apiOk
      ? mode === 'serial'
        ? 'Web Serial 사용 가능'
        : 'Web Bluetooth 사용 가능'
      : mode === 'serial'
        ? 'Web Serial을 지원하지 않는 브라우저예요'
        : 'Web Bluetooth를 지원하지 않는 브라우저예요',
    detail: apiOk
      ? mode === 'serial'
        ? 'navigator.serial이 있습니다.'
        : 'navigator.bluetooth가 있습니다.'
      : mode === 'serial'
        ? 'PC 크롬에서 USB로 연결해 주세요. 모바일 크롬은 Web Serial을 지원하지 않아요.'
        : isIos
          ? 'iOS Safari·Chrome은 Web Bluetooth를 지원하지 않아요. 조회 전용으로만 쓸 수 있어요.'
          : '안드로이드 Chrome 100 이상에서 열어주세요.',
  });

  items.push({
    key: 'platform',
    level: isAndroid && isChromium ? 'ok' : isIos ? 'blocked' : 'warn',
    title: isAndroid && isChromium ? '안드로이드 Chrome' : isIos ? 'iOS' : '데스크톱 브라우저',
    detail:
      isAndroid && isChromium
        ? '권장 환경이에요.'
        : isIos
          ? '아이폰에서는 마지막 상태 조회만 가능해요.'
          : '데스크톱 Chrome에서도 연결은 되지만, 실제 사용 환경은 안드로이드예요.',
  });

  return items;
}

/** 하나라도 blocked면 실기기 연결을 시도할 수 없다. */
export const isBleConnectable = (mode: BleMode): boolean =>
  mode === 'mock' || bleDiagnostics(mode).every((d) => d.key === 'platform' || d.level !== 'blocked');
