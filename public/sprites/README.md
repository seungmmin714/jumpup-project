# 도트 스프라이트

`assets-source/sprites/`의 시트를 잘라 만든 개별 PNG. **손으로 넣지 않는다.**

```bash
npm run prep:sprites
```

| 원본 | 격자 | 결과 |
|---|---|---|
| `icons.png` | 4×4 | `home` `journal` `catalog` `shop` / `drop` `sun` `drop-plus` `bulb` / `thermometer` `coin` `backpack` `gift` / `link` `lock` `sprout` `watering-can` |
| `happiness-faces.png` | 5×1 | `happiness-0`(울음) ~ `happiness-4`(활짝) — 숫자가 곧 단계 |
| `effects.png` | 4×3 | `fan` `wind` `bulb-bright` `splash` / `fire` `snow` `zzz` `question` / `face-happy` `face-sad` `berry` `link-green` |
| `shop-items.png` | 4×2 | `item-shelf` `item-watering-can` `item-rug` `item-window` / `item-hanging-plant` `item-frame` `item-basket` `item-gift-box` |
| `buttons.png` | 좌표 지정 | `btn-primary` `btn-secondary` `bar-empty` (나머지 칸은 만들지 않음) |
| `room.png` | — | 자르지 않고 폭 900px로 축소만 |

## 스크립트가 하는 일

1. **배경 제거** — 시트 배경이 흰색이고 알파가 꽉 차 있어서 그냥 자르면
   아이콘마다 흰 사각형이 붙는다. 테두리에서 흰색을 따라 들어가며 지운다.
   이때 **합성을 역산해 원래 색을 복원한다**(`unpremultiply`). 알파만 깎고
   색을 두면 가장자리에 흰 테두리가 남아 초록 버튼 위에서 특히 도드라진다.
2. **셀 찾기** — 세 가지 방식을 시트에 따라 골라 쓴다.
   - 기본: 알파 투영으로 내용이 있는 구간(밴드)을 찾아 실제 셀을 잡는다.
     한 아이콘이 세로로 길어 밴드가 쪼개지면 간격이 가장 좁은 이웃끼리 합친다.
   - `rects`: 좌표를 직접 지정. 버튼 시트는 가로로 길고 옅은 그림자가 칸을
     이어버려 자동 검출이 전부 어긋나서, 연결 요소로 측정한 좌표를 박아 뒀다.
3. **정렬 + 축소** — 아이콘 128px, 상점 아이템 192px, 버튼은 원본 크기 유지
   (9-슬라이스로 늘려 쓰므로 줄이면 모서리가 뭉개진다).

시트에 아이콘을 추가하려면 `SHEETS[].names`에 **행 우선** 순서로 이름을 넣는다.
이름이 곧 파일명이자 `PixelIcon`의 `name` 값이다.

## 코드에서 쓰기

```tsx
import { PixelIcon, ShopItemImage } from '@/components/PixelIcon';

<PixelIcon name="drop" size={22} />          // 장식
<PixelIcon name="lock" size={18} alt="잠김" /> // 의미가 있으면 alt를 준다
<ShopItemImage name="rug" size={72} />
```

버튼은 CSS에서 9-슬라이스로 쓴다 (`.btn-primary` / `.btn-secondary`).
전부 `image-rendering: pixelated`로 그려진다.

## 바 스프라이트에서 쓰는 것은 빈 프레임뿐

눈금·채움·숫자가 박힌 칸(`bar-soil` `bar-slider` `bar-progress`)은 **만들지 않는다.**
식물마다 목표 구간이 다르고(방울토마토 45~65%, 다육 15~35%) 값에 따라 채움이
늘어나야 해서 고정 그림으로는 맞출 수 없다.

쓰는 건 빈 트랙 `bar-empty` 하나뿐이고, `.pixel-track`이 이걸 9-슬라이스로 두른다.
그 안의 구간·채움·마커·숫자는 전부 CSS와 HTML이다.

```html
<div class="pixel-track" style="height:30px">
  <span style="width:45%"></span>  <!-- 건조 -->
  <span style="width:20%"></span>  <!-- 목표 구간 -->
  <span style="width:35%"></span>  <!-- 과습 -->
</div>
```

`btn-inventory` `btn-event`도 아이콘이 그림에 포함돼 코드가 그리는 아이콘과
겹치므로 만들지 않는다. 두 버튼은 `btn-secondary` 위에 아이콘을 얹는다.
