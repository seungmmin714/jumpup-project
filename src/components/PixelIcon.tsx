// 도트 아이콘. public/sprites 의 개별 PNG를 그린다.
// 시트를 배경 스프라이트로 쓰지 않는 이유는 scripts/slice-sprites.mjs 주석 참고.

export type IconName =
  | 'home'
  | 'journal'
  | 'catalog'
  | 'shop'
  | 'drop'
  | 'sun'
  | 'drop-plus'
  | 'bulb'
  | 'thermometer'
  | 'coin'
  | 'backpack'
  | 'gift'
  | 'link'
  | 'lock'
  | 'sprout'
  | 'watering-can';

export type ShopItemIcon =
  | 'shelf'
  | 'watering-can'
  | 'rug'
  | 'window'
  | 'hanging-plant'
  | 'frame'
  | 'basket'
  | 'gift-box';

interface Props {
  name: IconName;
  /** px 단위. 도트가 뭉개지지 않도록 짝수로 준다. */
  size?: number;
  className?: string;
  /** 의미를 갖는 아이콘이면 대체 텍스트를 준다. 없으면 장식으로 처리한다. */
  alt?: string;
}

export function PixelIcon({ name, size = 20, className = '', alt }: Props) {
  return (
    <img
      src={`/sprites/${name}.png`}
      width={size}
      height={size}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      className={`pixelated inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export function ShopItemImage({
  name,
  size = 72,
  className = '',
}: {
  name: ShopItemIcon;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`/sprites/item-${name}.png`}
      alt=""
      aria-hidden
      className={`pixelated select-none ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
