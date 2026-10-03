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
    return arpeggio(key.rootPc, key.scale.intervals, direction, lowestMidi);
  }

  /** Any interval set from its lowest playable root, one octave, as MIDI. */
  function arpeggio(rootPc, intervals, direction, lowestMidi) {
    const floor = lowestMidi === undefined ? TUNINGS.standard.strings[0].midi : lowestMidi;
    const rootMidi = floor + ((((rootPc - floor) % 12) + 12) % 12);
    return applyDirection(intervals.map((iv) => rootMidi + iv).concat(rootMidi + 12), direction);
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

  return {
    TUNINGS,
    FRET_RANGES,
    FOCUS_SPANS,
    markerAt,
    createFretboard,
    playbackSequence,
    arpeggio,
    clampFocus,
    positionSequence
  };
});
