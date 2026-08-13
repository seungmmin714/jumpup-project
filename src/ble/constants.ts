// §5.1 GATT — 변경 금지
export const GATT_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const GATT_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

/** 장치명: GROWME01 ~ GROWME99 */
export const DEVICE_NAME_PREFIX = 'GROWME';

/** 이 웹 클라이언트가 지원하는 유일한 프로토콜 버전 */
export const SUPPORTED_PROTO_VER = 3;

// §5.5 프레이밍
export const LINE_TERMINATOR = '\n';
export const FIELD_SEPARATOR = ',';
export const MAX_LINE_BYTES = 40;
export const BLE_CHUNK_BYTES = 20;
export const RX_BUFFER_LIMIT = 256;
export const CHUNK_INTERVAL_MS = 20;

// §5.6 전송 주기 / §7 연결 규칙
export const SENSOR_PERIOD_MS = 5_000;
export const SENSOR_FAST_PERIOD_MS = 1_000;
export const HEARTBEAT_PERIOD_MS = 60_000;
/** 15초간 D 패킷 무수신 → STALE */
export const STALE_TIMEOUT_MS = 15_000;
/** 웹은 초당 1회만 렌더링 */
export const RENDER_THROTTLE_MS = 1_000;

/** 재연결: 1초 → 2초 → 4초, 최대 3회 */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000] as const;

/** §5.3 R:1은 화분이 3분 후 자동 해제 */
export const FAST_SAMPLING_MAX_MS = 3 * 60_000;

// §13 손상 패킷: 5분 내 20건 초과 시 "통신이 불안정해요"
export const CORRUPT_WINDOW_MS = 5 * 60_000;
export const CORRUPT_THRESHOLD = 20;

/** §9.2 같은 필드 3회 연속 결측이면 경고 아이콘 */
export const MISSING_WARN_COUNT = 3;

// §5.3 명령 생성기 — 개행은 send()가 붙인다
export const cmdFan = (on: boolean) => `F:${on ? 1 : 0}`;
export const cmdLed = (pct: number) => `L:${Math.round(clamp(pct, 0, 100))}`;
export const cmdQuery = () => 'Q';
export const cmdPing = () => 'P';
export const cmdFastSampling = (on: boolean) => `R:${on ? 1 : 0}`;
export const cmdSetProfile = (p: {
  soilDry: number;
  soilWet: number;
  tempMinX10: number;
  tempMaxX10: number;
  lightMin: number;
}) => `S:${p.soilDry},${p.soilWet},${p.tempMinX10},${p.tempMaxX10},${p.lightMin}`;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
