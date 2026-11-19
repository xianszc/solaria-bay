// All sound is synthesized with WebAudio — no audio files, no network.
// A low engine drone follows speed, a two-tone siren wails while the
// police are close, the radio cycles soft chords per station, and every
// action (a shot, a crash, a pickup, a mission done) has a small
// one-shot blip. Everything is original: the stations and the tunes are
// invented for Solaria Bay.

const STATIONS = [
  { name: 'SOLARIA FM', chords: [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]] },
  { name: 'BAY 94', chords: [[262, 330, 392], [294, 370, 440], [330, 415, 494], [262, 330, 392]] },
  { name: 'GOLDEN HOUR', chords: [[175, 220, 262], [147, 185, 220], [165, 208, 247], [175, 220, 262]] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let radioGain = null;
  let radioOn = true;
  let station = 0;
  let chordIndex = 0;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine drone: a low sawtooth whose pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 700;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: a sine that alternates two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 780;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.12;
    radioGain.connect(master);
  }

  function playChord(freqs, dur) {
    if (!ctx || !radioOn) return;
    const t0 = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g);
      g.connect(radioGain);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }

  function radioTick() {
    if (!ctx) return;
    const chords = STATIONS[station].chords;
    playChord(chords[chordIndex % chords.length], 1.9);
    chordIndex += 1;
    radioTimer = window.setTimeout(radioTick, 1900);
  }

  return {
    start() {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
      if (!radioTimer) radioTick();
    },
    setSpeed(kmh) {
      if (!ctx) return;
      const f = 55 + Math.min(kmh, 220) * 0.55;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(kmh > 2 ? 0.05 : 0, ctx.currentTime, 0.1);
    },
    setSiren(on, near) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
      if (on) {
        // Two-tone wail: alternate 780 / 1040 Hz twice a second.
        const now = ctx.currentTime;
        sirenOsc.frequency.setValueAtTime(near ? 1040 : 780, now);
        sirenOsc.frequency.setTargetAtTime(near ? 780 : 1040, now, 0.45);
      }
    },
    cycleStation() {
      station = (station + 1) % STATIONS.length;
      chordIndex = 0;
      return STATIONS[station].name;
    },
    toggleRadio() {
      radioOn = !radioOn;
      return radioOn;
    },
    get stationName() {
      return STATIONS[station].name;
    },
    get radioOn() {
      return radioOn;
    },
    // One-shot effects.
    blip(freq, dur, type = 'sine', vol = 0.2) {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur);
    },
    shot() {
      this.blip(180, 0.12, 'square', 0.25);
      this.blip(90, 0.2, 'sawtooth', 0.15);
    },
    crash() {
      this.blip(70, 0.3, 'sawtooth', 0.3);
    },
    pickup() {
      this.blip(660, 0.15, 'sine', 0.2);
      window.setTimeout(() => this.blip(880, 0.2, 'sine', 0.2), 120);
    },
    missionDone() {
      [523, 659, 784].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.25, 'sine', 0.22), i * 140));
    },
    busted() {
      [392, 311, 233].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.35, 'triangle', 0.22), i * 200));
    },
  };
}
