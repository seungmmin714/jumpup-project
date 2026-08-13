// 캐릭터 아트 전처리기.
//
//   assets-source/characters/*.png  (원본, 배경 있음)
//        ↓ 배경 제거 → 여백 트림 → 정사각 캔버스에 바닥 정렬
//   public/characters/*.png         (표시용)
//
// 왜 필요한가: 생성된 아트에는 크림색 배경이 깔려 있어서 그대로 쓰면
// 씬 위에 네모난 판이 얹힌 것처럼 보인다. 또 캐릭터 주변 여백이 제각각이라
// 발밑에 러그를 깔면 캐릭터마다 발 높이가 어긋난다.
// 배경을 투명하게 만들고 여백을 잘라낸 뒤, 캐릭터 발이 항상 이미지 아래끝에
// 오도록 정사각 캔버스에 바닥 정렬해서 두 문제를 한 번에 없앤다.
//
// 사용법:  node scripts/prep-characters.mjs [--keep-size]
// 처리 후 sips로 표시용 크기까지 줄인다(스크립트가 알아서 호출).

import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC_DIR = 'assets-source/characters';
const OUT_DIR = 'public/characters';
/** 표시용 최대 변 길이 — 화면에서는 208px로 그려지므로 3배 화면까지 충분하다 */
const DISPLAY_MAX = 512;

/** 배경으로 볼 색과의 거리. 이 이하는 완전 투명 */
const T_TRANSPARENT = 20;
/** 이 이상 떨어지면 완전 불투명. 사이 구간은 부드럽게 이어 붙인다 */
const T_OPAQUE = 62;
/** 트림할 때 남길 여백 (짧은 변 대비) */
const TRIM_PAD = 0.02;

const dist = (r1, g1, b1, r2, g2, b2) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

/** 네 모서리 색의 중앙값을 배경색으로 본다 */
function detectBackground(png) {
  const { width: w, height: h, data } = png;
  const at = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  return [0, 1, 2].map((c) => {
    const vals = corners.map((p) => p[c]).sort((a, b) => a - b);
    return Math.round((vals[1] + vals[2]) / 2);
  });
}

/**
 * 테두리에서 시작해 배경색과 가까운 픽셀만 따라 들어가며 알파를 깎는다.
 * 캐릭터 내부의 밝은 부분(하이라이트 등)은 테두리와 이어져 있지 않으므로 살아남는다.
 */
function removeBackground(png, bg) {
  const { width: w, height: h, data } = png;
  const [br, bg_, bb] = bg;
  const visited = new Uint8Array(w * h);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], br, bg_, bb) >= T_OPAQUE) return;
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

  let cleared = 0;
  while (stack.length > 0) {
    const p = stack.pop();
    const i = p * 4;
    const d = dist(data[i], data[i + 1], data[i + 2], br, bg_, bb);

    // 경계는 부드럽게: 배경에 가까울수록 투명, 멀수록 불투명
    const alpha = d <= T_TRANSPARENT ? 0 : Math.round(((d - T_TRANSPARENT) / (T_OPAQUE - T_TRANSPARENT)) * 255);
    if (alpha < data[i + 3]) {
      data[i + 3] = alpha;
      cleared += 1;
    }

    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return cleared;
}

/** 알파가 있는 영역의 경계 상자 */
function contentBounds(png, threshold = 8) {
  const { width: w, height: h, data } = png;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * 내용만 잘라내 정사각 캔버스에 다시 얹는다.
 * 가로는 가운데, 세로는 **아래끝에 맞춘다** — 캐릭터 발이 항상 이미지 맨 아래에 오도록.
 */
function trimToSquare(png, bounds) {
  const cw = bounds.maxX - bounds.minX + 1;
  const ch = bounds.maxY - bounds.minY + 1;
  const pad = Math.round(Math.min(cw, ch) * TRIM_PAD);
  const side = Math.max(cw, ch) + pad * 2;

  const out = new PNG({ width: side, height: side, fill: true });
  const offsetX = Math.round((side - cw) / 2);
  const offsetY = side - ch - pad; // 바닥 정렬

  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((bounds.minY + y) * png.width + (bounds.minX + x)) * 4;
      const di = ((offsetY + y) * side + (offsetX + x)) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}

// ───────── 실행 ─────────

if (!existsSync(SRC_DIR)) {
  console.error(`원본 폴더가 없습니다: ${SRC_DIR}`);
  console.error('캐릭터 원본 PNG를 그 폴더에 넣고 다시 실행하세요.');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const keepSize = process.argv.includes('--keep-size');
const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

if (files.length === 0) {
  console.error(`${SRC_DIR}에 PNG가 없습니다.`);
  process.exit(1);
}

for (const file of files) {
  const srcPath = path.join(SRC_DIR, file);
  const outPath = path.join(OUT_DIR, file);

  const png = PNG.sync.read(readFileSync(srcPath));
  const bg = detectBackground(png);
  const cleared = removeBackground(png, bg);

  const bounds = contentBounds(png);
  if (!bounds) {
    console.warn(`⚠️  ${file}: 내용이 전부 지워졌습니다. 건너뜁니다.`);
    continue;
  }

  const squared = trimToSquare(png, bounds);
  writeFileSync(outPath, PNG.sync.write(squared));

  if (!keepSize && squared.width > DISPLAY_MAX) {
    execFileSync('sips', ['-Z', String(DISPLAY_MAX), outPath, '--out', outPath], {
      stdio: 'ignore',
    });
  }

  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(
    `✅ ${file.padEnd(20)} 배경 rgb(${bg.join(',')}) · ${cleared.toLocaleString()}px 제거 · ` +
      `${png.width}×${png.height} → ${squared.width}×${squared.width} · ${kb}KB`,
  );
}

console.log('\n완료. public/characters 를 확인하세요.');
