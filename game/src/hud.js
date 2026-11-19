// The HUD: a compact DOM overlay in the SOLARIA style — crisp white type,
// amber accents, deep-slate translucent panels, a circular wireframe
// minimap. Dense enough to read as a GTA HUD, small enough to leave the
// city visible. The minimap is a 2D canvas redrawn every frame.
import { WEAPONS } from './config.js';

const DISTRICT_LABELS = {
  'Twin Prism Towers': 'TWIN PRISM TOWERS',
  'Prism District': 'PRISM DISTRICT',
  'Marina Row': 'MARINA ROW',
  'Palm Boulevard': 'PALM BOULEVARD',
  Causeway: 'CAUSEWAY',
  'Solaria Key': 'SOLARIA KEY',
  'South Solaria': 'SOUTH SOLARIA',
  'Old Solaria': 'OLD SOLARIA',
};

export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-mission" class="panel">
      <div class="mission-kicker">MISSION <span id="hud-mission-num">1/6</span></div>
      <div id="hud-mission-name">FIRST LIGHT</div>
      <div id="hud-mission-obj">Drive to the Marina Row marker</div>
      <div id="hud-mission-next">NEXT: The Pickup</div>
    </div>
    <div id="hud-right" class="panel">
      <div id="hud-stars">☆☆☆☆☆</div>
      <div id="hud-cash">$0</div>
      <div id="hud-rep">REP 0</div>
      <div id="hud-police"></div>
    </div>
    <div id="hud-district">PALM BOULEVARD</div>
    <div id="hud-dialog" class="panel"><span id="hud-portrait">DQ</span><span id="hud-dialog-text"></span></div>
    <div id="hud-weapons"></div>
    <div id="hud-radio" class="panel"><span id="hud-radio-name">SOLARIA FM 88.5</span><span id="hud-radio-song">Golden Hour — The Apricots</span></div>
    <div id="hud-speed">
      <div id="hud-speed-num">0</div>
      <div id="hud-speed-unit">KM/H · <span id="hud-car-name">ON FOOT</span></div>
      <div id="hud-cond"><div id="hud-cond-fill"></div></div>
      <div id="hud-nitro"><div id="hud-nitro-fill"></div></div>
    </div>
    <canvas id="hud-minimap" width="180" height="180"></canvas>
    <div id="hud-crosshair">+</div>
    <div id="hud-message"></div>
  `;
  const el = (id) => document.getElementById(id);
  const minimap = el('hud-minimap');
  const mctx = minimap.getContext('2d');

  function stars(count) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < count ? '★' : '☆';
    return out;
  }

  function drawMinimap(game) {
    const W = 180;
    const H = 180;
    const cx = W / 2;
    const cy = H / 2;
    // World bounds: x [-320, 780], z [-320, 320] -> map to the circle.
    const scale = 0.135;
    const toMap = (x, z) => [cx + (x - 230) * scale, cy + z * scale];
    mctx.clearRect(0, 0, W, H);
    mctx.save();
    mctx.beginPath();
    mctx.arc(cx, cy, 86, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = 'rgba(27,38,59,0.85)';
    mctx.fillRect(0, 0, W, H);
    // Water.
    mctx.fillStyle = '#0e6f8f';
    mctx.fillRect(0, 0, W, H);
    // Islands.
    mctx.fillStyle = '#3a4556';
    const [ix, iy] = toMap(-320, -320);
    mctx.fillRect(ix, iy, 640 * scale, 640 * scale);
    const [kx, ky] = toMap(560, -160);
    mctx.fillRect(kx, ky, 220 * scale, 320 * scale);
    // Causeway.
    mctx.fillStyle = '#8a8f96';
    const [bx, by] = toMap(298, -10);
    mctx.fillRect(bx, by, 284 * scale, 20 * scale);
    // Roads.
    mctx.strokeStyle = '#5a6270';
    mctx.lineWidth = 2;
    for (const line of [-240, -160, -80, 0, 80, 160, 240]) {
      const [ax, ay] = toMap(line, -320);
      mctx.beginPath();
      mctx.moveTo(ax, ay);
      mctx.lineTo(ax, ay + 640 * scale);
      mctx.stroke();
      const [hx, hy] = toMap(-320, line);
      mctx.beginPath();
      mctx.moveTo(hx, hy);
      mctx.lineTo(hx + 640 * scale, hy);
      mctx.stroke();
    }
    // Mission marker.
    const step = game.missions.currentStep ? game.missions.currentStep() : null;
    if (step && (step.kind === 'reach' || step.kind === 'grab') && game.missions.active) {
      const [mx, my] = toMap(step.x, step.z);
      mctx.fillStyle = '#ffb703';
      mctx.beginPath();
      mctx.arc(mx, my, 5, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#ffb703';
      mctx.beginPath();
      mctx.arc(mx, my, 9, 0, Math.PI * 2);
      mctx.stroke();
    }
    // Police blips.
    mctx.fillStyle = '#3fa9ff';
    for (const car of game.actors.police.cars) {
      const [px, py] = toMap(car.pos.x, car.pos.z);
      mctx.beginPath();
      mctx.arc(px, py, 3, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(game.player.pos.x, game.player.pos.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(-game.player.heading);
    mctx.fillStyle = game.currentCar ? '#70e000' : '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 6);
    mctx.lineTo(-5, 6);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px system-ui, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('N', cx, 14);
    mctx.restore();
    mctx.strokeStyle = 'rgba(255,255,255,0.7)';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(cx, cy, 88, 0, Math.PI * 2);
    mctx.stroke();
  }

  function update(game) {
    const missions = game.missions;
    const mission = missions.current();
    el('hud-mission-num').textContent = `${Math.min(missions.index + 1, 6)}/6`;
    el('hud-mission-name').textContent = mission.name;
    el('hud-mission-obj').textContent = mission.objective;
    const next = missions.index + 1 < 6 ? `NEXT: ${['The Pickup', 'Tower Run', 'The Jump', 'Golden Hour', 'Solaria Heist'][missions.index]}` : 'FINAL MISSION';
    el('hud-mission-next').textContent = next;
    el('hud-stars').textContent = stars(game.wantedStars);
    el('hud-stars').style.color = game.wantedStars > 0 ? '#ff5a4e' : '#ffffff';
    el('hud-cash').textContent = `$${Math.round(game.money).toLocaleString('en-US')}`;
    el('hud-rep').textContent = `REP ${Math.round(game.rep)}`;
    const policeList = game.actors.police.cars.slice(0, 3).map((car) => {
      const dist = Math.round(Math.hypot(car.pos.x - game.player.pos.x, car.pos.z - game.player.pos.z));
      const tactic = car.disabled ? 'DISABLED' : dist < 25 ? 'RAMMING' : 'PURSUIT';
      return `<div>SPD-${Math.abs(Math.round(car.pos.x + car.pos.z)) % 90 + 10} · ${dist}m · ${tactic}</div>`;
    }).join('');
    el('hud-police').innerHTML = policeList;
    el('hud-district').textContent = DISTRICT_LABELS[game.district] || game.district;
    const dialog = game.dialog || '';
    el('hud-dialog').style.display = dialog ? 'flex' : 'none';
    if (dialog) {
      el('hud-dialog-text').textContent = dialog;
      el('hud-portrait').textContent = game.dialogSpeaker || 'DQ';
    }
    // Weapons.
    el('hud-weapons').innerHTML = WEAPONS.map((w, i) => {
      const ammo = game.ammo[i];
      const active = i === game.weapon;
      const ammoText = ammo === Infinity ? '∞' : ammo;
      return `<div class="weapon${active ? ' active' : ''}"><b>${i + 1}</b> ${w.name} <span>${ammoText}</span></div>`;
    }).join('');
    el('hud-radio-name').textContent = game.station.name;
    el('hud-radio-song').textContent = game.station.song;
    const speed = game.currentCar ? Math.round(game.currentCar.speedKmh) : 0;
    el('hud-speed-num').textContent = speed;
    el('hud-car-name').textContent = game.currentCar ? game.currentCar.name : 'ON FOOT';
    const cond = game.currentCar ? game.currentCar.condition : game.player.health;
    el('hud-cond-fill').style.width = `${Math.max(0, cond)}%`;
    el('hud-cond-fill').style.background = cond > 50 ? '#70e000' : cond > 25 ? '#ffb703' : '#ff5a4e';
    el('hud-nitro-fill').style.width = `${game.currentCar ? game.currentCar.nitro : 0}%`;
    el('hud-crosshair').style.display = !game.currentCar && game.weapon > 0 ? 'block' : 'none';
    const msg = missions.message;
    el('hud-message').textContent = msg;
    el('hud-message').style.opacity = msg ? '1' : '0';
    drawMinimap(game);
  }

  return { update };
}
