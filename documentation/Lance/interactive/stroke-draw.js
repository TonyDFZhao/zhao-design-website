/**
 * Lance case-study first shot: scroll-scrubbed stroke-in / stroke-out
 * for the left / middle / right hotel drawings.
 */

const SVG_URL = new URL("./frame.svg?v=lance-stroke-2", import.meta.url).href;
const STROKE_SEL = "path, line, polyline, polygon, circle, ellipse";
const STAGGER = 0.35; /* shared across all three buildings */
const CAP_FADE = 0.18;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function totalLength(el) {
  try {
    const len = el.getTotalLength();
    return Number.isFinite(len) && len > 0 ? len : 0;
  } catch {
    return 0;
  }
}

function collectPaths(svg) {
  const roots = ["left", "middle", "right"]
    .map((id) => svg.querySelector(`#${id}, [id="${id}"]`))
    .filter(Boolean);
  const scope = roots.length ? roots : [svg];
  const paths = [];

  scope.forEach((root) => {
    root.querySelectorAll(STROKE_SEL).forEach((node) => {
      const el = node;
      const stroke = el.getAttribute("stroke");
      if (!stroke || stroke === "none") return;
      if (!(el instanceof SVGGeometryElement)) return;
      const len = totalLength(el);
      if (len <= 0) return;
      el.setAttribute("vector-effect", "non-scaling-stroke");
      paths.push({
        el,
        len,
        delay: Math.random() * STAGGER,
      });
    });
  });

  return paths;
}

function applyProgress(paths, progress) {
  const span = 1 - STAGGER;
  paths.forEach(({ el, len, delay }) => {
    const local = span > 0 ? clamp((progress - delay) / span, 0, 1) : progress;
    const t = easeInOut(local);
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len * (1 - t)}`;
    /* Soft fade so round caps don’t pop in as dots */
    const fade = clamp(t / CAP_FADE, 0, 1);
    el.style.strokeOpacity = String(fade);
  });
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   scrollRoot?: HTMLElement | null,
 *   isMobile?: () => boolean,
 * }} [opts]
 */
export function mountLanceStroke(host, opts = {}) {
  const scrollRoot = opts.scrollRoot || null;
  const isMobile = typeof opts.isMobile === "function" ? opts.isMobile : () => false;

  let destroyed = false;
  let paths = [];
  let startTop = null;
  let raf = 0;
  let lastProgress = -1;

  host.classList.add("lance-stroke");
  host.innerHTML = `<div class="lance-stroke__stage" aria-hidden="true"></div>`;
  const stage = host.querySelector(".lance-stroke__stage");

  function endLineY() {
    if (scrollRoot) {
      const view = scrollRoot.getBoundingClientRect();
      return isMobile() ? view.top + view.height * 0.25 : view.top;
    }
    return isMobile() ? window.innerHeight * 0.25 : 0;
  }

  function shotEl() {
    return host.closest(".long__shot") || host;
  }

  function measureStart() {
    const shot = shotEl();
    const top = shot.getBoundingClientRect().top;
    const end = endLineY();
    /* Distance the shot top travels from “enter” to “complete”. */
    const range = top - end;
    if (range > 8) {
      startTop = top;
    } else if (startTop == null) {
      /* Already past the end line on open — keep a small range so scrub still works. */
      startTop = end + Math.max(window.innerHeight * 0.35, 120);
    }
  }

  function progressFromScroll() {
    if (startTop == null) measureStart();
    const top = shotEl().getBoundingClientRect().top;
    const end = endLineY();
    const range = startTop - end;
    if (range <= 1) return 1;
    return clamp((startTop - top) / range, 0, 1);
  }

  function paint() {
    raf = 0;
    if (destroyed || !paths.length) return;
    const p = progressFromScroll();
    if (Math.abs(p - lastProgress) < 0.001) return;
    lastProgress = p;
    applyProgress(paths, p);
  }

  function requestPaint() {
    if (raf || destroyed) return;
    raf = requestAnimationFrame(paint);
  }

  function onScroll() {
    requestPaint();
  }

  function onResize() {
    /* Recapture start relative to current scroll so deep-mode layout shifts stay honest. */
    const p = lastProgress < 0 ? 0 : lastProgress;
    const end = endLineY();
    const top = shotEl().getBoundingClientRect().top;
    if (p <= 0.001) {
      measureStart();
    } else if (p >= 0.999) {
      startTop = end + (top - end) / Math.max(p, 0.001);
    } else {
      startTop = end + (top - end) / Math.max(p, 0.001);
    }
    lastProgress = -1;
    requestPaint();
  }

  async function boot() {
    try {
      const res = await fetch(SVG_URL);
      if (!res.ok) throw new Error(`Failed to load ${SVG_URL}`);
      const text = await res.text();
      if (destroyed) return;
      stage.innerHTML = text;
      const svg = stage.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      /* Guard against empty Figma clipPaths that hide all geometry. */
      svg.querySelectorAll("clipPath").forEach((clip) => {
        if (!clip.querySelector("rect, path, circle, polygon, use")) {
          const parent = svg.querySelector(`[clip-path="url(#${clip.id})"]`);
          if (parent) parent.removeAttribute("clip-path");
          clip.remove();
        }
      });
      svg.querySelectorAll("rect").forEach((rect) => {
        const fill = (rect.getAttribute("fill") || "").toLowerCase();
        if (fill === "white" || fill === "#ffffff") rect.remove();
      });
      paths = collectPaths(svg);
      if (!paths.length) {
        console.error("Lance stroke interactive: no drawable paths found");
        return;
      }
      applyProgress(paths, 0);
      requestAnimationFrame(() => {
        measureStart();
        lastProgress = -1;
        requestPaint();
      });
    } catch (err) {
      console.error("Lance stroke interactive failed", err);
    }
  }

  if (scrollRoot) {
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  boot();

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (scrollRoot) scrollRoot.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      host.classList.remove("lance-stroke");
      host.innerHTML = "";
      paths = [];
    },
    refresh() {
      onResize();
    },
  };
}
