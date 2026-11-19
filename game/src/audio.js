// All sound is synthesized with WebAudio — no audio files, no network.
// A low engine drone follows speed, a two-tone siren wails while the
// police are close, the radio cycles soft chords per station, and every
// gunshot, pickup and mission chime is a short oscillator ping.

const RADIO = [
  { name: 'SOLARIA FM 88.5', song: 'Golden Hour — The Apricots', progression: [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]] },
  { name: 'BAYWAVE 101.2', song: 'Prism Lights — Marina Drive', progression: [[165, 208, 247], [147, 185, 220], [131, 165, 196], [147, 185, 220]] },
  { name: 'PALM TALK 96.0', song: 'Sunset News — Evening Report', progression: [[262, 330, 392], [247, 311, 370], [220, 277, 330], [262, 330, 392]] },
];

export function createAudio() {
  const nodes = { ctx: null, master: null, engine: null, engineLevel: null, siren: null, sirenLevel: null };
  let silent = false;
  let booted = false;
  let chordStep = 0;
  let stationIndex = 0;

  // One oscillator wired through its own gain into the master bus.
  function voice(type, freq) {
    const osc = nodes.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const level = nodes.ctx.createGain();
    osc.connect(level);
    level.connect(nodes.master);
    return { osc, level };
  }

  // A short note that fades out on its own.
  function ping(freq, seconds, type, volume) {
    if (!nodes.ctx || silent) return;
    const { osc, level } = voice(type || 'sine', freq);
    level.gain.setValueAtTime(volume || 0.2, nodes.ctx.currentTime);
    level.gain.exponentialRampToValueAtTime(0.001, nodes.ctx.currentTime + seconds);
    osc.start();
    osc.stop(nodes.ctx.currentTime + seconds);
  }

  function playChord() {
    if (!nodes.ctx || silent) return;
    const notes = RADIO[stationIndex].progression[chordStep % RADIO[stationIndex].progression.length];
    chordStep += 1;
    for (const freq of notes) {
      const { osc, level } = voice('triangle', freq);
      level.gain.setValueAtTime(0.05, nodes.ctx.currentTime);
      level.gain.exponentialRampToValueAtTime(0.001, nodes.ctx.currentTime + 2.2);
      osc.start();
      osc.stop(nodes.ctx.currentTime + 2.3);
    }
  }

  return {
    ensure() {
      if (booted) return;
      booted = true;
      try {
        nodes.ctx = new (window.AudioContext || window.webkitAudioContext)();
        nodes.master = nodes.ctx.createGain();
        nodes.master.gain.value = silent ? 0 : 0.5;
        nodes.master.connect(nodes.ctx.destination);
        // Engine: a sawtooth through a low-pass filter, silent until driving.
        const engine = voice('sawtooth', 60);
        const filter = nodes.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engine.osc.disconnect();
        engine.osc.connect(filter);
        filter.connect(engine.level);
        // engine.level is already wired to the master bus by voice().
        engine.level.gain.value = 0;
        engine.osc.start();
        nodes.engine = engine.osc;
        nodes.engineLevel = engine.level;
        // Siren: a sine that the loop retunes into a wail.
        const siren = voice('sine', 700);
        siren.level.gain.value = 0;
        siren.osc.start();
        nodes.siren = siren.osc;
        nodes.sirenLevel = siren.level;
        setInterval(playChord, 2400);
      } catch {
        nodes.ctx = null;
      }
    },
    setEngine(speedKmh, inCar) {
      if (!nodes.ctx) return;
      nodes.engineLevel.gain.value = inCar ? 0.05 + Math.min(0.09, (speedKmh / 212) * 0.09) : 0;
      nodes.engine.frequency.value = 55 + speedKmh * 0.9;
    },
    setSiren(on, time) {
      if (!nodes.ctx) return;
      nodes.sirenLevel.gain.value = on ? 0.035 : 0;
      if (on) nodes.siren.frequency.value = 660 + Math.sin(time * 2.4) * 180;
    },
    shot() {
      ping(880, 0.09, 'square', 0.16);
      ping(140, 0.14, 'sawtooth', 0.22);
    },
    pickup() {
      ping(660, 0.12);
      setTimeout(() => ping(990, 0.16), 110);
    },
    mission() {
      ping(523, 0.14);
      setTimeout(() => ping(659, 0.14), 130);
      setTimeout(() => ping(784, 0.22), 260);
    },
    busted() {
      ping(330, 0.3, 'sawtooth', 0.2);
      setTimeout(() => ping(220, 0.5, 'sawtooth', 0.2), 280);
    },
    nextStation() {
      stationIndex = (stationIndex + 1) % RADIO.length;
      chordStep = 0;
      return RADIO[stationIndex];
    },
    get station() {
      return RADIO[stationIndex];
    },
    toggleMute() {
      silent = !silent;
      if (nodes.master) nodes.master.gain.value = silent ? 0 : 0.5;
      return silent;
    },
    get isMuted() {
      return silent;
    },
  };
}
