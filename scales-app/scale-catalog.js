/**
 * The scale catalogue. Pure data: GembaTheory reads it, nothing else.
 *
 *   id         stable key (saved in favourites and settings - never rename)
 *   name       display name
 *   aka        other names, shown small and matched by search
 *   intervals  semitones above the root, ascending, starting at 0
 *   degrees    optional, only where the default names (1 ♭2 2 ♭3 3 4 ♭5 5
 *              ♭6 6 ♭7 7) are wrong for this scale - Lydian's 6 semitones is
 *              a ♯4, not a ♭5. Written in ASCII: b = ♭, # = ♯.
 *
 * Every degree is checked against its interval by the test suite, and no
 * two scales may share an interval set (aliases go in `aka` instead).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GembaScaleCatalog = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCALES = [
    /* ---- essentials ---- */
    { id: "major",            name: "Major",            aka: ["Ionian"],                    intervals: [0, 2, 4, 5, 7, 9, 11] },
    { id: "natural-minor",    name: "Natural Minor",    aka: ["Aeolian"],                   intervals: [0, 2, 3, 5, 7, 8, 10] },
    { id: "major-pentatonic", name: "Major Pentatonic",                                     intervals: [0, 2, 4, 7, 9] },
    { id: "minor-pentatonic", name: "Minor Pentatonic",                                     intervals: [0, 3, 5, 7, 10] },
    { id: "blues",            name: "Blues",            aka: ["Minor Blues"],               intervals: [0, 3, 5, 6, 7, 10] },
    { id: "major-blues",      name: "Major Blues",                                          intervals: [0, 2, 3, 4, 7, 9] },
    { id: "harmonic-minor",   name: "Harmonic Minor",                                       intervals: [0, 2, 3, 5, 7, 8, 11] },
    { id: "melodic-minor",    name: "Melodic Minor",    aka: ["Jazz Minor"],                intervals: [0, 2, 3, 5, 7, 9, 11] },

    /* ---- modes of major ---- */
    { id: "dorian",           name: "Dorian",                                               intervals: [0, 2, 3, 5, 7, 9, 10] },
    { id: "phrygian",         name: "Phrygian",                                             intervals: [0, 1, 3, 5, 7, 8, 10] },
    { id: "lydian",           name: "Lydian",                                               intervals: [0, 2, 4, 6, 7, 9, 11], degrees: "1 2 3 #4 5 6 7" },
    { id: "mixolydian",       name: "Mixolydian",       aka: ["Dominant"],                  intervals: [0, 2, 4, 5, 7, 9, 10] },
    { id: "locrian",          name: "Locrian",                                              intervals: [0, 1, 3, 5, 6, 8, 10] },

    /* ---- modes of melodic minor ---- */
    { id: "dorian-b2",        name: "Dorian ♭2",   aka: ["Phrygian ♮6", "Javanese"], intervals: [0, 1, 3, 5, 7, 9, 10] },
    { id: "lydian-augmented", name: "Lydian Augmented",                                     intervals: [0, 2, 4, 6, 8, 9, 11], degrees: "1 2 3 #4 #5 6 7" },
    { id: "lydian-dominant",  name: "Lydian Dominant",  aka: ["Overtone", "Acoustic", "Lydian ♭7"], intervals: [0, 2, 4, 6, 7, 9, 10], degrees: "1 2 3 #4 5 6 b7" },
    { id: "mixolydian-b6",    name: "Mixolydian ♭6", aka: ["Hindu", "Aeolian Dominant"], intervals: [0, 2, 4, 5, 7, 8, 10] },
    { id: "locrian-nat2",     name: "Locrian ♮2",  aka: ["Half-Diminished", "Aeolian ♭5"], intervals: [0, 2, 3, 5, 6, 8, 10] },
    { id: "altered",          name: "Altered",          aka: ["Super Locrian", "Diminished Whole Tone"], intervals: [0, 1, 3, 4, 6, 8, 10], degrees: "1 b2 #2 3 b5 b6 b7" },

    /* ---- modes of harmonic minor ---- */
    { id: "locrian-nat6",     name: "Locrian ♮6",                                      intervals: [0, 1, 3, 5, 6, 9, 10] },
    { id: "ionian-sharp5",    name: "Ionian ♯5",   aka: ["Augmented Major"],           intervals: [0, 2, 4, 5, 8, 9, 11], degrees: "1 2 3 4 #5 6 7" },
    { id: "dorian-sharp4",    name: "Dorian ♯4",   aka: ["Ukrainian Dorian", "Romanian Minor"], intervals: [0, 2, 3, 6, 7, 9, 10], degrees: "1 2 b3 #4 5 6 b7" },
    { id: "phrygian-dominant", name: "Phrygian Dominant", aka: ["Spanish Gypsy", "Freygish", "Hijaz"], intervals: [0, 1, 4, 5, 7, 8, 10] },
    { id: "lydian-sharp2",    name: "Lydian ♯2",                                       intervals: [0, 3, 4, 6, 7, 9, 11], degrees: "1 #2 3 #4 5 6 7" },
    { id: "ultralocrian",     name: "Ultralocrian",     aka: ["Super Locrian ♭♭7"], intervals: [0, 1, 3, 4, 6, 8, 9], degrees: "1 b2 b3 b4 b5 b6 bb7" },

    /* ---- exotic & world ---- */
    { id: "harmonic-major",   name: "Harmonic Major",                                       intervals: [0, 2, 4, 5, 7, 8, 11] },
    { id: "double-harmonic",  name: "Double Harmonic",  aka: ["Byzantine", "Arabic", "Gypsy Major", "Bhairav"], intervals: [0, 1, 4, 5, 7, 8, 11] },
    { id: "hungarian-minor",  name: "Hungarian Minor",  aka: ["Gypsy Minor", "Algerian"],   intervals: [0, 2, 3, 6, 7, 8, 11], degrees: "1 2 b3 #4 5 b6 7" },
    { id: "hungarian-major",  name: "Hungarian Major",                                      intervals: [0, 3, 4, 6, 7, 9, 10], degrees: "1 #2 3 #4 5 6 b7" },
    { id: "neapolitan-minor", name: "Neapolitan Minor",                                     intervals: [0, 1, 3, 5, 7, 8, 11] },
    { id: "neapolitan-major", name: "Neapolitan Major",                                     intervals: [0, 1, 3, 5, 7, 9, 11] },
    { id: "persian",          name: "Persian",                                              intervals: [0, 1, 4, 5, 6, 8, 11] },
    { id: "enigmatic",        name: "Enigmatic",                                            intervals: [0, 1, 4, 6, 8, 10, 11], degrees: "1 b2 3 #4 #5 #6 7" },
    { id: "major-locrian",    name: "Major Locrian",    aka: ["Arabian"],                   intervals: [0, 2, 4, 5, 6, 8, 10] },
    { id: "spanish-8",        name: "Spanish 8-Tone",   aka: ["Spanish Phrygian"],          intervals: [0, 1, 3, 4, 5, 6, 8, 10], degrees: "1 b2 #2 3 4 b5 b6 b7" },
    { id: "leading-whole-tone", name: "Leading Whole Tone",                                 intervals: [0, 2, 4, 6, 8, 10, 11], degrees: "1 2 3 #4 #5 #6 7" },
    { id: "prometheus",       name: "Prometheus",                                           intervals: [0, 2, 4, 6, 9, 10], degrees: "1 2 3 #4 6 b7" },
    { id: "marwa",            name: "Marwa",            aka: ["Raga Marwa"],                intervals: [0, 1, 4, 6, 7, 9, 11], degrees: "1 b2 3 #4 5 6 7" },
    { id: "purvi",            name: "Purvi",            aka: ["Raga Purvi"],                intervals: [0, 1, 4, 6, 7, 8, 11], degrees: "1 b2 3 #4 5 b6 7" },
    { id: "todi",             name: "Todi",             aka: ["Raga Todi"],                 intervals: [0, 1, 3, 6, 7, 8, 11], degrees: "1 b2 b3 #4 5 b6 7" },

    /* ---- pentatonic & five-note world scales ---- */
    { id: "dominant-pentatonic", name: "Dominant Pentatonic",                               intervals: [0, 2, 4, 7, 10] },
    { id: "minor6-pentatonic", name: "Minor 6 Pentatonic",                                  intervals: [0, 3, 5, 7, 9] },
    { id: "egyptian",         name: "Egyptian",         aka: ["Suspended Pentatonic"],      intervals: [0, 2, 5, 7, 10] },
    { id: "yo",               name: "Yo",               aka: ["Ritsusen"],                  intervals: [0, 2, 5, 7, 9] },
    { id: "hirajoshi",        name: "Hirajoshi",                                            intervals: [0, 2, 3, 7, 8] },
    { id: "kumoi",            name: "Kumoi",                                                intervals: [0, 2, 3, 7, 9] },
    { id: "in-sen",           name: "In Sen",                                               intervals: [0, 1, 5, 7, 10] },
    { id: "iwato",            name: "Iwato",                                                intervals: [0, 1, 5, 6, 10] },
    { id: "pelog",            name: "Pelog",            aka: ["Balinese"],                  intervals: [0, 1, 3, 7, 8] },
    { id: "okinawan",         name: "Okinawan",         aka: ["Ryukyu"],                    intervals: [0, 4, 5, 7, 11] },

    /* ---- bebop ---- */
    { id: "bebop-dominant",   name: "Bebop Dominant",                                       intervals: [0, 2, 4, 5, 7, 9, 10, 11] },
    { id: "bebop-major",      name: "Bebop Major",                                          intervals: [0, 2, 4, 5, 7, 8, 9, 11], degrees: "1 2 3 4 5 #5 6 7" },
    { id: "bebop-dorian",     name: "Bebop Dorian",     aka: ["Bebop Minor"],               intervals: [0, 2, 3, 4, 5, 7, 9, 10] },
    { id: "bebop-melodic-minor", name: "Bebop Melodic Minor",                               intervals: [0, 2, 3, 5, 7, 8, 9, 11], degrees: "1 2 b3 4 5 #5 6 7" },

    /* ---- symmetric ---- */
    { id: "whole-tone",       name: "Whole Tone",                                           intervals: [0, 2, 4, 6, 8, 10], degrees: "1 2 3 #4 #5 b7" },
    { id: "diminished-wh",    name: "Diminished (Whole-Half)",                              intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
    { id: "diminished-hw",    name: "Diminished (Half-Whole)", aka: ["Dominant Diminished"], intervals: [0, 1, 3, 4, 6, 7, 9, 10], degrees: "1 b2 #2 3 #4 5 6 b7" },
    { id: "augmented",        name: "Augmented",        aka: ["Hexatonic"],                 intervals: [0, 3, 4, 7, 8, 11], degrees: "1 #2 3 5 #5 7" },
    { id: "chromatic",        name: "Chromatic",                                            intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  ];

  /**
   * How the picker groups the catalogue. A scale may sit in several groups,
   * under a group-specific label (Major is "Ionian" among the modes).
   */
  const GROUPS = [
    { id: "essentials", name: "Essentials", items: [
      "major", "natural-minor", "major-pentatonic", "minor-pentatonic",
      "blues", "major-blues", "harmonic-minor", "melodic-minor"
    ] },
    { id: "major-modes", name: "Modes of Major", items: [
      ["major", "Ionian"], "dorian", "phrygian", "lydian", "mixolydian",
      ["natural-minor", "Aeolian"], "locrian"
    ] },
    { id: "melodic-modes", name: "Modes of Melodic Minor", items: [
      "melodic-minor", "dorian-b2", "lydian-augmented", "lydian-dominant",
      "mixolydian-b6", "locrian-nat2", "altered"
    ] },
    { id: "harmonic-modes", name: "Modes of Harmonic Minor", items: [
      "harmonic-minor", "locrian-nat6", "ionian-sharp5", "dorian-sharp4",
      "phrygian-dominant", "lydian-sharp2", "ultralocrian"
    ] },
    { id: "pentatonic", name: "Pentatonic", items: [
      "major-pentatonic", "minor-pentatonic", "dominant-pentatonic", "minor6-pentatonic",
      "egyptian", "yo", "hirajoshi", "kumoi", "in-sen", "iwato", "pelog", "okinawan"
    ] },
    { id: "exotic", name: "Exotic & World", items: [
      "harmonic-major", "double-harmonic", "phrygian-dominant", "hungarian-minor",
      "hungarian-major", "neapolitan-minor", "neapolitan-major", "persian",
      "enigmatic", "major-locrian", "spanish-8", "leading-whole-tone", "prometheus",
      "marwa", "purvi", "todi"
    ] },
    { id: "bebop", name: "Bebop", items: [
      "bebop-dominant", "bebop-major", "bebop-dorian", "bebop-melodic-minor"
    ] },
    { id: "symmetric", name: "Symmetric", items: [
      "whole-tone", "diminished-wh", "diminished-hw", "augmented", "chromatic"
    ] }
  ];

  /**
   * Chords, for the chord-tone overlay. Triads also appear in the scale
   * browser (as "Major Triad" etc.) so their shapes can be seen on their own.
   *   symbol  appended to the root: "m7" -> Am7
   *   roman   appended to the Roman numeral: "°" -> vii°
   */
  const CHORDS = [
    /* ---- triads ---- */
    { id: "maj",     family: "triad",   name: "Major",       symbol: "",            roman: "",      intervals: [0, 4, 7] },
    { id: "min",     family: "triad",   name: "Minor",       symbol: "m",           roman: "",      intervals: [0, 3, 7] },
    { id: "dim",     family: "triad",   name: "Diminished",  symbol: "°",      roman: "°", intervals: [0, 3, 6] },
    { id: "aug",     family: "triad",   name: "Augmented",   symbol: "+",           roman: "+",     intervals: [0, 4, 8], degrees: "1 3 #5" },
    { id: "sus2",    family: "triad",   name: "Sus2",        symbol: "sus2",        roman: "sus2",  intervals: [0, 2, 7] },
    { id: "sus4",    family: "triad",   name: "Sus4",        symbol: "sus4",        roman: "sus4",  intervals: [0, 5, 7] },
    { id: "susb2",   family: "triad",   name: "Sus♭2",  aka: ["Phrygian Sus"], symbol: "sus♭2", roman: "sus♭2", intervals: [0, 1, 7] },
    { id: "sus#4",   family: "triad",   name: "Sus♯4",  aka: ["Lydian Sus"],   symbol: "sus♯4", roman: "sus♯4", intervals: [0, 6, 7], degrees: "1 #4 5" },
    { id: "majb5",   family: "triad",   name: "Major ♭5", symbol: "(♭5)", roman: "(♭5)", intervals: [0, 4, 6] },
    { id: "min#5",   family: "triad",   name: "Minor ♯5", symbol: "m(♯5)", roman: "(♯5)", intervals: [0, 3, 8], degrees: "1 b3 #5" },
    { id: "quartal", family: "triad",   name: "Quartal",     aka: ["Stacked Fourths"], symbol: " quartal", roman: " quartal",  intervals: [0, 5, 10] },

    /* ---- sixths and sevenths ---- */
    { id: "maj7",    family: "seventh", name: "Major 7",     symbol: "maj7",        roman: "maj7",  intervals: [0, 4, 7, 11] },
    { id: "7",       family: "seventh", name: "Dominant 7",  symbol: "7",           roman: "7",     intervals: [0, 4, 7, 10] },
    { id: "m7",      family: "seventh", name: "Minor 7",     symbol: "m7",          roman: "7",     intervals: [0, 3, 7, 10] },
    { id: "m7b5",    family: "seventh", name: "Half-Diminished", aka: ["Minor 7♭5"], symbol: "m7♭5", roman: "ø7", intervals: [0, 3, 6, 10] },
    { id: "dim7",    family: "seventh", name: "Diminished 7", symbol: "°7",    roman: "°7", intervals: [0, 3, 6, 9], degrees: "1 b3 b5 bb7" },
    { id: "mmaj7",   family: "seventh", name: "Minor Major 7", symbol: "m(maj7)",   roman: "(maj7)", intervals: [0, 3, 7, 11] },
    { id: "maj7#5",  family: "seventh", name: "Augmented Major 7", symbol: "maj7♯5", roman: "+maj7", intervals: [0, 4, 8, 11], degrees: "1 3 #5 7" },
    { id: "7#5",     family: "seventh", name: "Augmented 7", symbol: "7♯5",    roman: "+7",    intervals: [0, 4, 8, 10], degrees: "1 3 #5 b7" },
    { id: "7b5",     family: "seventh", name: "Dominant 7♭5", symbol: "7♭5", roman: "7♭5", intervals: [0, 4, 6, 10] },
    { id: "7sus4",   family: "seventh", name: "7sus4",       symbol: "7sus4",       roman: "7sus4", intervals: [0, 5, 7, 10] },
    { id: "6",       family: "seventh", name: "Major 6",     symbol: "6",           roman: "6",     intervals: [0, 4, 7, 9] },
    { id: "m6",      family: "seventh", name: "Minor 6",     symbol: "m6",          roman: "6",     intervals: [0, 3, 7, 9] },
    { id: "7sus2",   family: "seventh", name: "7sus2",       symbol: "7sus2",       roman: "7sus2", intervals: [0, 2, 7, 10] },
    { id: "m7#5",    family: "seventh", name: "Minor 7♯5", symbol: "m7♯5", roman: "7♯5", intervals: [0, 3, 8, 10], degrees: "1 b3 #5 b7" },
    { id: "maj7b5",  family: "seventh", name: "Major 7♭5", symbol: "maj7♭5", roman: "maj7♭5", intervals: [0, 4, 6, 11] },
    { id: "dimmaj7", family: "seventh", name: "Diminished Major 7", symbol: "°(maj7)", roman: "°(maj7)", intervals: [0, 3, 6, 11] },

    /*
     * Extended and altered chords are written as stacked voicings - the 9th
     * is 14 semitones up, not 2 - so arpeggios run 1 3 5 7 9 as played.
     * Their degrees are always spelled out.
     */

    /* ---- ninths and added tones ---- */
    { id: "add9",    family: "ninth", name: "Add 9",         symbol: "add9",        roman: "add9",  intervals: [0, 4, 7, 14],         degrees: "1 3 5 9" },
    { id: "madd9",   family: "ninth", name: "Minor Add 9",   symbol: "m(add9)",     roman: "(add9)", intervals: [0, 3, 7, 14],        degrees: "1 b3 5 9" },
    { id: "6/9",     family: "ninth", name: "6/9",           symbol: "6/9",         roman: "6/9",   intervals: [0, 4, 7, 9, 14],      degrees: "1 3 5 6 9" },
    { id: "m6/9",    family: "ninth", name: "Minor 6/9",     symbol: "m6/9",        roman: "6/9",   intervals: [0, 3, 7, 9, 14],      degrees: "1 b3 5 6 9" },
    { id: "maj9",    family: "ninth", name: "Major 9",       symbol: "maj9",        roman: "maj9",  intervals: [0, 4, 7, 11, 14],     degrees: "1 3 5 7 9" },
    { id: "9",       family: "ninth", name: "Dominant 9",    symbol: "9",           roman: "9",     intervals: [0, 4, 7, 10, 14],     degrees: "1 3 5 b7 9" },
    { id: "m9",      family: "ninth", name: "Minor 9",       symbol: "m9",          roman: "9",     intervals: [0, 3, 7, 10, 14],     degrees: "1 b3 5 b7 9" },
    { id: "mmaj9",   family: "ninth", name: "Minor Major 9", symbol: "m(maj9)",     roman: "(maj9)", intervals: [0, 3, 7, 11, 14],    degrees: "1 b3 5 7 9" },
    { id: "9sus4",   family: "ninth", name: "9sus4",         symbol: "9sus4",       roman: "9sus4", intervals: [0, 5, 7, 10, 14],     degrees: "1 4 5 b7 9" },
    { id: "m9b5",    family: "ninth", name: "Half-Diminished 9", aka: ["Minor 9♭5"], symbol: "m9♭5", roman: "ø9", intervals: [0, 3, 6, 10, 14], degrees: "1 b3 b5 b7 9" },

    /* ---- elevenths ---- */
    { id: "add11",   family: "eleventh", name: "Add 11",     symbol: "add11",       roman: "add11", intervals: [0, 4, 7, 17],         degrees: "1 3 5 11" },
    { id: "11",      family: "eleventh", name: "Dominant 11", symbol: "11",         roman: "11",    intervals: [0, 4, 7, 10, 14, 17], degrees: "1 3 5 b7 9 11" },
    { id: "m11",     family: "eleventh", name: "Minor 11",   symbol: "m11",         roman: "11",    intervals: [0, 3, 7, 10, 14, 17], degrees: "1 b3 5 b7 9 11" },
    { id: "maj7#11", family: "eleventh", name: "Major 7♯11", aka: ["Lydian Chord"], symbol: "maj7♯11", roman: "maj7♯11", intervals: [0, 4, 7, 11, 18], degrees: "1 3 5 7 #11" },
    { id: "maj9#11", family: "eleventh", name: "Major 9♯11", symbol: "maj9♯11", roman: "maj9♯11", intervals: [0, 4, 7, 11, 14, 18], degrees: "1 3 5 7 9 #11" },
    { id: "7#11",    family: "eleventh", name: "Dominant 7♯11", aka: ["Lydian Dominant Chord"], symbol: "7♯11", roman: "7♯11", intervals: [0, 4, 7, 10, 18], degrees: "1 3 5 b7 #11" },

    /* ---- thirteenths ---- */
    { id: "13",      family: "thirteenth", name: "Dominant 13", symbol: "13",       roman: "13",    intervals: [0, 4, 7, 10, 14, 21], degrees: "1 3 5 b7 9 13" },
    { id: "maj13",   family: "thirteenth", name: "Major 13", symbol: "maj13",       roman: "maj13", intervals: [0, 4, 7, 11, 14, 21], degrees: "1 3 5 7 9 13" },
    { id: "m13",     family: "thirteenth", name: "Minor 13", symbol: "m13",         roman: "13",    intervals: [0, 3, 7, 10, 14, 21], degrees: "1 b3 5 b7 9 13" },
    { id: "13b9",    family: "thirteenth", name: "13♭9", symbol: "13♭9",  roman: "13♭9", intervals: [0, 4, 7, 10, 13, 21], degrees: "1 3 5 b7 b9 13" },
    { id: "7b13",    family: "thirteenth", name: "7♭13", symbol: "7♭13",  roman: "7♭13", intervals: [0, 4, 7, 10, 20],   degrees: "1 3 5 b7 b13" },

    /* ---- altered dominants ---- */
    { id: "7b9",     family: "altered", name: "7♭9",     symbol: "7♭9",    roman: "7♭9", intervals: [0, 4, 7, 10, 13],   degrees: "1 3 5 b7 b9" },
    { id: "7#9",     family: "altered", name: "7♯9",     aka: ["Hendrix Chord"], symbol: "7♯9", roman: "7♯9", intervals: [0, 4, 7, 10, 15], degrees: "1 3 5 b7 #9" },
    { id: "7#5#9",   family: "altered", name: "7♯5♯9", symbol: "7♯5♯9", roman: "7♯5♯9", intervals: [0, 4, 8, 10, 15], degrees: "1 3 #5 b7 #9" },
    { id: "7#5b9",   family: "altered", name: "7♯5♭9", symbol: "7♯5♭9", roman: "7♯5♭9", intervals: [0, 4, 8, 10, 13], degrees: "1 3 #5 b7 b9" },
    { id: "7b5b9",   family: "altered", name: "7♭5♭9", symbol: "7♭5♭9", roman: "7♭5♭9", intervals: [0, 4, 6, 10, 13], degrees: "1 3 b5 b7 b9" },
    { id: "7b5#9",   family: "altered", name: "7♭5♯9", symbol: "7♭5♯9", roman: "7♭5♯9", intervals: [0, 4, 6, 10, 15], degrees: "1 3 b5 b7 #9" }
  ];

  /* Chord families, in display order. "arpeggio" names the scale-browser group. */
  const CHORD_FAMILIES = [
    { id: "triad",      name: "Triads",           arpeggio: "Triads" },
    { id: "seventh",    name: "Sixths & sevenths", arpeggio: "7th & 6th Arpeggios" },
    { id: "ninth",      name: "Ninths",           arpeggio: "9th Arpeggios" },
    { id: "eleventh",   name: "Elevenths",        arpeggio: "11th Arpeggios" },
    { id: "thirteenth", name: "Thirteenths",      arpeggio: "13th Arpeggios" },
    { id: "altered",    name: "Altered dominants", arpeggio: "Altered Arpeggios" }
  ];

  /**
   * Progressions as Roman numerals, read against the current key. Numerals
   * count from the major scale (♭VII is 10 semitones up) so one list serves
   * every key; their case is how they are usually written, for display.
   */
  const PROGRESSIONS = [
    /* ---- major-key ---- */
    { id: "1-4-5",      mood: "major", name: "I–IV–V",           aka: ["Blues", "Rock", "Folk"], steps: ["I", "IV", "V"] },
    { id: "1-5-6-4",    mood: "major", name: "Pop Axis",                    aka: ["I–V–vi–IV"], steps: ["I", "V", "vi", "IV"] },
    { id: "2-5-1",      mood: "major", name: "Jazz ii–V–I",       steps: ["ii", "V", "I"] },
    { id: "1-6-4-5",    mood: "major", name: "’50s Doo-Wop",           aka: ["I–vi–IV–V"], steps: ["I", "vi", "IV", "V"] },
    { id: "6-4-1-5",    mood: "major", name: "Pop, Minor Start",            aka: ["vi–IV–I–V"], steps: ["vi", "IV", "I", "V"] },
    { id: "1-4-6-5",    mood: "major", name: "I–IV–vi–V",    steps: ["I", "IV", "vi", "V"] },
    { id: "1-5-4",      mood: "major", name: "Rock I–V–IV",       steps: ["I", "V", "IV"] },
    { id: "1-b7-4",     mood: "major", name: "Mixolydian Rock",             aka: ["I–♭VII–IV"], steps: ["I", "♭VII", "IV"] },
    { id: "1-4",        mood: "major", name: "I–IV Vamp",              steps: ["I", "IV"] },
    { id: "1-6-2-5",    mood: "major", name: "Rhythm Changes Turnaround",   aka: ["I–vi–ii–V"], steps: ["I", "vi", "ii", "V"] },
    { id: "3-6-2-5-1",  mood: "major", name: "Jazz Turnaround",             aka: ["iii–vi–ii–V–I"], steps: ["iii", "vi", "ii", "V", "I"] },
    { id: "canon",      mood: "major", name: "Pachelbel’s Canon",      steps: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"] },
    { id: "12-bar",     mood: "major", name: "12-Bar Blues",                steps: ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"] },
    { id: "12-bar-qc",  mood: "major", name: "12-Bar Blues, Quick Change",  steps: ["I", "IV", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"] },

    /* ---- minor-key ---- */
    { id: "m-1-4-5",    mood: "minor", name: "Minor i–iv–v",      steps: ["i", "iv", "v"] },
    { id: "m-epic",     mood: "minor", name: "Epic Minor",                  aka: ["i–♭VI–♭III–♭VII"], steps: ["i", "♭VI", "♭III", "♭VII"] },
    { id: "andalusian", mood: "minor", name: "Andalusian Cadence",          aka: ["i–♭VII–♭VI–V", "Flamenco"], steps: ["i", "♭VII", "♭VI", "V"] },
    { id: "m-2-5-1",    mood: "minor", name: "Minor ii°–V–i", steps: ["ii°", "V", "i"] },
    { id: "m-aeolian",  mood: "minor", name: "Aeolian Rock",                aka: ["i–♭VII–♭VI–♭VII"], steps: ["i", "♭VII", "♭VI", "♭VII"] },
    { id: "m-1-6-7",    mood: "minor", name: "i–♭VI–♭VII", steps: ["i", "♭VI", "♭VII"] },
    { id: "m-dorian",   mood: "minor", name: "Dorian Vamp",                 aka: ["i–IV"], steps: ["i", "IV"] }
  ];

  return { SCALES, GROUPS, CHORDS, CHORD_FAMILIES, PROGRESSIONS };
});
