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
    theme: pick(store.get("theme"), ["dark", "light"], "dark"),
    voice: pick(store.get("voice"), Object.keys(Audio.VOICES), "acoustic"),
    ring: pick(store.get("ring"), Object.keys(Audio.RINGS), "short"),
    favorites: loadFavorites(),
    scaleTab: pick(store.get("scaleTab"), ["all", "favorites"], "all")
  };

  function loadFavorites() {
    try {
      const list = JSON.parse(store.get("favorites", "[]"));
      return Array.isArray(list) ? list.filter((id) => SCALE_IDS.indexOf(id) !== -1) : [];
    } catch (e) { return []; }
  }

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
    syncSeg($("voiceSeg"), "value", state.voice);
    syncSeg($("ringSeg"), "value", state.ring);
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
    renderScaleList();
  }

  /* ---------------------------------------------------------- scale page */

  let scaleQuery = "";

  /** Folds ♭ ♯ ♮ to ASCII so "b6" finds "Mixolydian ♭6". */
  function fold(text) {
    return text.toLowerCase()
      .replace(/♭/g, "b").replace(/♯/g, "#").replace(/♮/g, "");
  }

  function scaleRow(scale, label) {
    const active = scale.id === state.selectedScale;
    const row = document.createElement("div");
    row.className = "scale-row" + (active ? " is-active" : "");

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "scale-pick";
    pickBtn.dataset.scale = scale.id;
    pickBtn.setAttribute("role", "radio");
    pickBtn.setAttribute("aria-checked", String(active));

    const others = (label !== scale.name ? [scale.name] : []).concat(scale.aka).filter((n) => n !== label);
    pickBtn.innerHTML =
      `<span class="scale-pick-text"><span class="scale-pick-name"></span>` +
      (others.length ? `<span class="scale-pick-aka"></span>` : "") + `</span>` +
      `<span class="scale-pick-formula"></span>`;
    pickBtn.querySelector(".scale-pick-name").textContent = label;
    if (others.length) pickBtn.querySelector(".scale-pick-aka").textContent = others.join(" · ");
    pickBtn.querySelector(".scale-pick-formula").textContent = Theory.degreeLabels(scale).join(" ");

    const fav = state.favorites.indexOf(scale.id) !== -1;
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star" + (fav ? " is-fav" : "");
    star.dataset.star = scale.id;
    star.setAttribute("aria-pressed", String(fav));
    star.setAttribute("aria-label", (fav ? "Remove " : "Add ") + label + (fav ? " from" : " to") + " favorites");
    star.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -9L2.6 -3.2L9 -2.8L4.1 1.4L5.6 7.6L0 4.3L-5.6 7.6L-4.1 1.4L-9 -2.8L-2.6 -3.2Z"/></svg>`;

    row.appendChild(pickBtn);
    row.appendChild(star);
    return row;
  }

  function section(title, rows) {
    const sec = document.createElement("section");
    sec.className = "scale-group";
    if (title) {
      const h = document.createElement("h3");
      h.className = "scale-group-title";
      h.textContent = title;
      sec.appendChild(h);
    }
    const grid = document.createElement("div");
    grid.className = "scale-grid";
    rows.forEach((r) => grid.appendChild(r));
    sec.appendChild(grid);
    return sec;
  }

  function emptyNote(text) {
    const p = document.createElement("p");
    p.className = "scale-empty";
    p.textContent = text;
    return p;
  }

  function renderScaleList() {
    const list = $("scaleList");
    const keepScroll = list.scrollTop;
    list.innerHTML = "";
    syncTabs();

    // Every word must appear somewhere: "hung min" finds Hungarian Minor,
    // and a stray autocorrected word only narrows, never empties wrongly.
    const q = fold(scaleQuery.trim());
    const words = q.split(/\s+/).filter(Boolean);
    const matches = (scale, label) => {
      const hay = fold([label, scale.name].concat(scale.aka).join(" "));
      return words.every((w) => hay.indexOf(w) !== -1);
    };

    if (state.scaleTab === "favorites") {
      const favs = state.favorites.map((id) => Theory.getScale(id)).filter((s) => matches(s, s.name));
      if (!state.favorites.length) {
        list.appendChild(emptyNote("No favorites yet. Tap the star beside any scale to keep it here."));
      } else if (!favs.length) {
        list.appendChild(emptyNote("No favorites match “" + scaleQuery.trim() + "”."));
      } else {
        list.appendChild(section(null, favs.map((s) => scaleRow(s, s.name))));
      }
    } else if (q) {
      // Searching flattens the groups: each scale once, under its own name.
      const seen = new Set();
      const rows = [];
      Theory.GROUPS.forEach((g) => g.items.forEach((it) => {
        if (seen.has(it.scale.id) || !matches(it.scale, it.label)) return;
        seen.add(it.scale.id);
        rows.push(scaleRow(it.scale, it.scale.name));
      }));
      list.appendChild(rows.length ? section(null, rows)
        : emptyNote("No scales match “" + scaleQuery.trim() + "”."));
    } else {
      Theory.GROUPS.forEach((g) => {
        list.appendChild(section(g.name, g.items.map((it) => scaleRow(it.scale, it.label))));
      });
    }

    list.scrollTop = keepScroll;
  }

  function syncTabs() {
    $("scaleTabs").querySelectorAll(".seg").forEach((b) => {
      const on = b.dataset.tab === state.scaleTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  function toggleFavorite(id) {
    const favs = state.favorites.slice();
    const i = favs.indexOf(id);
    if (i === -1) favs.push(id);
    else favs.splice(i, 1);
    state.favorites = favs;
    store.set("favorites", JSON.stringify(favs));
    renderScaleList();
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
    store.set("voice", state.voice);
    store.set("ring", state.ring);
    store.set("scaleTab", state.scaleTab);

    Audio.setVoice(state.voice);
    Audio.setRing(state.ring);
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

  // Android's back button closes whatever is open; only on the fretboard
  // does it leave the app. Browsers get the same through history entries.
  let skipNextPop = false;

  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp) {
    CapApp.addListener("backButton", () => {
      if (openSheetEl) closeSheet();
      else CapApp.minimizeApp();
    });
  }

  window.addEventListener("popstate", () => {
    if (skipNextPop) { skipNextPop = false; return; }
    if (openSheetEl) closeSheet(true, true);
  });

  function openSheet(id, trigger) {
    if (openSheetEl) return;
    const sheet = $(id);
    openSheetEl = sheet;
    sheetTrigger = trigger || null;
    try { history.pushState({ overlay: id }, ""); } catch (e) { /* unsupported */ }

    if (!sheet.classList.contains("page")) {
      const scrim = $("scrim");
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add("is-open"));
    }

    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.querySelector(".screen").inert = true;
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    if (id === "scalePage") {
      renderScaleList();
      const current = sheet.querySelector(".scale-row.is-active");
      if (current) current.scrollIntoView({ block: "center" });
      else $("scaleList").scrollTop = 0;
    }

    const focusTarget = sheet.querySelector(".scale-row.is-active .scale-pick") ||
      sheet.querySelector(".is-active") || sheet.querySelector("button");
    setTimeout(() => focusTarget && focusTarget.focus({ preventScroll: true }), 60);
  }

  function closeSheet(restoreFocus, fromHistory) {
    if (!openSheetEl) return;
    const sheet = openSheetEl;
    openSheetEl = null;

    if (!fromHistory && history.state && history.state.overlay) {
      skipNextPop = true;
      history.back();
    }

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

    const voices = $("voiceSeg");
    Object.keys(Audio.VOICES).forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg";
      b.setAttribute("role", "radio");
      b.dataset.value = id;
      b.textContent = Audio.VOICES[id].name;
      voices.appendChild(b);
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
  $("scaleBtn").addEventListener("click", (e) => openSheet("scalePage", e.currentTarget));

  $("scaleList").addEventListener("click", (e) => {
    const star = e.target.closest("[data-star]");
    if (star) { toggleFavorite(star.dataset.star); return; }
    const row = e.target.closest("[data-scale]");
    if (row) {
      set({ selectedScale: row.dataset.scale });
      closeSheet();
    }
  });

  $("scaleTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    set({ scaleTab: b.dataset.tab });
    $("scaleList").scrollTop = 0;
    renderScaleList();
  });

  $("scaleSearch").addEventListener("input", (e) => {
    scaleQuery = e.target.value;
    $("scaleList").scrollTop = 0;
    renderScaleList();
  });
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
  bindSeg($("voiceSeg"), "value", (v) => { set({ voice: v }); preview(); });
  bindSeg($("ringSeg"), "value", (v) => { set({ ring: v }); preview(); });

  /** Lets the player hear a sound choice straight away: root, then fifth. */
  function preview() {
    if (state.playbackState === "playing") return;
    const root = Fret.playbackSequence(key, "up")[0] + 12;
    Audio.playSequence([root, root + 7], 0.28, null, null);
  }

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
  Audio.setVoice(state.voice);
  Audio.setRing(state.ring);
  rebuildKey();
  buildPickers();
  renderPickers();
  renderLegend();
  renderToolbar();
  lastSize = scroller.clientWidth + "x" + scroller.clientHeight;
  buildBoard();
})();
