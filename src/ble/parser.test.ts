import { describe, expect, it } from 'vitest';
import { UplinkParser, parseQueryAck, seqGap } from './parser';
import type { SensorPacket } from './types';

const sensorOf = (p: ReturnType<UplinkParser['push']>['frames'][number]): SensorPacket => {
  if (p.kind !== 'sensor') throw new Error(`expected sensor, got ${p.kind}`);
  return p.packet;
};

describe('T-02 업링크 재조립·파싱 (DoD 5케이스)', () => {
  it('① 정상: D / H / A 세 종류를 한 번에 파싱', () => {
    const p = new UplinkParser();
    const { frames, drops } = p.push('D,612,235,55,780,0,7\nH,GROWME,3,2.0\nA,F,OK\n');

    expect(drops).toHaveLength(0);
    expect(frames).toHaveLength(3);

    expect(sensorOf(frames[0]!)).toEqual({
      soilRaw: 612,
      tempX10: 235,
      humi: 55,
      lightRaw: 780,
      mood: 0,
      seq: 7,
    });
    expect(frames[1]).toEqual({ kind: 'hello', packet: { protoVer: 3, fwVer: '2.0' } });
    expect(frames[2]).toEqual({ kind: 'ack', packet: { cmd: 'F', result: 'OK' } });
  });

  it('② 분할: 20바이트 청크로 쪼개 들어와도 재조립된다', () => {
    const p = new UplinkParser();
    const line = 'D,612,235,55,780,0,7\nD,613,236,54,781,0,8\n';
    const frames = [];
    for (let i = 0; i < line.length; i += 7) {
      frames.push(...p.push(line.slice(i, i + 7)).frames);
    }
    expect(frames).toHaveLength(2);
    expect(sensorOf(frames[0]!).seq).toBe(7);
    expect(sensorOf(frames[1]!).seq).toBe(8);
    expect(p.pending).toBe('');
  });

  it('②-b CR 제거 및 미완성 라인 보류', () => {
    const p = new UplinkParser();
    const a = p.push('D,612,235,55,780,0,7\r\nD,613,');
    expect(a.frames).toHaveLength(1);
    expect(a.drops).toHaveLength(0);
    expect(p.pending).toBe('D,613,');

    const b = p.push('236,54,781,0,8\r\n');
    expect(b.frames).toHaveLength(1);
    expect(sensorOf(b.frames[0]!).tempX10).toBe(236);
  });

  it('③ 결측: 빈 필드는 null, 범위 이탈도 null', () => {
    const p = new UplinkParser();
    const { frames, drops } = p.push('D,612,,,780,6,8\nD,9999,235,255,-5,0,9\n');
    expect(drops).toHaveLength(0);

    expect(sensorOf(frames[0]!)).toEqual({
      soilRaw: 612,
      tempX10: null,
      humi: null,
      lightRaw: 780,
      mood: 6,
      seq: 8,
    });
    // 범위 이탈 값은 폐기가 아니라 null (§13)
    expect(sensorOf(frames[1]!)).toEqual({
      soilRaw: null,
      tempX10: 235,
      humi: null,
      lightRaw: null,
      mood: 0,
      seq: 9,
    });
  });

  it('④ 손상: 알 수 없는 접두어·필드 수 불일치·mood 범위 초과는 폐기', () => {
    const p = new UplinkParser();
    const { frames, drops } = p.push(
      ['X,1,2,3', 'D,612,235,55,780', 'D,612,235,55,780,9,7', 'D,a,235,55,780,0,7', 'A,F'].join(
        '\n',
      ) + '\n',
    );
    expect(frames).toHaveLength(0);
    expect(drops.map((d) => d.reason)).toEqual([
      'unknown-prefix',
      'field-count',
      'bad-mood',
      'bad-number',
      'field-count',
    ]);
  });

  it('④-b 연결 직후 잘린 첫 라인은 폐기되고 이후는 정상 동작', () => {
    const p = new UplinkParser();
    const { frames, drops } = p.push('35,55,780,0,6\nD,612,235,55,780,0,7\n');
    expect(drops).toHaveLength(1);
    expect(frames).toHaveLength(1);
    expect(sensorOf(frames[0]!).seq).toBe(7);
  });

  it('⑤ 버퍼 초과: 256바이트 넘으면 비우고 손상 처리', () => {
    const p = new UplinkParser();
    const { frames, drops } = p.push('D'.repeat(300)); // 개행 없음
    expect(frames).toHaveLength(0);
    expect(drops).toHaveLength(1);
    expect(drops[0]!.reason).toBe('buffer-overflow');
    expect(p.pending).toBe('');

    // 비운 뒤에도 정상 수신이 이어져야 한다
    expect(p.push('D,612,235,55,780,0,7\n').frames).toHaveLength(1);
  });
});

describe('A,Q 프로파일 응답', () => {
  it('Q 응답은 결과 필드가 여러 개여도 파싱된다', () => {
    const p = new UplinkParser();
    const { frames } = p.push('A,Q,708,578,150,300,500\n');
    expect(frames[0]).toEqual({ kind: 'ack', packet: { cmd: 'Q', result: '708,578,150,300,500' } });
    expect(parseQueryAck('708,578,150,300,500')).toEqual({
      soilDry: 708,
      soilWet: 578,
      tempMinX10: 150,
      tempMaxX10: 300,
      lightMin: 500,
    });
  });

  it('형식이 다르면 null', () => {
    expect(parseQueryAck('708,578,150')).toBeNull();
    expect(parseQueryAck('OK')).toBeNull();
  });

  it('에러 응답도 그대로 전달', () => {
    const p = new UplinkParser();
    const { frames } = p.push('A,S,ERR:RANGE\nA,?,ERR:CMD\n');
    expect(frames).toEqual([
      { kind: 'ack', packet: { cmd: 'S', result: 'ERR:RANGE' } },
      { kind: 'ack', packet: { cmd: '?', result: 'ERR:CMD' } },
    ]);
  });
});

describe('seq 유실 계산 (0~255 순환)', () => {
  it('연속·건너뜀·중복·랩어라운드', () => {
    expect(seqGap(null, 7)).toBe(0);
    expect(seqGap(7, 8)).toBe(1);
    expect(seqGap(7, 10)).toBe(3);
    expect(seqGap(7, 7)).toBe(-1);
    expect(seqGap(255, 0)).toBe(1);
    expect(seqGap(254, 2)).toBe(4);
  });
});
