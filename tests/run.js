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
  check("252 combinations clean", problems.length === 0, problems.slice(0, 5));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
