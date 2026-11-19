// Sound, all synthesized with WebAudio — no audio files, no network.
// Engine hum follows speed, the siren wails when police are close, the
// radio plays a soft chord loop per station, and shots, pickups and
// mission chimes are short oscillator blips.

const STATIONS = [
  { name: 'SOLARIA FM 88.5', song: 'Golden Hour — The Apricots', chords: [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]] },
  { name: 'BAYWAVE 101.2', song: 'Prism Lights — Marina Drive', chords: [[165, 208, 247], [147, 185, 220], [131, 165, 196], [147, 185, 220]] },
  { name: 'PALM TALK 96.0', song: 'Sunset News — Evening Report', chords: [[262, 330, 392], [247, 311, 370], [220, 277, 330], [262, 330, 392]] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let radioChord = 0;
  let station = 0;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      radioTimer = setInterval(playRadioChord, 2400);
    } catch {
      ctx = null;
    }
  }

  function playRadioChord() {
    if (!ctx || muted) return;
    const stationDef = STATIONS[station];
    const chord = stationDef.chords[radioChord % stationDef.chords.length];
    radioChord += 1;
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 2.3);
    }
  }

  function blip(freq, duration, type = 'sine', volume = 0.2) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    ensure,
    setEngine(speedKmh, inCar) {
      if (!ctx) return;
      engineGain.gain.value = inCar ? 0.05 + Math.min(0.09, (speedKmh / 212) * 0.09) : 0;
      engineOsc.frequency.value = 55 + speedKmh * 0.9;
    },
    setSiren(on, time) {
      if (!ctx) return;
      sirenGain.gain.value = on ? 0.035 : 0;
      if (on) sirenOsc.frequency.value = 660 + Math.sin(time * 2.4) * 180;
    },
    shot() {
      blip(880, 0.09, 'square', 0.16);
      blip(140, 0.14, 'sawtooth', 0.22);
    },
    pickup() {
      blip(660, 0.12);
      setTimeout(() => blip(990, 0.16), 110);
    },
    mission() {
      blip(523, 0.14);
      setTimeout(() => blip(659, 0.14), 130);
      setTimeout(() => blip(784, 0.22), 260);
    },
    busted() {
      blip(330, 0.3, 'sawtooth', 0.2);
      setTimeout(() => blip(220, 0.5, 'sawtooth', 0.2), 280);
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      radioChord = 0;
      return STATIONS[station];
    },
    get station() {
      return STATIONS[station];
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}
