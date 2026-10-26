import { flushSync } from "react-dom";

type ThemeName = "light" | "dark";

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
};

function starClipPaths(
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): [string, string] {
  const toX = (x: number) => `${(x / viewportWidth) * 100}%`;
  const toY = (y: number) => `${(y / viewportHeight) * 100}%`;
  const point = (x: number, y: number) => `${toX(x)} ${toY(y)}`;
  const radius = maxRadius * Math.SQRT2 * 1.03;
  const innerRatio = 0.42;

  const starPolygon = (size: number) => {
    const verts: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      verts.push(point(cx + size * Math.cos(outerA), cy + size * Math.sin(outerA)));
      const innerA = outerA + Math.PI / 5;
      verts.push(
        point(
          cx + size * innerRatio * Math.cos(innerA),
          cy + size * innerRatio * Math.sin(innerA),
        ),
      );
    }
    return `polygon(${verts.join(", ")})`;
  };

  return [starPolygon(Math.max(2, radius * 0.025)), starPolygon(radius)];
}

let themeChangeActive = false;

export function playStarThemeChange(options: {
  button: HTMLElement;
  next: ThemeName;
  current: ThemeName;
  apply: () => void;
}): void {
  const { button, next, current, apply } = options;
  if (next === current || themeChangeActive) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => ViewTransitionLike;
  };
  if (reduced || typeof doc.startViewTransition !== "function") {
    apply();
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const maxRadius = Math.hypot(
    Math.max(x, viewportWidth - x),
    Math.max(y, viewportHeight - y),
  );
  const clipPath = starClipPaths(x, y, maxRadius, viewportWidth, viewportHeight);
  const root = document.documentElement;
  root.dataset.magicuiThemeVt = "active";
  root.style.setProperty("--magicui-theme-toggle-vt-duration", "650ms");
  root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);
  themeChangeActive = true;

  const cleanup = () => {
    themeChangeActive = false;
    delete root.dataset.magicuiThemeVt;
    root.style.removeProperty("--magicui-theme-toggle-vt-duration");
    root.style.removeProperty("--magicui-theme-vt-clip-from");
  };

  const transition = doc.startViewTransition(() => {
    flushSync(() => {
      root.classList.toggle("dark", next === "dark");
      apply();
    });
  });

  transition.finished.finally(cleanup).catch(cleanup);
  transition.ready
    .then(() => {
      root.animate(
        { clipPath },
        {
          duration: 650,
          easing: "linear",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}
