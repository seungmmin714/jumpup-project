# 캐릭터 이미지

식물별 캐릭터 아트를 이 폴더에 아래 파일명 그대로 넣는다.
`src/data/plants.ts`의 `characterImage` 경로와 1:1로 맞물린다.

| 파일명 | 식물 | plantId |
|---|---|---|
| `tomato-cherry.png` | 방울토마토 | `tomato-cherry` |
| `basil.png` | 바질 | `basil` |
| `lettuce.png` | 상추 | `lettuce` |
| `monstera.png` | 몬스테라 | `monstera` |
| `succulent.png` | 다육식물 | `succulent` |

> ⚠️ 파일명은 **`basil.png`처럼 이름만** 쓴다. 저장 대화상자에 `public/characters/basil.png`처럼
> 경로를 통째로 입력하면 macOS가 `/`를 `:`로 바꿔 `public:characters:basil.png`라는
> **한 개의 파일**을 만들어 버린다. 그러면 브라우저가 404를 받고 텍스트 표정으로 대체된다.

## 규격

- **정사각형에 가까운 세로 비율**(2:3까지 허용). 화면에서 `object-contain`으로 들어간다.
- **배경은 투명(PNG)** 이 가장 좋다. 크림색 배경이 깔린 이미지도 씬 배경과 톤이 비슷해 무난하다.
- 화면에서는 세로 208px로 그려진다. 짧은 변 기준 **340px 이상**이면 3배 화면에서도 선명하다.
  파일당 250KB를 넘기지 않는다 — 5장이 한 번에 로딩되므로 원본(1024×1536, 장당 1.3MB)을
  그대로 넣으면 모바일 첫 로딩이 무거워진다.

```bash
# 원본을 assets-source/characters에 두고, 표시용만 줄여서 public에 넣는다
sips -Z 512 assets-source/characters/basil.png --out public/characters/basil.png
```

`assets-source/`는 gitignore돼 있다. 원본이 필요하면 그쪽을 쓰고, 커밋되는 건 축소본뿐이다.
- 파일이 없으면 앱은 자동으로 텍스트 표정(`(◕‿◕)` 등)으로 대체하므로, 없어도 화면은 깨지지 않는다.

## 기분(mood) 표현

캐릭터 아트는 **식물당 한 장**이면 된다. 7종의 기분은 이미지를 갈아끼우는 대신
[`PlantCharacter.tsx`](../../src/features/character/PlantCharacter.tsx)가
색 필터·움직임·오버레이 아이콘을 얹어 표현한다.

| mood | 연출 |
|---|---|
| 0 OK | 은은하게 위아래로 떠다님 + 반짝임 |
| 1 THIRSTY | 채도를 낮추고 살짝 기울여 축 처지게 |
| 2 HOT | 따뜻한 색조 + 땀방울 + 아지랑이 |
| 3 COLD | 차가운 색조 + 눈송이 + 떨림 |
| 4 DARK | 어둡게 + zzz |
| 5 OVERWATER | 푸른 색조 + 물방울 |
| 6 SENSOR_ERR | 흑백 + 물음표 |

기분별 전용 아트가 생기면 `characterMoodImages`에 경로를 추가하면 그쪽이 우선 사용된다.
