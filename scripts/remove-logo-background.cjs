/**
 * Makes the logo PNG background transparent.
 * Removes:
 * 1. The outer matte connected to the image edges.
 * 2. The inner dark rounded-rectangle backdrop behind the artwork.
 */
const path = require("path");
const sharp = require("sharp");

const INPUT = path.join(__dirname, "../public/FLIPVISE_STUDIO_LOGO_1.PNG");
const EDGE_TOLERANCE = 42;
const PANEL_TOLERANCE = 32;

async function main() {
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const buf = Buffer.from(data);

  const bgR = buf[0];
  const bgG = buf[1];
  const bgB = buf[2];

  function luminanceAt(i) {
    return Math.round((buf[i] + buf[i + 1] + buf[i + 2]) / 3);
  }

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

  function floodFill(seedPoints, predicate) {
    const vis = new Uint8Array(w * h);
    const q = [];

    function tryAdd(x, y) {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const p = y * w + x;
      if (vis[p]) return;
      const i = p * 4;
      if (!predicate(i)) return;
      vis[p] = 1;
      q.push(p);
    }

    for (const [x, y] of seedPoints) {
      tryAdd(x, y);
    }

    let head = 0;
    while (head < q.length) {
      const p = q[head++];
      const x = p % w;
      const y = (p / w) | 0;
      const i = p * 4;
      buf[i + 3] = 0;
      tryAdd(x + 1, y);
      tryAdd(x - 1, y);
      tryAdd(x, y + 1);
      tryAdd(x, y - 1);
    }
  }

  const edgeSeeds = [];

  for (let x = 0; x < w; x++) {
    edgeSeeds.push([x, 0], [x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    edgeSeeds.push([0, y], [w - 1, y]);
  }

  floodFill(
    edgeSeeds,
    (i) =>
      nearColor(i, [bgR, bgG, bgB], EDGE_TOLERANCE) && buf[i + 3] > 0
  );

  const panelSeedHints = [
    [Math.floor(w * 0.5), Math.floor(h * 0.56)],
    [Math.floor(w * 0.5), Math.floor(h * 0.66)],
    [Math.floor(w * 0.5), Math.floor(h * 0.74)],
    [Math.floor(w * 0.2), Math.floor(h * 0.56)],
    [Math.floor(w * 0.8), Math.floor(h * 0.56)],
  ];

  const panelTargets = [];

  for (const [sx, sy] of panelSeedHints) {
    for (let y = Math.max(0, sy - 24); y <= Math.min(h - 1, sy + 24); y++) {
      for (let x = Math.max(0, sx - 24); x <= Math.min(w - 1, sx + 24); x++) {
        const i = (y * w + x) * 4;
        if (buf[i + 3] === 0) continue;
        if (luminanceAt(i) > 55) continue;
        panelTargets.push([x, y, [buf[i], buf[i + 1], buf[i + 2]]]);
        break;
      }
      if (panelTargets.length > 0 && panelTargets.at(-1)[0] !== undefined) {
        const last = panelTargets.at(-1);
        if (Math.abs(last[0] - sx) <= 24 && Math.abs(last[1] - sy) <= 24) break;
      }
    }
  }

  for (const [sx, sy, target] of panelTargets) {
    floodFill(
      [[sx, sy]],
      (i) =>
        buf[i + 3] > 0 &&
        luminanceAt(i) <= 70 &&
        nearColor(i, target, PANEL_TOLERANCE)
    );
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .trim({ background: transparent })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(INPUT);

  console.log("Wrote transparent PNG:", INPUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
