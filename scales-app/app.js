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
  const CHORD_IDS = Theory.CHORDS.map((c) => c.id);
  const DIRECTIONS = ["up", "down", "updown"];
  const DIR_LABELS = { up: "ascending", down: "descending", updown: "ascending then descending" };

  function intOrNull(v, lo, hi) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  }

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
    scaleTab: pick(store.get("scaleTab") === "all" ? "scales" : store.get("scaleTab"),
      ["scales", "arpeggios", "favorites"], "scales"),

    // Chord-tone overlay. The chord root is kept as an offset from the key's
    // root, so a chosen V chord stays the V when the key changes.
    chordId: pick(store.get("chord"), CHORD_IDS, null),
    chordOffset: intOrNull(store.get("chordOffset"), 0, 11),
    chordTab: pick(store.get("chordTab"), ["key", "all"], "key"),

    // Position focus: a box of frets, the rest of the neck faded behind it.
    focusOn: store.get("focus", "0") === "1",
    focusStart: intOrNull(store.get("focusStart"), 0, 24),
    focusSpan: Number(pick(store.get("focusSpan"), Fret.FOCUS_SPANS.map(String), "5")),
    focusStep: pick(store.get("focusStep"), ["shape", "fret"], "shape"),
    loop: store.get("loop", "0") === "1",

    // Progression mode. Built-ins by id; customs as "custom:<id>".
    progressionId: store.get("progression", "") || null,
    progStyle: pick(store.get("progStyle"), ["modes", "moved"], "modes"),
    progMove: pick(store.get("progMove"), ["stay", "up", "down"], "stay"),
    progTab: pick(store.get("progTab"), ["popular", "custom"], "popular"),
    customProgs: loadCustomProgs()
  };

  function loadCustomProgs() {
    try {
      const list = JSON.parse(store.get("customProgs", "[]"));
      return Array.isArray(list)
        ? list.filter((p) => p && p.id && Array.isArray(p.steps) && p.steps.length &&
            p.steps.every((x) => Theory.parseRoman(x)))
        : [];
    } catch (e) { return []; }
  }

  function getProgression(id) {
    if (!id) return null;
    if (id.indexOf("custom:") === 0) {
      return state.customProgs.find((p) => "custom:" + p.id === id) || null;
    }
    return Theory.PROGRESSIONS.find((p) => p.id === id) || null;
  }

  function numerals(steps) {
    return steps.join("\u2013");
  }
  if (state.chordId === null || state.chordOffset === null) {
    state.chordId = null;
    state.chordOffset = null;
  }

  /** Arpeggio tones read in stacked order (1 3 5 7 9), not pitch order. */
  function degreeNum(label) {
    return parseInt(String(label).replace(/\D/g, ""), 10) || 1;
  }

  function inChordOrder(items, labelOf) {
    return items.slice().sort((a, b) => degreeNum(labelOf(a)) - degreeNum(labelOf(b)));
  }

  function formulaOf(scale) {
    const labels = Theory.degreeLabels(scale);
    return (scale.isChord ? inChordOrder(labels, (l) => l) : labels).join(" ");
  }

  function loadFavorites() {
    try {
      const list = JSON.parse(store.get("favorites", "[]"));
      return Array.isArray(list) ? list.filter((id) => SCALE_IDS.indexOf(id) !== -1) : [];
    } catch (e) { return []; }
  }

  let key = null;
  let chord = null;
  let board = null;

  /* --------------------------------------------------------------- view */

  const scroller = $("boardScroll");
  const view = window.GembaBoardView.create(scroller, onCellTap, onFretTap);

  function buildBoard() {
    board = Fret.createFretboard({ tuning: "standard", fretCount: state.fretRange });
    const ratio = scroller.scrollWidth > scroller.clientWidth
      ? scroller.scrollLeft / (scroller.scrollWidth - scroller.clientWidth) : 0;

    view.build(board);
    view.render(key, state.displayMode, state.showChromatic, overlay());

    scroller.scrollLeft = ratio * Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    updateNav();
  }

  function rebuildKey() {
    key = Theory.createKey(state.selectedRoot, state.selectedScale, state.preferredAccidental);
  }

  function rebuildChord() {
    chord = state.chordId ? Theory.createChord(key, state.chordOffset, state.chordId) : null;
  }

  /** The box in force, or null. Defaults to the root's fret on the low E. */
  function currentFocus() {
    if (!state.focusOn) return null;
    const start = state.focusStart === null ? Theory.mod12(key.rootPc - 4) : state.focusStart;
    return Fret.clampFocus(start, state.focusSpan, state.fretRange);
  }

  function overlay() {
    return { chord, focus: currentFocus() };
  }

  function renderBoard() {
    view.render(key, state.displayMode, state.showChromatic, overlay());
  }

  function renderToolbar() {
    // While a progression plays these name the current step (see showStep).
    if (shownStep === -1) {
      $("rootNote").textContent = key.rootName;
      $("scaleName").textContent = key.scale.name;
    }
    $("rootBtn").setAttribute("aria-label", "Root note " + key.rootName + ". Change root");
    $("scaleBtn").setAttribute("aria-label", "Scale " + key.scale.name + ". Change scale");

    const modeBtn = $("modeBtn");
    modeBtn.classList.toggle("is-notes", state.displayMode === "notes");
    modeBtn.setAttribute("aria-label", state.displayMode === "notes"
      ? "Showing note names. Tap for intervals" : "Showing intervals. Tap for note names");

    const prog = getProgression(state.progressionId);
    const progBtn = $("progBtn");
    progBtn.classList.toggle("is-active", !!prog);
    $("progLabel").textContent = prog ? (prog.steps.length <= 4 ? numerals(prog.steps) : prog.name) : "Prog";
    progBtn.setAttribute("aria-label", prog
      ? "Progression " + prog.name + ". Change or turn off" : "Progression mode");
    syncSeg($("dirSeg2"), "dir", state.direction);
    syncSeg($("spanSeg"), "value", String(state.focusSpan));
    syncSeg($("stepSeg"), "value", state.focusStep);

    const dirBtn = $("dirBtn");
    DIRECTIONS.forEach((d) => dirBtn.classList.toggle("dir-" + d, d === state.direction));
    dirBtn.setAttribute("aria-label", "Playback direction: " + DIR_LABELS[state.direction] + ". Tap to change");

    const chordBtn = $("chordBtn");
    chordBtn.classList.toggle("is-active", !!chord);
    $("chordLabel").textContent = chord ? chord.symbol : "Chord";
    chordBtn.setAttribute("aria-label", chord
      ? "Chord overlay " + chord.symbol + ". Change or clear"
      : "Chord overlay: highlight a chord inside the scale");

    const loopBtn = $("loopBtn");
    loopBtn.classList.toggle("is-active", state.loop);
    loopBtn.setAttribute("aria-pressed", String(state.loop));
    loopBtn.setAttribute("aria-label", state.loop ? "Loop is on. Tap to play once" : "Loop playback");

    const focusBtn = $("focusBtn");
    const fb = currentFocus();
    focusBtn.classList.toggle("is-active", state.focusOn);
    // On, the button names the frets in the box: one less thing to look for.
    $("focusLabel").textContent = fb ? fb.start + "\u2013" + fb.end : "Box";
    focusBtn.setAttribute("aria-pressed", String(state.focusOn));
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
    const what = getProgression(state.progressionId) ? "progression"
      : (chord ? "chord" : "scale") + (state.focusOn ? " in the box" : "");
    $("playBtn").setAttribute("aria-label", playing ? "Stop playback" : "Play " + what);

    const f = currentFocus();
    $("boardSummary").textContent =
      `${key.rootName} ${key.scale.name}: ${key.tones.map((t) => t.note).join(" ")}` +
      (chord ? `. Showing ${chord.symbol}: ${chord.tones.map((t) => t.note).join(" ")}` : "") +
      (f ? `. Focus on frets ${f.start} to ${f.end}` : "");

    updateNav();
  }

  function renderLegend() {
    const legend = $("legend");
    legend.innerHTML = "";

    const title = document.createElement("span");
    title.className = "legend-title";
    title.textContent = chord
      ? `${chord.symbol} \u00B7 in ${key.rootName} ${key.scale.name}`
      : `${key.rootName} ${key.scale.name}`;
    legend.appendChild(title);
    legend.classList.toggle("is-chord", !!chord);

    const prog = getProgression(state.progressionId);
    if (prog) {
      const tag = document.createElement("span");
      tag.className = "legend-shape";
      // Short progressions spell out; long ones (12-bar, Canon) go by name.
      tag.textContent = prog.steps.length <= 5
        ? numerals(prog.steps) + " \u00B7 " +
          Theory.progressionSteps(key, prog.steps, state.progStyle).map((st) => st.key.rootName).join(" ")
        : prog.name;
      legend.appendChild(tag);
    }

    const shape = shapeInfo();
    if (shape && !prog) {
      const tag = document.createElement("span");
      tag.className = "legend-shape";
      tag.textContent = shape;
      legend.appendChild(tag);
    }

    // With a chord on, the legend lists the chord's tones and their function;
    // a tone the scale lacks is marked so the clash is plain.
    const tones = chord ? chord.tones
      : key.scale.isChord ? inChordOrder(key.tones, (t) => t.degree) : key.tones;
    tones.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (t.interval === 0 ? " is-root" : "") + (chord && !t.inScale ? " is-out" : "");
      chip.dataset.pc = t.pc;
      chip.innerHTML = `<span class="chip-note"></span><span class="chip-deg"></span>`;
      chip.firstChild.textContent = t.note;
      chip.lastChild.textContent = t.degree;
      if (chord && !t.inScale) chip.title = t.note + " is outside the scale";
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
    pickBtn.querySelector(".scale-pick-formula").textContent = formulaOf(scale);

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
      // Searching flattens the groups and looks in both tabs: each scale once.
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
      const kind = state.scaleTab === "arpeggios" ? "arpeggio" : "scale";
      Theory.GROUPS.filter((g) => g.kind === kind).forEach((g) => {
        list.appendChild(section(g.name, g.items.map((it) => scaleRow(it.scale, it.label))));
      });
    }

    list.scrollTop = keepScroll;
  }

  /* ---------------------------------------------------------- chord page */

  let chordPickRoot = 0;   // root offset being browsed on the All chords tab

  function chordChip(offset, c, main, sub, extraClass) {
    const b = document.createElement("button");
    b.type = "button";
    const active = chord && state.chordId === c.id && state.chordOffset === offset;
    b.className = "chord-chip" + (active ? " is-active" : "") + (extraClass || "");
    b.dataset.offset = offset;
    b.dataset.chord = c.id;
    b.setAttribute("aria-pressed", String(!!active));
    b.innerHTML = `<span class="chord-chip-main"></span><span class="chord-chip-sub"></span>`;
    b.firstChild.textContent = main;
    b.lastChild.textContent = sub;
    return b;
  }

  function renderChordPage() {
    const body = $("chordBody");
    body.innerHTML = "";
    $("chordPageSub").textContent = `in ${key.rootName} ${key.scale.name}`;
    $("chordClear").hidden = !chord;
    $("chordTabs").querySelectorAll(".seg").forEach((b) => {
      const on = b.dataset.tab === state.chordTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });

    if (state.chordTab === "key") {
      // One row per scale degree: every catalogue chord that fits the scale.
      Theory.diatonicChords(key).forEach((d) => {
        const row = document.createElement("div");
        row.className = "chord-degree";
        const head = document.createElement("div");
        head.className = "chord-degree-head";
        head.innerHTML = `<span class="chord-degree-num"></span><span class="chord-degree-note"></span>`;
        head.firstChild.textContent = d.degree;
        head.lastChild.textContent = d.note;
        row.appendChild(head);

        const chips = document.createElement("div");
        chips.className = "chord-chips";
        if (!d.chords.length) {
          const none = document.createElement("span");
          none.className = "chord-none";
          none.textContent = "No chords from the list fit here";
          chips.appendChild(none);
        }
        d.chords.forEach((x) => chips.appendChild(chordChip(d.offset, x.chord, x.symbol, x.roman)));
        row.appendChild(chips);
        body.appendChild(row);
      });
      return;
    }

    // All chords: pick any root (named as the key spells it), then any quality.
    const roots = document.createElement("div");
    roots.className = "chord-roots";
    roots.setAttribute("role", "radiogroup");
    roots.setAttribute("aria-label", "Chord root");
    for (let o = 0; o < 12; o++) {
      const info = key.byInterval[o];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chord-root" + (o === chordPickRoot ? " is-active" : "") + (info.inScale ? " in-scale" : "");
      b.dataset.pickRoot = o;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o === chordPickRoot));
      b.textContent = info.note;
      roots.appendChild(b);
    }
    body.appendChild(roots);

    const rootName = key.byInterval[chordPickRoot].note;
    Theory.FAMILIES.map((f) => [f.id, f.name]).forEach(([family, label]) => {
      const sec = document.createElement("section");
      sec.className = "scale-group";
      const h = document.createElement("h3");
      h.className = "scale-group-title";
      h.textContent = label;
      sec.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "chord-grid";
      Theory.CHORDS.filter((c) => c.family === family).forEach((c) => {
        const fits = c.intervals.every((iv) => key.isScaleTone(key.rootPc + chordPickRoot + iv));
        grid.appendChild(chordChip(chordPickRoot, c, rootName + c.symbol,
          c.name + (fits ? " \u00B7 in scale" : ""), fits ? " fits" : ""));
      });
      sec.appendChild(grid);
      body.appendChild(sec);
    });
  }

  /* ----------------------------------------------------- progression page */

  let draftSteps = [];
  let draftName = "";

  function progRow(prog, id, onDelete) {
    const active = state.progressionId === id;
    const row = document.createElement("div");
    row.className = "scale-row" + (active ? " is-active" : "");

    const b = document.createElement("button");
    b.type = "button";
    b.className = "scale-pick";
    b.dataset.prog = id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(active));
    const steps = Theory.progressionSteps(key, prog.steps, state.progStyle);
    const inKey = steps.map((st) => st.key.rootName).join(" \u00B7 ");
    b.innerHTML = `<span class="scale-pick-text"><span class="scale-pick-name"></span>` +
      `<span class="scale-pick-aka"></span></span><span class="scale-pick-formula"></span>`;
    b.querySelector(".scale-pick-name").textContent = prog.name;
    b.querySelector(".scale-pick-aka").textContent = inKey;
    b.querySelector(".scale-pick-formula").textContent = numerals(prog.steps);
    row.appendChild(b);

    if (onDelete) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "row-delete";
      del.dataset.deleteProg = prog.id;
      del.setAttribute("aria-label", "Delete " + prog.name);
      del.textContent = "\u00D7";
      row.appendChild(del);
    }
    return row;
  }

  function renderProgPage() {
    $("progPageSub").textContent = `in ${key.rootName} ${key.scale.name}`;
    $("progClear").hidden = !getProgression(state.progressionId);
    $("progTabs").querySelectorAll(".seg").forEach((b) => {
      const on = b.dataset.tab === state.progTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    syncSeg($("progStyleSeg"), "value", state.progStyle);
    syncSeg($("progMoveSeg"), "value", state.progMove);

    const list = $("progList");
    list.innerHTML = "";

    if (state.progTab === "popular") {
      [["major", "Major keys"], ["minor", "Minor keys"]].forEach(([mood, title]) => {
        const rows = Theory.PROGRESSIONS.filter((p) => p.mood === mood).map((p) => progRow(p, p.id));
        list.appendChild(section(title, rows));
      });
      return;
    }

    // Custom: build with the numeral pad, name it, save it.
    const builder = document.createElement("div");
    builder.className = "prog-builder";

    const draft = document.createElement("div");
    draft.className = "prog-draft";
    draft.setAttribute("aria-label", "Your progression");
    if (!draftSteps.length) {
      const empty = document.createElement("span");
      empty.className = "prog-draft-empty";
      empty.textContent = "Tap numerals below to build a progression. Tap a step to remove it.";
      draft.appendChild(empty);
    }
    draftSteps.forEach((label, i) => {
      const st = Theory.progressionSteps(key, [label], state.progStyle)[0];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "draft-step";
      b.dataset.removeStep = i;
      b.setAttribute("aria-label", "Remove " + label);
      b.innerHTML = `<span class="draft-step-num"></span><span class="draft-step-note"></span>`;
      b.firstChild.textContent = label;
      b.lastChild.textContent = st.key.rootName;
      draft.appendChild(b);
    });
    builder.appendChild(draft);

    const pad = document.createElement("div");
    pad.className = "numeral-pad";
    for (let o = 0; o < 12; o++) {
      const label = Theory.romanForOffset(key, o);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "numeral" + (key.isScaleTone(key.rootPc + o) ? " in-scale" : "");
      b.dataset.addStep = label;
      b.setAttribute("aria-label", "Add " + label);
      b.innerHTML = `<span class="numeral-num"></span><span class="numeral-note"></span>`;
      b.firstChild.textContent = label;
      // Scale tones keep the key's spelling; a ♭ or ♯ numeral spells to match.
      const info = key.byInterval[o];
      b.lastChild.textContent = info.inScale ? info.note
        : Theory.simpleName(key.rootPc + o, label.charAt(0) === Theory.FLAT);
      pad.appendChild(b);
    }
    builder.appendChild(pad);

    const save = document.createElement("div");
    save.className = "prog-save";
    save.innerHTML = `<label class="search"><input id="progName" type="text" maxlength="40" ` +
      `placeholder="Name (optional)" autocomplete="off" spellcheck="false" aria-label="Progression name" /></label>` +
      `<button class="pill-btn" type="button" id="progDraftClear">Clear</button>` +
      `<button class="pill-btn" type="button" id="progSave">Save &amp; use</button>`;
    builder.appendChild(save);
    list.appendChild(builder);

    const nameInput = save.querySelector("#progName");
    nameInput.value = draftName;
    nameInput.addEventListener("input", () => { draftName = nameInput.value; });
    save.querySelector("#progSave").disabled = draftSteps.length < 2;
    save.querySelector("#progDraftClear").disabled = !draftSteps.length;

    if (state.customProgs.length) {
      list.appendChild(section("Saved", state.customProgs.map((p) => progRow(p, "custom:" + p.id, true))));
    } else {
      list.appendChild(emptyNote("Saved progressions appear here."));
    }
  }

  function saveDraft() {
    if (draftSteps.length < 2) return;
    const id = Date.now().toString(36);
    const name = draftName.trim() || numerals(draftSteps);
    const customProgs = state.customProgs.concat({ id, name, steps: draftSteps.slice() });
    store.set("customProgs", JSON.stringify(customProgs));
    draftSteps = [];
    draftName = "";
    set({ customProgs, progressionId: "custom:" + id });
    closeSheet();
  }

  function deleteCustom(id) {
    const customProgs = state.customProgs.filter((p) => p.id !== id);
    store.set("customProgs", JSON.stringify(customProgs));
    set({
      customProgs,
      progressionId: state.progressionId === "custom:" + id ? null : state.progressionId
    });
    renderProgPage();
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
    const chordChanged = keyChanged || state.chordId !== before.chordId ||
      state.chordOffset !== before.chordOffset;
    const focusChanged = state.focusOn !== before.focusOn || state.focusStart !== before.focusStart ||
      state.focusSpan !== before.focusSpan || state.fretRange !== before.fretRange;

    const progChanged = state.progressionId !== before.progressionId ||
      state.progStyle !== before.progStyle || state.progMove !== before.progMove ||
      state.customProgs !== before.customProgs;

    if ((chordChanged || focusChanged || progChanged) && state.playbackState === "playing") stopPlayback();
    if (keyChanged) rebuildKey();
    if (chordChanged) rebuildChord();

    if (state.theme !== before.theme) applyTheme();

    if (state.fretRange !== before.fretRange) buildBoard();
    else if (chordChanged || focusChanged || state.displayMode !== before.displayMode ||
             state.showChromatic !== before.showChromatic) renderBoard();

    if (chordChanged || focusChanged || progChanged) renderLegend();
    if (keyChanged) renderPickers();
    renderToolbar();
    if (focusChanged && state.focusOn) revealFocus();

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
    store.set("chord", state.chordId || "");
    store.set("chordOffset", state.chordOffset === null ? "" : state.chordOffset);
    store.set("chordTab", state.chordTab);
    store.set("focus", state.focusOn ? "1" : "0");
    store.set("focusStart", state.focusStart === null ? "" : state.focusStart);
    store.set("focusSpan", state.focusSpan);
    store.set("focusStep", state.focusStep);
    store.set("loop", state.loop ? "1" : "0");
    store.set("progression", state.progressionId || "");
    store.set("progStyle", state.progStyle);
    store.set("progMove", state.progMove);
    store.set("progTab", state.progTab);

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

    if (id === "progPage") {
      renderProgPage();
      $("progBody").scrollTop = 0;
    }

    if (id === "chordPage") {
      chordPickRoot = state.chordOffset === null ? 0 : state.chordOffset;
      renderChordPage();
      $("chordBody").scrollTop = 0;
      const current = sheet.querySelector(".chord-chip.is-active");
      if (current) current.scrollIntoView({ block: "center" });
    }

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

    const spans = $("spanSeg");
    Fret.FOCUS_SPANS.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seg";
      b.setAttribute("role", "radio");
      b.dataset.value = String(n);
      b.textContent = n + " frets";
      spans.appendChild(b);
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
    const whole = max <= 1;
    const f = currentFocus();

    // In focus mode the arrows walk the box a fret at a time.
    if (f) {
      const byShape = state.focusStep === "shape";
      left.disabled = focusTarget(-1) === null;
      right.disabled = focusTarget(1) === null;
      left.setAttribute("aria-label", byShape ? "Previous shape" : "Move the box toward the nut");
      right.setAttribute("aria-label", byShape ? "Next shape" : "Move the box toward the body");
      left.title = right.title = "";
    } else {
      left.disabled = scroller.scrollLeft <= 1;
      right.disabled = scroller.scrollLeft >= max - 1;
      left.setAttribute("aria-label", "Toward the nut");
      right.setAttribute("aria-label", "Toward the body");
      left.title = right.title = whole ? "The whole neck is in view" : "";
    }
    $("rotateHint").classList.toggle("is-needed", !whole);
    // The arrows only appear when they can do something.
    $("navPair").hidden = !f && whole;
  }

  /** The pitch classes in view: the chord's if one is shown, else the scale's. */
  function activePcs() {
    return chord ? chord.tones.map((t) => t.pc) : key.pitchClasses;
  }

  function shapes() {
    return board ? Fret.shapeStarts(board, activePcs(), state.focusSpan) : [];
  }

  /** Where the box goes next in direction d: next shape, or one fret, per the setting. */
  function focusTarget(d) {
    const f = currentFocus();
    if (!f) return null;
    if (state.focusStep === "fret") {
      const next = Fret.clampFocus(f.start + d, state.focusSpan, state.fretRange).start;
      return next === f.start ? null : next;
    }
    const list = shapes().map((x) => x.start);
    const next = d > 0 ? list.find((x) => x > f.start) : list.slice().reverse().find((x) => x < f.start);
    return next === undefined ? null : next;
  }

  function moveFocus(d) {
    const next = focusTarget(d);
    if (next !== null) set({ focusStart: next });
  }

  /** "Shape 2 of 5 · from ♭3 · frets 3–7", or just the frets off a shape. */
  function shapeInfo() {
    const f = currentFocus();
    if (!f) return null;
    const list = shapes();
    const i = list.findIndex((x) => x.start === f.start);
    const frets = f.start === f.end ? "fret " + f.start : "frets " + f.start + "\u2013" + f.end;
    if (i === -1) return frets;
    const from = chord
      ? chord.byInterval[Theory.mod12(list[i].pc - chord.rootPc)].degree
      : key.byInterval[Theory.mod12(list[i].pc - key.rootPc)].degree;
    return "Shape " + (i + 1) + " of " + list.length + " \u00B7 from " + from + " \u00B7 " + frets;
  }

  /** Scrolls the neck so the whole box is in view, centring it if it was not. */
  function revealFocus() {
    const f = currentFocus();
    if (f) revealSpan(f);
  }

  /**
   * Scrolls the neck to a box. Unless `always`, a box already fully on
   * screen stays put; otherwise it is centred.
   */
  function revealSpan(f, always) {
    const x = view.spanX(f.start, f.end);
    if (!x) return;
    const viewL = scroller.scrollLeft;
    const viewR = viewL + scroller.clientWidth;
    if (!always && x.left >= viewL + 4 && x.right <= viewR - 4) return;
    scroller.scrollTo({ left: (x.left + x.right) / 2 - scroller.clientWidth / 2, behavior: "smooth" });
  }

  function onFretTap(fret) {
    set({ focusOn: true, focusStart: Fret.clampFocus(fret, state.focusSpan, state.fretRange).start });
  }

  function nudge(dir) {
    if (state.focusOn) { moveFocus(dir); return; }
    // Roughly four frets per press, whatever the board's scale.
    const g = view.geometry;
    const step = g ? (g.fretX[Math.min(5, g.fretX.length - 1)] - g.fretX[1]) : scroller.clientWidth * 0.5;
    scroller.scrollBy({ left: dir * Math.max(step, scroller.clientWidth * 0.33), behavior: "smooth" });
  }

  /* ------------------------------------------------------------ playback */

  let flashTimer = null;

  function highlight(midi, only) {
    view.setSounding(midi, only);
    const pc = midi === null ? -1 : Theory.mod12(midi);
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-sounding", Number(c.dataset.pc) === pc);
    });
  }

  /**
   * What Play plays: the chord if one is overlaid, else the scale. In focus
   * mode it runs every such note inside the box, low to high, lighting the
   * exact position; otherwise one octave from the lowest root.
   */
  function playbackItems() {
    const pcs = chord ? chord.tones.map((t) => t.pc) : key.pitchClasses;
    const f = currentFocus();
    if (f) {
      return Fret.positionSequence(board, pcs, f, state.direction)
        .map((n) => ({ midi: n.midi, only: { string: n.string, fret: n.fret } }));
    }
    const midis = chord
      ? Fret.arpeggio(chord.rootPc, chord.chord.intervals, state.direction)
      : Fret.playbackSequence(key, state.direction);
    return midis.map((m) => ({ midi: m, only: null }));
  }

  function startPlayback() {
    if (!getProgression(state.progressionId) && !playbackItems().length) return;
    clearTimeout(flashTimer);
    set({ playbackState: "playing" });
    playPass(undefined);
  }

  /**
   * One run through the notes. With Loop on, each pass queues the next as it
   * ends; turning Loop off lets the current pass finish, then stops.
   */
  function playPass(startAt) {
    const prog = getProgression(state.progressionId);
    let chained = false;
    const items = prog ? progressionItems(prog) : playbackItems();
    // Up+down would sound its bottom note twice at the seam; drop the repeat.
    if (!prog && state.loop && state.direction === "updown" && items.length > 2) items.pop();

    Audio.playSequence(items.map((x) => x.midi), SPEEDS[state.speed],
      (i) => {
        const it = items[i];
        if (it.step !== undefined && it.step !== shownStep) showStep(it);
        // A rest keeps the step's last note lit until the next step begins.
        if (it.midi !== null) highlight(it.midi, it.only);
      },
      () => {
        // The next loop pass (if any) is already running; it finishes later.
        if (chained || state.playbackState !== "playing") return;
        finishPlayback();
        set({ playbackState: "idle" });
      },
      {
        startAt,
        onNearEnd: (end) => {
          if (state.playbackState !== "playing" || !state.loop) return;
          chained = true;
          playPass(end);
        }
      });
  }

  /*
   * Progression playback: each step plays one octave of its scale or mode,
   * placed on the neck by the "On the neck" choice, with a beat's rest
   * between steps. While a step sounds, the board shows that step's mode.
   */
  let progSteps = null;
  let progPlan = null;
  let shownStep = -1;

  function progressionItems(prog) {
    progSteps = Theory.progressionSteps(key, prog.steps, state.progStyle);
    progPlan = Fret.progressionPlan(board, progSteps, {
      move: state.progMove,
      span: state.focusSpan,
      box: state.progMove === "stay" ? currentFocus() : null,
      direction: state.direction
    });
    const items = [];
    progPlan.forEach((p, step) => {
      p.notes.forEach((n) => items.push({ midi: n.midi, only: { string: n.string, fret: n.fret }, step }));
      items.push({ midi: null, only: null, step });          // a beat's rest
    });
    return items;
  }

  /**
   * A new progression step: the neck, box, legend and toolbar all follow it,
   * and the board scrolls so the step's box is centred on screen.
   */
  function showStep(item) {
    const first = shownStep === -1;
    shownStep = item.step;
    const st = progSteps[item.step];
    const focus = progPlan[item.step].focus;
    view.render(st.key, state.displayMode, state.showChromatic, { chord: null, focus });
    renderStepLegend(st, item.step);
    view.setSounding(null);
    revealSpan(focus, !first);

    // The toolbar names the step being played; finishPlayback restores it.
    $("rootNote").textContent = st.key.rootName;
    $("scaleName").textContent = st.name.slice(st.key.rootName.length + 1);
    document.querySelector(".toolbar").classList.add("is-following");
  }

  function renderStepLegend(st, index) {
    const legend = $("legend");
    legend.innerHTML = "";
    legend.classList.remove("is-chord");
    const where = document.createElement("span");
    where.className = "legend-step";
    where.textContent = `${index + 1}/${progSteps.length} \u00B7 ${st.label}`;
    legend.appendChild(where);
    const title = document.createElement("span");
    title.className = "legend-title";
    title.textContent = st.name;
    legend.appendChild(title);
    st.key.tones.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (t.interval === 0 ? " is-root" : "");
      chip.dataset.pc = t.pc;
      chip.innerHTML = `<span class="chip-note"></span><span class="chip-deg"></span>`;
      chip.firstChild.textContent = t.note;
      chip.lastChild.textContent = t.degree;
      legend.appendChild(chip);
    });
  }

  /** Back to the key's own view after a progression has played. */
  function finishPlayback() {
    highlight(null);
    if (shownStep !== -1) {
      shownStep = -1;
      progSteps = null;
      progPlan = null;
      document.querySelector(".toolbar").classList.remove("is-following");
      renderBoard();
      renderLegend();
      renderToolbar();
    }
  }

  function stopPlayback() {
    Audio.stop();
    finishPlayback();
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
  $("chordBtn").addEventListener("click", (e) => openSheet("chordPage", e.currentTarget));
  $("progBtn").addEventListener("click", (e) => openSheet("progPage", e.currentTarget));

  $("progTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    set({ progTab: b.dataset.tab });
    renderProgPage();
  });
  bindSeg($("progStyleSeg"), "value", (v) => { set({ progStyle: v }); renderProgPage(); });
  bindSeg($("progMoveSeg"), "value", (v) => { set({ progMove: v }); renderProgPage(); });

  $("progClear").addEventListener("click", () => {
    set({ progressionId: null });
    closeSheet();
  });

  $("progList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete-prog]");
    if (del) { deleteCustom(del.dataset.deleteProg); return; }
    const add = e.target.closest("[data-add-step]");
    if (add) { draftSteps.push(add.dataset.addStep); renderProgPage(); return; }
    const rm = e.target.closest("[data-remove-step]");
    if (rm) { draftSteps.splice(Number(rm.dataset.removeStep), 1); renderProgPage(); return; }
    if (e.target.closest("#progSave")) { saveDraft(); return; }
    if (e.target.closest("#progDraftClear")) { draftSteps = []; renderProgPage(); return; }
    const row = e.target.closest("[data-prog]");
    if (row) {
      set({ progressionId: row.dataset.prog });
      closeSheet();
    }
  });

  $("focusBtn").addEventListener("click", () => {
    if (state.focusOn) { set({ focusOn: false }); return; }
    // Land on a shape: the first one at or after where the box last was.
    let start = currentFocusStart();
    if (state.focusStep === "shape") {
      const list = shapes().map((x) => x.start);
      const at = list.find((x) => x >= start);
      if (at !== undefined) start = at;
      else if (list.length) start = list[list.length - 1];
    }
    set({ focusOn: true, focusStart: start });
  });

  /** Where a newly switched-on box starts: last place, else the root on low E. */
  function currentFocusStart() {
    return state.focusStart === null ? Theory.mod12(key.rootPc - 4) : state.focusStart;
  }

  $("loopBtn").addEventListener("click", () => set({ loop: !state.loop }));

  $("dirBtn").addEventListener("click", () => {
    set({ direction: DIRECTIONS[(DIRECTIONS.indexOf(state.direction) + 1) % DIRECTIONS.length] });
  });

  $("chordTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    set({ chordTab: b.dataset.tab });
    renderChordPage();
    $("chordBody").scrollTop = 0;
  });

  $("chordBody").addEventListener("click", (e) => {
    const r = e.target.closest("[data-pick-root]");
    if (r) {
      chordPickRoot = Number(r.dataset.pickRoot);
      renderChordPage();
      return;
    }
    const c = e.target.closest("[data-chord]");
    if (!c) return;
    const offset = Number(c.dataset.offset);
    // Tapping the chord already shown turns the overlay off.
    if (state.chordId === c.dataset.chord && state.chordOffset === offset) {
      set({ chordId: null, chordOffset: null });
    } else {
      set({ chordId: c.dataset.chord, chordOffset: offset });
    }
    closeSheet();
  });

  $("chordClear").addEventListener("click", () => {
    set({ chordId: null, chordOffset: null });
    closeSheet();
  });
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

  $("modeBtn").addEventListener("click", () =>
    set({ displayMode: state.displayMode === "notes" ? "intervals" : "notes" }));
  bindSeg($("spanSeg"), "value", (v) => set({ focusSpan: Number(v) }));
  bindSeg($("stepSeg"), "value", (v) => set({ focusStep: v }));
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
  rebuildChord();
  // The board model first: the legend and arrows ask it for shapes.
  board = Fret.createFretboard({ tuning: "standard", fretCount: state.fretRange });
  buildPickers();
  renderPickers();
  renderLegend();
  renderToolbar();
  lastSize = scroller.clientWidth + "x" + scroller.clientHeight;
  buildBoard();
})();
