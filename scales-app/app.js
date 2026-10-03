/**
 * Gemba Scales - app state and wiring.
 *
 * State holds only choices. Everything shown on the neck is derived from
 * root + scale + accidental preference (the key) and the tuning + fret
 * range (the board); nothing per-fret is ever stored.
 */
(function () {
  const Theory = window.GembaTheory;
  const Fret = window.GembaFretboard;
  const Audio = window.ScaleAudio;

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------ storage */

  const PREFIX = "gemba-scales-";
  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, String(v)); } catch (e) { /* private mode */ }
    }
  };

  function pick(value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
  }

  const SPEEDS = { slow: 0.6, medium: 0.38, fast: 0.24 };
  const SCALE_IDS = Theory.SCALES.map((s) => s.id);

  /* -------------------------------------------------------------- state */

  const rootSaved = parseInt(store.get("root", "7"), 10);

  const state = {
    selectedRoot: rootSaved >= 0 && rootSaved < 12 ? rootSaved : 7,          // G
    selectedScale: pick(store.get("scale"), SCALE_IDS, "major-pentatonic"),
    displayMode: pick(store.get("mode"), ["intervals", "notes"], "intervals"),
    fretRange: Number(pick(store.get("frets"), Fret.FRET_RANGES.map(String), "12")),
    preferredAccidental: pick(store.get("accidental"), ["auto", "sharp", "flat"], "auto"),
    playbackState: "idle",
    direction: pick(store.get("direction"), ["up", "down", "updown"], "up"),
    speed: pick(store.get("speed"), Object.keys(SPEEDS), "medium"),
    showChromatic: store.get("chromatic", "1") === "1",
    tapSound: store.get("tapSound", "1") === "1",
    theme: pick(store.get("theme"), ["dark", "light"], "dark")
  };

  let key = null;
  let board = null;

  /* --------------------------------------------------------------- view */

  const scroller = $("boardScroll");
  const view = window.GembaBoardView.create(scroller, onCellTap);

  function buildBoard() {
    board = Fret.createFretboard({ tuning: "standard", fretCount: state.fretRange });
    const ratio = scroller.scrollWidth > scroller.clientWidth
      ? scroller.scrollLeft / (scroller.scrollWidth - scroller.clientWidth) : 0;

    view.build(board);
    view.render(key, state.displayMode, state.showChromatic);

    scroller.scrollLeft = ratio * Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    updateNav();
  }

  function rebuildKey() {
    key = Theory.createKey(state.selectedRoot, state.selectedScale, state.preferredAccidental);
  }

  function renderBoard() {
    view.render(key, state.displayMode, state.showChromatic);
  }

  function renderToolbar() {
    $("rootNote").textContent = key.rootName;
    $("rootBtn").setAttribute("aria-label", "Root note " + key.rootName + ". Change root");
    $("scaleName").textContent = key.scale.name;
    $("scaleBtn").setAttribute("aria-label", "Scale " + key.scale.name + ". Change scale");

    syncSeg($("modeSeg"), "mode", state.displayMode);
    syncSeg($("dirSeg"), "dir", state.direction);
    syncSeg($("dirSeg2"), "dir", state.direction);
    syncSeg($("themeSeg"), "value", state.theme);
    syncSeg($("accSeg"), "value", state.preferredAccidental);
    syncSeg($("fretSeg"), "value", String(state.fretRange));
    syncSeg($("speedSeg"), "value", state.speed);
    $("chromaticToggle").setAttribute("aria-checked", String(state.showChromatic));
    $("tapSoundToggle").setAttribute("aria-checked", String(state.tapSound));

    const playing = state.playbackState === "playing";
    $("playBtn").classList.toggle("is-playing", playing);
    $("playBtn").setAttribute("aria-pressed", String(playing));
    $("playBtn").setAttribute("aria-label", playing ? "Stop playback" : "Play scale");

    $("boardSummary").textContent =
      `${key.rootName} ${key.scale.name}: ${key.tones.map((t) => t.note).join(" ")}`;
  }

  function renderLegend() {
    const legend = $("legend");
    legend.innerHTML = "";

    const title = document.createElement("span");
    title.className = "legend-title";
    title.textContent = `${key.rootName} ${key.scale.name}`;
    legend.appendChild(title);

    key.tones.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (t.interval === 0 ? " is-root" : "");
      chip.dataset.interval = t.interval;
      chip.innerHTML = `<span class="chip-note"></span><span class="chip-deg"></span>`;
      chip.firstChild.textContent = t.note;
      chip.lastChild.textContent = t.degree;
      legend.appendChild(chip);
    });
  }

  function renderPickers() {
    document.querySelectorAll(".root-opt").forEach((b) => {
      const on = Number(b.dataset.pc) === state.selectedRoot;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", String(on));
    });
    document.querySelectorAll(".scale-opt").forEach((b) => {
      const on = b.dataset.scale === state.selectedScale;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const meta = $("themeColorMeta");
    if (meta) meta.setAttribute("content", state.theme === "light" ? "#F4F0E8" : "#121214");
  }

  /* ------------------------------------------------------------ updates */

  /**
   * Single entry point for changing state. Works out the least it has to
   * redo: a fret-range change rebuilds the board, a key change recomputes
   * the key, a display change only re-labels.
   */
  function set(patch) {
    const before = Object.assign({}, state);
    Object.assign(state, patch);

    const keyChanged = state.selectedRoot !== before.selectedRoot ||
      state.selectedScale !== before.selectedScale ||
      state.preferredAccidental !== before.preferredAccidental;

    if (keyChanged && state.playbackState === "playing") stopPlayback();
    if (keyChanged) rebuildKey();

    if (state.theme !== before.theme) applyTheme();

    if (state.fretRange !== before.fretRange) buildBoard();
    else if (keyChanged || state.displayMode !== before.displayMode ||
             state.showChromatic !== before.showChromatic) renderBoard();

    if (keyChanged) {
      renderLegend();
      renderPickers();
    }
    renderToolbar();

    store.set("root", state.selectedRoot);
    store.set("scale", state.selectedScale);
    store.set("mode", state.displayMode);
    store.set("frets", state.fretRange);
    store.set("accidental", state.preferredAccidental);
    store.set("direction", state.direction);
    store.set("speed", state.speed);
    store.set("chromatic", state.showChromatic ? "1" : "0");
    store.set("tapSound", state.tapSound ? "1" : "0");
    store.set("theme", state.theme);
  }

  /* ---------------------------------------------------------- segmented */

  function syncSeg(group, attr, value) {
    group.querySelectorAll(".seg").forEach((b) => {
      const on = b.dataset[attr] === value;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  function bindSeg(group, attr, onPick) {
    group.addEventListener("click", (e) => {
      const b = e.target.closest(".seg");
      if (b && group.contains(b)) onPick(b.dataset[attr]);
    });
  }

  /* -------------------------------------------------------------- sheets */

  let openSheetEl = null;
  let sheetTrigger = null;

  function openSheet(id, trigger) {
    if (openSheetEl) closeSheet(false);
    const sheet = $(id);
    openSheetEl = sheet;
    sheetTrigger = trigger || null;

    const scrim = $("scrim");
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add("is-open"));

    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.querySelector(".screen").inert = true;
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    const focusTarget = sheet.querySelector(".is-active") || sheet.querySelector("button");
    setTimeout(() => focusTarget && focusTarget.focus({ preventScroll: true }), 60);
  }

  function closeSheet(restoreFocus) {
    if (!openSheetEl) return;
    const sheet = openSheetEl;
    openSheetEl = null;

    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.querySelector(".screen").inert = false;

    const scrim = $("scrim");
    scrim.classList.remove("is-open");
    setTimeout(() => { if (!openSheetEl) scrim.hidden = true; }, 220);

    if (sheetTrigger) {
      sheetTrigger.setAttribute("aria-expanded", "false");
      if (restoreFocus !== false) sheetTrigger.focus({ preventScroll: true });
    }
    sheetTrigger = null;
  }

  function buildPickers() {
    const grid = $("rootGrid");
    for (let pc = 0; pc < 12; pc++) {
      const opts = Theory.rootSpellings(pc).map((s) =>
        s.letter + (s.alter > 0 ? Theory.SHARP : s.alter < 0 ? Theory.FLAT : ""));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "root-opt";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", Theory.rootPickerLabel(pc).replace(" / ", " or "));
      b.dataset.pc = pc;
      b.innerHTML = `<span class="root-opt-main"></span>` +
        (opts.length > 1 ? `<span class="root-opt-alt"></span>` : "");
      b.firstChild.textContent = opts[0];
      if (opts.length > 1) b.lastChild.textContent = opts[1];
      b.addEventListener("click", () => {
        set({ selectedRoot: pc });
        closeSheet();
      });
      grid.appendChild(b);
    }

    const list = $("scaleList");
    Theory.SCALES.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scale-opt";
      b.setAttribute("role", "radio");
      b.dataset.scale = s.id;
      b.innerHTML = `<span class="scale-opt-name"></span><span class="scale-opt-formula"></span>`;
      b.firstChild.textContent = s.name;
      b.lastChild.textContent = Theory.degreeLabels(s).join("  ");
      b.addEventListener("click", () => {
        set({ selectedScale: s.id });
        closeSheet();
      });
      list.appendChild(b);
    });

    const frets = $("fretSeg");
    Fret.FRET_RANGES.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg";
      b.setAttribute("role", "radio");
      b.dataset.value = String(n);
      b.textContent = String(n);
      frets.appendChild(b);
    });
  }

  /* ---------------------------------------------------------- navigation */

  function updateNav() {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const left = $("navLeft");
    const right = $("navRight");
    left.disabled = scroller.scrollLeft <= 1;
    right.disabled = scroller.scrollLeft >= max - 1;
    const whole = max <= 1;
    left.title = right.title = whole ? "The whole neck is in view" : "";
    $("rotateHint").classList.toggle("is-needed", !whole);
  }

  function nudge(dir) {
    // Roughly four frets per press, whatever the board's scale.
    const g = view.geometry;
    const step = g ? (g.fretX[Math.min(5, g.fretX.length - 1)] - g.fretX[1]) : scroller.clientWidth * 0.5;
    scroller.scrollBy({ left: dir * Math.max(step, scroller.clientWidth * 0.33), behavior: "smooth" });
  }

  /* ------------------------------------------------------------ playback */

  let flashTimer = null;

  function highlight(midi) {
    view.setSounding(midi);
    const iv = midi === null ? -1 : Theory.mod12(midi - key.rootPc);
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-sounding", Number(c.dataset.interval) === iv);
    });
  }

  function startPlayback() {
    const seq = Fret.playbackSequence(key, state.direction);
    clearTimeout(flashTimer);
    set({ playbackState: "playing" });
    Audio.playSequence(seq, SPEEDS[state.speed],
      (i, midi) => highlight(midi),
      () => {
        highlight(null);
        set({ playbackState: "idle" });
      });
  }

  function stopPlayback() {
    Audio.stop();
    highlight(null);
    state.playbackState = "idle";
    renderToolbar();
  }

  function onCellTap(p) {
    if (!state.tapSound || state.playbackState === "playing") return;
    Audio.playNote(p.midi);
    highlight(p.midi);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => highlight(null), 700);
  }

  /* -------------------------------------------------------------- events */

  $("rootBtn").addEventListener("click", (e) => openSheet("rootSheet", e.currentTarget));
  $("scaleBtn").addEventListener("click", (e) => openSheet("scaleSheet", e.currentTarget));
  $("menuBtn").addEventListener("click", (e) => openSheet("menuSheet", e.currentTarget));
  $("scrim").addEventListener("click", () => closeSheet());
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeSheet()));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openSheetEl) {
      closeSheet();
      return;
    }
    if (openSheetEl || e.target.closest("input, textarea")) return;
    if (e.key === "ArrowLeft") { nudge(-1); e.preventDefault(); }
    if (e.key === "ArrowRight") { nudge(1); e.preventDefault(); }
  });

  bindSeg($("modeSeg"), "mode", (v) => set({ displayMode: v }));
  bindSeg($("dirSeg"), "dir", (v) => set({ direction: v }));
  bindSeg($("dirSeg2"), "dir", (v) => set({ direction: v }));
  bindSeg($("themeSeg"), "value", (v) => set({ theme: v }));
  bindSeg($("accSeg"), "value", (v) => set({ preferredAccidental: v }));
  bindSeg($("fretSeg"), "value", (v) => set({ fretRange: Number(v) }));
  bindSeg($("speedSeg"), "value", (v) => set({ speed: v }));

  $("chromaticToggle").addEventListener("click", () => set({ showChromatic: !state.showChromatic }));
  $("tapSoundToggle").addEventListener("click", () => set({ tapSound: !state.tapSound }));

  $("playBtn").addEventListener("click", () => {
    if (state.playbackState === "playing") stopPlayback();
    else startPlayback();
  });

  $("navLeft").addEventListener("click", () => nudge(-1));
  $("navRight").addEventListener("click", () => nudge(1));
  scroller.addEventListener("scroll", updateNav, { passive: true });

  // Rebuild only when the space for the board really changes size.
  let lastSize = "";
  let resizeFrame = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const size = scroller.clientWidth + "x" + scroller.clientHeight;
      if (size === lastSize) return;
      lastSize = size;
      buildBoard();
    });
  };
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(scroller);
  else window.addEventListener("resize", onResize);

  // Audio stops when the app goes to the background.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.playbackState === "playing") stopPlayback();
  });

  /* ---------------------------------------------------------------- boot */

  applyTheme();
  rebuildKey();
  buildPickers();
  renderPickers();
  renderLegend();
  renderToolbar();
  lastSize = scroller.clientWidth + "x" + scroller.clientHeight;
  buildBoard();
})();
