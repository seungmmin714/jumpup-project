import { describe, expect, it } from 'vitest';
import { HAPPINESS_LABEL, happinessFace } from './PixelIcon';

describe('행복도 → 표정', () => {
  it('20%씩 5단계로 나눈다', () => {
    expect(happinessFace(0)).toBe('happiness-0'); // 울음
    expect(happinessFace(19)).toBe('happiness-0');
    expect(happinessFace(20)).toBe('happiness-1'); // 슬픔
    expect(happinessFace(40)).toBe('happiness-2'); // 보통
    expect(happinessFace(60)).toBe('happiness-3'); // 미소
    expect(happinessFace(80)).toBe('happiness-4'); // 활짝
    expect(happinessFace(100)).toBe('happiness-4');
  });

  it('범위를 벗어난 값도 단계 안에 가둔다', () => {
    expect(happinessFace(-10)).toBe('happiness-0');
    expect(happinessFace(999)).toBe('happiness-4');
  });

  it('단계마다 대체 텍스트가 있다', () => {
    expect(HAPPINESS_LABEL).toHaveLength(5);
    for (const label of HAPPINESS_LABEL) expect(label.length).toBeGreaterThan(0);
  });
});
