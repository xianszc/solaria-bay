// The HUD: a compact DOM overlay in the SOLARIA style — crisp white
// type, amber accents, deep-slate translucent panels, a circular
// minimap. Dense enough to read as a proper open-world HUD, small
// enough to stay legible at contact-sheet size.

import { FONT, PALETTE } from './config.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createHUD() {
  const root = el('div', 'hud');
  root.innerHTML = `
    <div class="hud-mission">
      <div class="hud-mission-title"></div>
      <div class="hud-mission-objective"></div>
      <div class="hud-mission-step"></div>
    </div>
    <div class="hud-right">
      <div class="hud-stars"></div>
      <div class="hud-cash"></div>
      <div class="hud-police"></div>
    </div>
    <div class="hud-speed">
      <div class="hud-speed-num">0</div>
      <div class="hud-speed-unit">km/h</div>
      <div class="hud-speed-car"></div>
    </div>
    <div class="hud-radio"></div>
    <div class="hud-hint">WASD drive/walk · F steal car · Shift nitro/run · 1/2/3 weapons · Click shoot · R radio · P pause</div>
    <div class="hud-dialogue"></div>
    <div class="hud-crosshair">+</div>
    <canvas class="hud-minimap" width="180" height="180"></canvas>
  `;
  document.body.appendChild(root);
  const missionTitle = root.querySelector('.hud-mission-title');
  const missionObjective = root.querySelector('.hud-mission-objective');
  const missionStep = root.querySelector('.hud-mission-step');
  const starsEl = root.querySelector('.hud-stars');
  const cashEl = root.querySelector('.hud-cash');
  const policeEl = root.querySelector('.hud-police');
  const speedNum = root.querySelector('.hud-speed-num');
  const speedCar = root.querySelector('.hud-speed-car');
  const radioEl = root.querySelector('.hud-radio');
  const dialogueEl = root.querySelector('.hud-dialogue');
  const crosshair = root.querySelector('.hud-crosshair');
  const minimap = root.querySelector('.hud-minimap');
  const mctx = minimap.getContext('2d');

  let dialogueTimer = null;
  function showDialogue(speaker, text, ms = 4200) {
    dialogueEl.innerHTML = '';
    const who = el('span', 'hud-dialogue-who', speaker + ': ');
    const what = el('span', 'hud-dialogue-what', text);
    dialogueEl.appendChild(who);
    dialogueEl.appendChild(what);
    dialogueEl.style.opacity = '1';
    if (dialogueTimer) clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => { dialogueEl.style.opacity = '0'; }, ms);
  }

  function drawMinimap(state) {
    const S = 180;
    const C = S / 2;
    const scale = S / 900; // the world spans about 900 m across
    mctx.clearRect(0, 0, S, S);
    // Circular clip.
    mctx.save();
    mctx.beginPath();
    mctx.arc(C, C, C - 2, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#1b263b';
    mctx.fillRect(0, 0, S, S);
    // Water.
    mctx.fillStyle = '#0e6f8f';
    mctx.fillRect(0, 0, S, S);
    // Island + Key.
    const toMap = (x, z) => [C + x * scale, C + z * scale];
    mctx.fillStyle = '#b3a37e';
    const [ix, iz] = toMap(-320, -320);
    mctx.fillRect(ix, iz, 640 * scale, 640 * scale);
    const [kx, kz] = toMap(560, -160);
    mctx.fillRect(kx, kz, 220 * scale, 320 * scale);
    // Causeway.
    mctx.fillStyle = '#4a4640';
    const [cx, cz] = toMap(298, -12);
    mctx.fillRect(cx, cz, 284 * scale, 24 * scale);
    // Roads.
    mctx.strokeStyle = '#332e29';
    mctx.lineWidth = 2;
    for (const s of [-240, -160, -80, 0, 80, 160, 240]) {
      const [ax, ay] = toMap(s, -320);
      mctx.beginPath();
      mctx.moveTo(ax, ay);
      mctx.lineTo(ax, ay + 640 * scale);
      mctx.stroke();
      const [bx, by] = toMap(-320, s);
      mctx.beginPath();
      mctx.moveTo(bx, by);
      mctx.lineTo(bx + 640 * scale, by);
      mctx.stroke();
    }
    // Mission marker.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      mctx.fillStyle = '#ffb703';
      mctx.beginPath();
      mctx.arc(mx, my, 5, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#ffffff';
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
    // Police (red dots).
    for (const p of state.police || []) {
      const [px, py] = toMap(p.x, p.z);
      mctx.fillStyle = '#ff2d2d';
      mctx.beginPath();
      mctx.arc(px, py, 3, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player (white arrow).
    const [ux, uy] = toMap(state.player.x, state.player.z);
    mctx.save();
    mctx.translate(ux, uy);
    mctx.rotate(Math.atan2(-Math.sin(state.player.heading), -Math.cos(state.player.heading)) + Math.PI / 2);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    mctx.restore();
    // Ring.
    mctx.strokeStyle = 'rgba(255,255,255,0.85)';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(C, C, C - 2, 0, Math.PI * 2);
    mctx.stroke();
  }

  return {
    root,
    showDialogue,
    update(state) {
      const m = state.mission;
      missionTitle.textContent = m ? `${m.index + 1}. ${m.current ? m.current.name : ''}` : '';
      missionObjective.textContent = m && m.current ? m.current.brief : '';
      missionStep.textContent = m && m.currentStep ? `▸ ${m.currentStep.label}` : '';
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < state.stars ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.style.color = state.stars >= 3 ? '#ff2d2d' : '#ffb703';
      cashEl.textContent = `$${state.money.toLocaleString('en-US')}  ·  REP ${state.rep}`;
      const alive = (state.police || []).filter((p) => p.condition > 0).length;
      policeEl.textContent = state.stars > 0 ? `SPD: ${alive} unit${alive === 1 ? '' : 's'} on you` : 'SPD: clear';
      // Speed.
      speedNum.textContent = Math.round(state.speedKmh);
      speedCar.textContent = state.inCar ? state.carName : 'ON FOOT';
      speedCar.style.color = state.inCar ? '#70e000' : '#ffffff';
      radioEl.textContent = state.radioOn ? `♪ ${state.station}` : '♪ radio off';
      crosshair.style.display = !state.inCar && state.weapon !== 0 ? 'block' : 'none';
      drawMinimap(state);
    },
    setVisible(v) {
      root.style.display = v ? 'block' : 'none';
    },
  };
}

export function injectHUDStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .hud { position: fixed; inset: 0; pointer-events: none; font-family: ${FONT}; color: ${PALETTE.hudText}; z-index: 10; }
    .hud-mission { position: absolute; top: 14px; left: 14px; background: ${PALETTE.hudPanel}; border-left: 4px solid ${PALETTE.hudAmber}; padding: 10px 14px; max-width: 380px; border-radius: 4px; }
    .hud-mission-title { font-size: 17px; font-weight: 800; letter-spacing: 1px; }
    .hud-mission-objective { font-size: 13px; opacity: 0.92; margin-top: 3px; line-height: 1.35; }
    .hud-mission-step { font-size: 12px; color: ${PALETTE.hudAmber}; margin-top: 4px; font-weight: 700; }
    .hud-right { position: absolute; top: 14px; right: 14px; text-align: right; }
    .hud-stars { font-size: 26px; letter-spacing: 3px; text-shadow: 0 2px 6px rgba(0,0,0,0.6); }
    .hud-cash { font-size: 15px; font-weight: 700; margin-top: 2px; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
    .hud-police { font-size: 12px; opacity: 0.9; margin-top: 2px; }
    .hud-speed { position: absolute; right: 16px; bottom: 16px; text-align: right; text-shadow: 0 2px 6px rgba(0,0,0,0.7); }
    .hud-speed-num { font-size: 44px; font-weight: 800; line-height: 1; }
    .hud-speed-unit { font-size: 12px; opacity: 0.85; }
    .hud-speed-car { font-size: 14px; font-weight: 800; letter-spacing: 1px; margin-top: 2px; }
    .hud-radio { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); font-size: 13px; font-weight: 700; background: ${PALETTE.hudPanel}; padding: 6px 12px; border-radius: 20px; }
    .hud-hint { position: absolute; bottom: 16px; left: 210px; font-size: 11px; opacity: 0.75; max-width: 260px; line-height: 1.4; }
    .hud-dialogue { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); background: ${PALETTE.hudPanel}; padding: 9px 16px; border-radius: 6px; font-size: 14px; max-width: 560px; transition: opacity 0.4s; opacity: 0; }
    .hud-dialogue-who { color: ${PALETTE.hudAmber}; font-weight: 800; }
    .hud-crosshair { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 22px; font-weight: 700; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.8); display: none; }
    .hud-minimap { position: absolute; left: 14px; bottom: 14px; width: 180px; height: 180px; border-radius: 50%; box-shadow: 0 4px 18px rgba(0,0,0,0.5); }
  `;
  document.head.appendChild(style);
}
