(function () {
  const home = document.getElementById("home");
  const feed = document.getElementById("feed");
  const rail = document.getElementById("rail");
  const railMenu = document.getElementById("rail-menu");
  const railTicks = document.getElementById("rail-ticks");
  const railMarker = document.getElementById("rail-marker");
  const learnWrap = document.getElementById("learn-more-wrap");
  const info = document.getElementById("info");
  const infoBioFull = document.getElementById("info-bio-full");
  const infoEsc = document.getElementById("info-esc");
  const infoSpacer = document.getElementById("info-spacer");
  const cvLink = document.getElementById("cv-link");

  const carousel = document.getElementById("carousel");
  const carouselFrame = document.getElementById("carousel-frame");
  const carouselSlideA = document.getElementById("carousel-slide-a");
  const carouselSlideB = document.getElementById("carousel-slide-b");
  const carouselDots = document.getElementById("carousel-dots");
  const longform = document.getElementById("longform");
  const longStage = document.getElementById("long-stage");
  const caseBox = document.getElementById("case-box");
  const caseScroll = document.getElementById("case-scroll");
  const caseInfo = document.getElementById("case-info");
  const caseImages = document.getElementById("case-images");
  const caseFooter = document.getElementById("case-footer");
  const caseSecond = document.getElementById("case-second");
  const deepPanel = document.getElementById("deep-panel");

  let activeIndex = 0;
  let openProject = null;
  let carouselIndex = 0;
  let deepOpen = false;
  let adjacentBusy = false;
  let carouselFront = carouselSlideA;
  let carouselBack = carouselSlideB;
  let carouselToken = 0;
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeActive = false;
  let closeFadeTimer = null;
  const MOBILE_MQ = "(max-width: 720px)";
  const SWIPE_MIN = 40;
  const OVERLAY_FADE_MS = 350; /* matches --dur */
  const imageCache = new Map();
  const videoCache = new Map();
  const posterCache = new Map();
  const lottieCache = new Map();
  const lottieDataCache = new Map();
  const lottiePlayers = [];
  let swapTimers = [];
  let lottieObserver = null;
  let videoLoadObserver = null;
  let interactiveCleanups = [];
  let interactiveInstances = [];
  let lottieTriggerRaf = null;

  const TICK_GAP = 8; /* matches .rail__ticks gap */

  function isMobile() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function getTickStep() {
    const tick = railTicks.querySelector(".rail__tick");
    if (!tick) return 1.5 + TICK_GAP;
    return tick.getBoundingClientRect().height + TICK_GAP;
  }

  let infoExpanded = false;
  let infoScrollLock = 0;

  function renderBioFull() {
    infoBioFull.innerHTML = SITE.bioFull
      .map((parts) => {
        const inner = parts
          .map((part) =>
            typeof part === "string"
              ? part
              : `<span class="info__em">${part.em}</span>`
          )
          .join("");
        return `<p>${inner}</p>`;
      })
      .join("");
  }

  function expandInfo() {
    if (infoExpanded || openProject) return;
    if (isMobile()) {
      infoScrollLock = home.scrollTop;
      infoSpacer.style.height = `${info.offsetHeight}px`;
    }
    infoExpanded = true;
    info.classList.add("is-expanded");
    home.classList.add("is-info-expanded");
  }

  function collapseInfo() {
    if (!infoExpanded) return;
    const savedScroll = infoScrollLock;
    infoExpanded = false;
    info.classList.remove("is-expanded");
    home.classList.remove("is-info-expanded");
    info.scrollTop = 0;
    if (isMobile()) {
      infoSpacer.style.height = "0";
      requestAnimationFrame(() => {
        home.scrollTop = savedScroll;
        requestAnimationFrame(() => {
          home.scrollTop = savedScroll;
        });
      });
    }
  }

  /* ——— Init copy ——— */
  renderBioFull();
  learnWrap.querySelector(".info__bio-text").textContent = SITE.bio;
  document.querySelector(".info__email").href = `mailto:${SITE.email}`;
  document.querySelector(".info__email").textContent = SITE.email;
  if (SITE.cv && SITE.cv !== "#") cvLink.href = SITE.cv;

  learnWrap.addEventListener("click", expandInfo);
  infoEsc.addEventListener("click", collapseInfo);

  /* ——— Feed ——— */
  function renderFeed() {
    feed.innerHTML = "";
    PROJECTS.forEach((project, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "project";
      btn.dataset.index = String(index);
      btn.id = `project-${project.id}`;
      btn.innerHTML = `
        <div class="project__thumb project__thumb--${project.aspect}${project.thumb ? " has-image" : ""}${project.border ? " has-stroke" : ""}">
          <div class="project__thumb-media${project.thumbFit === "fill" ? " is-fill" : ""}"${project.thumb ? ` style="background-image: url('${project.thumb}')"` : ""}></div>
        </div>
        <div class="project__meta">
          <div class="project__left">
            <span>${project.number}</span>
            <span>${project.title}</span>
          </div>
          <span class="project__date">${project.date}</span>
        </div>
      `;
      btn.addEventListener("click", () => openFromIndex(index));
      feed.appendChild(btn);
    });
  }

  /* ——— Rail menu + progress ——— */
  function renderRailMenu() {
    railMenu.innerHTML = PROJECTS.map(
      (project, index) => `
      <button class="rail__item" type="button" data-index="${index}">
        <span>${project.title}</span>
      </button>
    `
    ).join("");

    railMenu.querySelectorAll(".rail__item").forEach((item) => {
      item.addEventListener("click", () => {
        const index = Number(item.dataset.index);
        scrollToProject(index, true);
      });
    });

    lockRailMenuWidth();
  }

  function lockRailMenuWidth() {
    const wasHidden = getComputedStyle(railMenu).visibility === "hidden";
    const prev = {
      opacity: railMenu.style.opacity,
      visibility: railMenu.style.visibility,
      transform: railMenu.style.transform,
      pointerEvents: railMenu.style.pointerEvents,
    };
    railMenu.style.opacity = "0";
    railMenu.style.visibility = "visible";
    railMenu.style.transform = "none";
    railMenu.style.pointerEvents = "none";
    railMenu.style.minWidth = "0";

    const width = Math.ceil(railMenu.getBoundingClientRect().width);
    railMenu.style.minWidth = `${width}px`;
    document.documentElement.style.setProperty("--rail-menu-width", `${width}px`);

    if (wasHidden) {
      railMenu.style.opacity = prev.opacity;
      railMenu.style.visibility = prev.visibility;
      railMenu.style.transform = prev.transform;
      railMenu.style.pointerEvents = prev.pointerEvents;
    }
  }

  function renderTicks() {
    railTicks.innerHTML = PROJECTS.map(
      () => `<span class="rail__tick"></span>`
    ).join("");
  }

  function activeSlot(index) {
    const total = PROJECTS.length;
    if (index <= 0) return 0;
    if (index === 1) return 1;
    if (index >= 2 && index <= 9) return 2;
    if (index === total - 2) return 3;
    return 4;
  }

  function updateProgress() {
    const step = getTickStep();
    const slot = activeSlot(activeIndex);
    const offset = -(activeIndex - slot) * step;
    railTicks.style.transform = `translateY(${offset}px)`;
    railMarker.style.transform = `translateY(${slot * step}px)`;

    railTicks.querySelectorAll(".rail__tick").forEach((tick, i) => {
      tick.classList.toggle("is-active", i === activeIndex);
    });

    railMenu.querySelectorAll(".rail__item").forEach((item, i) => {
      item.classList.toggle("is-active", i === activeIndex);
    });

    feed.querySelectorAll(".project").forEach((el, i) => {
      el.classList.toggle("is-active", i === activeIndex);
    });
  }

  function getClosestProjectIndex() {
    const mid = window.innerHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    feed.querySelectorAll(".project").forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function onScroll() {
    if (openProject) return;
    activeIndex = getClosestProjectIndex();
    updateProgress();
  }

  function scrollHomeToProject(index, instant) {
    const el = feed.querySelectorAll(".project")[index];
    if (!el) return;
    const homeRect = home.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target =
      home.scrollTop +
      (elRect.top - homeRect.top) +
      elRect.height / 2 -
      home.clientHeight / 2;
    home.scrollTo({
      top: Math.max(0, target),
      behavior: instant ? "auto" : "smooth",
    });
  }

  function scrollToProject(index, thenOpen) {
    activeIndex = index;
    updateProgress();
    if (thenOpen) {
      openFromIndex(index);
      return;
    }
    scrollHomeToProject(index);
  }

  /* ——— Open / close projects ——— */
  function dimHome(on, mode) {
    home.classList.remove("is-dimmed", "is-dimmed-full");
    if (on) {
      home.classList.add(mode === "full" ? "is-dimmed-full" : "is-dimmed");
    }
    document.body.classList.toggle("is-locked", on);
  }

  function openFromIndex(index) {
    const project = PROJECTS[index];
    activeIndex = index;
    updateProgress();
    openProject = project;
    dimHome(true, project.type === "long" ? "full" : "soft");
    if (project.type === "carousel") openCarousel(project);
    else openLongform(project);
  }

  function closeAll() {
    const index = openProject
      ? PROJECTS.findIndex((p) => p.id === openProject.id)
      : activeIndex;
    clearTimeout(deepTimer);
    clearTimeout(closeFadeTimer);
    stopAnchorLock();
    clearDeepScrollLock();
    adjacentBusy = false;

    /*
      If deep read (or mobile sheet) is open, keep that layout while the
      overlay fades out — don’t animate back to normal under the fade.
      Reset deep chrome after the overlay is invisible.
    */
    const leaveDeepVisible =
      deepOpen ||
      longStage.classList.contains("is-deep") ||
      longStage.classList.contains("is-sheet");

    deepOpen = false;
    document.getElementById("long-esc")?.classList.remove("is-inset");
    /* Keep back/expand/deep classes until after fade when leaveDeepVisible */

    pauseSlideVideo(carouselSlideA);
    pauseSlideVideo(carouselSlideB);
    destroyLotties();
    destroyInteractives();
    stopSwapSlots();
    carousel.classList.remove("is-open");
    carousel.setAttribute("aria-hidden", "true");
    longform.classList.remove("is-open");
    longform.setAttribute("aria-hidden", "true");
    if (index >= 0) {
      activeIndex = index;
      scrollHomeToProject(index, true);
      updateProgress();
    }
    openProject = null;
    dimHome(false);

    const finishClose = () => {
      closeFadeTimer = null;
      longStage.classList.remove(
        "is-deep",
        "is-deep-ui",
        "is-deep-closing",
        "is-deep-prep",
        "is-fading",
        "is-sheet"
      );
      document.documentElement.style.removeProperty("--info-shift");
      clearSecondGap();
      document.getElementById("expand-story")?.classList.remove("is-open");
      document.getElementById("expand-answer")?.classList.remove("is-open");
      document.getElementById("long-back")?.classList.remove("is-inset");
      deepPanel?.setAttribute("aria-hidden", "true");
    };

    if (leaveDeepVisible) {
      longStage.classList.add("is-deep-prep"); /* freeze any mid-transition */
      closeFadeTimer = setTimeout(finishClose, OVERLAY_FADE_MS);
    } else {
      finishClose();
    }
  }

  /* ——— Media helpers ——— */
  function mediaTypeFromSrc(src) {
    const ext = (String(src).split(".").pop() || "").toLowerCase().split("?")[0];
    if (ext === "mp4" || ext === "webm" || ext === "mov") return "video";
    if (ext === "json") return "lottie";
    return "image";
  }

  function stripVideoChrome(video) {
    if (!video) return;
    video.controls = false;
    video.removeAttribute("controls");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute(
      "controlslist",
      "nodownload nofullscreen noremoteplayback noplaybackrate"
    );
  }

  function slideLottie(el) {
    return el.querySelector(".carousel__lottie");
  }

  function destroyLotties(scope) {
    if (!scope && lottieObserver) {
      lottieObserver.disconnect();
      lottieObserver = null;
    }
    for (let i = lottiePlayers.length - 1; i >= 0; i--) {
      const player = lottiePlayers[i];
      if (scope && player.el !== scope && !scope.contains(player.el)) continue;
      try {
        player.ro?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        player.anim.destroy();
      } catch {
        /* ignore */
      }
      lottiePlayers.splice(i, 1);
    }
  }

  function loadLottieData(src) {
    if (!src) return Promise.resolve(null);
    if (lottieDataCache.has(src)) return lottieDataCache.get(src);
    const promise = fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${src}`);
        return res.json();
      })
      .catch((err) => {
        lottieDataCache.delete(src);
        throw err;
      });
    lottieDataCache.set(src, promise);
    return promise;
  }

  function whenElementSized(el) {
    if (el.clientWidth > 1 && el.clientHeight > 1) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        ro?.disconnect();
        resolve();
      };
      const ro =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => {
              if (el.clientWidth > 1 && el.clientHeight > 1) done();
            })
          : null;
      if (ro) ro.observe(el);
      requestAnimationFrame(() => {
        if (el.clientWidth > 1 && el.clientHeight > 1) done();
      });
      setTimeout(done, 400);
    });
  }

  function offsetLottiePos(value, dx, dy) {
    if (!Array.isArray(value)) return value;
    const next = value.slice();
    next[0] = (next[0] || 0) + dx;
    next[1] = (next[1] || 0) + dy;
    return next;
  }

  function applyLottieView(data, container) {
    if (!data || !container) return data;
    const vw = Number(container.dataset.lottieViewW);
    const vh = Number(container.dataset.lottieViewH);
    const vx = Number(container.dataset.lottieViewX) || 0;
    const vy = Number(container.dataset.lottieViewY) || 0;
    if (!vw || !vh) return data;
    const layers = (data.layers || []).map((layer) => {
      if (layer.parent != null) return layer;
      const ks = { ...(layer.ks || {}) };
      const src = ks.p && typeof ks.p === "object" ? ks.p : { a: 0, k: [0, 0, 0] };
      const p = { ...src };
      if (p.a === 1 && Array.isArray(p.k)) {
        p.k = p.k.map((kf) => ({
          ...kf,
          s: offsetLottiePos(kf.s, vx, vy),
          e: kf.e ? offsetLottiePos(kf.e, vx, vy) : kf.e,
        }));
      } else {
        p.a = 0;
        p.k = offsetLottiePos(Array.isArray(p.k) ? p.k : [0, 0, 0], vx, vy);
      }
      ks.p = p;
      return { ...layer, ks };
    });
    return { ...data, w: vw, h: vh, layers };
  }

  function playLottie(container, src) {
    if (!container || !src || !window.lottie) return null;
    destroyLotties(container);
    container.replaceChildren();
    const token = {};
    container._lottieToken = token;
    const fit = container.dataset.lottieFit || "contain";
    const renderer = container.dataset.lottieRenderer || "canvas";
    const dpr = Number(container.dataset.lottieDpr);
    const preserve =
      fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";

    const start = (animationData) => {
      if (container._lottieToken !== token || !container.isConnected) return null;
      const params = {
        container,
        renderer,
        loop: true,
        autoplay: false,
        rendererSettings: {
          preserveAspectRatio: preserve,
          clearCanvas: true,
          hideOnTransparent: false,
          progressiveLoad: true,
          imagePreserveAspectRatio: preserve,
        },
      };
      if (dpr > 0) params.rendererSettings.dpr = dpr;
      if (animationData) params.animationData = animationData;
      else params.path = src;
      const anim = window.lottie.loadAnimation(params);
      const resize = () => {
        try {
          anim.resize();
        } catch {
          /* ignore */
        }
      };
      const player = { el: container, anim, src, ro: null, started: false };
      anim.addEventListener("DOMLoaded", () => {
        requestAnimationFrame(() => {
          resize();
          if (!player.started) {
            try {
              anim.goToAndStop(0, true);
            } catch {
              /* ignore */
            }
          }
          maybeStartLottie(player);
        });
      });
      const ro =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(resize)
          : null;
      if (ro) ro.observe(container);
      player.ro = ro;
      lottiePlayers.push(player);
      return anim;
    };

    whenElementSized(container)
      .then(() => {
        if (container._lottieToken !== token) return null;
        return loadLottieData(src);
      })
      .then((data) => start(applyLottieView(data, container)))
      .catch(() => start(null));
    return null;
  }

  function lottieTriggerHost(el) {
    return el?.closest(".long__shot, .carousel__slide") || el;
  }

  /*
    Universal longform motion trigger (Lottie + video):
    default — play when 50% of the shot’s height is above the line 10% from
    the bottom of the viewport (mid-point reaches the bottom 10% band).
    data-play-trigger="top" — play when the top of the shot reaches that line.
    data-play-trigger="immediate" — play as soon as the case page opens.
  */
  function isScrollPlayTrigger(el) {
    const host = lottieTriggerHost(el);
    if (!host) return false;
    const mode =
      el?.dataset?.playTrigger ||
      host?.dataset?.playTrigger ||
      "mid";
    if (mode === "immediate") return true;
    const rect = host.getBoundingClientRect();
    if (rect.height <= 0) return false;
    const line = window.innerHeight * 0.9;
    if (mode === "top") return rect.top <= line;
    const above = Math.max(0, Math.min(rect.bottom, line) - rect.top);
    return above / rect.height >= 0.5;
  }

  function maybeStartLottie(player) {
    if (!player || player.started || !player.anim) return;
    if (!isScrollPlayTrigger(player.el)) return;
    player.started = true;
    try {
      player.anim.goToAndPlay(0, true);
    } catch {
      try {
        player.anim.play();
      } catch {
        /* ignore */
      }
    }
  }

  const VIDEO_CACHE_BUST = "fs1";

  function videoUrl(src) {
    if (!src) return src;
    return src + (src.includes("?") ? "&" : "?") + "v=" + VIDEO_CACHE_BUST;
  }

  function ensureVideoSrc(video) {
    const src = video?.dataset?.src;
    if (!src) return;
    const url = videoUrl(src);
    if (video.getAttribute("src") === url) return;
    video.preload = "auto";
    video.src = url;
    video.load();
  }

  function maybeStartLongVideo(video) {
    if (!video || !video.isConnected) return;
    if (video.dataset.scrollPlayed === "1") return;
    if (!isScrollPlayTrigger(video)) return;
    ensureVideoSrc(video);
    if (video.readyState < 2) return;
    const play = video.play();
    if (play && typeof play.then === "function") {
      play
        .then(() => {
          if (!video.paused) video.dataset.scrollPlayed = "1";
        })
        .catch(() => {});
    }
  }

  function checkLottieTriggers() {
    lottiePlayers.forEach(maybeStartLottie);
    document.querySelectorAll("#long-media .long__video").forEach(maybeStartLongVideo);
  }

  function stopLottieTriggerWatch() {
    if (lottieTriggerRaf) {
      cancelAnimationFrame(lottieTriggerRaf);
      lottieTriggerRaf = null;
    }
  }

  function watchLottieTriggers(durationMs) {
    stopLottieTriggerWatch();
    const start = performance.now();
    function frame(now) {
      checkLottieTriggers();
      if (now - start < durationMs) {
        lottieTriggerRaf = requestAnimationFrame(frame);
      } else {
        lottieTriggerRaf = null;
        checkLottieTriggers();
      }
    }
    lottieTriggerRaf = requestAnimationFrame(frame);
  }

  function bindLotties(root) {
    if (lottieObserver) {
      lottieObserver.disconnect();
      lottieObserver = null;
    }
    if (!root) return;
    const nodes = [...root.querySelectorAll("[data-lottie]")];
    const videoHosts = [...root.querySelectorAll(".long__video")].map(
      (video) => video.closest(".long__shot") || video
    );
    nodes.forEach((el) => {
      if (!el.dataset.lottie || el.dataset.lottieBound === "1") return;
      el.dataset.lottieBound = "1";
      playLottie(el, el.dataset.lottie);
    });

    const observeTargets = [
      ...nodes.map((el) => el.closest(".long__shot") || el),
      ...videoHosts,
    ].filter((el, i, arr) => el && arr.indexOf(el) === i);

    if (!observeTargets.length) return;

    if (typeof IntersectionObserver !== "function") {
      checkLottieTriggers();
      return;
    }

    lottieObserver = new IntersectionObserver(
      () => checkLottieTriggers(),
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    observeTargets.forEach((el) => lottieObserver.observe(el));
    checkLottieTriggers();
  }

  function bindLongVideos(root) {
    if (videoLoadObserver) {
      videoLoadObserver.disconnect();
      videoLoadObserver = null;
    }
    if (!root) return;
    const videos = [...root.querySelectorAll(".long__video")];
    videos.forEach((video) => {
      const src = video.dataset.src;
      if (!src) return;
      stripVideoChrome(video);
      video.controls = false;
      video.removeAttribute("controls");
      video.muted = true;
      video.loop = true;
      video.autoplay = false;
      video.removeAttribute("autoplay");
      video.dataset.scrollPlayed = "0";
      video.preload = "none";
      video.addEventListener("loadeddata", () => {
        if (video.dataset.playTrigger === "immediate") {
          maybeStartLongVideo(video);
          return;
        }
        try {
          video.pause();
          if (video.currentTime > 0.05) video.currentTime = 0;
        } catch {
          /* ignore */
        }
        maybeStartLongVideo(video);
      });
      video.addEventListener("canplay", () => maybeStartLongVideo(video));
      if (video.dataset.playTrigger === "immediate") ensureVideoSrc(video);
    });

    const pending = videos.filter(
      (video) => video.dataset.src && video.dataset.playTrigger !== "immediate"
    );
    if (!pending.length) return;

    if (typeof IntersectionObserver !== "function") {
      pending.forEach(ensureVideoSrc);
      return;
    }

    videoLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          ensureVideoSrc(entry.target);
          videoLoadObserver?.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "600px 0px 900px 0px", threshold: 0.01 }
    );
    pending.forEach((video) => videoLoadObserver.observe(video));
  }

  function destroyInteractives() {
    interactiveCleanups.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
    interactiveCleanups = [];
    interactiveInstances = [];
  }

  function refreshInteractives() {
    interactiveInstances.forEach((instance) => {
      try {
        instance.refresh?.();
      } catch (_) {}
    });
  }

  function bindInteractives(root) {
    destroyInteractives();
    if (!root) return;
    const nodes = [...root.querySelectorAll("[data-interactive]")];
    if (!nodes.length) return;

    const confidentNodes = nodes.filter((el) =>
      ["first", "grid", "last"].includes(el.dataset.interactive)
    );
    const lanceNodes = nodes.filter(
      (el) => el.dataset.interactive === "lance-stroke"
    );

    if (confidentNodes.length) {
      import(
        new URL(
          "documentation/confident-ai/interactive/grid-bg.js?v=confident-33",
          document.baseURI
        ).href
      )
        .then(({ mountDotGrid, LETTER_LINES }) => {
          confidentNodes.forEach((el) => {
            if (el.dataset.interactiveBound === "1") return;
            el.dataset.interactiveBound = "1";
            const variant = el.dataset.interactive;
            const opts = {};
            if (variant === "first") {
              opts.letterLines = LETTER_LINES;
            }
            if (variant === "grid") {
              opts.enableBoxes = true;
              opts.enableDemo = true;
            }
            if (variant === "last") {
              opts.logo = {
                src: "documentation/confident-ai/interactive/confident-ai-wordmark.svg",
                left: 9,
                top: 498,
                width: 1007,
                height: 196,
              };
            }
            const instance = mountDotGrid(el, opts);
            interactiveInstances.push(instance);
            interactiveCleanups.push(() => instance.destroy());
          });
        })
        .catch((err) => {
          console.error("Failed to load interactive grid", err);
        });
    }

    if (lanceNodes.length) {
      import(
        new URL(
          "documentation/Lance/interactive/stroke-draw.js?v=lance-stroke-2",
          document.baseURI
        ).href
      )
        .then(({ mountLanceStroke }) => {
          lanceNodes.forEach((el) => {
            if (el.dataset.interactiveBound === "1") return;
            el.dataset.interactiveBound = "1";
            const instance = mountLanceStroke(el, {
              scrollRoot: caseScroll,
              isMobile,
            });
            interactiveInstances.push(instance);
            interactiveCleanups.push(() => instance.destroy());
          });
        })
        .catch((err) => {
          console.error("Failed to load Lance stroke interactive", err);
        });
    }
  }

  function stopSwapSlots() {
    swapTimers.forEach((id) => clearInterval(id));
    swapTimers = [];
  }

  function startSwapSlots(root) {
    stopSwapSlots();
    if (!root) return;
    root.querySelectorAll(".long__swap").forEach((slot) => {
      const imgs = [...slot.querySelectorAll(".swap__img")];
      const dots = [...slot.querySelectorAll(".swap__dot")];
      if (imgs.length < 2) return;
      let index = 0;
      const id = setInterval(() => {
        imgs[index].classList.remove("is-active");
        dots[index]?.classList.remove("is-active");
        index = (index + 1) % imgs.length;
        imgs[index].classList.add("is-active");
        dots[index]?.classList.add("is-active");
      }, 3000);
      swapTimers.push(id);
    });
  }

  /* ——— Carousel ——— */
  function getCarouselMedia(project) {
    const bordered = new Set(project.borderSlides || []);
    const list = (project.media && project.media.length
      ? project.media
      : (project.videos && project.videos.length
          ? project.videos
          : project.images) || []);
    return list.map((item, i) => {
      if (typeof item === "string") {
        return {
          type: mediaTypeFromSrc(item),
          src: item,
          border: bordered.has(i),
        };
      }
      return {
        ...item,
        type: item.type || mediaTypeFromSrc(item.src),
        border: item.border || bordered.has(i),
      };
    });
  }

  function slideVideo(el) {
    return el.querySelector(".carousel__video");
  }

  function clearSlide(el) {
    const video = slideVideo(el);
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.removeAttribute("poster");
      video.style.objectFit = "";
      video.load();
    }
    const lottieEl = slideLottie(el);
    if (lottieEl) {
      destroyLotties(lottieEl);
      lottieEl.replaceChildren();
    }
    el.style.backgroundImage = "";
    el.style.backgroundSize = "";
    el.style.backgroundColor = "";
    el.classList.remove(
      "has-image",
      "has-video",
      "has-lottie",
      "is-visible",
      "has-stroke"
    );
    el.classList.add("greybox");
  }

  function pauseSlideVideo(el) {
    const video = slideVideo(el);
    if (!video) return;
    video.removeAttribute("data-play-token");
    if (video._playRetry) {
      video.removeEventListener("canplay", video._playRetry);
      video.removeEventListener("loadeddata", video._playRetry);
      video._playRetry = null;
    }
    video.pause();
  }

  function playSlideVideo(el) {
    const video = slideVideo(el);
    if (!video || !(video.getAttribute("src") || video.src)) return;
    stripVideoChrome(video);
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    const token = String(Date.now()) + Math.random();
    video.setAttribute("data-play-token", token);
    if (video._playRetry) {
      video.removeEventListener("canplay", video._playRetry);
      video.removeEventListener("loadeddata", video._playRetry);
    }
    const tryPlay = () => {
      if (video.getAttribute("data-play-token") !== token) return;
      if (!video.paused && !video.ended) return;
      const play = video.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
    };
    video._playRetry = tryPlay;
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    tryPlay();
  }

  function preloadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => {
        imageCache.delete(src);
        reject(new Error(`Failed to load ${src}`));
      };
      img.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  /* Capture first decoded frame → blob URL (cached) for poster while video buffers */
  function getVideoPoster(src) {
    if (!src) return Promise.resolve(null);
    if (posterCache.has(src)) return posterCache.get(src);

    const promise = new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      let settled = false;

      const finish = (url) => {
        if (settled) return;
        settled = true;
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.removeAttribute("src");
        video.load();
        resolve(url);
      };

      const snap = () => {
        try {
          if (!video.videoWidth || !video.videoHeight) {
            finish(null);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                finish(URL.createObjectURL(blob));
                return;
              }
              try {
                finish(canvas.toDataURL("image/jpeg", 0.85));
              } catch {
                finish(null);
              }
            },
            "image/jpeg",
            0.85
          );
        } catch {
          finish(null);
        }
      };

      video.onerror = () => {
        posterCache.delete(src);
        finish(null);
      };

      video.onloadeddata = () => {
        const fallback = setTimeout(snap, 250);
        video.onseeked = () => {
          clearTimeout(fallback);
          snap();
        };
        try {
          video.currentTime = 0.001;
        } catch {
          clearTimeout(fallback);
          snap();
        }
      };

      video.src = src;
      video.load();
    });

    posterCache.set(src, promise);
    return promise;
  }

  function preloadVideo(src) {
    if (!src) return Promise.resolve(null);
    if (videoCache.has(src)) return videoCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const done = () => {
        video.oncanplaythrough = null;
        video.onloadeddata = null;
        video.onerror = null;
        resolve(src);
      };
      video.oncanplaythrough = done;
      video.onloadeddata = done;
      video.onerror = () => {
        videoCache.delete(src);
        reject(new Error(`Failed to load ${src}`));
      };
      video.src = src;
      video.load();
    });
    videoCache.set(src, promise);
    return promise;
  }

  function preloadLottie(src) {
    if (!src) return Promise.resolve(null);
    if (lottieCache.has(src)) return lottieCache.get(src);
    const promise = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${src}`);
      return src;
    }).catch((err) => {
      lottieCache.delete(src);
      throw err;
    });
    lottieCache.set(src, promise);
    return promise;
  }

  function preloadMedia(item) {
    if (!item) return Promise.resolve(null);
    if (item.type === "video") return preloadVideo(item.src);
    if (item.type === "lottie") return preloadLottie(item.src);
    return preloadImage(item.src);
  }

  function preloadProjectMedia(project) {
    const media = getCarouselMedia(project);
    /* Images/Lottie only — hidden <video> preloaders compete with the
       visible player for the browser’s decoder slots and can stall playback. */
    return Promise.allSettled(
      media.filter((item) => item.type !== "video").map(preloadMedia)
    );
  }

  function applyMediaToSlide(el, item, poster) {
    const video = slideVideo(el);
    const lottieEl = slideLottie(el);
    const fit = item.fit === "contain" ? "contain" : "cover";
    el.classList.toggle("has-stroke", !!item.border);
    el.style.backgroundSize = fit;
    el.style.backgroundColor = item.bg || "";
    if (lottieEl) {
      destroyLotties(lottieEl);
      lottieEl.replaceChildren();
    }

    if (item.type === "lottie") {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.removeAttribute("poster");
        video.load();
      }
      el.style.backgroundImage = "";
      el.classList.remove("has-image", "has-video", "greybox");
      el.classList.add("has-lottie");
      if (lottieEl) playLottie(lottieEl, item.src);
      return;
    }

    if (item.type === "video") {
      el.style.backgroundImage = poster ? `url("${poster}")` : "";
      el.classList.remove("has-image", "has-lottie", "greybox");
      el.classList.add("has-video");
      if (video) {
        stripVideoChrome(video);
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.style.objectFit = fit;
        if (poster) video.poster = poster;
        if (video.getAttribute("src") !== videoUrl(item.src)) {
          video.src = videoUrl(item.src);
          video.load();
        }
      }
      return;
    }

    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.removeAttribute("poster");
      video.load();
    }
    el.style.backgroundImage = `url("${item.src}")`;
    el.style.backgroundRepeat = "no-repeat";
    el.classList.remove("has-video", "has-lottie", "greybox");
    el.classList.add("has-image");
  }

  function openCarousel(project) {
    carouselIndex = 0;
    carouselToken += 1;
    carouselFront = carouselSlideA;
    carouselBack = carouselSlideB;
    clearSlide(carouselSlideA);
    clearSlide(carouselSlideB);

    document.getElementById("carousel-num").textContent = project.number;
    document.getElementById("carousel-title").textContent = project.title;
    document.getElementById("carousel-sub").textContent = project.subtitle || "";
    document.getElementById("carousel-intro").hidden = !project.subtitle;
    document.getElementById("carousel-status").textContent =
      project.status || "";
    document.getElementById("carousel-date").textContent = project.date;
    const media = getCarouselMedia(project);
    renderCarouselDots(media.length || project.slides || 1);
    document
      .getElementById("carousel-frame")
      .classList.toggle("has-stroke", !!project.border);
    carousel.classList.add("is-open");
    carousel.setAttribute("aria-hidden", "false");
    preloadProjectMedia(project);
    updateCarouselSlide();
    updateCarouselMetaFit();
  }

  function updateCarouselMetaFit() {
    const meta = document.querySelector(".carousel__meta");
    if (!meta || !carousel.classList.contains("is-open")) return;

    meta.classList.remove("is-compact");
    const intro = document.getElementById("carousel-intro");
    if (!intro || intro.hidden) return;

    const left = meta.querySelector(".carousel__meta-left");
    const date = document.getElementById("carousel-date");
    const gap =
      parseFloat(getComputedStyle(meta).gap) ||
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--carousel-meta-gap"
        )
      ) ||
      20;
    const needed = left.scrollWidth + gap + date.getBoundingClientRect().width;
    if (needed > meta.clientWidth + 0.5) meta.classList.add("is-compact");
  }

  function renderCarouselDots(count) {
    carouselDots.innerHTML = Array.from({ length: count }, (_, i) =>
      `<button class="carousel__dot${i === 0 ? " is-active" : ""}" type="button" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`
    ).join("");

    carouselDots.querySelectorAll(".carousel__dot").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = Number(dot.dataset.index);
        if (!openProject || Number.isNaN(index) || index === carouselIndex) return;
        carouselIndex = index;
        updateCarouselSlide();
      });
    });
  }

  function updateCarouselDots() {
    [...carouselDots.children].forEach((dot, i) => {
      dot.classList.toggle("is-active", i === carouselIndex);
    });
  }

  function updateCarouselSlide() {
    if (!openProject) return;
    const media = getCarouselMedia(openProject);
    const item = media[carouselIndex];
    const token = ++carouselToken;
    updateCarouselDots();

    if (!item) {
      clearSlide(carouselBack);
      carouselFront.classList.add("greybox", "is-visible");
      carouselFront.classList.remove("has-image", "has-video", "has-lottie");
      pauseSlideVideo(carouselBack);
      return;
    }

    const reveal = (poster) => {
      if (token !== carouselToken || !openProject) return;

      if (!carouselFront.classList.contains("is-visible")) {
        applyMediaToSlide(carouselFront, item, poster);
        carouselFront.classList.add("is-visible");
        if (item.type === "video") playSlideVideo(carouselFront);
        return;
      }

      applyMediaToSlide(carouselBack, item, poster);

      requestAnimationFrame(() => {
        if (token !== carouselToken) return;
        carouselBack.classList.add("is-visible");
        carouselFront.classList.remove("is-visible");
        pauseSlideVideo(carouselFront);
        if (item.type === "video") playSlideVideo(carouselBack);
        const outgoing = carouselFront;
        carouselFront = carouselBack;
        carouselBack = outgoing;
        setTimeout(() => {
          if (token !== carouselToken) return;
          if (carouselBack === outgoing) clearSlide(outgoing);
        }, 400);
      });
    };

    if (item.type === "video") {
      reveal(null);
      return;
    }

    preloadMedia(item)
      .then(() => reveal(null))
      .catch(() => {
        if (token !== carouselToken) return;
        carouselFront.classList.add("greybox", "is-visible");
        carouselFront.classList.remove("has-image", "has-video", "has-lottie");
      });
  }

  function stepCarousel(dir) {
    if (!openProject) return;
    const media = getCarouselMedia(openProject);
    const max = media.length || openProject.slides || 1;
    carouselIndex = (carouselIndex + dir + max) % max;
    updateCarouselSlide();
  }

  /* ——— Long form ——— */
  function questionBlockHTML(text) {
    const html = String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    return `
      <div class="long__question-block" id="long-question-block">
        <p class="long__question" id="long-question">${html}</p>
        <button class="expand expand--story" id="expand-answer" type="button">
          <span class="expand__label">Design Story</span>
          <img class="expand__icon" src="assets/plus.svg" alt="" width="16" height="16" />
        </button>
      </div>`;
  }

  function splitItems(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function splitColumnHTML(items) {
    const list = splitItems(items);
    if (!list.length) return "";
    if (list.length === 1) {
      return mediaFigureHTML(list[0], false, { split: true, flex: 1 });
    }
    return `<div class="long__split-col">${list
      .map((item) => mediaFigureHTML(item))
      .join("")}</div>`;
  }

  function splitBlockHTML(block) {
    const leftHTML = splitColumnHTML(block.left);
    const rightHTML = splitColumnHTML(block.right);
    if (!leftHTML || !rightHTML) return "";
    /* Equal columns: stacked images share the opposite height when ARs match the design. */
    return `
      <div class="long__split">
        ${leftHTML}
        ${rightHTML}
      </div>`;
  }

  function mediaFigureHTML(item, inRow = false, splitOpts = null) {
    const REF_CASE_W = 1048; /* design width used when gallery heights were authored */
    const classes = [
      "long__shot",
      item.framed ? "long__shot--framed" : "",
      item.flex ? "long__shot--flex" : "",
      item.border ? "has-stroke" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const style = [];
    if (item.border && item.borderAlpha != null) {
      style.push(`--stroke-alpha:${item.borderAlpha}`);
    }
    if (inRow) {
      const arW = item.width || 1;
      const arH = item.height || 1;
      const grow = item.flex ? 1 : arW / arH;
      style.push(`--shot-ar:${arW} / ${arH}`);
      style.push(`--shot-flex:${grow}`);
    } else if (splitOpts?.split) {
      const arW = item.width || 1;
      const arH = item.height || 1;
      style.push(`--shot-ar:${arW} / ${arH}`);
      style.push(`--shot-flex:${splitOpts.flex || arW / arH}`);
    } else {
      let ar = item.aspect || "";
      if (!ar && item.width && item.height) ar = `${item.width} / ${item.height}`;
      if (!ar && item.height) ar = `${REF_CASE_W} / ${item.height}`;
      if (ar) style.push(`aspect-ratio:${ar}`);
    }
    const styleAttr = style.filter(Boolean).join(";");

    const applyStage = (mediaHTML) => {
      const stage = item.stage;
      const styles = [...style];
      if (item.bg) styles.push(`background:${item.bg}`);
      if (stage) {
        const frameW = stage.frameW || item.width || 1;
        const innerW = stage.innerW || 1;
        const innerH = stage.innerH || innerW;
        styles.push(`--stage-bg:${stage.bg || "#aa947d"}`);
        styles.push(`--stage-inner-w:${(innerW / frameW) * 100}%`);
        styles.push(`--stage-inner-ar:${innerW} / ${innerH}`);
        styles.push(`--stage-inner-pad:${(innerH / innerW) * 100}%`);
      }
      const stageStyle = styles.filter(Boolean).join(";");
      const inner = stage
        ? `<div class="long__stage-inner"><div class="long__stage-ratio" aria-hidden="true"></div>${mediaHTML}</div>`
        : mediaHTML;
      return `
        <figure class="${classes}${stage ? " long__shot--stage" : ""}"${stageStyle ? ` style="${stageStyle}"` : ""}>
          ${inner}
        </figure>`;
    };

    if (item.type === "swap") {
      const srcs = item.srcs || [];
      const imgs = srcs
        .map(
          (src, i) =>
            `<img class="swap__img${i === 0 ? " is-active" : ""}" src="${src}" alt="">`
        )
        .join("");
      const dots = srcs
        .map(
          (_, i) =>
            `<span class="swap__dot${i === 0 ? " is-active" : ""}"></span>`
        )
        .join("");
      return `
        <figure class="${classes} long__swap"${styleAttr ? ` style="${styleAttr}"` : ""}>
          ${imgs}
          <div class="swap__bar" aria-hidden="true">${dots}</div>
        </figure>`;
    }

    if (item.type === "lottie") {
      const view = item.view;
      const attrs = [
        item.renderer ? `data-lottie-renderer="${item.renderer}"` : "",
        item.fit ? `data-lottie-fit="${item.fit}"` : "",
        item.dpr ? `data-lottie-dpr="${item.dpr}"` : "",
        view?.w ? `data-lottie-view-w="${view.w}"` : "",
        view?.h ? `data-lottie-view-h="${view.h}"` : "",
        view && view.x != null ? `data-lottie-view-x="${view.x}"` : "",
        view && view.y != null ? `data-lottie-view-y="${view.y}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return applyStage(
        `<div class="long__lottie" data-lottie="${item.src}"${attrs ? ` ${attrs}` : ""}></div>`
      );
    }

    if (item.type === "video") {
      const trigger =
        item.playTrigger === "top" || item.playTrigger === "immediate"
          ? ` data-play-trigger="${item.playTrigger}"`
          : "";
      return applyStage(
        `<video class="long__video" data-src="${item.src}"${trigger} muted loop playsinline webkit-playsinline preload="none" disablepictureinpicture controlslist="nodownload nofullscreen noremoteplayback noplaybackrate" disableRemotePlayback></video>`
      );
    }

    if (item.type === "interactive") {
      const variant = item.variant || "grid";
      const tone =
        variant === "lance-stroke" ? " long__shot--lance-stroke" : "";
      return `
        <figure class="${classes} long__shot--interactive${tone}"${styleAttr ? ` style="${styleAttr}"` : ""}>
          <div class="long__interactive" data-interactive="${variant}"></div>
        </figure>`;
    }

    return `
      <figure class="${classes}"${styleAttr ? ` style="${styleAttr}"` : ""}>
        <img src="${item.src}" alt="" loading="lazy" />
      </figure>`;
  }

  function renderLongMedia(project) {
    const root = document.getElementById("long-media");
    const gallery = project.gallery;
    if (lottieObserver) {
      lottieObserver.disconnect();
      lottieObserver = null;
    }
    destroyLotties(root);
    destroyInteractives();
    stopSwapSlots();
    if (videoLoadObserver) {
      videoLoadObserver.disconnect();
      videoLoadObserver = null;
    }

    if (!gallery || !gallery.length) {
      root.innerHTML = `
        <div class="greybox greybox--lg long__hero"></div>
        ${questionBlockHTML(project.question)}
        <div class="greybox greybox--lg"></div>
        <div class="greybox greybox--lg"></div>`;
    } else {
      root.innerHTML = gallery
        .map((block) => {
          if (block.type === "question") {
            return questionBlockHTML(project.question);
          }
          if (block.type === "row") {
            return `<div class="long__row">${block.items
              .map((item) => mediaFigureHTML(item, true))
              .join("")}</div>`;
          }
          if (block.type === "split") {
            return splitBlockHTML(block);
          }
          return mediaFigureHTML(block);
        })
        .join("");
    }

    const answerBtn = document.getElementById("expand-answer");
    if (answerBtn && deepOpen) answerBtn.classList.add("is-open");

    bindLotties(root);
    bindLongVideos(root);
    startSwapSlots(root);
    bindInteractives(root);
    checkLottieTriggers();
  }

  function populateLongform(project) {
    document.getElementById("long-name").textContent = project.caseTitle || project.title;
    document.getElementById("long-tagline").innerHTML = (project.tagline || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    document.getElementById("long-name-sm").textContent = project.caseTitle || project.title;
    document.getElementById("long-tagline-sm").textContent = (project.tagline || "")
      .replace(/\s*\n\s*/g, " ")
      .trim();
    document.getElementById("long-client").textContent = project.client;
    document.getElementById("long-year").textContent = project.year;
    document.getElementById("long-service").textContent = project.service;
    document.getElementById("deep-headline").innerHTML = (project.deepHeadline || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    document.getElementById("deep-challenge").textContent = project.challenge;
    const testimonial = (project.testimonial || "").trim();
    document.getElementById("deep-testimonial").textContent = testimonial;
    document
      .getElementById("deep-testimonial-block")
      ?.toggleAttribute("hidden", !testimonial);
    document.getElementById("deep-strategy-label").textContent =
      project.strategyLabel || "Strategy";
    const strategyRoot = document.getElementById("deep-strategy");
    if (Array.isArray(project.strategy)) {
      strategyRoot.innerHTML = `<ol class="deep__list">${project.strategy
        .map((item) => `<li>${item}</li>`)
        .join("")}</ol>`;
    } else {
      strategyRoot.innerHTML = `<p class="deep__text">${project.strategy || ""}</p>`;
    }
    const outcome = project.outcome;
    const outcomeRoot = document.getElementById("deep-outcome");
    const outcomeBlock = document.getElementById("deep-outcome-block");
    if (outcomeRoot && outcomeBlock) {
      const hasOutcome = Array.isArray(outcome)
        ? outcome.length > 0
        : !!(outcome && String(outcome).trim());
      outcomeBlock.toggleAttribute("hidden", !hasOutcome);
      if (!hasOutcome) {
        outcomeRoot.innerHTML = "";
      } else if (Array.isArray(outcome)) {
        outcomeRoot.innerHTML = outcome
          .map((item) => {
            if (item && typeof item === "object") {
              const title = item.title ? `<strong>${item.title}</strong> ` : "";
              return `<p class="deep__text">${title}${item.text || item.body || ""}</p>`;
            }
            return `<p class="deep__text">${item}</p>`;
          })
          .join("");
      } else {
        outcomeRoot.innerHTML = `<p class="deep__text">${outcome}</p>`;
      }
    }
    document.getElementById("deep-credits").innerHTML = (project.credits || [])
      .map(
        (c) => `
        <div class="deep__credit">
          <span class="deep__credit-role">${c.role}</span>
          <span class="deep__credit-names">${c.names}</span>
        </div>`
      )
      .join("");

    renderLongMedia(project);
  }

  function openLongform(project, options = {}) {
    const preserveDeep = !!options.preserveDeep;
    clearTimeout(closeFadeTimer);
    closeFadeTimer = null;
    if (!preserveDeep) closeDeep();

    populateLongform(project);
    caseScroll.scrollTop = 0;

    if (preserveDeep && deepOpen) {
      if (isMobile()) {
        longStage.classList.add("is-sheet");
        document.getElementById("expand-story")?.classList.add("is-open");
        document.getElementById("expand-answer")?.classList.add("is-open");
        deepPanel.setAttribute("aria-hidden", "false");
        deepPanel.querySelector(".deep__inner")?.scrollTo(0, 0);
      } else {
        longStage.classList.add("is-deep-prep");
        longStage.classList.add("is-deep", "is-deep-ui");
        longStage.classList.remove("is-deep-closing");
        document.getElementById("expand-story")?.classList.add("is-open");
        deepPanel.setAttribute("aria-hidden", "false");
        applyInfoShift();
        applySecondGapWhenReady();
        deepPanel.querySelector(".deep__inner")?.scrollTo(0, 0);
        void longStage.offsetWidth;
        longStage.classList.remove("is-deep-prep");
        updateDeepChrome();
      }
    }

    longform.classList.add("is-open");
    longform.setAttribute("aria-hidden", "false");
  }

  let deepTimer = null;
  let deepScrollLockTimer = null;
  let deepAnchorRaf = null;
  let deepAnchorEl = null;
  const DEEP_MS = 1000;
  const DEEP_CLOSE_MS = 1100;

  function setDeepScrollLock(durationMs) {
    clearTimeout(deepScrollLockTimer);
    longStage.classList.add("is-deep-animating");
    watchLottieTriggers(durationMs);
    deepScrollLockTimer = setTimeout(() => {
      longStage.classList.remove("is-deep-animating");
      deepScrollLockTimer = null;
      checkLottieTriggers();
    }, durationMs);
  }

  function isDeepScrollLocked() {
    return longStage.classList.contains("is-deep-animating");
  }

  function blockDeepUserScroll(e) {
    if (!isDeepScrollLocked()) return;
    e.preventDefault();
  }

  /** When the cursor is outside the case column, still scroll the case. */
  function forwardOutsideCaseScroll(e) {
    if (isDeepScrollLocked()) return;
    if (!longform.classList.contains("is-open")) return;
    if (e.target.closest("#case-scroll") || e.target.closest(".deep__inner")) {
      return;
    }
    if (e.type === "wheel") {
      e.preventDefault();
      caseScroll.scrollTop += e.deltaY;
    }
  }

  function clearDeepScrollLock() {
    clearTimeout(deepScrollLockTimer);
    deepScrollLockTimer = null;
    longStage.classList.remove("is-deep-animating");
    stopLottieTriggerWatch();
  }

  function updateDeepChrome() {
    const back = document.getElementById("long-back");
    const esc = document.getElementById("long-esc");
    if (!deepOpen || !longStage.classList.contains("is-deep-ui")) {
      back?.classList.remove("is-inset");
      esc?.classList.remove("is-inset");
      return;
    }
    const firstShot = document.querySelector("#long-media .long__shot");
    const reached = firstShot
      ? firstShot.getBoundingClientRect().top <= 60
      : false;
    back?.classList.toggle("is-inset", reached);
    esc?.classList.toggle("is-inset", reached);
  }

  function stopAnchorLock() {
    if (deepAnchorRaf) {
      cancelAnimationFrame(deepAnchorRaf);
      deepAnchorRaf = null;
    }
  }

  function pickDeepAnchor(sourceEl) {
    const answerBtn = document.getElementById("expand-answer");
    const question = document.getElementById("long-question-block");
    const firstShot =
      document.querySelector("#long-media .long__shot") ||
      document.getElementById("long-media");
    const fromQuestion =
      sourceEl &&
      ((answerBtn && (answerBtn === sourceEl || answerBtn.contains(sourceEl))) ||
        (question && (question === sourceEl || question.contains(sourceEl))));
    if (fromQuestion && (answerBtn || question)) return answerBtn || question;
    if (question && caseScroll) {
      const q = question.getBoundingClientRect();
      const view = caseScroll.getBoundingClientRect();
      if (q.bottom > view.top && q.top < view.bottom) {
        return answerBtn || question;
      }
    }
    return firstShot;
  }

  function lockScrollAnchor(anchor, targetTop, durationMs) {
    stopAnchorLock();
    if (!anchor || !caseScroll) return;
    const start = performance.now();

    function frame(now) {
      const delta = anchor.getBoundingClientRect().top - targetTop;
      if (Math.abs(delta) > 0.1) {
        caseScroll.scrollTop += delta;
      }
      checkLottieTriggers();
      if (now - start < durationMs) {
        deepAnchorRaf = requestAnimationFrame(frame);
      } else {
        deepAnchorRaf = null;
        checkLottieTriggers();
      }
    }

    deepAnchorRaf = requestAnimationFrame(frame);
  }

  function measureInfoShift() {
    /* Collapse INFO (and the headers→images flex gap) so titles sit --media-gap above the first shot. */
    if (!caseInfo || !caseScroll) return 0;
    const rowGap = parseFloat(getComputedStyle(caseScroll).rowGap) || 24;
    const mediaGap =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--media-gap")
      ) || 16;
    return -(caseInfo.offsetHeight + rowGap - mediaGap);
  }

  function applyInfoShift() {
    document.documentElement.style.setProperty(
      "--info-shift",
      `${measureInfoShift()}px`
    );
  }

  const SECOND_GAP_MAX = 52;

  function measureSecondGap() {
    const back = document.getElementById("long-back");
    const second = document.getElementById("case-second");
    const shot = document.querySelector("#long-media .long__shot");
    if (!back || !second || !shot) return 0;
    const pad =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--pad")
      ) || 16;
    const mediaGap =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--media-gap")
      ) || 16;
    const caseH = window.innerHeight - pad * 2;
    const rowGap = parseFloat(getComputedStyle(caseScroll).rowGap) || 24;
    const extra =
      caseH -
      (back.offsetHeight +
        rowGap +
        second.offsetHeight +
        mediaGap +
        shot.offsetHeight);
    return Math.min(SECOND_GAP_MAX, Math.max(0, Math.round(extra)));
  }

  function applySecondGap() {
    document.documentElement.style.setProperty(
      "--second-gap",
      `${measureSecondGap()}px`
    );
  }

  function whenFirstShotReady() {
    const shot = document.querySelector("#long-media .long__shot");
    if (!shot) return Promise.resolve();
    const media = shot.querySelector("img, video");
    if (!media) return Promise.resolve();
    if (media.tagName === "IMG" && media.complete && media.naturalHeight) {
      return Promise.resolve();
    }
    if (media.tagName === "VIDEO" && media.readyState >= 1) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => resolve();
      media.addEventListener("load", done, { once: true });
      media.addEventListener("loadeddata", done, { once: true });
      media.addEventListener("error", done, { once: true });
      setTimeout(done, 500);
    });
  }

  function applySecondGapWhenReady() {
    const run = () => {
      requestAnimationFrame(() => {
        applySecondGap();
        requestAnimationFrame(applySecondGap);
      });
    };
    whenFirstShotReady().then(run);
  }

  function clearSecondGap() {
    document.documentElement.style.setProperty("--second-gap", "0px");
  }

  function openStorySheet() {
    deepOpen = true;
    clearTimeout(deepTimer);
    stopAnchorLock();
    longStage.classList.remove("is-deep", "is-deep-ui", "is-deep-closing");
    document.documentElement.style.removeProperty("--info-shift");
    clearSecondGap();
    document.getElementById("expand-story")?.classList.add("is-open");
    document.getElementById("expand-answer")?.classList.add("is-open");
    deepPanel.setAttribute("aria-hidden", "false");
    longStage.classList.add("is-sheet");
    deepPanel.querySelector(".deep__inner")?.scrollTo(0, 0);
  }

  function closeStorySheet() {
    deepOpen = false;
    longStage.classList.remove("is-sheet");
    document.getElementById("expand-story")?.classList.remove("is-open");
    document.getElementById("expand-answer")?.classList.remove("is-open");
    deepPanel.setAttribute("aria-hidden", "true");
  }

  function openDeep(e) {
    if (isMobile()) {
      if (deepOpen) closeStorySheet();
      else openStorySheet();
      return;
    }

    const anchor = pickDeepAnchor(e?.target);
    deepAnchorEl = anchor;
    const targetTop = anchor
      ? anchor.getBoundingClientRect().top
      : window.innerHeight / 2;

    deepOpen = true;
    clearTimeout(deepTimer);
    stopAnchorLock();
    longStage.classList.remove("is-sheet");

    document.getElementById("expand-story")?.classList.add("is-open");
    document.getElementById("expand-answer")?.classList.add("is-open");
    deepPanel.setAttribute("aria-hidden", "false");

    /* Measure while the case is still at normal width so tagline wrap /
       shot height at the deep size cannot change --info-shift mid-move. */
    applyInfoShift();
    applySecondGap();

    longStage.classList.remove("is-deep-ui", "is-deep-closing");
    longStage.classList.add("is-deep");
    setDeepScrollLock(DEEP_MS);
    requestAnimationFrame(refreshInteractives);

    lockScrollAnchor(anchor, targetTop, DEEP_MS);
    updateDeepChrome();

    // Phase 2 @ 0.5s → 1.0s: Second INFO, padding→inset, radius
    deepTimer = setTimeout(() => {
      longStage.classList.add("is-deep-ui");
      updateDeepChrome();
      checkLottieTriggers();
      refreshInteractives();
    }, DEEP_MS / 2);
  }

  function closeDeep() {
    if (longStage.classList.contains("is-sheet") || (deepOpen && isMobile())) {
      closeStorySheet();
      return;
    }
    if (!longStage.classList.contains("is-deep") && !deepOpen) return;

    const anchor =
      (deepAnchorEl && deepAnchorEl.isConnected && deepAnchorEl) ||
      pickDeepAnchor();
    const targetTop = anchor
      ? anchor.getBoundingClientRect().top
      : window.innerHeight / 2;

    deepOpen = false;
    clearTimeout(deepTimer);
    stopAnchorLock();
    deepAnchorEl = null;

    /*
      Close timeline (1.1s):
      0–0.5s   Second INFO (+ back) fade out
      0.5–0.6s image/footer shift reverse (0.1s)
      0.6–1.1s INFO fade in
      0–1s     panel out, padding/radius, case dock (parallel)
    */
    longStage.classList.remove("is-deep-ui");
    longStage.classList.add("is-deep-closing");
    setDeepScrollLock(DEEP_CLOSE_MS);
    document.getElementById("long-back")?.classList.remove("is-inset");
    document.getElementById("long-esc")?.classList.remove("is-inset");

    // Target 0 immediately; CSS delays the visual move until 0.5s
    document.documentElement.style.setProperty("--info-shift", "0px");
    clearSecondGap();
    requestAnimationFrame(refreshInteractives);

    lockScrollAnchor(anchor, targetTop, DEEP_CLOSE_MS);

    deepTimer = setTimeout(() => {
      longStage.classList.add("is-deep-prep");
      longStage.classList.remove("is-deep", "is-deep-closing", "is-deep-ui");
      void longStage.offsetWidth;
      longStage.classList.remove("is-deep-prep");
      document.getElementById("expand-story")?.classList.remove("is-open");
      document.getElementById("expand-answer")?.classList.remove("is-open");
      deepPanel.setAttribute("aria-hidden", "true");
      updateDeepChrome();
      refreshInteractives();
    }, DEEP_CLOSE_MS);
  }

  function resetDeepInstant() {
    clearTimeout(deepTimer);
    stopAnchorLock();
    deepOpen = false;
    deepAnchorEl = null;
    clearDeepScrollLock();
    longStage.classList.add("is-deep-prep");
    longStage.classList.remove("is-deep", "is-deep-ui", "is-deep-closing", "is-sheet");
    document.documentElement.style.removeProperty("--info-shift");
    clearSecondGap();
    document.getElementById("expand-story")?.classList.remove("is-open");
    document.getElementById("expand-answer")?.classList.remove("is-open");
    document.getElementById("long-esc")?.classList.remove("is-inset");
    document.getElementById("long-back")?.classList.remove("is-inset");
    deepPanel?.setAttribute("aria-hidden", "true");
    void longStage.offsetWidth;
    longStage.classList.remove("is-deep-prep");
  }

  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function goAdjacent(dir) {
    if (!openProject || adjacentBusy) return;
    const index = PROJECTS.findIndex((p) => p.id === openProject.id);
    const nextIndex = (index + dir + PROJECTS.length) % PROJECTS.length;
    const next = PROJECTS[nextIndex];
    adjacentBusy = true;

    const ADJACENT_MS = 350;
    const fromLong = openProject.type === "long";
    const stayDeep = !!(deepOpen && fromLong && next.type === "long");

    try {
      if (fromLong) {
        longStage.classList.add("is-fading");
        if (deepOpen) setDeepScrollLock(ADJACENT_MS * 2 + 50);
        await waitMs(ADJACENT_MS);
      }

      /* Long → long: swap in place (keep deep-read layout if open) */
      if (fromLong && next.type === "long") {
        activeIndex = nextIndex;
        openProject = next;
        updateProgress();
        openLongform(next, { preserveDeep: stayDeep });
        void longStage.offsetWidth;
        longStage.classList.remove("is-fading");
        await waitMs(ADJACENT_MS);
        return;
      }

      /* Long → carousel (or other type change) */
      if (fromLong) {
        destroyLotties();
        destroyInteractives();
        stopSwapSlots();
        resetDeepInstant(); // still under is-fading → stays invisible
        longform.classList.remove("is-open");
        longform.setAttribute("aria-hidden", "true");
        await waitMs(ADJACENT_MS); // overlay finishes fading out
        longStage.classList.remove("is-fading");
      } else {
        pauseSlideVideo(carouselSlideA);
        pauseSlideVideo(carouselSlideB);
        destroyLotties(carouselSlideA);
        destroyLotties(carouselSlideB);
        carousel.classList.remove("is-open");
        carousel.setAttribute("aria-hidden", "true");
      }

      activeIndex = nextIndex;
      openProject = next;
      updateProgress();
      dimHome(true, next.type === "long" ? "full" : "soft");

      if (next.type === "carousel") openCarousel(next);
      else openLongform(next);
    } finally {
      adjacentBusy = false;
    }
  }

  /* ——— Events ——— */
  window.matchMedia(MOBILE_MQ).addEventListener("change", (e) => {
    document.documentElement.classList.add("no-motion");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("no-motion");
      });
    });

    if (!openProject || openProject.type !== "long") return;

    if (e.matches) {
      /* Desktop → mobile: keep story open as the sheet */
      if (deepOpen && !longStage.classList.contains("is-sheet")) {
        clearTimeout(deepTimer);
        stopAnchorLock();
        clearDeepScrollLock();
        longStage.classList.remove(
          "is-deep",
          "is-deep-ui",
          "is-deep-closing",
          "is-deep-prep"
        );
        document.documentElement.style.removeProperty("--info-shift");
        clearSecondGap();
        document.getElementById("long-back")?.classList.remove("is-inset");
        document.getElementById("long-esc")?.classList.remove("is-inset");
        longStage.classList.add("is-sheet");
        deepPanel.setAttribute("aria-hidden", "false");
      }
    } else if (
      deepOpen ||
      longStage.classList.contains("is-sheet") ||
      longStage.classList.contains("is-deep")
    ) {
      /* Mobile → desktop: leave deep read, return to normal longform */
      resetDeepInstant();
    }
  });

  window.addEventListener("resize", () => {
    lockRailMenuWidth();
    onScroll();
    updateCarouselMetaFit();
    checkLottieTriggers();
    if (
      deepOpen &&
      openProject &&
      openProject.type === "long" &&
      !isMobile() &&
      longStage.classList.contains("is-deep")
    ) {
      applyInfoShift();
      applySecondGapWhenReady();
    }
  });
  home.addEventListener("scroll", onScroll, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      lockRailMenuWidth();
      updateProgress();
      updateCarouselMetaFit();
    });
  }

  document.getElementById("carousel-prev").addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMobile()) return;
    stepCarousel(-1);
  });
  document.getElementById("carousel-next").addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMobile()) return;
    stepCarousel(1);
  });

  carouselFrame.addEventListener("pointerdown", (e) => {
    if (!isMobile() || !openProject || openProject.type !== "carousel") return;
    if (e.target.closest(".carousel__dot")) return;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    swipeActive = true;
  });

  carouselFrame.addEventListener("pointerup", (e) => {
    if (!swipeActive) return;
    swipeActive = false;
    if (!isMobile() || !openProject || openProject.type !== "carousel") return;
    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
    stepCarousel(dx < 0 ? 1 : -1);
  });

  carouselFrame.addEventListener("pointercancel", () => {
    swipeActive = false;
  });
  document.getElementById("carousel-esc").addEventListener("click", closeAll);
  document.getElementById("long-esc").addEventListener("click", closeAll);
  document.getElementById("long-back").addEventListener("click", closeDeep);
  document.getElementById("deep-handle").addEventListener("click", (e) => {
    e.stopPropagation();
    closeDeep();
  });
  document.getElementById("case-scroll").addEventListener(
    "scroll",
    () => {
      updateDeepChrome();
      checkLottieTriggers();
    },
    { passive: true }
  );
  ["wheel", "touchmove"].forEach((type) => {
    longform.addEventListener(type, blockDeepUserScroll, { passive: false });
    caseScroll.addEventListener(type, blockDeepUserScroll, { passive: false });
    deepPanel.addEventListener(type, blockDeepUserScroll, { passive: false });
  });
  longform.addEventListener("wheel", forwardOutsideCaseScroll, { passive: false });
  document.getElementById("expand-story").addEventListener("click", openDeep);
  longform.addEventListener("click", (e) => {
    if (e.target.closest("#expand-answer")) openDeep();
    else if (
      deepOpen &&
      isMobile() &&
      !e.target.closest("#deep-panel") &&
      !e.target.closest(".expand") &&
      !e.target.closest("#long-esc")
    ) {
      closeDeep();
    } else if (
      !deepOpen &&
      (e.target === longform || e.target === longStage)
    ) {
      closeAll();
    }
  });
  document.getElementById("long-prev").addEventListener("click", () =>
    goAdjacent(-1)
  );
  document.getElementById("long-next").addEventListener("click", () =>
    goAdjacent(1)
  );

  carousel.addEventListener("click", (e) => {
    if (e.target === carousel) closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (infoExpanded) {
        collapseInfo();
        return;
      }
      if (deepOpen) closeDeep();
      else closeAll();
    }
    if (
      isDeepScrollLocked() &&
      ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
        e.key
      )
    ) {
      e.preventDefault();
    }
    if (!openProject || openProject.type !== "carousel") return;
    if (e.key === "ArrowLeft") stepCarousel(-1);
    if (e.key === "ArrowRight") stepCarousel(1);
  });

  renderFeed();
  renderRailMenu();
  renderTicks();
  updateProgress();
  onScroll();
})();
