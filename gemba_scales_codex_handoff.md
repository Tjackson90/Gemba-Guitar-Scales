# CODEX HANDOFF — GEMBA SCALES

## PROJECT OVERVIEW

Build a new guitar scale reference/learning app called:

Gemba Scales

This app is part of the Gemba Guitar ecosystem.

Existing completed apps:
- Gemba Metronome
- Gemba Tuner

The goal is for Gemba Scales to become the third focused utility in that ecosystem.

This should NOT become an oversized music-theory platform in V1.

The primary purpose is:

1. Select a root note.
2. Select a scale.
3. Immediately visualize that scale across the guitar fretboard.
4. Clearly identify root notes, scale tones, and intervals.
5. Allow the player to switch between interval-based and note-name-based views.
6. Eventually allow scale playback/practice functionality.

The attached screenshot is the PRIMARY LAYOUT REFERENCE.

Use it as a structural/UI reference, not as something that must be copied pixel-for-pixel.

The fretboard should dominate the screen.

---

# FIRST TASK: INSPECT THE EXISTING PROJECT

Before changing anything:

1. Inspect the current repository/project structure.
2. Identify the framework, language, architecture, navigation system, styling system, and audio implementation already being used.
3. Reuse existing patterns wherever reasonable.
4. Do not replace working architecture simply because another approach would also work.
5. Look for reusable Gemba Guitar components/styles from the metronome or tuner if they exist in this repository.
6. Keep the code modular enough that additional scales, tunings, and practice features can be added later.

Do not begin by rewriting the app architecture.

---

# PRIMARY UI CONCEPT

The main screen should closely follow the attached screenshot.

The layout is:

TOP CONTROL BAR
-------------------------
Menu | Root Note | Scale Selector | Display Controls | Position Controls | Other Options

FRET NUMBER ROW
-------------------------
1 | 2 | 3 | 4 | 5 | 6 | etc.

MAIN GUITAR FRETBOARD
-------------------------
Six strings
Scale notes
Root notes
Interval information
Fret lines
Position markers

The fretboard should take up most of the available screen.

Avoid filling the screen with cards, text explanations, large headers, or dashboard elements.

This is a fretboard-first application.

---

# PRIMARY SCREEN ORIENTATION

The interface should be optimized primarily for LANDSCAPE orientation because a guitar fretboard benefits from horizontal space.

It should still fail gracefully on smaller or portrait displays.

Do not squash the fretboard until it becomes unusable.

If necessary:
- allow horizontal scrolling
- resize controls intelligently
- collapse secondary controls

Landscape should be the best experience.

---

# TOP BAR

Create a compact top control bar inspired by the reference image.

## Menu

Leftmost hamburger/menu button.

Reserved for settings and future features.

Do not overbuild the menu during the initial implementation.

---

## Root Selector

Prominent root-note selector.

Example:

[G]

Tapping it should allow selection of:

C
C#/Db
D
D#/Eb
E
F
F#/Gb
G
G#/Ab
A
A#/Bb
B

Enharmonic handling should be considered in the underlying scale engine.

---

# SCALE SELECTOR

Place a larger selector directly beside the root selector.

Example:

[G] [Major Pentatonic ▼]

Initial supported scales:

Major
Natural Minor
Major Pentatonic
Minor Pentatonic
Blues
Harmonic Minor
Melodic Minor

Architecture should make adding additional scales extremely easy.

Do NOT create separate fretboard data manually for every scale/key combination.

Scales must be generated mathematically from interval definitions.

Suggested interval data:

Major
0, 2, 4, 5, 7, 9, 11

Natural Minor
0, 2, 3, 5, 7, 8, 10

Major Pentatonic
0, 2, 4, 7, 9

Minor Pentatonic
0, 3, 5, 7, 10

Blues
0, 3, 5, 6, 7, 10

Harmonic Minor
0, 2, 3, 5, 7, 8, 11

Melodic Minor
0, 2, 3, 5, 7, 9, 11

Use a reusable ScaleDefinition/data structure.

---

# FRETBOARD

This is the most important component in the app.

Build it as a reusable component rather than placing notes manually.

Initial tuning:

Standard guitar tuning.

From TOP of display to BOTTOM:

High E
B
G
D
A
Low E

This ordering intentionally matches the attached reference image.

Internally represent the open strings correctly so fret calculations remain straightforward.

---

# FRET RANGE

Initially support approximately:

Open string through fret 12

Ideally architect this so the range can later extend to:

15
17
19
22
24

Do not hardcode the fretboard in a way that makes expansion difficult.

The fretboard can horizontally scroll if screen width requires it.

---

# FRET NUMBERS

Display fret numbers directly above the fretboard.

Example:

1 2 3 4 5 6 7 8 9 10 11 12

The open-string area should visually occur before fret 1.

---

# FRET POSITION MARKERS

Include traditional guitar fret markers.

Single markers:

3
5
7
9

Double marker:

12

Architecture should support repeating the pattern beyond fret 12 later.

Markers should appear subtly below or within the fretboard like the reference image.

---

# STRINGS

Render six horizontal guitar strings.

Strings should be clearly visible without overpowering the notes.

Optional visual improvement:

String thickness may gradually increase toward the low E string.

Do not make this necessary for the first functional build if it complicates implementation.

---

# FRETS

Render vertical fret separators.

They should be clearly visible but visually secondary to scale notes.

The fretboard should have a cool blue/cyan visual treatment similar to the reference image while still fitting the Gemba Guitar aesthetic.

---

# SCALE NOTE DISPLAY

Every location on the fretboard must be calculated from:

open string note + fret number

Determine the pitch class.

Then determine its interval relative to the selected root.

Example:

Root = G

G = 0 semitones
G#/Ab = 1
A = 2
A#/Bb = 3
B = 4
C = 5
C#/Db = 6
D = 7
D#/Eb = 8
E = 9
F = 10
F#/Gb = 11

Compare that interval against the selected scale's interval set.

If it belongs to the scale:

render a note marker.

If it does not belong:

do not render a scale-note marker.

---

# ROOT NOTE DISPLAY

The root note must be immediately identifiable.

Use a different visual style/color for root notes.

Reference style:

ROOT:
coral / red / salmon circle

OTHER SCALE NOTES:
green circle

The exact colors can be adjusted to match Gemba Guitar branding, but the hierarchy must remain obvious.

A player should be able to glance at the fretboard and instantly identify every root position.

---

# INTERVAL LABELS

This is an important part of the reference design.

When interval mode is enabled, display scale degrees inside the scale-note circles.

Examples:

1
2
♭3
3
4
♭5
5
♭6
6
♭7
7

Use proper musical symbols where practical:

♭3
♭5
♭7

rather than plain text like:

b3
b5
b7

if font support is reliable.

---

# CHROMATIC INTERVAL BACKGROUND

The attached reference does something useful that should be preserved.

Behind the actual selected scale notes, faintly show the chromatic interval at every fret position relative to the current root.

Example for root G:

G = 1
G#/Ab = ♭2
A = 2
A#/Bb = ♭3
B = 3
C = 4
C#/Db = ♭5
D = 5
D#/Eb = ♭6
E = 6
F = ♭7
F#/Gb = 7

These background labels should be subtle.

They provide fretboard context without competing with active scale notes.

Active scale-note circles should visually sit above these labels.

---

# DISPLAY MODES

Create a display toggle.

At minimum support:

INTERVALS
NOTES

Potential future mode:

BOTH

For V1, Intervals and Notes are enough if implementing Both adds unnecessary complexity.

## Interval Mode

Scale note circle displays:

1
2
♭3
4
5
etc.

## Note Mode

Scale note circle displays:

G
A
B
D
E
etc.

Changing display mode should NOT recalculate or rebuild the musical state.

It should only change how existing note information is rendered.

---

# ENHARMONIC SPELLING

Avoid ugly theoretical results such as unnecessarily mixing sharps and flats.

Create centralized note-name handling.

At minimum maintain:

SHARP NAMES:
C C# D D# E F F# G G# A A# B

FLAT NAMES:
C Db D Eb E F Gb G Ab A Bb B

Root selection should influence preferred spelling where appropriate.

Do not scatter enharmonic logic throughout UI code.

Keep it in the music-theory layer.

Perfect academic enharmonic spelling is not necessary for the first build, but the architecture should not make future improvements difficult.

---

# POSITION NAVIGATION

The reference layout contains left/right navigation.

Add UI placeholders or basic functionality for moving through fretboard positions.

For the first implementation, the priority is:

FULL FRETBOARD

Position-specific scale shapes can come later.

If left/right arrows are included before position mode exists, they should either:

- scroll/navigate fret ranges

OR

- remain disabled with a clear internal TODO

Do not create fake controls that appear functional but do nothing.

---

# AUDIO / SCALE PLAYBACK

After the core fretboard is functioning correctly, add basic scale playback if the existing project architecture makes audio straightforward.

Desired controls eventually:

Play Ascending
Play Descending
Play Ascending + Descending

Playback should play the selected scale from the root.

Do not allow audio implementation to delay the core fretboard functionality.

If reusable audio code exists from Gemba Tuner or Gemba Metronome, inspect whether it can safely be reused.

Do not duplicate an entire audio subsystem unnecessarily.

---

# MUSICAL DATA MODEL

Keep music theory separate from UI rendering.

Suggested conceptual structure:

Note / PitchClass
ScaleDefinition
ScaleEngine
FretboardEngine
DisplayMode

Example:

ScaleDefinition
- id
- name
- intervals

ScaleEngine
- rootPitchClass
- selectedScale
- getScalePitchClasses()
- getIntervalName()
- getDisplayNoteName()

FretboardEngine
- tuning
- fretCount
- getPitchAt(string, fret)
- getIntervalFromRoot(string, fret)
- isScaleTone(string, fret)

This is conceptual guidance.

Adapt naming and structure to the existing framework rather than forcing unnecessary architecture.

---

# STATE

The following should be centralized application state:

selectedRoot
selectedScale
displayMode
fretRange
preferredAccidental
playbackState

Changing root or scale should immediately update the fretboard.

Avoid storing duplicate derived state.

Example:

Do not independently store every highlighted fret if they can be derived from:

root + scale + tuning.

---

# VISUAL DIRECTION

The reference screenshot should guide the layout.

General visual direction:

Background:
clean/light

Fretboard:
cyan / blue

Frets:
slightly darker cyan

Strings:
light neutral

Scale notes:
green

Root:
coral / salmon

Text:
high contrast

Selected toolbar controls:
soft cyan highlight

Controls:
rounded
simple
touch-friendly
minimal

Avoid:
- gradients everywhere
- excessive shadows
- glassmorphism
- gaming-style UI
- overly decorative music graphics
- giant cards
- unnecessary animations

The app should feel like a polished musical tool.

---

# TOUCH TARGETS

This is a phone/tablet app.

Interactive controls should have comfortable touch areas even if their visible icon is smaller.

Aim for roughly 44–48dp minimum interactive areas.

---

# PERFORMANCE

The fretboard should update immediately when changing:

root
scale
display mode

Do not recreate expensive components unnecessarily.

There are only a few hundred possible visible fret/string positions, so implementation should remain lightweight.

---

# V1 FEATURE SCOPE

V1 MUST INCLUDE:

- root selection
- scale selection
- mathematically generated scales
- standard tuning fretboard
- open strings
- frets 1–12 minimum
- fret numbers
- guitar position markers
- root highlighting
- scale-tone highlighting
- interval display
- note-name display
- chromatic interval background
- responsive/mobile-safe layout
- landscape optimization

V1 SHOULD INCLUDE IF STRAIGHTFORWARD:

- basic scale playback
- left/right fret navigation
- accidental preference

---

# EXPLICITLY OUT OF SCOPE FOR INITIAL BUILD

Do NOT implement these yet:

- user accounts
- cloud sync
- achievements
- backing tracks
- AI improvisation tools
- chord progression trainer
- song analysis
- microphone note detection
- CAGED lessons
- 3NPS lessons
- chord library
- chord identifier
- alternate tunings
- custom tunings
- gamification
- social features
- complex animation
- paid subscription systems

Do not allow feature creep.

The priority is making the core scale/fretboard experience excellent.

---

# FUTURE ARCHITECTURE CONSIDERATIONS

Do not build these features now, but avoid architectural decisions that would make them unnecessarily difficult later:

Alternate tunings
CAGED positions
3-note-per-string positions
Pentatonic boxes
Modes
Diatonic chords
Triad overlays
Chord-tone highlighting
Practice mode
Metronome integration
Scale sequencing
Interval training
Backing tracks

Again:

DO NOT IMPLEMENT THESE NOW.

Just keep the underlying musical engine reusable.

---

# DEVELOPMENT ORDER

Work in this order:

PHASE 1
Inspect existing project and architecture.

PHASE 2
Build music-theory engine and tests.

PHASE 3
Build fretboard engine and verify fret calculations.

PHASE 4
Render static fretboard.

PHASE 5
Connect root selector.

PHASE 6
Connect scale selector.

PHASE 7
Add root and scale-tone highlighting.

PHASE 8
Add chromatic interval background.

PHASE 9
Add Notes / Intervals display switching.

PHASE 10
Responsive/landscape polish.

PHASE 11
Basic playback only if core app is stable.

Do not attempt every feature simultaneously.

---

# THEORY ENGINE TEST CASES

Before considering the engine correct, verify examples manually.

TEST 1

Root:
G

Scale:
Major Pentatonic

Expected notes:

G
A
B
D
E

Expected degrees:

1
2
3
5
6

---

TEST 2

Root:
B

Scale:
Natural Minor

Expected notes:

B
C#
D
E
F#
G
A

Expected degrees:

1
2
♭3
4
5
♭6
♭7

---

TEST 3

Root:
A

Scale:
Minor Pentatonic

Expected notes:

A
C
D
E
G

Expected degrees:

1
♭3
4
5
♭7

---

TEST 4

Standard guitar tuning open strings from display top to bottom:

E4
B3
G3
D3
A2
E2

For root G, their intervals should render as:

E = 6
B = 3
G = 1
D = 5
A = 2
E = 6

This should visually match the open-string column behavior in the attached reference screenshot.

---

# QUALITY REQUIREMENTS

Do not mark the task complete merely because the app compiles.

Verify:

- scale math
- fret note math
- open string notes
- root highlighting
- scale-tone membership
- interval labels
- fret numbering
- display mode switching
- touch controls
- landscape layout
- no obvious clipping
- no accidental horizontal overflow outside the intended fretboard area
- no dead buttons
- no console/runtime errors

Run available tests and add focused tests for the music engine.

---

# IMPORTANT DESIGN PRINCIPLE

This app should help guitarists SEE the relationship between:

ROOT
→ INTERVAL
→ SCALE
→ FRETBOARD

The fretboard is not decoration.

It is the application.

Every major design decision should support that.

---

# FINAL DELIVERABLE

Once the initial implementation is complete:

1. Summarize what was changed.
2. List files created or modified.
3. Explain the music-theory architecture.
4. Explain any assumptions made.
5. List anything intentionally deferred.
6. Report tests/build checks performed.
7. Identify any remaining bugs or visual inconsistencies honestly.

Do not silently expand project scope.

If a decision is unclear but does not block development, choose the simplest implementation consistent with this handoff and document the assumption.
