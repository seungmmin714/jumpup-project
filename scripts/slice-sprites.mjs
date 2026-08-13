// 스프라이트 시트 → 개별 PNG.
//
//   assets-source/sprites/icons.png       4×4 UI 아이콘
//   assets-source/sprites/shop-items.png  4×2 상점 아이템
//   assets-source/sprites/room.png        방 배경 (자르지 않고 축소만)
//        ↓
//   public/sprites/*.png
//
// 셀마다 투명 여백을 잘라내고 정사각으로 맞춘 뒤 축소한다.
// CSS 스프라이트(background-position)를 쓰지 않는 이유: 아이콘마다 표시 크기가
// 다르고, 파일이 나뉘어 있어야 필요한 것만 캐시된다.
//
// 사용법: node scripts/slice-sprites.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC_DIR = 'assets-source/sprites';
const OUT_DIR = 'public/sprites';

/** 시트 정의 — 이름은 행 우선(왼→오른, 위→아래) 순서다. */
const SHEETS = [
  {
    file: 'icons.png',
    cols: 4,
    rows: 4,
    size: 128,
    names: [
      'home', 'journal', 'catalog', 'shop',
      'drop', 'sun', 'drop-plus', 'bulb',
      'thermometer', 'coin', 'backpack', 'gift',
      'link', 'lock', 'sprout', 'watering-can',
    ],
  },
  {
    file: 'effects.png',
    cols: 4,
    rows: 3,
    size: 128,
    names: [
      'fan', 'wind', 'bulb-bright', 'splash',
      'fire', 'snow', 'zzz', 'question',
      'face-happy', 'face-sad', 'berry', 'link-green',
    ],
  },
  {
    // 버튼·바는 가로로 길다. 정사각으로 채우면 9-슬라이스가 깨진다.
    file: 'buttons.png',
    cols: 2,
    rows: 4,
    size: 96,
    square: false,
    // 버튼은 가로로 길고 옅은 그림자를 달고 있어 격자·투영 방식이 전부 어긋났다.
    // 연결 요소로 실제 위치를 측정해 좌표를 박아 뒀다(scripts 주석 참고).
    // 9-슬라이스로 늘려 쓰므로 축소하지 않는다 — size 0.
    size: 0,
    square: false,
    rects: {
      'btn-primary': [88, 69, 644, 185],
      'btn-secondary': [838, 69, 629, 185],
      'bar-empty': [812, 595, 651, 94],
    },
    // 빈 칸은 만들지 않는다. 눈금·채움·아이콘이 그림에 박혀 있어 쓸 수 없는 칸들이다:
    //   bar-soil(눈금 고정) · bar-slider(눈금 고정) · bar-progress(채움 고정)
    //   btn-inventory · btn-event(아이콘이 그림에 포함 — 코드가 그리는 아이콘과 겹친다)
    // 쓰는 건 빈 트랙 프레임 하나(bar-empty)뿐이고, 나머지는 CSS로 그린다.
    names: [
      'btn-primary', 'btn-secondary',
      '', '',
      '', 'bar-empty',
      '', '',
    ],
  },
  {
    file: 'shop-items.png',
    cols: 4,
    rows: 2,
    size: 192,
    prefix: 'item-',
    names: [
      'shelf', 'watering-can', 'rug', 'window',
      'hanging-plant', 'frame', 'basket', 'gift-box',
    ],
  },
];

/** 배경 이미지는 자르지 않고 폭만 줄인다 */
const BACKGROUNDS = [{ file: 'room.png', width: 900 }];

// 배경을 지우고 남는 옅은 잔여물(알파 한 자리~수십)이 셀 가장자리까지 이어져 있으면
// 트림이 통째로 실패한다. 경계 판정은 넉넉히 불투명한 픽셀만 내용으로 친다.
const ALPHA_MIN = 96;

// 시트 배경은 거의 흰색(253,253,254)이고 알파가 꽉 차 있다. 잘라내기 전에 지워야 한다.
// 아이콘 안쪽에도 밝은 색(책 종이·창문 구름·액자 바탕)이 있으므로 임계값을 바짝 조인다.
// 아이콘마다 어두운 외곽선이 있어 이 정도로도 새지 않는다.
const BG_T_TRANSPARENT = 16;
const BG_T_OPAQUE = 34;

const dist = (r1, g1, b1, r2, g2, b2) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);


/**
 * 배경 위에 합성된 결과에서 원래 색을 되돌린다.
 *
 *   관측색 = a·원본색 + (1-a)·배경색   →   원본색 = (관측색 - (1-a)·배경색) / a
 *
 * 알파만 깎고 색을 그대로 두면 가장자리에 배경색 테두리가 남는다.
 * (흰 배경이면 흰 테두리, 크림 배경이면 크림 테두리)
 */
function unpremultiply(data, i, alpha, bg) {
  if (alpha <= 0 || alpha >= 255) return;
  const a = alpha / 255;
  for (let c = 0; c < 3; c += 1) {
    const v = (data[i + c] - (1 - a) * bg[c]) / a;
    data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
  }
}

/** 테두리에서 시작해 배경색과 이어진 영역만 투명하게 만든다. */
function removeSheetBackground(png) {
  const { width: w, height: h, data } = png;
  const [br, bgc, bb] = [data[0], data[1], data[2]];
  const visited = new Uint8Array(w * h);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], br, bgc, bb) >= BG_T_OPAQUE) return;
    visited[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }

  while (stack.length > 0) {
    const p = stack.pop();
    const i = p * 4;
    const d = dist(data[i], data[i + 1], data[i + 2], br, bgc, bb);
    const a =
      d <= BG_T_TRANSPARENT
        ? 0
        : Math.round(((d - BG_T_TRANSPARENT) / (BG_T_OPAQUE - BG_T_TRANSPARENT)) * 255);
    // 아주 옅게 남는 픽셀은 흰 테두리처럼 보이므로 아예 지운다
    const finalA = a < 24 ? 0 : a;
    data[i + 3] = finalA;
    unpremultiply(data, i, finalA, [br, bgc, bb]);

    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

/**
 * 알파 투영으로 실제 아이콘 밴드를 찾는다.
 * 시트가 정확한 격자로 배치돼 있지 않아 고정 분할로 자르면 옆 아이콘이 걸쳐 들어온다.
 * 내용이 있는 행/열이 이어지는 구간을 밴드로 보고, 그 교차점을 셀로 쓴다.
 */
function bands(png, axis, from = 0, to = Infinity) {
  const { width: w, height: h, data } = png;
  const n = axis === 'x' ? w : h;
  const lo = Math.max(0, from);
  const hi = Math.min((axis === 'x' ? h : w) - 1, to);
  const filled = new Uint8Array(n);

  for (let i = 0; i < n; i += 1) {
    for (let j = lo; j <= hi; j += 1) {
      const x = axis === 'x' ? i : j;
      const y = axis === 'x' ? j : i;
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        filled[i] = 1;
        break;
      }
    }
  }

  const out = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    if (i < n && filled[i]) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      // 노이즈 한두 픽셀은 밴드로 치지 않는다
      if (i - start > n * 0.02) out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

/**
 * 밴드가 기대보다 많으면 간격이 가장 좁은 이웃끼리 합친다.
 * 행잉 플랜트의 덩굴처럼 한 아이콘이 세로로 길면 밴드가 쪼개진다.
 */
function mergeTo(list, expected) {
  const out = list.map((b) => [...b]);
  while (out.length > expected) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < out.length - 1; i += 1) {
      const gap = out[i + 1][0] - out[i][1];
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    out[best] = [out[best][0], out[best + 1][1]];
    out.splice(best + 1, 1);
  }
  return out;
}

function cellBounds(png, x0, y0, w, h, minAlpha = ALPHA_MIN) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = png.data[((y0 + y) * png.width + (x0 + x)) * 4 + 3];
      if (a > minAlpha) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/** 잘라낸 내용을 그대로 옮긴다 (정사각 정렬 없음) */
function toRect(png, x0, y0, b) {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const out = new PNG({ width: w, height: h, fill: true });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = ((y0 + b.minY + y) * png.width + (x0 + b.minX + x)) * 4;
      const di = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) out.data[di + c] = png.data[si + c];
    }
  }
  return out;
}

/** 잘라낸 내용을 정사각 캔버스 가운데에 놓는다 */
function toSquare(png, x0, y0, b) {
  const cw = b.maxX - b.minX + 1;
  const ch = b.maxY - b.minY + 1;
  const pad = Math.round(Math.max(cw, ch) * 0.04);
  const side = Math.max(cw, ch) + pad * 2;

  const out = new PNG({ width: side, height: side, fill: true });
  const ox = Math.round((side - cw) / 2);
  const oy = Math.round((side - ch) / 2);

  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((y0 + b.minY + y) * png.width + (x0 + b.minX + x)) * 4;
      const di = ((oy + y) * side + (ox + x)) * 4;
      for (let c = 0; c < 4; c += 1) out.data[di + c] = png.data[si + c];
    }
  }
  return out;
}

const shrink = (file, max) =>
  execFileSync('sips', ['-Z', String(max), file, '--out', file], { stdio: 'ignore' });

if (!existsSync(SRC_DIR)) {
  console.error(`원본 폴더가 없습니다: ${SRC_DIR}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

for (const sheet of SHEETS) {
  const src = path.join(SRC_DIR, sheet.file);
  if (!existsSync(src)) {
    console.warn(`⚠️  건너뜀 (없음): ${src}`);
    continue;
  }
  const png = PNG.sync.read(readFileSync(src));
  removeSheetBackground(png);

  const xs = sheet.evenGrid ? [] : mergeTo(bands(png, 'x'), sheet.cols);
  const ys = sheet.evenGrid ? [] : mergeTo(bands(png, 'y'), sheet.rows);
  const grid = !sheet.evenGrid && xs.length === sheet.cols && ys.length === sheet.rows;
  if (!grid && !sheet.evenGrid) {
    console.warn(
      `⚠️  ${sheet.file}: 밴드 ${xs.length}×${ys.length} (기대 ${sheet.cols}×${sheet.rows}) — 균등 분할로 대체`,
    );
  }
  const fw = Math.floor(png.width / sheet.cols);
  const fh = Math.floor(png.height / sheet.rows);
  let n = 0;

  for (let r = 0; r < sheet.rows; r += 1) {
    for (let c = 0; c < sheet.cols; c += 1) {
      const name = sheet.names[n];
      n += 1;
      if (!name) continue;

      const rect = sheet.rects?.[name];
      const x0 = rect ? rect[0] : grid ? xs[c][0] : c * fw;
      const y0 = rect ? rect[1] : grid ? ys[r][0] : r * fh;
      const cw = rect ? rect[2] : grid ? xs[c][1] - xs[c][0] + 1 : fw;
      const ch = rect ? rect[3] : grid ? ys[r][1] - ys[r][0] + 1 : fh;

      // 좌표를 직접 준 경우엔 그대로 잘라낸다
      const b = rect
        ? { minX: 0, minY: 0, maxX: cw - 1, maxY: ch - 1 }
        : cellBounds(png, x0, y0, cw, ch, sheet.trimAlpha ?? ALPHA_MIN);
      if (!b) {
        console.warn(`⚠️  빈 칸: ${sheet.file} [${r},${c}]`);
        continue;
      }
      const keepRect = sheet.square === false;
      const out = keepRect ? toRect(png, x0, y0, b) : toSquare(png, x0, y0, b);
      const outPath = path.join(OUT_DIR, `${sheet.prefix ?? ''}${name}.png`);
      writeFileSync(outPath, PNG.sync.write(out));
      // 사각형은 높이 기준, 정사각은 한 변 기준으로 줄인다
      const measure = keepRect ? out.height : out.width;
      if (sheet.size > 0 && measure > sheet.size) {
        shrink(outPath, Math.round((out.width / measure) * sheet.size));
      }
      console.log(
        `✅ ${path.basename(outPath).padEnd(22)} ${out.width}×${out.height} → ${sheet.size}px`,
      );
    }
  }
}

for (const bgDef of BACKGROUNDS) {
  const src = path.join(SRC_DIR, bgDef.file);
  if (!existsSync(src)) {
    console.warn(`⚠️  건너뜀 (없음): ${src}`);
    continue;
  }
  const outPath = path.join(OUT_DIR, bgDef.file);
  writeFileSync(outPath, readFileSync(src));
  shrink(outPath, bgDef.width);
  console.log(`✅ ${bgDef.file.padEnd(22)} → ${bgDef.width}px, ${Math.round(statSync(outPath).size / 1024)}KB`);
}

console.log('\n완료. public/sprites 를 확인하세요.');
