/**
 * Fretboard renderer.
 *
 * build() draws the board once for a given size and fret range: wood, frets,
 * strings, inlays, fret numbers and one node per position. Changing root,
 * scale or display mode never rebuilds - render() only flips classes and
 * text on the nodes that already exist.
 */
window.GembaBoardView = (function () {
  const NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  /**
   * Fret widths shrink up the neck, but at half the real rate (a real 12th
   * fret is ~53% of the 1st) so high frets stay wide enough to read.
   */
  function fretWeights(count) {
    const w = [];
    for (let n = 1; n <= count; n++) w.push(Math.pow(2, -n / 24));
    return w;
  }

  /** Whole pixels for a measured size, never past `avail` when it fits. */
  function fitTo(raw, avail) {
    return raw <= avail + 0.5 ? Math.min(avail, Math.ceil(raw - 0.01)) : Math.ceil(raw);
  }

  function create(scroller, onTap, onFretTap) {
    let root = null;
    let cells = [];
    let focusRect = null;
    let geometry = null;
    let last = { mode: null, chromatic: null };

    /**
     * Lays the board out to fill the scroller, overflowing sideways if needed.
     * Everything is measured right-handed (nut on the left); X() and span()
     * then mirror positions for left-handed mode. Only positions move - text
     * is never flipped, so labels stay readable.
     */
    function measure(board, mirror) {
      const availW = scroller.clientWidth;
      const availH = scroller.clientHeight;
      const numberRow = 26;
      const padY = 8;
      const padX = 8;

      // Rows follow the height, but a tall narrow screen (portrait) must not
      // grow notes so big that only a few frets fit across.
      const rowH = Math.max(28, Math.min(84, availW / 7.5, (availH - numberRow - padY * 2) / 6));
      const openW = Math.max(46, Math.min(78, rowH * 1.15));

      const weights = fretWeights(board.fretCount);
      const total = weights.reduce((a, b) => a + b, 0);
      const minFret = Math.max(48, rowH);
      let unit = (availW - padX * 2 - openW) / total;
      if (unit * weights[weights.length - 1] < minFret) {
        unit = minFret / weights[weights.length - 1];
      }

      const fretX = [padX + openW];            // fretX[0] is the nut
      weights.forEach((w) => fretX.push(fretX[fretX.length - 1] + w * unit));

      // A board that fits is sized to the space exactly. Rounding a fitted
      // 844.9999px up to 845 + 1 would overflow by a pixel, bring up a
      // scrollbar, shrink the space and trigger a rebuild - a flicker loop.
      const boardH = rowH * 6;
      const width = fitTo(fretX[fretX.length - 1] + padX, availW);
      const height = fitTo(numberRow + boardH + padY * 2, availH);
      const narrowest = weights[weights.length - 1] * unit;
      const r = Math.min(rowH * 0.4, narrowest * 0.4, 30);

      const X = (x) => (mirror ? width - x : x);

      return {
        width, height, rowH, openW, fretX, r, padX, mirror,
        top: numberRow + padY,
        X,
        /** A horizontal span [a, b] as an SVG x / width, mirrored if need be. */
        span(a, b) {
          const p = X(a);
          const q = X(b);
          return { x: Math.min(p, q), width: Math.abs(q - p) };
        },
        numberRow,
        cx(fret) {
          return fret === 0 ? padX + openW / 2 : (fretX[fret - 1] + fretX[fret]) / 2;
        },
        cy(row) { return numberRow + padY + rowH * (row + 0.5); }
      };
    }

    function build(board, mirror) {
      const g = measure(board, !!mirror);
      geometry = g;
      if (root) root.remove();

      root = svg("svg", {
        class: "fretboard" + (g.mirror ? " is-mirrored" : ""),
        width: g.width,
        height: g.height,
        viewBox: `0 0 ${g.width} ${g.height}`,
        "aria-hidden": "true"
      });

      const nut = g.fretX[0];
      const end = g.fretX[g.fretX.length - 1];
      const boardTop = g.top;
      const boardBottom = g.top + g.rowH * 6;

      /* ---- static layer ---- */
      const stat = svg("g", { class: "fb-static" }, root);

      const wood = g.span(nut, end);
      svg("rect", {
        class: "fb-wood", x: wood.x, y: boardTop, width: wood.width, height: boardBottom - boardTop, rx: 6
      }, stat);

      // Inlays sit between the strings so note circles never cover them.
      for (let f = 1; f <= board.fretCount; f++) {
        const m = window.GembaFretboard.markerAt(f);
        if (!m) continue;
        const x = g.X(g.cx(f));
        const dotR = Math.max(3, g.rowH * 0.075);
        const ys = m === 2
          ? [boardTop + g.rowH * 2, boardTop + g.rowH * 4]
          : [boardTop + g.rowH * 3];
        ys.forEach((y) => svg("circle", { class: "fb-inlay", cx: x, cy: y, r: dotR }, stat));
      }

      for (let f = 1; f <= board.fretCount; f++) {
        const x = g.X(g.fretX[f]);
        svg("line", { class: "fb-fret", x1: x, x2: x, y1: boardTop, y2: boardBottom }, stat);
      }
      const nutSpan = g.span(nut - 3, nut + 3);
      svg("rect", { class: "fb-nut", x: nutSpan.x, y: boardTop - 2, width: nutSpan.width, height: boardBottom - boardTop + 4, rx: 2 }, stat);

      // Strings thicken toward the low E (bottom row).
      board.displayOrder.forEach((s, row) => {
        const y = g.cy(row);
        svg("line", {
          class: "fb-string",
          x1: g.X(g.padX + g.openW * 0.12), x2: g.X(end), y1: y, y2: y,
          "stroke-width": (1 + row * 0.38).toFixed(2)
        }, stat);
      });

      // Fret numbers, with the inlay frets picked out.
      const nums = svg("g", { class: "fb-numbers" }, stat);
      for (let f = 0; f <= board.fretCount; f++) {
        const t = svg("text", {
          class: "fb-num" + (window.GembaFretboard.markerAt(f) ? " is-marker" : "") + (f === 0 ? " is-open" : ""),
          x: g.X(g.cx(f)), y: g.numberRow - 6, "text-anchor": "middle"
        }, nums);
        t.textContent = f === 0 ? "open" : String(f);

        const left = f === 0 ? g.padX : g.fretX[f - 1];
        const right = f === 0 ? g.fretX[0] : g.fretX[f];
        const hs = g.span(left, right);
        const hit = svg("rect", { class: "fb-num-hit", x: hs.x, y: 0, width: hs.width, height: g.numberRow + 6 }, nums);
        hit.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          onFretTap && onFretTap(f);
        });
      }

      // Position-focus frame: sits over the wood and strings, under the notes.
      focusRect = svg("rect", {
        class: "fb-focus", y: boardTop - 5, height: boardBottom - boardTop + 10, rx: 10, x: 0, width: 0
      }, root);

      /* ---- note layer ---- */
      const layer = svg("g", { class: "fb-notes" }, root);
      const fontMain = Math.round(g.r * 0.82);
      const fontBg = Math.max(11, Math.round(g.r * 0.6));

      cells = board.positions().map((p) => {
        const node = svg("g", {
          class: "cell",
          transform: `translate(${g.X(g.cx(p.fret)).toFixed(1)} ${g.cy(p.row).toFixed(1)})`
        }, layer);
        node.dataset.midi = p.midi;

        // Generous invisible hit area: the whole fret x string cell.
        const hitW = p.fret === 0 ? g.openW : g.fretX[p.fret] - g.fretX[p.fret - 1];
        svg("rect", { class: "hit", x: -hitW / 2, y: -g.rowH / 2, width: hitW, height: g.rowH }, node);

        const bg = svg("text", { class: "bg-label", "text-anchor": "middle", dy: "0.35em", "font-size": fontBg }, node);
        const halo = svg("circle", { class: "note-halo", r: g.r + 5 }, node);
        const dot = svg("circle", { class: "note-dot", r: g.r }, node);
        const label = svg("text", { class: "note-label", "text-anchor": "middle", dy: "0.36em", "font-size": fontMain }, node);

        node.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          onTap && onTap(p);
        });

        return { p, node, bg, label, halo, dot, interval: -1, text: "" };
      });

      scroller.innerHTML = "";
      scroller.appendChild(root);
      last = { mode: null, chromatic: null };
      return g;
    }

    /**
     * Pure presentation: key is GembaTheory.createKey(), mode "intervals" |
     * "notes". Only nodes whose text or class actually changes are touched.
     */
    function render(key, mode, showChromatic, overlay) {
      const g = geometry;
      if (!g) return;
      const chord = overlay && overlay.chord;
      const focus = overlay && overlay.focus;

      cells.forEach((c) => {
        const iv = ((c.p.pc - key.rootPc) % 12 + 12) % 12;
        const info = key.byInterval[iv];
        let text = mode === "notes" ? info.note : info.degree;
        let cls = "cell" + (info.inScale ? " in-scale" : " out") + (info.isRoot ? " is-root" : "");

        // Chord overlay: chord tones step forward labelled by chord function
        // (1 ♭3 5 ♭7); the rest of the scale stays visible but recedes.
        if (chord) {
          const ci = chord.byInterval[((c.p.pc - chord.rootPc) % 12 + 12) % 12];
          if (ci.isChordTone) {
            cls += " is-chord" + (ci.isRoot ? " is-chord-root" : "") + (ci.inScale ? "" : " chord-out");
            text = mode === "notes" ? ci.note : ci.degree;
          } else {
            if (info.inScale) cls += " is-dimmed";
            // Everything counts from the chord's root while a chord is shown,
            // so the faded scale tones read as its tensions (2 4 6, ♭6 ...).
            if (mode !== "notes") text = ci.degree;
          }
        }

        // Position focus: the box stays bright, the rest of the neck fades.
        if (focus && (c.p.fret < focus.start || c.p.fret > focus.end)) cls += " is-outside";
        if (c.node.classList.contains("is-sounding")) cls += " is-sounding";
        if (c.node.getAttribute("class") !== cls) c.node.setAttribute("class", cls);

        if (c.text !== text) {
          c.text = text;
          c.bg.textContent = text;
          c.label.textContent = text;
          // Longer labels (♭3, F♯, then ♯11, ♭13) step down to fit the circle.
          const size = text.length > 2 ? 0.56 : text.length > 1 ? 0.7 : 0.82;
          c.label.setAttribute("font-size", Math.round(g.r * size));
        }
      });

      if (showChromatic !== last.chromatic) {
        root.classList.toggle("hide-chromatic", !showChromatic);
        last.chromatic = showChromatic;
      }

      root.classList.toggle("has-chord", !!chord);
      placeFocus(focus);
    }

    function placeFocus(focus) {
      if (!focusRect) return;
      if (!focus) {
        focusRect.setAttribute("class", "fb-focus is-hidden");
        return;
      }
      const g = geometry;
      const left = focus.start === 0 ? g.padX : g.fretX[focus.start - 1];
      const right = focus.end === 0 ? g.fretX[0] : g.fretX[focus.end];
      const box = g.span(left - 3, right + 3);
      focusRect.setAttribute("x", box.x.toFixed(1));
      focusRect.setAttribute("width", box.width.toFixed(1));
      focusRect.setAttribute("class", "fb-focus");
    }

    /** On-screen x range of a fret span (mirrored if need be), for scrolling. */
    function spanX(start, end) {
      const g = geometry;
      if (!g) return null;
      const sp = g.span(
        start === 0 ? 0 : g.fretX[start - 1],
        end === 0 ? g.fretX[0] : g.fretX[Math.min(end, g.fretX.length - 1)]);
      return { left: sp.x, right: sp.x + sp.width };
    }

    /**
     * Pulses the positions sounding a MIDI note (null clears). With `only`
     * ({ string, fret }) just that one position lights, as in box playback.
     */
    function setSounding(midi, only) {
      cells.forEach((c) => {
        const hit = midi !== null && c.p.midi === midi &&
          (!only || (c.p.string === only.string && c.p.fret === only.fret));
        c.node.classList.toggle("is-sounding", hit);
      });
    }

    return {
      build,
      render,
      setSounding,
      spanX,
      get geometry() { return geometry; }
    };
  }

  return { create };
})();
