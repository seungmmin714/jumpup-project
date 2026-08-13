// T-02 — 업링크 재조립·파싱. 순수 함수/순수 상태만 사용한다 (BLE·DOM 의존 없음).
// §5.5 업링크 재조립 규칙 1~7을 그대로 구현한다.

import { RX_BUFFER_LIMIT } from './constants';
import type { AckCode, AckPacket, HelloPacket, Mood, ParseDrop, SensorPacket, Uplink } from './types';

export interface ParseResult {
  frames: Uplink[];
  drops: ParseDrop[];
}

/** ASCII only(§5.5). 128 이상 바이트는 U+FFFD로 바꿔 이후 검증에서 걸러지게 한다. */
export function decodeAscii(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : '�';
  return out;
}

const isAsciiPrintableLine = (s: string) => /^[\x20-\x7e]*$/.test(s);

/** 빈 문자열/공백은 결측(null). 숫자가 아니면 NaN을 반환해 호출부가 폐기하도록 한다. */
function parseNum(field: string | undefined): number | null | typeof NaN {
  if (field === undefined) return NaN;
  const t = field.trim();
  if (t === '') return null;
  if (!/^-?\d+$/.test(t)) return NaN;
  return Number(t);
}

/** 범위를 벗어난 값은 폐기가 아니라 null 처리한다(§13 "범위 이탈 값 → null"). */
const ranged = (v: number | null, lo: number, hi: number): number | null =>
  v === null ? null : v >= lo && v <= hi ? v : null;

export function parseSensorLine(fields: string[]): SensorPacket | ParseDrop['reason'] {
  // D,<soilRaw>,<tempX10>,<humi>,<lightRaw>,<mood>,<seq>
  if (fields.length !== 7) return 'field-count';

  const soilRaw = parseNum(fields[1]);
  const tempX10 = parseNum(fields[2]);
  const humi = parseNum(fields[3]);
  const lightRaw = parseNum(fields[4]);
  const mood = parseNum(fields[5]);
  const seq = parseNum(fields[6]);

  if (Number.isNaN(soilRaw) || Number.isNaN(tempX10) || Number.isNaN(humi) || Number.isNaN(lightRaw)) {
    return 'bad-number';
  }
  // mood·seq는 결측을 허용하지 않는다.
  if (mood === null || seq === null || Number.isNaN(mood) || Number.isNaN(seq)) return 'bad-number';
  if ((mood as number) < 0 || (mood as number) > 6) return 'bad-mood';
  if ((seq as number) < 0 || (seq as number) > 255) return 'bad-number';

  return {
    soilRaw: ranged(soilRaw as number | null, 0, 1023),
    tempX10: ranged(tempX10 as number | null, -400, 1000),
    humi: ranged(humi as number | null, 0, 100),
    lightRaw: ranged(lightRaw as number | null, 0, 1023),
    mood: mood as Mood,
    seq: seq as number,
  };
}

export function parseHelloLine(fields: string[]): HelloPacket | ParseDrop['reason'] {
  // H,GROWME,<protoVer>,<fwVer>
  if (fields.length !== 4) return 'field-count';
  const protoVer = parseNum(fields[2]);
  if (protoVer === null || Number.isNaN(protoVer)) return 'bad-number';
  const fwVer = (fields[3] ?? '').trim();
  if (fwVer === '') return 'field-count';
  return { protoVer: protoVer as number, fwVer };
}

const ACK_CODES: readonly string[] = ['F', 'L', 'S', 'Q', 'P', 'R', 'N', '?'];

export function parseAckLine(fields: string[]): AckPacket | ParseDrop['reason'] {
  // A,<cmd>,<result...>  — Q 응답은 결과가 여러 필드다: A,Q,708,578,150,300,500
  if (fields.length < 3) return 'field-count';
  const cmd = (fields[1] ?? '').trim();
  if (!ACK_CODES.includes(cmd)) return 'field-count';
  const result = fields
    .slice(2)
    .map((f) => f.trim())
    .join(',');
  if (result === '') return 'field-count';
  return { cmd: cmd as AckCode, result };
}

/** 한 줄(종결자 제거 후)을 프레임으로. 실패하면 폐기 사유를 돌려준다. */
export function parseLine(line: string): Uplink | ParseDrop {
  const raw = line.replace(/[\r\s]+$/g, '').replace(/^[\r\s]+/g, '');
  if (raw === '') return { reason: 'unknown-prefix', raw: line };
  if (!isAsciiPrintableLine(raw)) return { reason: 'unknown-prefix', raw };

  const head = raw[0];
  const fields = raw.split(',');

  if (head === 'D') {
    const r = parseSensorLine(fields);
    return typeof r === 'string' ? { reason: r, raw } : { kind: 'sensor', packet: r };
  }
  if (head === 'H') {
    const r = parseHelloLine(fields);
    return typeof r === 'string' ? { reason: r, raw } : { kind: 'hello', packet: r };
  }
  if (head === 'A') {
    const r = parseAckLine(fields);
    return typeof r === 'string' ? { reason: r, raw } : { kind: 'ack', packet: r };
  }
  return { reason: 'unknown-prefix', raw };
}

const isDrop = (v: Uplink | ParseDrop): v is ParseDrop => 'reason' in v;

/**
 * Notify 조각을 이어 붙였다가 `\n` 단위로 잘라 프레임을 만든다.
 * 연결 직후의 잘린 첫 라인은 규칙 4·5에 걸려 자연히 폐기된다.
 */
export class UplinkParser {
  private buffer = '';

  reset(): void {
    this.buffer = '';
  }

  get pending(): string {
    return this.buffer;
  }

  push(chunk: string | Uint8Array): ParseResult {
    const text = typeof chunk === 'string' ? chunk : decodeAscii(chunk);
    const frames: Uplink[] = [];
    const drops: ParseDrop[] = [];

    this.buffer += text;

    let nl = this.buffer.indexOf('\n');
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      const parsed = parseLine(line);
      if (isDrop(parsed)) {
        // 개행만 있는 빈 줄은 노이즈로 보고 카운트하지 않는다.
        if (parsed.raw.trim() !== '') drops.push(parsed);
      } else {
        frames.push(parsed);
      }
      nl = this.buffer.indexOf('\n');
    }

    // 규칙 6: 버퍼 256바이트 초과 → 비우고 손상 처리
    if (this.buffer.length > RX_BUFFER_LIMIT) {
      drops.push({ reason: 'buffer-overflow', raw: this.buffer.slice(0, 64) });
      this.buffer = '';
    }

    return { frames, drops };
  }
}

/** `A,Q,708,578,150,300,500` → 프로파일. 형식이 다르면 null. */
export function parseQueryAck(result: string): {
  soilDry: number;
  soilWet: number;
  tempMinX10: number;
  tempMaxX10: number;
  lightMin: number;
} | null {
  const parts = result.split(',').map((s) => s.trim());
  if (parts.length !== 5) return null;
  const nums = parts.map((p) => (/^-?\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  const [soilDry, soilWet, tempMinX10, tempMaxX10, lightMin] = nums as [
    number,
    number,
    number,
    number,
    number,
  ];
  return { soilDry, soilWet, tempMinX10, tempMaxX10, lightMin };
}

/** §5.6 seq 유실 계산. 0~255 순환을 고려한다. 중복(같은 seq)은 -1. */
export function seqGap(prev: number | null, next: number): number {
  if (prev === null) return 0;
  if (prev === next) return -1;
  return (next - prev + 256) % 256;
}
