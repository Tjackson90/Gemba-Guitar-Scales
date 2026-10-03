# Gemba Scales

The third app in the Gemba Guitar family, alongside Gemba Tuner and Gemba Metronome.
Pick a root and a scale and see it across the whole guitar neck, labelled by interval
or by note name.

Like Gemba Metronome, it is plain HTML/CSS/JS with no build step, ready to wrap with
Capacitor for Android.

## Run it

Open `scales-app/index.html` in a browser, or serve the folder:

```sh
npx serve scales-app
```

```sh
npm test          # music-engine tests (Node, no dependencies needed)
```

Android, once you want a device build:

```sh
npm install
npx cap add android
npm run sync
npm run open:android
```

## Layout

```
scales-app/
  scale-catalog.js  59 scales and modes, and how the picker groups them (data)
  theory.js       music theory: notes, scales, spelling, degrees      (no DOM)
  fretboard.js    tuning + fret maths, inlays, playback sequences     (no DOM)
  audio.js        playback: six voices (Karplus-Strong strings + small synths)
  board-view.js   SVG fretboard renderer
  app.js          state, persistence, toolbar, sheets
  index.html
  style.css
tests/run.js      engine tests
```

## How the music engine works

**Scales are interval sets.** `scale-catalog.js` lists each scale once, as semitones
above the root (`Major: 0 2 4 5 7 9 11`), with alternate names in `aka`. Every key is
generated from that. Adding a scale is one line. A scale whose degree names differ from
the defaults (e.g. Lydian's ♯4) adds a `degrees` string. The tests check that every
degree name lands on its interval and that no two scales share an interval set.
`GROUPS` arranges them for the picker (Essentials, the modes of major, melodic minor and
harmonic minor, Pentatonic, Exotic & World, Bebop, Symmetric). A scale can sit in several
groups under a group-specific label: Major is "Ionian" among the modes.

**A key is derived, never stored.** `createKey(rootPc, scaleId, accidentalPreference)`
returns `byInterval[0..11]`. For every semitone distance from the root it gives
`inScale`, `isRoot`, `degree` (`♭3`) and `note` (`E♭`). The fretboard computes each
position's interval as `(open string + fret − root) mod 12` and looks it up. Nothing
per-fret is saved in state.

**Spelling lives in one place.** Scale tones are spelled by degree: the 3rd is two
letters above the root, and the accidental is whatever makes the pitch right. This
gives B minor B C♯ D E F♯ G A and A blues A C D E♭ E G. Black-key roots pick the
spelling with fewer accidentals (D♭ major, C♯ minor), with ties going to flats except
F♯. Settings can force sharps or flats.

**The fretboard engine** (`createFretboard({ tuning, fretCount })`) stores strings
low → high so `pitchAt(string, fret)` is just `open MIDI + fret`. `displayOrder` flips
them so the high E is drawn on top. Tunings are data in `TUNINGS`, and fret ranges of
12/15/17/22/24 are already selectable.

**The view never rebuilds for musical changes.** `board-view.js` draws the board once
per size and fret range. Root, scale and display-mode changes only update the classes
and text on existing nodes.

## State

`selectedRoot`, `selectedScale`, `displayMode`, `fretRange`, `preferredAccidental`,
`playbackState`, plus `direction`, `speed`, `showChromatic`, `tapSound` and `theme`.
All of it lives in one object in `app.js`, changes through `set()`, and is saved to
`localStorage` under `gemba-scales-*`.

## Design

The launch screen and app icon share Gemba Metronome's navy and gold palette,
with an A minor pentatonic box at frets 5–8 and white root notes. Edit
`scales-app/brand-mark.svg`, then run `npm run assets` to regenerate the browser,
store, Android adaptive/themed launcher, and native splash images. Run
`npm run build:android` to include the updated artwork in an APK.


The app uses the Gemba Tuner / Metronome design language: the same warm neutrals in
dark and light, 1px hairlines, 16px radii, small spaced capitals for labels, serif for
the big readout (the root letter), monospace for numbers, and the system sans for the
rest. The neck gets its own cool cyan treatment, with coral roots and the family's sage
green for scale tones. Cyan replaces the tuner's gold as the selection accent so the
toolbar and board match.
