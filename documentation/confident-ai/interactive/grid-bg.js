/**
 * Interactive dotted-grid background for Confident AI assets.
 * Tune values in METRICS — fade timings, lineGap, and lineMode are the main levers.
 */

export const METRICS = {
  width: 1024,
  height: 682,
  dotSize: 2,
  pitch: 32, // center-to-center
  // Negative = shift grid up (more clearance at the bottom edge)
  gridOffsetY: -16,
  bg: "#131313",
  dotIdle: "rgba(255,255,255,0.26)",
  // Hover strength 1 → this alpha; rim falls back toward dotIdle
  dotActive: "rgba(255,255,255,0.8)",
  lineColor: "#7422F8",
  letterColor: "#7422F8",
  letterFontSize: 16,
  lineWidth: 1,
  lineGap: 4, // clear px between line end and dot edge
  // Oval hover in grid cells (wider than tall)
  hoverRadiusX: 3.2,
  hoverRadiusY: 2.1,
  fadeInMs: 280,
  fadeOutMs: 900, // slower opacity trail
  letterFadeOutMs: 1000, // letter cells fade out
  letterHoldMs: 3500, // stay full purple after leave before fade
  lineMode: "extend", // "fade" | "extend"
  lineExtendMs: 340,
  lineRetractMs: 1100, // slower stroke-out trail
};

/** 1-indexed rows 11 & 12, starting at 5th dot (1-indexed). */
export const LETTER_LINES = [
  { row: 11, startCol: 5, text: "CONFIDENT AI" },
  { row: 12, startCol: 5, text: "LLM THAT MOVES THE NEEDLE" },
];

/** Click-drag boxes (Figma 356:72763). Cycle all 5 before repeating. */
export const BOX_PALETTE = [
  { hex: "#7422F8", tag: "CONFIDENT-AI" },
  { hex: "#E8FF01", tag: "QA" },
  { hex: "#57E7B2", tag: "PM" },
  { hex: "#029DFF", tag: "ENGINEERS" },
  { hex: "#FF4101", tag: "SHAREHOLDERS" },
];

const BOX_CORNER = "#D9D9D9";
const BOX_CORNER_SIZE = 4;
const BOX_SWATCH_SIZE = 4.47;
const BOX_LABEL_FONT_SIZE = 8;
const BOX_TAG_LETTER_SPACING = 0.6; // px tracking on tag label
const BOX_TAG_PAD_X = 6;
const BOX_TAG_MARGIN = 4; // gap between tag pill edge and next dot/line
const BOX_TAG_MARGIN_ALT = 3; // use when full pill leaves exactly 3px to next dot
const BOX_HOLD_MS = 3000;
const BOX_FADE_MS = 600;
const BOX_LABEL_MIN_GAPS = 4;

/** Intro demo (Figma 356:73869) — purple CONFIDENT-AI box. */
const DEMO = {
  moveMs: 600,
  fadeInMs: 200,
  clickMs: 300,
  dragMs: 1400,
  dismissMs: 300,
  boxHoldMs: 3000,
  boxFadeMs: 600,
  rotateDeg: -20,
  // 0-indexed cells; 8 gaps matches Figma ~272px box at pitch 32
  startCol: 4,
  startRow: 3,
  endCol: 12,
  endRow: 11,
  cursorSize: 16,
  triggerAt: 0.4, // slide Y% line vs viewport bottom
};

function easeInOutSlowDown(t) {
  t = Math.max(0, Math.min(1, t));
  // Short ease-in, longer decelerating ease-out
  if (t < 0.28) {
    const u = t / 0.28;
    return 0.1 * u * u;
  }
  const u = (t - 0.28) / 0.72;
  return 0.1 + 0.9 * (1 - Math.pow(1 - u, 2.4));
}

function parseRgba(str) {
  const m = String(str).match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (m) {
    return {
      r: +m[1],
      g: +m[2],
      b: +m[3],
      a: m[4] !== undefined ? +m[4] : 1,
    };
  }
  const hex = String(str).replace("#", "");
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function withAlpha(color, alpha) {
  const c = parseRgba(color);
  return `rgba(${c.r},${c.g},${c.b},${alpha * c.a})`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function approach(current, target, dtMs, fadeInMs, fadeOutMs, instant) {
  if (instant) return target;
  if (current === target) return current;
  const duration = target > current ? fadeInMs : fadeOutMs;
  if (duration <= 0) return target;
  const step = dtMs / duration;
  if (target > current) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/**
 * @param {HTMLElement} mount
 * @param {Partial<typeof METRICS> & {
 *   letterLines?: Array<{ row: number, startCol: number, text: string }>,
 *   logo?: { src: string, left: number, top: number, width: number, height: number },
 *   enableBoxes?: boolean,
 *   enableDemo?: boolean
 * }} [overrides]
 */
export function mountDotGrid(mount, overrides = {}) {
  const {
    letterLines = [],
    logo = null,
    enableBoxes = false,
    enableDemo = false,
    ...metricOverrides
  } = overrides;
  const m = { ...METRICS, ...metricOverrides };
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (!mount.style.position || mount.style.position === "static") {
    mount.style.position = "relative";
  }
  mount.style.overflow = "hidden";
  mount.style.background = m.bg;

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-label", "Interactive dotted grid background");
  mount.appendChild(canvas);

  /** @type {HTMLElement | null} */
  let logoEl = null;
  if (logo?.src) {
    logoEl = document.createElement("div");
    logoEl.setAttribute("aria-hidden", "true");
    logoEl.style.cssText = [
      "position:absolute",
      `left:${(logo.left / m.width) * 100}%`,
      `top:${(logo.top / m.height) * 100}%`,
      `width:${(logo.width / m.width) * 100}%`,
      `height:${(logo.height / m.height) * 100}%`,
      "pointer-events:none",
      "user-select:none",
      "z-index:2",
    ].join(";");
    const img = document.createElement("img");
    img.src = logo.src;
    img.alt = "";
    img.draggable = false;
    img.style.cssText = "display:block;width:100%;height:100%;";
    logoEl.appendChild(img);
    mount.appendChild(logoEl);
  }

  const ctx = canvas.getContext("2d");

  /** Match backing-store pixels to CSS size × DPR so dots/text stay sharp on Retina. */
  function applyCanvasSize() {
    const rect = mount.getBoundingClientRect();
    const cssW = rect.width || m.width;
    const cssH = rect.height || m.height;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform((bw / m.width) || 1, 0, 0, (bh / m.height) || 1, 0, 0);
  }

  applyCanvasSize();
  const resizeObserver = new ResizeObserver(() => applyCanvasSize());
  resizeObserver.observe(mount);

  const half = m.dotSize / 2;
  const endInset = half + m.lineGap;

  const cols = Math.floor((m.width - m.dotSize) / m.pitch) + 1;
  const rows = Math.floor((m.height - m.dotSize) / m.pitch) + 1;
  const gridW = (cols - 1) * m.pitch;
  const gridH = (rows - 1) * m.pitch;
  const originX = (m.width - gridW) / 2;
  const originY = (m.height - gridH) / 2 + (m.gridOffsetY ?? 0);

  const dotCount = cols * rows;
  const dotOpacity = new Float32Array(dotCount);
  const dotTarget = new Float32Array(dotCount);

  /** @type {Map<string, string>} col,row → letter (non-space only) */
  const letterChars = new Map();
  /** @type {Set<number>} flat indices that are letter cells */
  const letterIndices = new Set();
  /** Hold-full-purple until this timestamp (ms) per letter index */
  const letterHoldUntil = new Float64Array(dotCount);
  /** 1 if letter was inside the oval on the last rebuildTargets */
  const letterHovered = new Uint8Array(dotCount);

  for (const line of letterLines) {
    const r = line.row - 1; // 1-indexed → 0-indexed
    const start = line.startCol - 1;
    if (r < 0 || r >= rows) continue;
    for (let i = 0; i < line.text.length; i++) {
      const ch = line.text[i];
      if (ch === " ") continue;
      const c = start + i;
      if (c < 0 || c >= cols) continue;
      letterChars.set(`${c},${r}`, ch);
      letterIndices.add(r * cols + c);
    }
  }

  function isLetterCell(c, r) {
    return letterChars.has(`${c},${r}`);
  }

  /** @type {{ x: number, y: number } | null} */
  let pointer = null;

  /**
   * @typedef {{
   *   c0: number, r0: number, c1: number, r1: number,
   *   ax: number, ay: number, bx: number, by: number,
   *   opacity: number, opacityTarget: number,
   *   progress: number, progressTarget: number,
   *   fromA: boolean
   * }} Edge
   */
  /** @type {Map<string, Edge>} */
  const edges = new Map();

  function ellipseNorm(dc, dr) {
    const nx = dc / m.hoverRadiusX;
    const ny = dr / m.hoverRadiusY;
    return Math.sqrt(nx * nx + ny * ny);
  }

  function ovalStrength(dc, dr) {
    const t = ellipseNorm(dc, dr);
    if (t >= 1) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * t));
  }

  function idx(c, r) {
    return r * cols + c;
  }

  function centerOf(c, r) {
    return {
      x: originX + c * m.pitch,
      y: originY + r * m.pitch,
    };
  }

  function edgeKey(c0, r0, c1, r1) {
    if (c0 > c1 || (c0 === c1 && r0 > r1)) {
      return `${c1},${r1}>${c0},${r0}`;
    }
    return `${c0},${r0}>${c1},${r1}`;
  }

  function insetSegment(c0, r0, c1, r1) {
    const a = centerOf(c0, r0);
    const b = centerOf(c1, r1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      ax: a.x + ux * endInset,
      ay: a.y + uy * endInset,
      bx: b.x - ux * endInset,
      by: b.y - uy * endInset,
    };
  }

  function ensureEdge(c0, r0, c1, r1) {
    const key = edgeKey(c0, r0, c1, r1);
    let e = edges.get(key);
    if (!e) {
      const ordered =
        c0 > c1 || (c0 === c1 && r0 > r1)
          ? [c1, r1, c0, r0]
          : [c0, r0, c1, r1];
      const seg = insetSegment(ordered[0], ordered[1], ordered[2], ordered[3]);
      e = {
        c0: ordered[0],
        r0: ordered[1],
        c1: ordered[2],
        r1: ordered[3],
        ax: seg.ax,
        ay: seg.ay,
        bx: seg.bx,
        by: seg.by,
        opacity: 0,
        opacityTarget: 0,
        progress: 0,
        progressTarget: 0,
        fromA: true,
      };
      edges.set(key, e);
    }
    return e;
  }

  function setGrowFromCursor(e) {
    if (!pointer) return;
    const dA = (e.ax - pointer.x) ** 2 + (e.ay - pointer.y) ** 2;
    const dB = (e.bx - pointer.x) ** 2 + (e.by - pointer.y) ** 2;
    e.fromA = dA <= dB;
  }

  function canConnect(c0, r0, c1, r1) {
    // No dashes between letter cells, or between a letter and a neighboring dot
    if (isLetterCell(c0, r0) || isLetterCell(c1, r1)) return false;
    return true;
  }

  function forceCursorPlus(col, row) {
    const arms = [
      [col - 1, row, col, row],
      [col, row, col + 1, row],
      [col, row - 1, col, row],
      [col, row, col, row + 1],
    ];
    for (const [c0, r0, c1, r1] of arms) {
      if (c0 < 0 || r0 < 0 || c0 >= cols || r0 >= rows) continue;
      if (c1 < 0 || r1 < 0 || c1 >= cols || r1 >= rows) continue;
      if (!canConnect(c0, r0, c1, r1)) continue;
      const e = ensureEdge(c0, r0, c1, r1);
      e.opacityTarget = 1;
      e.progressTarget = 1;
      setGrowFromCursor(e);
    }
  }

  function clearTargets() {
    dotTarget.fill(0);
    for (const e of edges.values()) {
      e.opacityTarget = 0;
      e.progressTarget = 0;
    }
  }

  function applyOvalAt(col, row) {
    const scanX = Math.ceil(m.hoverRadiusX);
    const scanY = Math.ceil(m.hoverRadiusY);
    /** @type {Array<[number, number, number]>} */
    const active = [];

    for (let dr = -scanY; dr <= scanY; dr++) {
      for (let dc = -scanX; dc <= scanX; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const strength = ovalStrength(dc, dr);
        if (strength <= 0) continue;
        const i = idx(c, r);
        if (strength > dotTarget[i]) dotTarget[i] = strength;
        active.push([c, r, strength]);
      }
    }

    for (const [c, r, s0] of active) {
      const neighbors = [
        [c + 1, r],
        [c, r + 1],
      ];
      for (const [nc, nr] of neighbors) {
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!canConnect(c, r, nc, nr)) continue;
        const s1 = dotTarget[idx(nc, nr)];
        if (s1 <= 0) continue;
        const lineStrength = (s0 + s1) * 0.5;
        const e = ensureEdge(c, r, nc, nr);
        if (lineStrength > e.opacityTarget) e.opacityTarget = lineStrength;
        e.progressTarget = 1;
        setGrowFromCursor(e);
      }
    }

    forceCursorPlus(col, row);
  }

  function rebuildTargets() {
    clearTargets();
    letterHovered.fill(0);
    if (pointer) {
      const { col, row } = pointerToCell(pointer.x, pointer.y);
      applyOvalAt(col, row);
    }
    // Capture real oval hits before hold overwrites targets
    const now = performance.now();
    for (const i of letterIndices) {
      if (dotTarget[i] > 0.001) {
        letterHovered[i] = 1;
        letterHoldUntil[i] = now + m.letterHoldMs;
      }
    }
    applyLetterTargets();
  }

  /**
   * Letters: full purple while hovered or within letterHoldMs after last hover.
   * Hold is only extended by oval hits in rebuildTargets — not by the held target itself.
   */
  function applyLetterTargets() {
    const now = performance.now();
    for (const i of letterIndices) {
      if (letterHovered[i] || now < letterHoldUntil[i]) {
        dotTarget[i] = 1;
      } else {
        dotTarget[i] = 0;
      }
    }
  }

  function pointerToLocal(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = m.width / rect.width;
    const scaleY = m.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function pointerToCell(x, y) {
    const col = Math.round((x - originX) / m.pitch);
    const row = Math.round((y - originY) / m.pitch);
    return {
      col: Math.max(0, Math.min(cols - 1, col)),
      row: Math.max(0, Math.min(rows - 1, row)),
    };
  }

  function shufflePalette() {
    const bag = BOX_PALETTE.map((p) => ({ ...p }));
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  let colorBag = shufflePalette();
  function nextBoxColor() {
    if (!colorBag.length) colorBag = shufflePalette();
    return colorBag.pop();
  }

  /** @type {Array<{
   *   c0: number, r0: number, c1: number, r1: number,
   *   hex: string, tag: string,
   *   dragging: boolean,
   *   releasedAt: number | null,
   *   persist?: boolean,
   *   isDemo?: boolean
   * }>} */
  const boxes = [];
  let dragBox = null;
  let dragStart = null;

  /** @type {null | {
   *   phase: 'idle'|'enter'|'click'|'drag'|'hold'|'dismiss'|'done',
   *   startedAt: number,
   *   phaseAt: number,
   *   box: object | null,
   *   x: number, y: number,
   *   opacity: number,
   *   rotation: number
   * }} */
  let demo = null;
  /** @type {HTMLImageElement | null} */
  let cursorEl = null;
  /** @type {HTMLElement | null} */
  let hintEl = null;
  let hintUnlocked = false;

  if (enableDemo) {
    cursorEl = document.createElement("img");
    cursorEl.src = new URL("./demo-cursor.svg", import.meta.url).href;
    cursorEl.alt = "";
    cursorEl.draggable = false;
    cursorEl.setAttribute("aria-hidden", "true");
    cursorEl.style.cssText = [
      "position:absolute",
      `width:${DEMO.cursorSize}px`,
      `height:${DEMO.cursorSize}px`,
      "left:0",
      "top:0",
      "pointer-events:none",
      "user-select:none",
      "z-index:4",
      "opacity:0",
      "transform-origin:12% 10%",
      "will-change:transform,opacity",
    ].join(";");
    mount.appendChild(cursorEl);
    hintEl = document.createElement("div");
    hintEl.textContent = "CLICK AND DRAG";
    hintEl.setAttribute("aria-hidden", "true");
    hintEl.style.cssText = [
      "position:absolute",
      "left:0",
      "top:0",
      "pointer-events:none",
      "user-select:none",
      "z-index:5",
      "opacity:0",
      "padding:4px 12px",
      "border-radius:0",
      "background:#edebec",
      "color:#000",
      'font:500 10px "DM Mono", ui-monospace, monospace',
      "letter-spacing:0.4px",
      "white-space:nowrap",
      "line-height:1.2",
      "text-transform:uppercase",
      "transform:translate3d(-9999px,-9999px,0)",
      "will-change:transform,opacity",
      "transition:opacity 120ms ease",
    ].join(";");
    mount.appendChild(hintEl);
    demo = {
      phase: "idle",
      startedAt: 0,
      phaseAt: 0,
      box: null,
      x: 0,
      y: 0,
      opacity: 0,
      rotation: 0,
    };
  }

  function setHintVisible(visible) {
    if (!hintEl) return;
    hintEl.style.opacity = visible && !hintUnlocked ? "1" : "0";
  }

  function setHintPosition(localX, localY) {
    if (!hintEl || hintUnlocked) return;
    const offsetX = 14;
    const offsetY = 18;
    hintEl.style.transform = `translate3d(${localX + offsetX}px, ${localY + offsetY}px, 0)`;
  }

  function unlockHint() {
    if (hintUnlocked) return;
    hintUnlocked = true;
    setHintVisible(false);
  }

  function normalizeBox(aCol, aRow, bCol, bRow) {
    let c0 = Math.min(aCol, bCol);
    let c1 = Math.max(aCol, bCol);
    let r0 = Math.min(aRow, bRow);
    let r1 = Math.max(aRow, bRow);
    if (c1 === c0) {
      if (c1 < cols - 1) c1 += 1;
      else c0 -= 1;
    }
    if (r1 === r0) {
      if (r1 < rows - 1) r1 += 1;
      else r0 -= 1;
    }
    c0 = Math.max(0, Math.min(cols - 1, c0));
    c1 = Math.max(0, Math.min(cols - 1, c1));
    r0 = Math.max(0, Math.min(rows - 1, r0));
    r1 = Math.max(0, Math.min(rows - 1, r1));
    if (c1 === c0) c1 = Math.min(cols - 1, c0 + 1);
    if (r1 === r0) r1 = Math.min(rows - 1, r0 + 1);
    return { c0, r0, c1, r1 };
  }

  function boxOpacity(box, now) {
    if (box.persist) return 1;
    if (box.dragging || box.releasedAt == null) return 1;
    const hold = box.isDemo ? DEMO.boxHoldMs : BOX_HOLD_MS;
    const fade = box.isDemo ? DEMO.boxFadeMs : BOX_FADE_MS;
    const age = now - box.releasedAt;
    if (age >= hold) return 0;
    const fadeStart = hold - fade;
    if (age < fadeStart) return 1;
    return 1 - (age - fadeStart) / fade;
  }

  function pruneBoxes(now) {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (b.persist) continue;
      const hold = b.isDemo ? DEMO.boxHoldMs : BOX_HOLD_MS;
      if (!b.dragging && b.releasedAt != null && now - b.releasedAt >= hold) {
        boxes.splice(i, 1);
      }
    }
  }

  function demoStartPoint() {
    return centerOf(DEMO.startCol, DEMO.startRow);
  }

  function demoEndPoint() {
    return centerOf(DEMO.endCol, DEMO.endRow);
  }

  function demoEnterFrom() {
    const s = demoStartPoint();
    return { x: s.x + 150, y: s.y + 200 };
  }

  function setCursorVisual(x, y, opacity, rotationDeg) {
    if (!cursorEl) return;
    const scaleX = mount.clientWidth / m.width || 1;
    const scaleY = mount.clientHeight / m.height || 1;
    cursorEl.style.opacity = String(opacity);
    cursorEl.style.transform =
      `translate(${x * scaleX}px, ${y * scaleY}px) rotate(${rotationDeg}deg)`;
  }

  function beginDemo(now) {
    if (!demo || demo.phase !== "idle") return;
    const from = demoEnterFrom();
    demo.phase = "enter";
    demo.startedAt = now;
    demo.phaseAt = now;
    demo.x = from.x;
    demo.y = from.y;
    demo.opacity = 0;
    demo.rotation = 0;
    setCursorVisual(demo.x, demo.y, 0, 0);
  }

  function dismissDemo(now) {
    if (!demo) return;
    if (
      demo.phase === "idle" ||
      demo.phase === "done" ||
      demo.phase === "dismiss"
    ) {
      return;
    }
    // Interrupt mid-animation: freeze box at current size, then fade after hold
    if (demo.box && demo.phase !== "hold") {
      demo.box.dragging = false;
    }
    demo.phase = "dismiss";
    demo.phaseAt = now;
    if (demo.box) {
      demo.box.persist = false;
      demo.box.dragging = false;
      demo.box.releasedAt = now;
    }
  }

  function updateDemo(now) {
    if (!demo || demo.phase === "idle" || demo.phase === "done") return;

    const start = demoStartPoint();
    const end = demoEndPoint();
    const from = demoEnterFrom();

    if (demo.phase === "enter") {
      const elapsed = now - demo.phaseAt;
      const moveT = Math.min(1, elapsed / DEMO.moveMs);
      const fadeT = Math.min(1, elapsed / DEMO.fadeInMs);
      const e = reducedMotion ? 1 : easeInOutSlowDown(moveT);
      demo.x = lerp(from.x, start.x, e);
      demo.y = lerp(from.y, start.y, e);
      demo.opacity = reducedMotion ? 1 : fadeT;
      demo.rotation = 0;
      if (elapsed >= DEMO.moveMs) {
        demo.phase = "click";
        demo.phaseAt = now;
        demo.x = start.x;
        demo.y = start.y;
        demo.opacity = 1;
      }
    } else if (demo.phase === "click") {
      const elapsed = now - demo.phaseAt;
      const t = Math.min(1, elapsed / DEMO.clickMs);
      const e = reducedMotion ? 1 : easeInOutSlowDown(t);
      demo.x = start.x;
      demo.y = start.y;
      demo.opacity = 1;
      demo.rotation = lerp(0, DEMO.rotateDeg, e);
      if (elapsed >= DEMO.clickMs) {
        demo.phase = "drag";
        demo.phaseAt = now;
        demo.rotation = DEMO.rotateDeg;
        const color = BOX_PALETTE[0];
        const bounds = normalizeBox(
          DEMO.startCol,
          DEMO.startRow,
          DEMO.startCol,
          DEMO.startRow
        );
        demo.box = {
          ...bounds,
          hex: color.hex,
          tag: color.tag,
          dragging: true,
          releasedAt: null,
          persist: true,
          isDemo: true,
        };
        boxes.push(demo.box);
      }
    } else if (demo.phase === "drag") {
      const elapsed = now - demo.phaseAt;
      const t = Math.min(1, elapsed / DEMO.dragMs);
      const e = reducedMotion ? 1 : easeInOutSlowDown(t);
      demo.x = lerp(start.x, end.x, e);
      demo.y = lerp(start.y, end.y, e);
      demo.opacity = 1;
      demo.rotation = DEMO.rotateDeg;
      const c1 = Math.round(lerp(DEMO.startCol, DEMO.endCol, e));
      const r1 = Math.round(lerp(DEMO.startRow, DEMO.endRow, e));
      if (demo.box) {
        const bounds = normalizeBox(DEMO.startCol, DEMO.startRow, c1, r1);
        demo.box.c0 = bounds.c0;
        demo.box.r0 = bounds.r0;
        demo.box.c1 = bounds.c1;
        demo.box.r1 = bounds.r1;
      }
      if (elapsed >= DEMO.dragMs) {
        demo.phase = "hold";
        demo.phaseAt = now;
        demo.x = end.x;
        demo.y = end.y;
        if (demo.box) {
          const bounds = normalizeBox(
            DEMO.startCol,
            DEMO.startRow,
            DEMO.endCol,
            DEMO.endRow
          );
          demo.box.c0 = bounds.c0;
          demo.box.r0 = bounds.r0;
          demo.box.c1 = bounds.c1;
          demo.box.r1 = bounds.r1;
          demo.box.dragging = false;
        }
      }
    } else if (demo.phase === "hold") {
      demo.x = end.x;
      demo.y = end.y;
      demo.opacity = 1;
      demo.rotation = DEMO.rotateDeg;
    } else if (demo.phase === "dismiss") {
      const elapsed = now - demo.phaseAt;
      const t = Math.min(1, elapsed / DEMO.dismissMs);
      const e = reducedMotion ? 1 : easeInOutSlowDown(t);
      // Keep current x/y (hold position, or wherever the interrupt landed)
      demo.rotation = lerp(DEMO.rotateDeg, 0, e);
      demo.opacity = 1 - e;
      if (elapsed >= DEMO.dismissMs) {
        demo.phase = "done";
        demo.opacity = 0;
        demo.rotation = 0;
      }
    }

    setCursorVisual(demo.x, demo.y, demo.opacity, demo.rotation);
  }

  function checkDemoTrigger() {
    if (!demo || demo.phase !== "idle") return;
    const rect = mount.getBoundingClientRect();
    const lineY = rect.top + rect.height * DEMO.triggerAt;
    if (lineY <= window.innerHeight) {
      beginDemo(performance.now());
    }
  }

  function onBoxPointerDown(ev) {
    if (!enableBoxes || ev.button !== 0) return;
    // First interaction: dismiss demo cursor and start drawing in the same gesture
    if (demo && demo.phase !== "idle" && demo.phase !== "done") {
      dismissDemo(performance.now());
    }
    unlockHint();
    ev.preventDefault();
    const local = pointerToLocal(ev.clientX, ev.clientY);
    const cell = pointerToCell(local.x, local.y);
    dragStart = { col: cell.col, row: cell.row };
    const color = nextBoxColor();
    const bounds = normalizeBox(cell.col, cell.row, cell.col, cell.row);
    dragBox = {
      ...bounds,
      hex: color.hex,
      tag: color.tag,
      dragging: true,
      releasedAt: null,
    };
    boxes.push(dragBox);
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onBoxPointerMove(ev) {
    if (!dragBox || !dragStart) return;
    const local = pointerToLocal(ev.clientX, ev.clientY);
    const cell = pointerToCell(local.x, local.y);
    const bounds = normalizeBox(dragStart.col, dragStart.row, cell.col, cell.row);
    dragBox.c0 = bounds.c0;
    dragBox.r0 = bounds.r0;
    dragBox.c1 = bounds.c1;
    dragBox.r1 = bounds.r1;
  }

  function onBoxPointerUp(ev) {
    if (!dragBox) return;
    if (ev && ev.pointerId != null) {
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragBox.dragging = false;
    dragBox.releasedAt = performance.now();
    dragBox = null;
    dragStart = null;
  }

  function drawBoxPerimeter(box, alpha) {
    const { c0, r0, c1, r1, hex } = box;
    ctx.lineWidth = m.lineWidth;
    ctx.lineCap = "butt";
    ctx.strokeStyle = withAlpha(hex, alpha);
    const segs = [];
    for (let c = c0; c < c1; c++) {
      segs.push(insetSegment(c, r0, c + 1, r0));
      segs.push(insetSegment(c, r1, c + 1, r1));
    }
    for (let r = r0; r < r1; r++) {
      segs.push(insetSegment(c0, r, c0, r + 1));
      segs.push(insetSegment(c1, r, c1, r + 1));
    }
    for (const s of segs) {
      ctx.beginPath();
      ctx.moveTo(s.ax, s.ay);
      ctx.lineTo(s.bx, s.by);
      ctx.stroke();
    }
  }

  function drawDotAt(x, y, size, color, alpha) {
    const h = size / 2;
    ctx.fillStyle = withAlpha(color, alpha);
    ctx.fillRect(Math.round(x - h), Math.round(y - h), size, size);
  }

  function drawBoxChrome(box, alpha) {
    const { c0, r0, c1, r1, hex, tag } = box;
    const gapsW = c1 - c0;
    const corners = [
      [c0, r0],
      [c1, r0],
      [c0, r1],
      [c1, r1],
    ];
    const cornerKeys = new Set(corners.map(([c, r]) => `${c},${r}`));

    for (let c = c0; c <= c1; c++) {
      for (const r of [r0, r1]) {
        if (cornerKeys.has(`${c},${r}`)) continue;
        const { x, y } = centerOf(c, r);
        drawDotAt(x, y, m.dotSize, hex, alpha);
      }
    }
    for (let r = r0 + 1; r < r1; r++) {
      for (const c of [c0, c1]) {
        const { x, y } = centerOf(c, r);
        drawDotAt(x, y, m.dotSize, hex, alpha);
      }
    }

    for (const [c, r] of corners) {
      if (c === c0 && r === r0) continue;
      const { x, y } = centerOf(c, r);
      drawDotAt(x, y, BOX_CORNER_SIZE, BOX_CORNER, alpha);
    }

    const tl = centerOf(c0, r0);
    drawDotAt(tl.x, tl.y, BOX_SWATCH_SIZE, hex, alpha);
    ctx.strokeStyle = withAlpha("#989898", alpha);
    ctx.lineWidth = 0.22;
    ctx.strokeRect(
      tl.x - BOX_SWATCH_SIZE / 2,
      tl.y - BOX_SWATCH_SIZE / 2,
      BOX_SWATCH_SIZE,
      BOX_SWATCH_SIZE
    );

    if (gapsW < BOX_LABEL_MIN_GAPS) return;

    const hexStr = hex.toUpperCase();
    ctx.font = `500 ${BOX_LABEL_FONT_SIZE}px "DM Mono", ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "0px";
    const hexW = ctx.measureText(hexStr).width;

    ctx.font = `500 ${BOX_LABEL_FONT_SIZE}px "DM Mono", ui-monospace, monospace`;
    ctx.letterSpacing = `${BOX_TAG_LETTER_SPACING}px`;
    const tagW = ctx.measureText(tag).width;
    const tagPadX = BOX_TAG_PAD_X;
    const tagH = 14;
    const gap = 6;
    const swatchRight = tl.x + BOX_SWATCH_SIZE / 2;
    const hexX = swatchRight + gap;
    const tagX = hexX + hexW + gap;

    const minPillW = tagW + tagPadX * 2;
    let tagPillW = minPillW;

    // Nearest top-row dot to the right of the tag text block
    const textRight = tagX + tagPadX + tagW;
    let nearestDotLeft = null;
    for (let c = c0 + 1; c <= c1; c++) {
      const { x } = centerOf(c, r0);
      const half = c === c1 ? BOX_CORNER_SIZE / 2 : m.dotSize / 2;
      const dotLeft = x - half;
      if (dotLeft > textRight) {
        nearestDotLeft = dotLeft;
        break;
      }
    }

    if (nearestDotLeft != null) {
      const gapAtFullPill = nearestDotLeft - (tagX + minPillW);
      let margin = BOX_TAG_MARGIN;
      if (gapAtFullPill === 3) margin = BOX_TAG_MARGIN_ALT;
      const targetPillRight = nearestDotLeft - margin;
      if (tagX + minPillW > targetPillRight) {
        const shrunkW = targetPillRight - tagX;
        if (shrunkW >= minPillW) tagPillW = shrunkW;
      }
    }

    const barLeft = swatchRight + 2;
    const barRight = tagX + tagPillW;
    const barH = 23;
    ctx.fillStyle = withAlpha(m.bg, alpha);
    ctx.fillRect(barLeft, tl.y - barH / 2, barRight - barLeft, barH);

    ctx.font = `500 ${BOX_LABEL_FONT_SIZE}px "DM Mono", ui-monospace, monospace`;
    ctx.letterSpacing = "0px";
    ctx.fillStyle = withAlpha(hex, alpha);
    ctx.fillText(hexStr, hexX, tl.y);

    ctx.fillStyle = withAlpha(hex, alpha);
    ctx.fillRect(tagX, tl.y - tagH / 2, tagPillW, tagH);
    ctx.font = `500 ${BOX_LABEL_FONT_SIZE}px "DM Mono", ui-monospace, monospace`;
    ctx.letterSpacing = `${BOX_TAG_LETTER_SPACING}px`;
    ctx.fillStyle = withAlpha("#131313", alpha);
    ctx.fillText(tag, tagX + tagPadX, tl.y + 0.3);
  }

  let lastClientX = 0;
  let lastClientY = 0;
  let hasPointerSample = false;

  function syncPointerFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    if (inside) {
      pointer = pointerToLocal(clientX, clientY);
      rebuildTargets();
      setHintPosition(pointer.x, pointer.y);
      setHintVisible(true);
    } else if (pointer !== null) {
      pointer = null;
      rebuildTargets();
      setHintVisible(false);
    } else {
      setHintVisible(false);
    }
  }

  function samplePointer(ev) {
    if (typeof ev.clientX !== "number") return;
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    hasPointerSample = true;
    syncPointerFromClient(lastClientX, lastClientY);
  }

  function onScrollSync() {
    if (!hasPointerSample) return;
    syncPointerFromClient(lastClientX, lastClientY);
  }

  function onPointerLeave() {
    pointer = null;
    rebuildTargets();
    setHintVisible(false);
  }

  canvas.addEventListener("pointermove", samplePointer);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", samplePointer);
  if (enableBoxes) {
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.addEventListener("pointerdown", onBoxPointerDown);
    canvas.addEventListener("pointermove", onBoxPointerMove);
    canvas.addEventListener("pointerup", onBoxPointerUp);
    canvas.addEventListener("pointercancel", onBoxPointerUp);
  }
  document.addEventListener("pointermove", samplePointer, { passive: true });
  document.addEventListener("wheel", samplePointer, { passive: true, capture: true });
  const scrollRoot = canvas.closest(".case__scroll") || window;
  scrollRoot.addEventListener("scroll", onScrollSync, { passive: true });

  let demoScrollCleanup = null;
  if (enableDemo) {
    const onDemoScroll = () => checkDemoTrigger();
    const onDemoClick = (ev) => {
      if (!demo || demo.phase === "idle" || demo.phase === "done") return;
      if (ev.button != null && ev.button !== 0) return;
      // Clicks on the grid are handled by onBoxPointerDown (dismiss + draw).
      // Outside clicks only release the demo cursor/box.
      if (mount.contains(ev.target)) return;
      dismissDemo(performance.now());
    };
    // window + document: some hosts only fire one of these
    window.addEventListener("scroll", onDemoScroll, { passive: true });
    document.addEventListener("scroll", onDemoScroll, { passive: true, capture: true });
    if (scrollRoot !== window) {
      scrollRoot.addEventListener("scroll", onDemoScroll, { passive: true });
    }
    window.addEventListener("resize", onDemoScroll, { passive: true });
    document.addEventListener("pointerdown", onDemoClick, true);
    const demoIO =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(() => checkDemoTrigger(), {
            threshold: [0, 0.15, 0.3, 0.4, 0.5, 0.75, 1],
          })
        : null;
    demoIO?.observe(mount);
    demoScrollCleanup = () => {
      window.removeEventListener("scroll", onDemoScroll);
      document.removeEventListener("scroll", onDemoScroll, { capture: true });
      if (scrollRoot !== window) {
        scrollRoot.removeEventListener("scroll", onDemoScroll);
      }
      window.removeEventListener("resize", onDemoScroll);
      document.removeEventListener("pointerdown", onDemoClick, true);
      demoIO?.disconnect();
    };
    // Retry a few frames — layout may not be ready on the first tick
    let tries = 0;
    const boot = () => {
      checkDemoTrigger();
      if (demo?.phase === "idle" && tries++ < 12) {
        requestAnimationFrame(boot);
      }
    };
    requestAnimationFrame(boot);
  }

  let fontReady = false;
  const fontFace = new FontFace(
    "DM Mono",
    `url(${new URL("./fonts/DMMono-Medium.ttf", import.meta.url).href})`,
    { weight: "500", style: "normal" }
  );
  fontFace
    .load()
    .then((f) => {
      document.fonts.add(f);
      fontReady = true;
    })
    .catch(() => {
      fontReady = true;
    });

  let lastTs = performance.now();
  let raf = 0;

  function draw(ts) {
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    const instant = reducedMotion;

    updateDemo(ts);

    // Expire letter holds without refreshing them from the held target
    applyLetterTargets();

    for (let i = 0; i < dotCount; i++) {
      const fadeOut = letterIndices.has(i) ? m.letterFadeOutMs : m.fadeOutMs;
      dotOpacity[i] = approach(
        dotOpacity[i],
        dotTarget[i],
        dt,
        m.fadeInMs,
        fadeOut,
        instant
      );
    }

    for (const e of edges.values()) {
      if (m.lineMode === "extend") {
        e.progress = approach(
          e.progress,
          e.progressTarget,
          dt,
          m.lineExtendMs,
          m.lineRetractMs,
          instant
        );
        e.opacity = approach(
          e.opacity,
          e.opacityTarget,
          dt,
          m.fadeInMs,
          m.fadeOutMs,
          instant
        );
      } else {
        e.opacity = approach(
          e.opacity,
          e.opacityTarget,
          dt,
          m.fadeInMs,
          m.fadeOutMs,
          instant
        );
        e.progress = e.opacity > 0.001 ? 1 : 0;
      }
    }

    ctx.fillStyle = m.bg;
    ctx.fillRect(0, 0, m.width, m.height);

    ctx.lineWidth = m.lineWidth;
    ctx.lineCap = "butt";
    for (const e of edges.values()) {
      if (e.opacity < 0.001 || e.progress < 0.001) continue;

      let x0;
      let y0;
      let x1;
      let y1;

      if (m.lineMode === "extend") {
        if (e.fromA) {
          x0 = e.ax;
          y0 = e.ay;
          x1 = lerp(e.ax, e.bx, e.progress);
          y1 = lerp(e.ay, e.by, e.progress);
        } else {
          x0 = e.bx;
          y0 = e.by;
          x1 = lerp(e.bx, e.ax, e.progress);
          y1 = lerp(e.by, e.ay, e.progress);
        }
      } else {
        x0 = e.ax;
        y0 = e.ay;
        x1 = e.bx;
        y1 = e.by;
      }

      ctx.strokeStyle = withAlpha(m.lineColor, e.opacity);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    const idle = parseRgba(m.dotIdle);
    const active = parseRgba(m.dotActive);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (fontReady) {
      ctx.font = `500 ${m.letterFontSize}px "DM Mono", ui-monospace, monospace`;
    } else {
      ctx.font = `500 ${m.letterFontSize}px ui-monospace, monospace`;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(c, r);
        const o = dotOpacity[i];
        const { x, y } = centerOf(c, r);
        const letter = letterChars.get(`${c},${r}`);

        if (letter && o > 0.001) {
          // Letter replaces the dot while lit (oval strength drives opacity)
          ctx.fillStyle = withAlpha(m.letterColor, o);
          ctx.fillText(letter, x, y);
        } else {
          const a = lerp(idle.a, active.a, o);
          const rr = Math.round(lerp(idle.r, active.r, o));
          const gg = Math.round(lerp(idle.g, active.g, o));
          const bb = Math.round(lerp(idle.b, active.b, o));
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`;
          ctx.fillRect(Math.round(x - half), Math.round(y - half), m.dotSize, m.dotSize);
        }
      }
    }

    if (enableBoxes) {
      pruneBoxes(ts);
      for (const box of boxes) {
        const alpha = boxOpacity(box, ts);
        if (alpha < 0.001) continue;
        drawBoxPerimeter(box, alpha);
        drawBoxChrome(box, alpha);
      }
    }

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  return {
    canvas,
    metrics: m,
    destroy() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      demoScrollCleanup?.();
      canvas.removeEventListener("pointermove", samplePointer);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", samplePointer);
      canvas.removeEventListener("pointerdown", onBoxPointerDown);
      canvas.removeEventListener("pointermove", onBoxPointerMove);
      canvas.removeEventListener("pointerup", onBoxPointerUp);
      canvas.removeEventListener("pointercancel", onBoxPointerUp);
      document.removeEventListener("pointermove", samplePointer);
      document.removeEventListener("wheel", samplePointer, { capture: true });
      scrollRoot.removeEventListener("scroll", onScrollSync);
      canvas.remove();
      logoEl?.remove();
      cursorEl?.remove();
      hintEl?.remove();
    },
  };
}
