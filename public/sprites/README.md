# 도트 스프라이트

`assets-source/sprites/`의 시트를 잘라 만든 개별 PNG. **손으로 넣지 않는다.**

```bash
npm run prep:sprites
```

| 원본 | 격자 | 결과 |
|---|---|---|
| `icons.png` | 4×4 | `home` `journal` `catalog` `shop` / `drop` `sun` `drop-plus` `bulb` / `thermometer` `coin` `backpack` `gift` / `link` `lock` `sprout` `watering-can` |
| `shop-items.png` | 4×2 | `item-shelf` `item-watering-can` `item-rug` `item-window` / `item-hanging-plant` `item-frame` `item-basket` `item-gift-box` |
| `room.png` | — | 자르지 않고 폭 900px로 축소만 |

시트에 아이콘을 추가하려면 `scripts/slice-sprites.mjs`의 `SHEETS[].names`에
**행 우선(왼→오른, 위→아래)** 순서로 이름을 넣는다. 이름이 곧 파일명이자
`PixelIcon`의 `name` 값이다.

## 스크립트가 하는 일

1. **배경 제거** — 시트 배경이 흰색이고 알파가 꽉 차 있어서 그냥 자르면
   아이콘마다 흰 사각형이 붙는다. 테두리에서 흰색을 따라 들어가며 지운다.
2. **밴드 검출** — 시트가 정확한 격자가 아니라, 균등 분할하면 옆 아이콘이
   걸쳐 들어온다. 알파 투영으로 내용이 있는 구간을 찾아 실제 셀을 잡는다.
   한 아이콘이 세로로 길어 밴드가 쪼개지면(행잉 플랜트 덩굴) 간격이 가장 좁은
   이웃끼리 합쳐 기대 개수를 맞춘다.
3. **정사각 정렬 + 축소** — 아이콘 128px, 상점 아이템 192px.

## 코드에서 쓰기

```tsx
import { PixelIcon, ShopItemImage } from '@/components/PixelIcon';

<PixelIcon name="drop" size={22} />          // 장식
<PixelIcon name="lock" size={18} alt="잠김" /> // 의미가 있으면 alt를 준다
<ShopItemImage name="rug" size={72} />
```

전부 `image-rendering: pixelated`로 그려진다.
