/**
 * Makes the logo PNG background transparent.
 * Removes border-connected matte (black, white, checkerboard gray) — transparent
 * edge pixels are pass-through so matte behind corner transparency is still removed.
 */
const path = require("path");
const sharp = require("sharp");

const INPUT = path.join(__dirname, "../logo/logo.png");
const OUTPUT = path.join(__dirname, "../public/logo.png");
const EDGE_TOLERANCE = 48;
const LIGHT_MATTE_MIN = 228;
const DARK_MATTE_MAX = 52;

async function main() {
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const buf = Buffer.from(data);

  function nearColor(i, target, tolerance) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    return (
      Math.abs(r - target[0]) <= tolerance &&
      Math.abs(g - target[1]) <= tolerance &&
      Math.abs(b - target[2]) <= tolerance
    );
  }

  function isLightMatte(i) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    return r >= LIGHT_MATTE_MIN && g >= LIGHT_MATTE_MIN && b >= LIGHT_MATTE_MIN;
  }

  function isDarkMatte(i) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    return r <= DARK_MATTE_MAX && g <= DARK_MATTE_MAX && b <= DARK_MATTE_MAX;
  }

  /** Baked-in Photoshop checkerboard preview tiles (white + light gray). */
  function isCheckerboardMatte(i) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff > 10) return false;
    const avg = (r + g + b) / 3;
    return avg >= 188 && avg <= 255;
  }

  const edgeOpaqueSamples = [];
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      if (buf[i + 3] > 0) edgeOpaqueSamples.push([buf[i], buf[i + 1], buf[i + 2]]);
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      if (buf[i + 3] > 0) edgeOpaqueSamples.push([buf[i], buf[i + 1], buf[i + 2]]);
    }
  }
  const bgR = edgeOpaqueSamples[0]?.[0] ?? buf[0];
  const bgG = edgeOpaqueSamples[0]?.[1] ?? buf[1];
  const bgB = edgeOpaqueSamples[0]?.[2] ?? buf[2];

  function isBorderMatte(i) {
    return (
      isLightMatte(i) ||
      isDarkMatte(i) ||
      isCheckerboardMatte(i) ||
      nearColor(i, [bgR, bgG, bgB], EDGE_TOLERANCE)
    );
  }

  function floodBorderMatte() {
    const vis = new Uint8Array(w * h);
    const q = [];

    function tryAdd(x, y) {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const p = y * w + x;
      if (vis[p]) return;
      vis[p] = 1;
      q.push(p);
    }

    for (let x = 0; x < w; x++) {
      tryAdd(x, 0);
      tryAdd(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryAdd(0, y);
      tryAdd(w - 1, y);
    }

    let head = 0;
    while (head < q.length) {
      const p = q[head++];
      const i = p * 4;
      const alpha = buf[i + 3];
      const matte = alpha > 0 && isBorderMatte(i);

      if (matte) {
        buf[i + 3] = 0;
      }

      if (alpha === 0 || matte) {
        const x = p % w;
        const y = (p / w) | 0;
        tryAdd(x + 1, y);
        tryAdd(x - 1, y);
        tryAdd(x, y + 1);
        tryAdd(x, y - 1);
      }
    }
  }

  floodBorderMatte();

  /** Off-white halo left when the source was exported on a white matte. */
  function isFringeHalo(i) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const lum = (r + g + b) / 3;
    return lum >= 195 && r >= 190 && g >= 190 && b >= 180;
  }

  /** Remove light / checkerboard fringe pixels touching transparency. */
  let fringeChanged = true;
  while (fringeChanged) {
    fringeChanged = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        if (buf[i + 3] === 0) continue;
        if (!isLightMatte(i) && !isCheckerboardMatte(i) && !isFringeHalo(i)) continue;
        const touchesTransparent =
          (x > 0 && buf[(p - 1) * 4 + 3] === 0) ||
          (x < w - 1 && buf[(p + 1) * 4 + 3] === 0) ||
          (y > 0 && buf[(p - w) * 4 + 3] === 0) ||
          (y < h - 1 && buf[(p + w) * 4 + 3] === 0);
        if (touchesTransparent) {
          buf[i + 3] = 0;
          fringeChanged = true;
        }
      }
    }
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .trim({ background: transparent })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(OUTPUT);

  console.log("Wrote transparent PNG:", OUTPUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
