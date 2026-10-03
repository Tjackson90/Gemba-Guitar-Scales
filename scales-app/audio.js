/**
 * Scale playback. Same shape as Gemba Metronome's AudioEngine - one lazily
 * created context, a master gain, tracked sources so stop() is instant - but
 * the voice is a Karplus-Strong plucked string instead of a click.
 */
window.ScaleAudio = (function () {
  let ctx = null;
  let master = null;
  let tone = null;

  const buffers = new Map();       // midi -> rendered pluck
  const activeSources = new Set();
  let timers = [];

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      // A gentle low-pass takes the edge off the raw noise burst.
      tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 3200;
      tone.Q.value = 0.4;

      master = ctx.createGain();
      master.gain.value = 0.8;

      tone.connect(master);
      master.connect(ctx.destination);
    }
    return ctx;
  }

  async function unlock() {
    const c = getCtx();
    if (c.state === "suspended") await c.resume();
  }

  /**
   * Renders one plucked note. The loop length is a whole number of samples,
   * so the buffer is played back at a small rate correction to land in tune.
   */
  function pluck(midi) {
    if (buffers.has(midi)) return buffers.get(midi);

    const c = getCtx();
    const sr = c.sampleRate;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const exact = sr / freq;                 // ideal loop length
    const n = Math.max(2, Math.round(exact - 0.5)); // averaging adds half a sample
    const seconds = 1.8;
    const len = Math.floor(sr * seconds);

    const buffer = c.createBuffer(1, len, sr);
    const out = buffer.getChannelData(0);
    const ring = new Float32Array(n);

    // Slightly smoothed noise: a pick, not a hiss.
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
      ring[i] = prev;
    }

    // Per-sample loss for a ~1.6 s ring-out regardless of pitch.
    const loss = Math.pow(0.001, 1 / (sr * 1.6));
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const a = i % n;
      const b = (i + 1) % n;
      const v = ring[a];
      out[i] = v;
      ring[a] = loss * 0.5 * (v + ring[b]);
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }

    const norm = peak > 0 ? 0.6 / peak : 1;
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) {
      out[i] *= norm * (i > len - fade ? (len - i) / fade : 1);
    }

    const entry = { buffer, rate: (n + 0.5) / exact };
    buffers.set(midi, entry);
    return entry;
  }

  function playAt(midi, when) {
    const c = getCtx();
    const { buffer, rate } = pluck(midi);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(tone);
    src.start(when);

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

  /** Single note, for tapping a fret. */
  async function playNote(midi) {
    await unlock();
    playAt(midi, getCtx().currentTime + 0.01);
  }

  /**
   * Plays a list of MIDI notes on the audio clock. onStep(index, midi) fires
   * as each note sounds (for highlighting), onDone once the last has rung.
   */
  async function playSequence(midis, stepSeconds, onStep, onDone) {
    stop();
    await unlock();
    const c = getCtx();
    const start = c.currentTime + 0.08;

    midis.forEach((midi, i) => {
      const when = start + i * stepSeconds;
      playAt(midi, when);
      timers.push(setTimeout(() => onStep && onStep(i, midi),
        Math.max(0, (when - c.currentTime) * 1000)));
    });

    const end = start + midis.length * stepSeconds;
    timers.push(setTimeout(() => { timers = []; onDone && onDone(); },
      Math.max(0, (end - c.currentTime) * 1000)));
  }

  return { unlock, playNote, playSequence, stop };
})();
