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

  return { SCALES, GROUPS };
});
