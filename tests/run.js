/**
 * Music engine tests. Run with: npm test
 */
const path = require("path");
const T = require(path.join(__dirname, "..", "scales-app", "theory.js"));
const F = require(path.join(__dirname, "..", "scales-app", "fretboard.js"));

let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name + (detail !== undefined ? "  -> " + detail : ""));
  }
}

function group(name) {
  console.log("\n" + name);
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ascii(s) {
  return s.replace(/♯/g, "#").replace(/♭/g, "b");
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function key(root, scale, pref) {
  return T.createKey(root, scale, pref);
}

function notes(k) {
  return k.tones.map((t) => ascii(t.note));
}

function degrees(k) {
  return k.tones.map((t) => ascii(t.degree));
}

/* -------------------------------------------------- handoff test cases -- */

group("Handoff TEST 1 - G major pentatonic");
{
  const k = key(PC.G, "major-pentatonic");
  check("notes G A B D E", same(notes(k), ["G", "A", "B", "D", "E"]), notes(k));
  check("degrees 1 2 3 5 6", same(degrees(k), ["1", "2", "3", "5", "6"]), degrees(k));
}

group("Handoff TEST 2 - B natural minor");
{
  const k = key(PC.B, "natural-minor");
  check("notes B C# D E F# G A", same(notes(k), ["B", "C#", "D", "E", "F#", "G", "A"]), notes(k));
  check("degrees 1 2 b3 4 5 b6 b7",
    same(degrees(k), ["1", "2", "b3", "4", "5", "b6", "b7"]), degrees(k));
  check("uses real flat glyphs", k.tones[2].degree === "♭3");
}

group("Handoff TEST 3 - A minor pentatonic");
{
  const k = key(PC.A, "minor-pentatonic");
  check("notes A C D E G", same(notes(k), ["A", "C", "D", "E", "G"]), notes(k));
  check("degrees 1 b3 4 5 b7", same(degrees(k), ["1", "b3", "4", "5", "b7"]), degrees(k));
}

group("Handoff TEST 4 - standard tuning open strings, root G");
{
  const fb = F.createFretboard({ fretCount: 12 });
  const top = fb.displayOrder.map((s) => T.midiName(fb.pitchAt(s, 0)));
  check("top to bottom E4 B3 G3 D3 A2 E2",
    same(top, ["E4", "B3", "G3", "D3", "A2", "E2"]), top);

  const k = key(PC.G, "major");
  const iv = fb.displayOrder.map((s) => ascii(k.byInterval[fb.intervalFromRoot(s, 0, k.rootPc)].degree));
  check("open-string degrees 6 3 1 5 2 6", same(iv, ["6", "3", "1", "5", "2", "6"]), iv);
}

/* ------------------------------------------------------ scale catalogue -- */

group("Scale definitions");
for (const s of T.SCALES) {
  const ok = s.intervals[0] === 0 &&
    s.intervals.every((v, i, a) => i === 0 || v > a[i - 1]) &&
    s.intervals.every((v) => v >= 0 && v < 12);
  check(`${s.name}: starts at 0, ascending, inside one octave`, ok, s.intervals);
}
check("unknown scale id falls back safely", T.getScale("nope") === T.SCALES[0]);

group("Catalogue integrity");
{
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  // A degree name must land on its interval: "#4" = major 4th + 1 = 6.
  function semis(label) {
    const n = parseInt(label.replace(/\D/g, ""), 10);
    const shift = (label.match(/♯/g) || []).length - (label.match(/♭/g) || []).length;
    return T.mod12(MAJOR[(n - 1) % 7] + shift);
  }

  const wrong = [];
  for (const s of T.SCALES) {
    const labels = T.degreeLabels(s);
    if (s.degrees && s.degrees.length !== s.intervals.length) wrong.push(s.id + " (count)");
    labels.forEach((l, i) => { if (semis(l) !== s.intervals[i]) wrong.push(`${s.id} ${l}`); });
  }
  check(`all ${T.SCALES.length} scales: every degree name matches its interval`, wrong.length === 0, wrong);

  const ids = new Set(T.SCALES.map((s) => s.id));
  check("scale ids unique", ids.size === T.SCALES.length);

  // Arpeggios may share a scale's notes on purpose (they say so in aka);
  // scales among themselves may not.
  const sets = new Map();
  const dupes = [];
  for (const s of T.SCALES.filter((x) => !x.isChord)) {
    const k = s.intervals.join(",");
    if (sets.has(k)) dupes.push(`${sets.get(k)} = ${s.id}`);
    sets.set(k, s.id);
  }
  check("no two scales share an interval set", dupes.length === 0, dupes);

  const grouped = new Set();
  let broken = 0;
  T.GROUPS.forEach((g) => g.items.forEach((it) => { if (!it.scale) broken++; else grouped.add(it.scale.id); }));
  check("every group item resolves to a scale", broken === 0);
  check("every scale appears in at least one group", grouped.size === T.SCALES.length,
    T.SCALES.filter((s) => !grouped.has(s.id)).map((s) => s.id));
  check("original V1 ids still exist (saved settings)",
    ["major", "natural-minor", "major-pentatonic", "minor-pentatonic", "blues", "harmonic-minor", "melodic-minor"]
      .every((id) => T.getScale(id).id === id));
  check("modes of major are seven", T.GROUPS.find((g) => g.id === "major-modes").items.length === 7);
  check("Ionian label points at Major",
    T.GROUPS.find((g) => g.id === "major-modes").items[0].label === "Ionian" &&
    T.GROUPS.find((g) => g.id === "major-modes").items[0].scale.id === "major");
}

group("Mode spellings");
{
  check("D Dorian: D E F G A B C", same(notes(key(PC.D, "dorian")), ["D", "E", "F", "G", "A", "B", "C"]));
  check("F Lydian: F G A B C D E", same(notes(key(PC.F, "lydian")), ["F", "G", "A", "B", "C", "D", "E"]));
  check("Lydian degree is #4", degrees(key(PC.F, "lydian"))[3] === "#4");
  check("E Phrygian Dominant: E F G# A B C D",
    same(notes(key(PC.E, "phrygian-dominant")), ["E", "F", "G#", "A", "B", "C", "D"]));
  check("G Altered: G Ab A# B Db Eb F",
    same(notes(key(PC.G, "altered")), ["G", "Ab", "A#", "B", "Db", "Eb", "F"]), notes(key(PC.G, "altered")));
  check("C Whole Tone: C D E F# G# Bb",
    same(notes(key(PC.C, "whole-tone")), ["C", "D", "E", "F#", "G#", "Bb"]), notes(key(PC.C, "whole-tone")));
  check("A Hungarian Minor: A B C D# E F G#",
    same(notes(key(PC.A, "hungarian-minor")), ["A", "B", "C", "D#", "E", "F", "G#"]));
  check("chromatic has 12 tones", key(PC.C, "chromatic").tones.length === 12);
}

group("Every root x scale builds without errors or repeated pitches");
{
  let problems = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const s of T.SCALES) {
      for (const pref of ["auto", "sharp", "flat"]) {
        const k = key(pc, s.id, pref);
        const pcs = new Set(k.tones.map((t) => t.pc));
        const doubled = k.tones.some((t) => /[#♯]{2}|[b♭]{2}/.test(t.note));
        if (pcs.size !== s.intervals.length || doubled || k.byInterval.length !== 12) {
          problems.push(`${pc} ${s.id} ${pref}`);
        }
      }
    }
  }
  check(`${12 * 3 * T.SCALES.length} root x scale x preference combinations clean`, problems.length === 0, problems.slice(0, 5));
}

/* --------------------------------------------------------- enharmonics -- */

group("Enharmonic spelling");
{
  check("F major spells B-flat", notes(key(PC.F, "major"))[3] === "Bb");
  check("D major spells F# and C#", same(notes(key(PC.D, "major")), ["D", "E", "F#", "G", "A", "B", "C#"]));
  check("auto: pc 1 major is Db", notes(key(1, "major"))[0] === "Db");
  check("auto: pc 1 minor is C#", notes(key(1, "natural-minor"))[0] === "C#");
  check("auto: pc 3 minor is Eb (tie goes to flats)", notes(key(3, "natural-minor"))[0] === "Eb");
  check("auto: pc 6 major is F#", notes(key(6, "major"))[0] === "F#");
  check("auto: pc 8 minor is G#", notes(key(8, "natural-minor"))[0] === "G#");
  check("auto: pc 10 major is Bb", notes(key(10, "major"))[0] === "Bb");
  check("forced sharp: pc 10 is A#", notes(key(10, "major", "sharp"))[0] === "A#");
  check("forced flat: pc 1 minor is Db", notes(key(1, "natural-minor", "flat"))[0] === "Db");
  check("F# major has E# (correct letter)", notes(key(6, "major"))[6] === "E#");
  check("A blues has Eb as its b5", same(notes(key(PC.A, "blues")), ["A", "C", "D", "Eb", "E", "G"]),
    notes(key(PC.A, "blues")));
  check("Bb blues b5 reads as E, not Fb",
    same(notes(key(10, "blues")), ["Bb", "Db", "Eb", "E", "F", "Ab"]), notes(key(10, "blues")));
  check("Gb major keeps Cb (seven-note scales keep their letters)",
    notes(key(6, "major", "flat"))[3] === "Cb");
  check("E harmonic minor raised 7 is D#", notes(key(PC.E, "harmonic-minor"))[6] === "D#");
  check("C melodic minor: C D Eb F G A B",
    same(notes(key(PC.C, "melodic-minor")), ["C", "D", "Eb", "F", "G", "A", "B"]));
  {
    const k = key(8, "harmonic-minor"); // G# harmonic minor wants F double-sharp
    check("double accidentals fall back to a plain name", ascii(k.tones[6].note) === "G",
      ascii(k.tones[6].note));
  }
  check("C major chromatic names use flats",
    ascii(key(PC.C, "major").byInterval[1].note) === "Db");
  check("G major pentatonic calls its missing 7th F#, not Gb",
    ascii(key(PC.G, "major-pentatonic").byInterval[11].note) === "F#");
  check("A minor pentatonic calls its b2 Bb (relative of C)",
    ascii(key(PC.A, "minor-pentatonic").byInterval[1].note) === "Bb");
  check("E minor pentatonic calls its 2nd F# (relative of G)",
    ascii(key(PC.E, "minor-pentatonic").byInterval[2].note) === "F#");
  check("E major chromatic names use sharps",
    ascii(key(PC.E, "major").byInterval[1].note) === "F");
  check("E major out-of-scale pc 5 above (A#) is sharp",
    ascii(key(PC.E, "major").byInterval[6].note) === "A#");
}

/* ------------------------------------------------- chromatic background -- */

group("Chromatic background degrees (root G)");
{
  const k = key(PC.G, "major-pentatonic");
  const expected = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
  const got = k.byInterval.map((s) => ascii(s.degree));
  check("1 b2 2 b3 3 4 b5 5 b6 6 b7 7", same(got, expected), got);
  check("byInterval pcs map back to G=0", k.byInterval[0].pc === 7 && k.byInterval[11].pc === 6);
  check("only scale tones flagged inScale",
    same(k.byInterval.filter((s) => s.inScale).map((s) => s.interval), [0, 2, 4, 7, 9]));
  check("root flagged on interval 0 only",
    k.byInterval.filter((s) => s.isRoot).length === 1 && k.byInterval[0].isRoot);
}

/* ------------------------------------------------------------ fret math -- */

group("Fret math");
{
  const fb = F.createFretboard({ fretCount: 12 });
  check("low E fret 3 is G2", T.midiName(fb.pitchAt(0, 3)) === "G2");
  check("A string fret 5 equals open D", fb.pitchAt(1, 5) === fb.pitchAt(2, 0));
  check("G string fret 4 equals open B (major-third gap)", fb.pitchAt(3, 4) === fb.pitchAt(4, 0));
  check("low E fret 12 is one octave up", fb.pitchAt(0, 12) - fb.pitchAt(0, 0) === 12);
  check("high E fret 12 is E5", T.midiName(fb.pitchAt(5, 12)) === "E5");
  check("78 positions for 6 strings x (open + 12)", fb.positions().length === 78);

  const k = key(PC.G, "major-pentatonic");
  check("low E fret 3 is a G-major-pentatonic root", fb.intervalFromRoot(0, 3, k.rootPc) === 0);
  check("low E fret 1 (F) is not in G major pentatonic", !fb.isScaleTone(0, 1, k));
  check("B string fret 3 (D) is in G major pentatonic", fb.isScaleTone(4, 3, k));

  const roots = fb.positions().filter((p) => k.byInterval[fb.intervalFromRoot(p.string, p.fret, k.rootPc)].isRoot);
  // E:3  A:10  D:5  G:0,12  B:8  E:3
  check("G appears 7 times on frets 0-12", roots.length === 7, roots.length);
}

group("Fret ranges");
for (const n of F.FRET_RANGES) {
  const fb = F.createFretboard({ fretCount: n });
  check(`${n} frets -> ${6 * (n + 1)} positions`, fb.positions().length === 6 * (n + 1));
}

group("Inlay markers");
{
  const singles = [];
  const doubles = [];
  for (let f = 0; f <= 24; f++) {
    if (F.markerAt(f) === 1) singles.push(f);
    if (F.markerAt(f) === 2) doubles.push(f);
  }
  check("singles at 3 5 7 9 15 17 19 21", same(singles, [3, 5, 7, 9, 15, 17, 19, 21]), singles);
  check("doubles at 12 and 24", same(doubles, [12, 24]), doubles);
  check("no marker on the open string", F.markerAt(0) === 0);
}

/* ------------------------------------------------------------- playback -- */

group("Playback sequence");
{
  const g = key(PC.G, "major-pentatonic");
  const up = F.playbackSequence(g, "up");
  check("G starts on G2 (low E, fret 3)", T.midiName(up[0]) === "G2");
  check("ascending ends on the octave", up[up.length - 1] - up[0] === 12 && up.length === 6);
  check("descending reverses", same(F.playbackSequence(g, "down"), up.slice().reverse()));
  const both = F.playbackSequence(g, "updown");
  check("up+down does not repeat the top note", both.length === 11 && both[5] === up[5] && both[6] === up[4]);
  check("E starts on the open low E", T.midiName(F.playbackSequence(key(PC.E, "major"), "up")[0]) === "E2");
  check("D# starts on fret 11, not below the guitar",
    F.playbackSequence(key(3, "major"), "up")[0] === 51);
  check("A4 is 440 Hz", T.midiToFrequency(69) === 440);
}

/* -------------------------------------------------------------- chords -- */

group("Chord catalogue");
{
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const semis = (l) => T.mod12(MAJOR[(parseInt(l.replace(/\D/g, ""), 10) - 1) % 7] +
    (l.match(/♯/g) || []).length - (l.match(/♭/g) || []).length);
  const bad = [];
  T.CHORDS.forEach((c) => T.degreeLabels(c).forEach((l, i) => { if (semis(l) !== T.mod12(c.intervals[i])) bad.push(c.id + " " + l); }));
  check(`all ${T.CHORDS.length} chords: degree names match intervals`, bad.length === 0, bad);
  check("extended degrees count past the octave (9 = 14 semitones up)",
    T.CHORDS.every((c) => T.degreeLabels(c).every((l, i) =>
      parseInt(l.replace(/\D/g, ""), 10) <= 7 || c.intervals[i] >= 12)));
  const sets = new Set(T.CHORDS.map((c) => c.intervals.map(T.mod12).sort((a, b) => a - b).join(",")));
  check("no two chords share an interval set", sets.size === T.CHORDS.length);
  const arpScales = T.SCALES.filter((x) => x.isChord);
  check("every chord is also an arpeggio in the browser", arpScales.length === T.CHORDS.length);
  check("arpeggio groups cover every family",
    T.FAMILIES.every((f) => T.GROUPS.some((g) => g.kind === "arpeggio" && g.items.some((it) => it.scale.family === f.id))));
  check("9th arpeggio notes say they match Dominant Pentatonic",
    T.getScale("arp-9").aka.indexOf("Same notes as Dominant Pentatonic") !== -1);
  check("G9 arpeggio: G B D F A, degrees 1 3 5 b7 9 in pitch order",
    same(notes(key(PC.G, "arp-9")), ["G", "A", "B", "D", "F"]) &&
    same(degrees(key(PC.G, "arp-9")), ["1", "9", "3", "5", "b7"]), notes(key(PC.G, "arp-9")));
  check("C13 spells A as its 13th", ascii(key(PC.C, "arp-13").tones.find((t) => t.degree === "13").note) === "A");
  check("E7#9 spells G as its #9 (F double-sharp avoided)",
    ["G", "F##"].indexOf(ascii(key(PC.E, "arp-7#9").tones.find((t) => t.degree === "♯9").note)) === 0,
    key(PC.E, "arp-7#9").tones.map((t) => t.note));
  check("arpeggio playback runs as voiced: Cmaj9 = C E G B D",
    same(F.playbackSequence(key(PC.C, "arp-maj9"), "up").map((m) => T.midiName(m)), ["C3", "E3", "G3", "B3", "D4"]));
  const triads = T.GROUPS.find((g) => g.id === "triads");
  check("Triads group lists every triad", triads.items.length === T.CHORDS.filter((c) => c.family === "triad").length);
  check("C augmented triad as a scale: C E G#", same(notes(key(PC.C, "triad-aug")), ["C", "E", "G#"]));
  check("triad scale degrees 1 b3 b5 for diminished", same(degrees(key(PC.B, "triad-dim")), ["1", "b3", "b5"]));
}

group("Chord-tone overlay");
{
  const g = key(PC.G, "major");
  const am7 = T.createChord(g, 2, "m7");
  check("ii7 in G is Am7", am7.symbol === "Am7");
  check("Am7 tones A C E G", same(am7.tones.map((t) => ascii(t.note)), ["A", "C", "E", "G"]));
  check("Am7 chord degrees 1 b3 5 b7", same(am7.tones.map((t) => ascii(t.degree)), ["1", "b3", "5", "b7"]));
  check("Am7 fits G major", am7.fitsScale);
  check("Am7 marks C (pc 0) as a chord tone", am7.isChordTone(0) && !am7.isChordTone(2));

  const c = key(PC.C, "major");
  const E = T.createChord(c, 4, "maj");
  check("III major in C is E G# B (not Ab)", same(E.tones.map((t) => ascii(t.note)), ["E", "G#", "B"]));
  check("E major does not fit C major; G# flagged out", !E.fitsScale && !E.tones[1].inScale);

  const triads = T.diatonicChords(c, "triad").map((d) => d.chords.find((x) =>
    ["maj", "min", "dim"].indexOf(x.chord.id) !== -1));
  check("C major stacked triads: C Dm Em F G Am B°",
    same(triads.map((t) => ascii(t.symbol)), ["C", "Dm", "Em", "F", "G", "Am", "B°"]),
    triads.map((t) => t.symbol));
  check("their numerals: I ii iii IV V vi vii°",
    same(triads.map((t) => t.roman), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]));

  const sevenths = T.diatonicChords(c, "seventh").map((d) => d.chords.map((x) => ascii(x.symbol)));
  check("Cmaj7 and G7 are diatonic to C; Bm7b5 too",
    sevenths[0].indexOf("Cmaj7") !== -1 && sevenths[4].indexOf("G7") !== -1 && sevenths[6].indexOf("Bm7b5") !== -1);
  check("C augmented is not diatonic to C major",
    T.diatonicChords(c).every((d) => d.chords.every((x) => x.chord.id !== "aug" || d.offset !== 0)));

  const am = key(PC.A, "harmonic-minor");
  const fifth = T.diatonicChords(am, "triad")[4].chords.map((x) => ascii(x.symbol));
  check("A harmonic minor has a major V (E)", fifth.indexOf("E") !== -1, fifth);
  check("chord follows the key: V in D major is A", T.createChord(key(PC.D, "major"), 7, "maj").symbol === "A");
  check("unknown chord id gives null", T.createChord(c, 0, "nope") === null);
}

/* ------------------------------------------------------- position focus -- */

group("Position focus");
{
  const fb = F.createFretboard({ fretCount: 12 });
  check("box clamps at the nut", same(F.clampFocus(-3, 5, 12), { start: 0, end: 4, span: 5 }));
  check("box clamps at the last fret", same(F.clampFocus(11, 5, 12), { start: 8, end: 12, span: 5 }));

  // A minor pentatonic, 5th position (frets 5-8): the classic box 1.
  const am = key(PC.A, "minor-pentatonic");
  const box = F.positionSequence(fb, am.pitchClasses, F.clampFocus(5, 4, 12), "up");
  check("box 1 has 12 notes", box.length === 12, box.length);
  check("starts on low E fret 5 (A2)", box[0].string === 0 && box[0].fret === 5 && T.midiName(box[0].midi) === "A2");
  check("ends on high E fret 8 (C5)", box[11].string === 5 && box[11].fret === 8);
  check("each pitch once, ascending", box.every((n, i) => i === 0 || n.midi > box[i - 1].midi));
  check("down reverses", same(F.positionSequence(fb, am.pitchClasses, F.clampFocus(5, 4, 12), "down"), box.slice().reverse()));

  // Open position: B string open (B3) and G string fret 4 (B3) - lower string wins.
  const g = F.positionSequence(fb, [11], F.clampFocus(0, 5, 12), "up").find((n) => n.midi === 59);
  check("shared pitch goes to the lower string", g.string === 3 && g.fret === 4);
  check("chord arpeggio Am7 from A2", same(F.arpeggio(9, [0, 3, 7, 10], "up").map((m) => T.midiName(m)),
    ["A2", "C3", "E3", "G3", "A3"]));

  // Shapes: A minor pentatonic gives the five boxes, starting on each scale
  // tone up the low E (open E counts as a shape too).
  const starts = F.shapeStarts(fb, key(PC.A, "minor-pentatonic").pitchClasses, 4).map((x) => x.start);
  // Low E: E0 G3 A5 C8 D10 E12; a 4-fret box can start no later than 9.
  check("A minor pentatonic shapes start at 0 3 5 8, then 9 (10 and 12 clamped)",
    same(starts, [0, 3, 5, 8, 9]), starts);
  check("shape starts never exceed the board", starts.every((x) => x + 3 <= 12));
  const am7 = T.createChord(key(PC.G, "major"), 2, "m7");
  const arpStarts = F.shapeStarts(fb, am7.tones.map((t) => t.pc), 5).map((x) => x.pc);
  check("Am7 shapes start only on chord tones", arpStarts.every((pc) => am7.isChordTone(pc)));
  check("Dominant 9 chord voicing spelled: G9 = G B D F A",
    same(T.createChord(key(PC.C, "major"), 7, "9").tones.map((t) => ascii(t.note)), ["G", "B", "D", "F", "A"]));
  check("G9 is diatonic to C major (V9)",
    T.diatonicChords(key(PC.C, "major"))[4].chords.some((x) => x.chord.id === "9" && x.roman === "V9"));
}

/* -------------------------------------------------------- progressions -- */

group("Progressions");
{
  check("catalogue progressions all parse", T.PROGRESSIONS.every((p) => p.steps.every((s) => T.parseRoman(s))));
  check("ids unique", new Set(T.PROGRESSIONS.map((p) => p.id)).size === T.PROGRESSIONS.length);
  check("bVII is 10 semitones", T.parseRoman("\u266DVII").offset === 10 && T.parseRoman("bVII").offset === 10);
  check("ii\u00B0 parses to 2", T.parseRoman("ii\u00B0").offset === 2);
  check("nonsense does not parse", T.parseRoman("X") === null);

  const g = key(PC.G, "major");
  const modes = T.progressionSteps(g, ["I", "IV", "V"], "modes").map((s) => s.name);
  check("I-IV-V in G as modes: G Ionian, C Lydian, D Mixolydian",
    same(modes, ["G Ionian", "C Lydian", "D Mixolydian"]), modes);
  const c4 = T.progressionSteps(g, ["IV"], "modes")[0].key;
  check("C Lydian keeps G major's notes, with F#", same(notes(c4), ["C", "D", "E", "F#", "G", "A", "B"]));
  check("C Lydian labels F# as #4", degrees(c4)[3] === "#4");
  const b7 = T.progressionSteps(g, ["\u266DVII"], "modes")[0];
  check("bVII outside the key falls back to moving the scale (F Major)", b7.moved && b7.name === "F Major");

  const a = key(PC.A, "minor-pentatonic");
  const moved = T.progressionSteps(a, ["I", "IV", "V"], "moved").map((s) => s.name);
  check("A minor pentatonic moved over I-IV-V: A, D, E minor pentatonic",
    same(moved, ["A Minor Pentatonic", "D Minor Pentatonic", "E Minor Pentatonic"]), moved);
  check("numeral case follows the key: G major ii, vii\u00B0, bVII",
    T.romanForOffset(g, 2) === "ii" && T.romanForOffset(g, 11) === "vii\u00B0" && T.romanForOffset(g, 10) === "\u266DVII");

  const fb = F.createFretboard({ fretCount: 15 });
  const steps = T.progressionSteps(g, ["I", "IV", "V"], "modes");

  const stay = F.progressionPlan(fb, steps, { move: "stay", span: 5, direction: "up" });
  check("stay: every step in the same box", stay.every((p) => same(p.focus, stay[0].focus)));
  check("stay: box starts on G at low E fret 3", stay[0].focus.start === 3);
  check("stay: each step runs one octave, root to root",
    stay.every((p, i) => p.notes.length === 8 && p.notes[0].midi % 12 === steps[i].rootPc &&
      p.notes[7].midi - p.notes[0].midi === 12), stay.map((p) => p.notes.length));
  check("stay: every note inside the box",
    stay.every((p) => p.notes.every((n) => n.fret >= p.focus.start && n.fret <= p.focus.end)));

  const up = F.progressionPlan(fb, steps, { move: "up", span: 5, direction: "up" });
  check("ascend: boxes climb G(3) C(8) D(10)", same(up.map((p) => p.focus.start), [3, 8, 10]), up.map((p) => p.focus.start));
  const down = F.progressionPlan(fb, steps, { move: "down", span: 5, direction: "up" });
  check("descend: boxes fall from the top G", down[0].focus.start > down[1].focus.start || down[1].focus.start > down[2].focus.start,
    down.map((p) => p.focus.start));
  const bars = F.progressionPlan(fb, T.progressionSteps(g, ["I", "I", "IV"], "modes"), { move: "up", span: 5, direction: "up" });
  check("ascend: a repeated chord stays put", bars[0].focus.start === bars[1].focus.start);
  // On 12 frets the next G above D (fret 10) would be fret 15, off the neck.
  const wrap = F.progressionPlan(F.createFretboard({ fretCount: 12 }),
    T.progressionSteps(g, ["I", "IV", "V", "I"], "modes"), { move: "up", span: 5 });
  check("ascend wraps to the bottom when the neck runs out", wrap[3].focus.start === 3, wrap.map((p) => p.focus.start));
  const desc = F.progressionPlan(fb, steps, { move: "stay", span: 5, direction: "down" });
  check("direction applies inside each step", desc[0].notes[0].midi > desc[0].notes[7].midi);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
