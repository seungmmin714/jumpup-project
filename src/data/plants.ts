// §11.4 식물 도감. 이 표가 S 명령의 유일한 출처다.
// 도감은 정보 탭이 아니라 **설정 진입점**이다 — 선택 시 해당 행을 S로 전송한다.

import type { Plant } from '@/ble/types';

export const PLANTS: readonly Plant[] = [
  {
    plantId: 'tomato-cherry',
    characterImage: '/characters/tomato-cherry.png',
    nameKo: '방울토마토',
    emoji: '🍅',
    targetMinPct: 45,
    targetMaxPct: 65,
    soilDry: 708,
    soilWet: 578,
    tempMinX10: 150,
    tempMaxX10: 300,
    lightMin: 500,
    waterMl: 250,
    description: '햇빛을 가장 많이 필요로 해요. 열매가 달리면 물을 규칙적으로 주는 게 중요해요.',
  },
  {
    plantId: 'basil',
    characterImage: '/characters/basil.png',
    nameKo: '바질',
    emoji: '🌿',
    targetMinPct: 45,
    targetMaxPct: 65,
    soilDry: 708,
    soilWet: 578,
    tempMinX10: 180,
    tempMaxX10: 300,
    lightMin: 450,
    waterMl: 200,
    description: '따뜻한 곳을 좋아해요. 잎이 시들기 전에 물을 주면 향이 더 진해져요.',
  },
  {
    plantId: 'lettuce',
    characterImage: '/characters/lettuce.png',
    nameKo: '상추',
    emoji: '🥬',
    targetMinPct: 50,
    targetMaxPct: 70,
    soilDry: 675,
    soilWet: 545,
    tempMinX10: 100,
    tempMaxX10: 250,
    lightMin: 350,
    waterMl: 200,
    description: '서늘한 환경을 좋아하고 흙이 촉촉해야 해요. 더위에 특히 약해요.',
  },
  {
    plantId: 'monstera',
    characterImage: '/characters/monstera.png',
    nameKo: '몬스테라',
    emoji: '🪴',
    targetMinPct: 35,
    targetMaxPct: 55,
    soilDry: 773,
    soilWet: 643,
    tempMinX10: 150,
    tempMaxX10: 300,
    lightMin: 250,
    waterMl: 200,
    description: '반그늘에서도 잘 자라요. 흙이 겉에서 속까지 마르면 그때 주세요.',
  },
  {
    plantId: 'succulent',
    characterImage: '/characters/succulent.png',
    nameKo: '다육식물',
    emoji: '🌵',
    targetMinPct: 15,
    targetMaxPct: 35,
    soilDry: 903,
    soilWet: 773,
    tempMinX10: 50,
    tempMaxX10: 350,
    lightMin: 400,
    waterMl: 80,
    description: '물을 아주 조금만 주세요. 과습이 가장 위험합니다.',
  },
] as const;

export const DEFAULT_PLANT_ID = 'tomato-cherry';

export const findPlant = (plantId: string | null | undefined): Plant =>
  PLANTS.find((p) => p.plantId === plantId) ?? PLANTS[0]!;
