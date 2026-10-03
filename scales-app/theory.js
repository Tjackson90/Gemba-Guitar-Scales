/**
 * Music-theory layer for Gemba Scales.
 *
 * Everything musical is derived here from three inputs - root pitch class,
 * scale definition and accidental preference - so the UI never decides how a
 * note is spelled or what degree it is. Scales are interval sets; nothing is
 * stored per key.
 *
 * Loads as a browser global (window.GembaTheory) or a CommonJS module (tests).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./scale-catalog.js"));
  else root.GembaTheory = factory(root.GembaScaleCatalog);
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";

  const SHARP = "♯"; // ♯
  const FLAT = "♭";  // ♭

  /* Plain-ASCII reference names, kept for logic and tests. */
  const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLAT_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

  /* Major keys written with sharps: G D A E B F♯. */
  const SHARP_KEYS = [7, 2, 9, 4, 11, 6];

  /**
   * Default degree label for every semitone above the root. Used both for
   * scale tones (unless a scale overrides it) and for the faint chromatic
   * background on the fretboard.
   */
  const CHROMATIC_DEGREES = [
    "1", FLAT + "2", "2", FLAT + "3", "3", "4",
    FLAT + "5", "5", FLAT + "6", "6", FLAT + "7", "7"
  ];

  /** ASCII degree names from the catalogue ("b3", "#4", "bb7") -> glyphs. */
  function glyphs(label) {
    return label.replace(/b/g, FLAT).replace(/#/g, SHARP);
  }

  function normalise(entry) {
    return Object.assign({}, entry, {
      aka: entry.aka || [],
      degrees: entry.degrees ? entry.degrees.split(" ").map(glyphs) : null
    });
  }

  /* Chords: the overlay's catalogue. */
  const CHORDS = Catalog.CHORDS.map(normalise);
  const CHORD_BY_ID = Object.create(null);
  CHORDS.forEach((c) => { CHORD_BY_ID[c.id] = c; });

  /*
   * Every chord is also an arpeggio the player can view across the neck.
   * As a "scale" its tones are folded into one octave and sorted (a 9th
   * becomes the note a tone above the root, still labelled 9); `stack`
   * keeps the real voicing so playback runs 1 3 5 7 9.
   */
  const FAMILIES = Catalog.CHORD_FAMILIES;

  const ARPEGGIO_SCALES = CHORDS.map((c) => {
    const labels = degreeLabels(c);
    const folded = c.intervals
      .map((iv, i) => ({ iv: mod12(iv), label: labels[i] }))
      .sort((a, b) => a.iv - b.iv);
    return {
      id: (c.family === "triad" ? "triad-" : "arp-") + c.id,
      name: c.name + (c.family === "triad" ? " Triad" : " Arpeggio"),
      aka: c.aka,
      intervals: folded.map((x) => x.iv),
      degrees: folded.map((x) => x.label),
      stack: c.intervals,
      family: c.family,
      isChord: true
    };
  });

  /* The catalogue lives in scale-catalog.js; adding a scale is one entry there. */
  const PLAIN_SCALES = Catalog.SCALES.map(normalise);

  // Some arpeggios hold exactly a scale's notes (a 9th arpeggio is the
  // dominant pentatonic); say so, since that is worth knowing.
  ARPEGGIO_SCALES.forEach((a) => {
    const twin = PLAIN_SCALES.find((sc) => sc.intervals.join() === a.intervals.join());
    if (twin) a.aka = a.aka.concat("Same notes as " + twin.name);
  });

  const SCALES = PLAIN_SCALES.concat(ARPEGGIO_SCALES);

  const SCALE_BY_ID = Object.create(null);
  SCALES.forEach((s) => { SCALE_BY_ID[s.id] = s; });

  function mod12(n) {
    return ((n % 12) + 12) % 12;
  }

  function getScale(id) {
    return SCALE_BY_ID[id] || SCALES[0];
  }

  function degreeLabels(scale) {
    return scale.intervals.map((iv, i) =>
      (scale.degrees && scale.degrees[i]) || CHROMATIC_DEGREES[mod12(iv)]);
  }

  /**
   * Picker groups, resolved to scales: [{ id, name, items: [{ scale, label }] }]
   * where label is the group's name for it (Major appears as "Ionian").
   */
  const GROUPS = Catalog.GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    kind: "scale",
    items: g.items.map((item) => {
      const id = Array.isArray(item) ? item[0] : item;
      const scale = SCALE_BY_ID[id];
      return { scale, label: Array.isArray(item) ? item[1] : scale.name };
    })
  })).concat(FAMILIES.map((f) => ({
    // Arpeggio groups: one per chord family (Triads, 7ths, 9ths ...).
    id: f.id === "triad" ? "triads" : "arp-" + f.id,
    name: f.arpeggio,
    kind: "arpeggio",
    items: ARPEGGIO_SCALES.filter((a) => a.family === f.id).map((a) => ({ scale: a, label: a.name }))
  })));

  /** "♭3" -> 3, "♯4" -> 4, "5" -> 5 */
  function degreeNumber(label) {
    const m = /(\d+)/.exec(label);
    return m ? parseInt(m[1], 10) : 1;
  }

  /* ------------------------------------------------------------- spelling */

  /**
   * A spelled note is { letter, alter, pc }: alter is -1 for ♭, +1 for ♯.
   * Formatting turns it into display text in exactly one place.
   */
  function formatSpelled(n) {
    if (n.alter === 0) return n.letter;
    if (n.alter === 1) return n.letter + SHARP;
    if (n.alter === -1) return n.letter + FLAT;
    // Double accidentals are rare and font support for 𝄪 / 𝄫 is poor, so they
    // are never shown; spellScale() replaces them before they reach here.
    return n.alter > 0 ? n.letter + SHARP + SHARP : n.letter + FLAT + FLAT;
  }

  function simpleName(pc, useFlats) {
    const ascii = (useFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
    return ascii.replace("#", SHARP).replace(/^([A-G])b$/, "$1" + FLAT);
  }

  /** Spelled options for a root: one for a natural, sharp + flat for a black key. */
  function rootSpellings(pc) {
    pc = mod12(pc);
    const natural = LETTER_PC.indexOf(pc);
    if (natural !== -1) return [{ letter: LETTERS[natural], alter: 0, pc }];

    return [
      { letter: LETTERS[LETTER_PC.indexOf(pc - 1)], alter: 1, pc },
      { letter: LETTERS[LETTER_PC.indexOf(pc + 1)], alter: -1, pc }
    ];
  }

  /**
   * Spell one scale tone by counting letters up from the root letter by the
   * degree number (3rd degree -> two letters up), then measuring the accidental.
   * This gives B natural minor B C♯ D E F♯ G A and A blues A C D E♭ E G.
   */
  function spellTone(rootSpelled, degreeLabel, interval) {
    const letterIdx = (LETTERS.indexOf(rootSpelled.letter) + degreeNumber(degreeLabel) - 1) % 7;
    const pc = mod12(rootSpelled.pc + interval);
    const alter = mod12(pc - LETTER_PC[letterIdx] + 6) - 6;
    return { letter: LETTERS[letterIdx], alter, pc };
  }

  function accidentalCost(spelled) {
    // A double accidental is worse than two singles: it also reads badly.
    return spelled.reduce((sum, n) => sum + (Math.abs(n.alter) > 1 ? 4 : Math.abs(n.alter)), 0);
  }

  function spellAll(rootSpelled, scale) {
    const labels = degreeLabels(scale);
    return scale.intervals.map((iv, i) => spellTone(rootSpelled, labels[i], iv));
  }

  /**
   * Pick how a black-key root is spelled.
   *   preference "sharp" / "flat" - honoured outright
   *   preference "auto"           - whichever spelling gives the scale fewer
   *                                 accidentals; a tie goes to flats (E♭ minor
   *                                 over D♯ minor) except F♯, the usual guitar name
   */
  function chooseRootSpelling(rootPc, scale, preference) {
    const options = rootSpellings(rootPc);
    if (options.length === 1) return options[0];

    const [sharp, flat] = options;
    if (preference === "sharp") return sharp;
    if (preference === "flat") return flat;

    const sharpCost = accidentalCost(spellAll(sharp, scale));
    const flatCost = accidentalCost(spellAll(flat, scale));
    if (sharpCost !== flatCost) return sharpCost < flatCost ? sharp : flat;
    return mod12(rootPc) === 6 ? sharp : flat;
  }

  /* ------------------------------------------------------------------ key */

  /**
   * Builds everything the fretboard needs for one root + scale + preference.
   *
   * byInterval[0..11] answers, for any semitone distance from the root:
   *   inScale, isRoot, degree ("♭3"), note ("C"), pc
   * so a fret position only needs its interval to know how to render.
   */
  function createKey(rootPc, scaleId, preference) {
    rootPc = mod12(rootPc);
    const scale = scaleId && typeof scaleId === "object" ? scaleId : getScale(scaleId);
    const pref = preference || "auto";

    const rootSpelled = chooseRootSpelling(rootPc, scale, pref);
    const labels = degreeLabels(scale);
    const spelled = spellAll(rootSpelled, scale);

    // Out-of-scale names follow the preference, or in auto the key's own
    // direction. A scale with no accidentals of its own (G major pentatonic,
    // A minor pentatonic) borrows the key signature of its major - or, for a
    // minor-third scale, its relative major - so G gets F♯ and A minor gets B♭.
    let useFlats;
    if (pref === "flat") useFlats = true;
    else if (pref === "sharp") useFlats = false;
    else if (spelled.some((n) => n.alter < 0)) useFlats = true;
    else if (spelled.some((n) => n.alter > 0)) useFlats = false;
    else {
      const minorish = scale.intervals.indexOf(3) !== -1 && scale.intervals.indexOf(4) === -1;
      const major = mod12(rootPc + (minorish ? 3 : 0));
      useFlats = SHARP_KEYS.indexOf(major) === -1;
    }

    // Seven-note scales need one of each letter, so E♯ in F♯ major stays.
    // Pentatonic and blues scales do not, so their F♭ / C♭ / E♯ / B♯ read as
    // the plain white key a guitarist expects (B♭ blues: ♭5 is E, not F♭).
    const lettersMatter = scale.intervals.length === 7;

    const tones = scale.intervals.map((iv, i) => {
      const n = spelled[i];
      const awkward = Math.abs(n.alter) > 1 ||
        (!lettersMatter && n.alter !== 0 && LETTER_PC.indexOf(n.pc) !== -1);
      const note = awkward ? simpleName(n.pc, useFlats) : formatSpelled(n);
      return { interval: iv, degree: labels[i], note, pc: n.pc };
    });

    const byInterval = [];
    for (let iv = 0; iv < 12; iv++) {
      byInterval.push({
        interval: iv,
        pc: mod12(rootPc + iv),
        inScale: false,
        isRoot: iv === 0,
        degree: CHROMATIC_DEGREES[iv],
        note: simpleName(rootPc + iv, useFlats)
      });
    }
    tones.forEach((t) => {
      const slot = byInterval[t.interval];
      slot.inScale = true;
      slot.degree = t.degree;
      slot.note = t.note;
    });

    return {
      rootPc,
      rootName: tones[0].note,
      scale,
      preference: pref,
      tones,
      byInterval,
      pitchClasses: tones.map((t) => t.pc),
      intervalOf(pc) { return mod12(pc - rootPc); },
      isScaleTone(pc) { return byInterval[mod12(pc - rootPc)].inScale; }
    };
  }

  /* --------------------------------------------------------------- chords */

  function getChord(id) {
    return CHORD_BY_ID[id] || null;
  }

  /** "F♯" -> { letter: "F", alter: 1, pc: 6 } */
  function parseSpelled(name) {
    const letter = name.charAt(0);
    let alter = 0;
    for (const ch of name.slice(1)) {
      if (ch === SHARP) alter++;
      else if (ch === FLAT) alter--;
    }
    return { letter, alter, pc: mod12(LETTER_PC[LETTERS.indexOf(letter)] + alter) };
  }

  /**
   * A chord built on a scale degree, spelled to agree with the key.
   *   rootOffset  semitones from the key's root to the chord's root - stored
   *               this way so the chord moves with the key (a "V" stays a V)
   *
   * byInterval[0..11] is relative to the CHORD root, like a key's:
   *   isChordTone, isRoot, degree (chord function: 1 ♭3 5 ♭7), note, inScale
   */
  function createChord(key, rootOffset, chordId) {
    const chord = getChord(chordId);
    if (!chord) return null;

    const offset = mod12(rootOffset);
    const rootPc = mod12(key.rootPc + offset);
    const rootName = key.byInterval[offset].note;
    const rootSpelled = parseSpelled(rootName);
    const labels = degreeLabels(chord);

    const tones = chord.intervals.map((iv, i) => {
      const pc = mod12(rootPc + iv);
      const inKey = key.byInterval[mod12(pc - key.rootPc)];
      let note = inKey.note;
      // A chord tone the scale lacks is spelled from the chord's own root
      // (E major in C: G♯, not A♭), unless that gives an awkward spelling.
      if (!inKey.inScale) {
        const sp = spellTone(rootSpelled, labels[i], iv);
        const awkward = Math.abs(sp.alter) > 1 || (sp.alter !== 0 && LETTER_PC.indexOf(sp.pc) !== -1);
        if (!awkward) note = formatSpelled(sp);
      }
      // interval: within the octave (for lookups); semitones: as voiced.
      return { interval: mod12(iv), semitones: iv, pc, degree: labels[i], note, inScale: inKey.inScale };
    });

    const byInterval = [];
    for (let iv = 0; iv < 12; iv++) {
      byInterval.push({ interval: iv, isChordTone: false, isRoot: iv === 0, degree: CHROMATIC_DEGREES[iv], note: "" });
    }
    tones.forEach((t) => {
      Object.assign(byInterval[t.interval], { isChordTone: true, degree: t.degree, note: t.note, inScale: t.inScale });
    });

    return {
      chord,
      rootPc,
      rootOffset: offset,
      rootName,
      symbol: rootName + chord.symbol,
      tones,
      byInterval,
      fitsScale: tones.every((t) => t.inScale),
      isChordTone(pc) { return byInterval[mod12(pc - rootPc)].isChordTone; }
    };
  }

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

  /** Degree "♭3" + chord -> "♭III", "ii", "vii°", "V7". */
  function romanNumeral(degreeLabel, chord) {
    const acc = degreeLabel.replace(/\d+/g, "");
    const numeral = ROMAN[(degreeNumber(degreeLabel) - 1) % 7];
    const pcs = chord.intervals.map(mod12);
    const minorish = pcs.indexOf(3) !== -1 && pcs.indexOf(4) === -1;
    return acc + (minorish ? numeral.toLowerCase() : numeral) + chord.roman;
  }

  /**
   * Every chord in the catalogue whose tones all sit inside the key, grouped
   * by the scale degree it is built on. Works for any scale, not just
   * seven-note ones: a pentatonic simply offers fewer chords.
   */
  function diatonicChords(key, family) {
    const pool = family ? CHORDS.filter((c) => c.family === family) : CHORDS;
    return key.tones.map((t) => ({
      degree: t.degree,
      offset: t.interval,
      note: t.note,
      chords: pool
        .filter((c) => c.intervals.every((iv) => key.isScaleTone(t.pc + iv)))
        .map((c) => ({ chord: c, symbol: t.note + c.symbol, roman: romanNumeral(t.degree, c) }))
    }));
  }

  /* ---------------------------------------------------------- progressions */

  const PROGRESSIONS = Catalog.PROGRESSIONS;
  const MODE_NAMES = { "major": "Ionian", "natural-minor": "Aeolian" };
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN_RE = /^([\u266D\u266Fb#]?)(VII|VI|IV|V|III|II|I)(.*)$/i;

  /**
   * "♭VII" -> { offset: 10, number: 7 }; "ii°" -> { offset: 2, number: 2 }.
   * Numerals count from the major scale; case and suffixes are display only.
   */
  function parseRoman(label) {
    const m = ROMAN_RE.exec(String(label).trim());
    if (!m) return null;
    const number = ROMAN.indexOf(m[2].toUpperCase()) + 1;
    const acc = m[1] === "\u266D" || m[1] === "b" ? -1 : m[1] === "\u266F" || m[1] === "#" ? 1 : 0;
    return { offset: mod12(MAJOR_STEPS[number - 1] + acc), number };
  }

  /** The numeral for a semitone offset, cased by the triad the key builds there. */
  const OFFSET_NUMERALS = ["I", "\u266DII", "II", "\u266DIII", "III", "IV", "\u266FIV", "V", "\u266DVI", "VI", "\u266DVII", "VII"];

  function romanForOffset(key, offset) {
    const base = OFFSET_NUMERALS[mod12(offset)];
    const pc = key.rootPc + offset;
    if (!key.isScaleTone(pc)) return base;
    const has = (iv) => key.isScaleTone(pc + iv);
    if (has(3) && has(7)) return base.toLowerCase();
    if (has(3) && has(6) && !has(7)) return base.toLowerCase() + "\u00B0";
    return base;
  }

  /**
   * What each step of a progression plays, against the key.
   *   style "modes": the key's own notes from the step's root - IV in G major
   *                  is C Lydian. A root outside the scale (♭VII in major)
   *                  falls back to moving the scale there.
   *   style "moved": the selected scale moved to each root - A minor
   *                  pentatonic over I-IV-V gives A, D and E minor pentatonic.
   * Returns [{ label, offset, rootPc, key, name, moved }].
   */
  function progressionSteps(key, steps, style) {
    return steps.map((label) => {
      const r = parseRoman(label);
      const offset = r ? r.offset : 0;
      const rootPc = mod12(key.rootPc + offset);
      let scale = key.scale;
      let moved = true;

      if (style !== "moved" && key.isScaleTone(rootPc)) {
        const intervals = key.pitchClasses.map((pc) => mod12(pc - rootPc)).sort((a, b) => a - b);
        const sig = intervals.join();
        scale = PLAIN_SCALES.find((sc) => sc.intervals.join() === sig) ||
          SCALES.find((sc) => sc.intervals.join() === sig) ||
          { id: "rotation", name: key.scale.name + " from " + key.byInterval[offset].degree, aka: [], intervals, degrees: null };
        moved = false;
      }

      const stepKey = createKey(rootPc, scale, key.preference);
      // As a mode of the key, Major and Natural Minor read as Ionian and Aeolian.
      const modeName = !moved && MODE_NAMES[scale.id] ? MODE_NAMES[scale.id] : scale.name;
      return { label, offset, rootPc, key: stepKey, name: stepKey.rootName + " " + modeName, moved };
    });
  }

  /** Label for the root picker: "C", "C♯ / D♭". */
  function rootPickerLabel(pc) {
    const opts = rootSpellings(pc);
    return opts.map(formatSpelled).join(" / ");
  }

  /** MIDI number -> "E4" (sharp names; used for diagnostics and tests). */
  function midiName(midi, useFlats) {
    return simpleName(midi, useFlats) + (Math.floor(midi / 12) - 1);
  }

  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  return {
    SHARP,
    FLAT,
    SHARP_NAMES,
    FLAT_NAMES,
    CHROMATIC_DEGREES,
    SCALES,
    GROUPS,
    CHORDS,
    FAMILIES,
    PROGRESSIONS,
    parseRoman,
    romanForOffset,
    progressionSteps,
    mod12,
    getChord,
    createChord,
    diatonicChords,
    romanNumeral,
    getScale,
    degreeLabels,
    rootSpellings,
    chooseRootSpelling,
    createKey,
    rootPickerLabel,
    simpleName,
    midiName,
    midiToFrequency
  };
});
