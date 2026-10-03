/**
 * Scale playback. Same shape as Gemba Metronome's AudioEngine - one lazily
 * created context, a master gain, tracked sources so stop() is instant.
 *
 * Voices come in two kinds:
 *   string  - Karplus-Strong plucked string, rendered once per pitch and cached
 *   synth   - a few oscillators with their own envelopes (keys, marimba, pure)
 *
 * Every note, whatever the voice, passes through a release envelope set by
 * the Ring setting, so nothing hangs on longer than the player wants.
 */
window.ScaleAudio = (function () {
  /* Shown in Settings in this order. */
  const VOICES = {
    acoustic: { name: "Acoustic", kind: "string", smooth: 0.45, pick: 0.13, cutoff: 3600, t60: 2.2, gain: 1 },
    nylon:    { name: "Nylon",    kind: "string", smooth: 0.8,  pick: 0.22, cutoff: 1700, t60: 1.8, gain: 1.15 },
    electric: { name: "Electric", kind: "string", smooth: 0.2,  pick: 0.07, cutoff: 5200, t60: 3.0, gain: 0.85 },
    keys:     { name: "Keys",     kind: "keys",    gain: 0.9 },
    marimba:  { name: "Marimba",  kind: "marimba", gain: 1 },
    pure:     { name: "Pure",     kind: "pure",    gain: 0.75 }
  };

  /* Ring length in seconds: how long a note is heard before it fades out. */
  const RINGS = { short: 0.55, medium: 1.1, long: 2.2 };

  let ctx = null;
  let master = null;
  let voiceId = "acoustic";
  let ring = RINGS.short;

  const buffers = new Map();       // "voice:midi" -> rendered string pluck
  const activeSources = new Set();
  let timers = [];

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  async function unlock() {
    const c = getCtx();
    if (c.state === "suspended") await c.resume();
  }

  function setVoice(id) {
    if (VOICES[id]) voiceId = id;
  }

  function setRing(id) {
    if (RINGS[id]) ring = RINGS[id];
  }

  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ---------------------------------------------------------- string voice */

  /**
   * Renders one plucked note. The loop length is a whole number of samples,
   * so the buffer is played back at a small rate correction to land in tune.
   */
  function pluck(v, midi) {
    const cacheKey = voiceId + ":" + midi;
    if (buffers.has(cacheKey)) return buffers.get(cacheKey);

    const c = getCtx();
    const sr = c.sampleRate;
    const exact = sr / freqOf(midi);
    const n = Math.max(2, Math.round(exact - 0.5)); // averaging adds half a sample
    const len = Math.floor(sr * 2.6);

    const buffer = c.createBuffer(1, len, sr);
    const out = buffer.getChannelData(0);
    const loop = new Float32Array(n);

    // Excitation: noise smoothed by how soft the "pick" is (nylon = flesh,
    // electric = hard pick), then combed to mimic where the string is struck.
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = prev * v.smooth + (Math.random() * 2 - 1) * (1 - v.smooth);
      loop[i] = prev;
    }
    const p = Math.max(1, Math.round(n * v.pick));
    const struck = loop.slice();
    for (let i = 0; i < n; i++) loop[i] = struck[i] - struck[(i + p) % n] * 0.9;

    const loss = Math.pow(0.001, 1 / (sr * v.t60));
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const a = i % n;
      const val = loop[a];
      out[i] = val;
      loop[a] = loss * 0.5 * (val + loop[(i + 1) % n]);
      if (Math.abs(val) > peak) peak = Math.abs(val);
    }

    const norm = peak > 0 ? 0.6 / peak : 1;
    for (let i = 0; i < len; i++) out[i] *= norm;

    const entry = { buffer, rate: (n + 0.5) / exact };
    buffers.set(cacheKey, entry);
    return entry;
  }

  /* ----------------------------------------------------------- synth voices */

  function partial(c, dest, type, freq, level, when, decay) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(level, when + 0.004);
    g.gain.setTargetAtTime(0.0001, when + 0.004, decay);
    osc.connect(g);
    g.connect(dest);
    return osc;
  }

  function synthOscillators(c, v, midi, when, dest) {
    const f = freqOf(midi);
    if (v.kind === "keys") {
      // Electric-piano-ish: warm fundamental, an octave, and a quick bell tine.
      return [
        partial(c, dest, "sine", f, 0.55, when, 0.9),
        partial(c, dest, "sine", f * 2, 0.18, when, 0.5),
        partial(c, dest, "sine", f * 7.1, 0.06, when, 0.05)
      ];
    }
    if (v.kind === "marimba") {
      // Wooden bar: fundamental, the bar's tuned 4th partial, a short knock.
      return [
        partial(c, dest, "sine", f, 0.6, when, 0.35),
        partial(c, dest, "sine", f * 4, 0.16, when, 0.06),
        partial(c, dest, "triangle", f * 10, 0.04, when, 0.012)
      ];
    }
    // Pure: soft triangle, good for ear training.
    return [partial(c, dest, "triangle", f, 0.5, when, 1.2)];
  }

  /* ------------------------------------------------------------ playing */

  function playAt(midi, when) {
    const c = getCtx();
    const v = VOICES[voiceId];

    // The Ring envelope every voice shares: hold, then fade to silence.
    const env = c.createGain();
    env.gain.setValueAtTime(v.gain, when);
    env.gain.setTargetAtTime(0.0001, when + ring * 0.4, ring * 0.22);
    const end = when + ring * 0.4 + ring * 0.22 * 7;

    if (v.kind === "string") {
      const tone = c.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = v.cutoff;
      tone.Q.value = 0.5;
      tone.connect(env);

      const { buffer, rate } = pluck(v, midi);
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(tone);
      track(src, when, end);
    } else {
      synthOscillators(c, v, midi, when, env).forEach((osc) => track(osc, when, end));
    }

    env.connect(master);
  }

  function track(src, when, end) {
    src.start(when);
    src.stop(end);
    activeSources.add(src);
    src.onended = () => activeSources.delete(src);
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    if (!ctx) return;

    const now = ctx.currentTime;
    activeSources.forEach((src) => {
      try { src.stop(now); } catch (e) { /* already finished */ }
    });
    activeSources.clear();
  }

  /** Single note, for tapping a fret or previewing a sound. */
  async function playNote(midi) {
    await unlock();
    playAt(midi, getCtx().currentTime + 0.01);
  }

  /**
   * Plays a list of MIDI notes on the audio clock. onStep(index, midi) fires
   * as each note sounds (for highlighting), onDone after the last.
   * continueRing: the next pass of a loop - pending timers are replaced but
   * the previous pass's last note is left to ring into it.
   */
  async function playSequence(midis, stepSeconds, onStep, onDone, continueRing) {
    if (continueRing) {
      timers.forEach(clearTimeout);
      timers = [];
    } else {
      stop();
    }
    await unlock();
    const c = getCtx();
    const start = c.currentTime + 0.08;

    midis.forEach((midi, i) => {
      const when = start + i * stepSeconds;
      if (midi !== null) playAt(midi, when);   // null is a rest
      timers.push(setTimeout(() => onStep && onStep(i, midi),
        Math.max(0, (when - c.currentTime) * 1000)));
    });

    const end = start + midis.length * stepSeconds;
    timers.push(setTimeout(() => { timers = []; onDone && onDone(); },
      Math.max(0, (end - c.currentTime) * 1000)));
  }

  return { VOICES, RINGS, unlock, setVoice, setRing, playNote, playSequence, stop };
})();
