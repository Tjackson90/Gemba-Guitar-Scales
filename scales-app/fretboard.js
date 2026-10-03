/**
 * Fretboard engine: pure pitch arithmetic over a tuning and a fret range.
 *
 * Strings are stored low -> high (index 0 is the low E) so pitch maths stays
 * the obvious "open MIDI + fret". The view asks for displayOrder, which runs
 * high -> low to put the high E on top as players read a diagram.
 *
 * Loads as a browser global (window.GembaFretboard) or a CommonJS module.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GembaFretboard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Open-string MIDI numbers. Further tunings are one more entry. */
  const TUNINGS = {
    standard: {
      id: "standard",
      name: "Standard",
      strings: [
        { name: "E", midi: 40 }, // E2 - low E
        { name: "A", midi: 45 }, // A2
        { name: "D", midi: 50 }, // D3
        { name: "G", midi: 55 }, // G3
        { name: "B", midi: 59 }, // B3
        { name: "E", midi: 64 }  // E4 - high E
      ]
    }
  };

  const FRET_RANGES = [12, 15, 17, 22, 24];

  /**
   * Inlay pattern, repeating every octave: single dots at 3 5 7 9, a double
   * at 12 (and 24). Returns 0, 1 or 2.
   */
  function markerAt(fret) {
    if (fret <= 0) return 0;
    const f = fret % 12;
    if (f === 0) return 2;
    return f === 3 || f === 5 || f === 7 || f === 9 ? 1 : 0;
  }

  function createFretboard(options) {
    const opts = options || {};
    const tuning = TUNINGS[opts.tuning] || opts.tuning || TUNINGS.standard;
    const fretCount = Math.max(1, opts.fretCount || 12);
    const strings = tuning.strings;

    function pitchAt(stringIndex, fret) {
      return strings[stringIndex].midi + fret;
    }

    function pitchClassAt(stringIndex, fret) {
      return pitchAt(stringIndex, fret) % 12;
    }

    function intervalFromRoot(stringIndex, fret, rootPc) {
      return (((pitchAt(stringIndex, fret) - rootPc) % 12) + 12) % 12;
    }

    function isScaleTone(stringIndex, fret, key) {
      return key.isScaleTone(pitchClassAt(stringIndex, fret));
    }

    /** Indices into strings, top of the screen first (high E -> low E). */
    const displayOrder = strings.map((_, i) => i).reverse();

    /** Every position on the board, open strings included. */
    function positions() {
      const out = [];
      displayOrder.forEach((s, row) => {
        for (let f = 0; f <= fretCount; f++) {
          out.push({ string: s, row, fret: f, midi: pitchAt(s, f), pc: pitchClassAt(s, f) });
        }
      });
      return out;
    }

    return {
      tuning,
      strings,
      fretCount,
      displayOrder,
      pitchAt,
      pitchClassAt,
      intervalFromRoot,
      isScaleTone,
      positions
    };
  }

  /**
   * Notes for scale playback: one octave from the lowest root the guitar can
   * play (at or above the low string), as MIDI numbers.
   *   direction "up" | "down" | "updown"
   */
  function playbackSequence(key, direction, lowestMidi) {
    // An arpeggio "scale" plays as voiced (1 3 5 7 9), not folded into an octave.
    return arpeggio(key.rootPc, key.scale.stack || key.scale.intervals, direction, lowestMidi);
  }

  /**
   * Any interval set from its lowest playable root, as MIDI. Sets inside one
   * octave finish on the octave root; extended voicings (9ths, 13ths) end on
   * their top tone.
   */
  function arpeggio(rootPc, intervals, direction, lowestMidi) {
    const floor = lowestMidi === undefined ? TUNINGS.standard.strings[0].midi : lowestMidi;
    const rootMidi = floor + ((((rootPc - floor) % 12) + 12) % 12);
    const up = intervals.map((iv) => rootMidi + iv);
    if (Math.max.apply(null, intervals) < 12) up.push(rootMidi + 12);
    return applyDirection(up, direction);
  }

  function applyDirection(up, direction) {
    const down = up.slice().reverse();
    if (direction === "down") return down;
    if (direction === "updown") return up.concat(down.slice(1));
    return up;
  }

  /* ------------------------------------------------------- position focus */

  /** Spans offered for the focus box, in frets. */
  const FOCUS_SPANS = [4, 5, 6];

  /**
   * A box of `span` frets starting at `start` (0 = open position), kept on
   * the board. Returns { start, end, span } with end inclusive.
   */
  function clampFocus(start, span, fretCount) {
    const width = Math.max(1, Math.min(span, fretCount + 1));
    const first = Math.max(0, Math.min(start, fretCount + 1 - width));
    return { start: first, end: first + width - 1, span: width };
  }

  /**
   * The notes of a pitch-class set inside a box, in the order a player would
   * run them in position: lowest to highest pitch, each pitch once. When a
   * pitch sits on two strings in the box, the lower string takes it, as it
   * would when ascending without shifting.
   * Returns [{ midi, string, fret }] in the requested direction.
   */
  function positionSequence(board, pitchClasses, focus, direction) {
    const wanted = new Set(pitchClasses.map((pc) => ((pc % 12) + 12) % 12));
    const byMidi = new Map();

    board.strings.forEach((_, s) => {
      for (let f = focus.start; f <= focus.end && f <= board.fretCount; f++) {
        const midi = board.pitchAt(s, f);
        if (!wanted.has(midi % 12)) continue;
        if (!byMidi.has(midi) || s < byMidi.get(midi).string) byMidi.set(midi, { midi, string: s, fret: f });
      }
    });

    const up = Array.from(byMidi.values()).sort((a, b) => a.midi - b.midi);
    return applyDirection(up, direction);
  }

  /**
   * Shapes: one box per tone of the set on the low E string, the box starting
   * at that fret. For a pentatonic this gives the five familiar boxes; for an
   * arpeggio, one shape per chord tone - the same set every octave.
   * Returns [{ start, pc }] in fret order.
   */
  function shapeStarts(board, pitchClasses, span) {
    const wanted = new Set(pitchClasses.map((pc) => ((pc % 12) + 12) % 12));
    const seen = new Set();
    const out = [];
    for (let f = 0; f <= board.fretCount; f++) {
      const pc = board.pitchClassAt(0, f);
      if (!wanted.has(pc)) continue;
      const box = clampFocus(f, span, board.fretCount);
      if (seen.has(box.start)) continue;
      seen.add(box.start);
      out.push({ start: box.start, pc });
    }
    return out;
  }

  /* ---------------------------------------------------------- progressions */

  /** Frets on the low E string where a pitch class sits, low to high. */
  function rootFrets(board, pc) {
    const out = [];
    for (let f = 0; f <= board.fretCount; f++) if (board.pitchClassAt(0, f) === ((pc % 12) + 12) % 12) out.push(f);
    return out;
  }

  /**
   * One octave of a set inside a box, from the lowest root found there up to
   * the root above it (or as far as the box reaches).
   */
  function octaveInBox(board, pitchClasses, rootPc, focus) {
    const all = positionSequence(board, pitchClasses, focus, "up");
    const root = all.find((n) => n.midi % 12 === ((rootPc % 12) + 12) % 12);
    if (!root) return all;
    return all.filter((n) => n.midi >= root.midi && n.midi <= root.midi + 12);
  }

  /**
   * Where each progression step is played and which notes it plays.
   *   steps     [{ rootPc, key }] from GembaTheory.progressionSteps
   *   move      "stay" - every step in one box (opts.box, or the first root's)
   *             "up"   - each step at its next root up the low E
   *             "down" - each step at its next root down the low E
   *             Running out of neck wraps round to the other end.
   * Returns [{ focus, notes: [{ midi, string, fret }] }], notes already in
   * the requested direction.
   */
  function progressionPlan(board, steps, opts) {
    const span = opts.span || 5;
    const dir = opts.direction || "up";
    let prevFret = null;
    let prevPc = null;
    let stayBox = opts.box || null;

    return steps.map((step, i) => {
      let focus;
      if (opts.move === "stay") {
        if (!stayBox) stayBox = clampFocus(rootFrets(board, step.rootPc)[0] || 0, span, board.fretCount);
        focus = stayBox;
      } else {
        const frets = rootFrets(board, step.rootPc);
        const up = opts.move !== "down";
        let fret;
        if (i === 0 || prevFret === null) {
          fret = up ? frets[0] : frets[frets.length - 1];
        } else if (step.rootPc === prevPc) {
          fret = prevFret;                    // same chord again: stay put
        } else {
          fret = up ? frets.find((f) => f > prevFret) : frets.slice().reverse().find((f) => f < prevFret);
          if (fret === undefined) fret = up ? frets[0] : frets[frets.length - 1];
        }
        prevFret = fret;
        prevPc = step.rootPc;
        focus = clampFocus(fret, span, board.fretCount);
      }
      const notes = octaveInBox(board, step.key.pitchClasses, step.rootPc, focus);
      return { focus, notes: applyDirection(notes, dir) };
    });
  }

  return {
    TUNINGS,
    FRET_RANGES,
    FOCUS_SPANS,
    markerAt,
    createFretboard,
    playbackSequence,
    arpeggio,
    clampFocus,
    positionSequence,
    shapeStarts,
    progressionPlan
  };
});
