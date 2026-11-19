// SOLARIA BAY — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between five screens: title, play, paused,
// victory and busted. ?shot=drawbridge|boulevard|overlook|pursuit (with
// &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { HERO_CAR, MISSIONS, SAVE_KEY, STEP, WANTED, WEAPONS } from './config.js';
import { createRandom } from './random.js';
import { buildWorld } from './world.js';
import { createCar, createHelicopter, createPolice, createTraffic, stepCar, stepTraffic } from './vehicles.js';
import { createPedestrians, createPlayer, stepPedestrians, stepPlayer } from './characters.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_RADIO, ACTION_WEAPON_NEXT, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const random = createRandom(seed);
const world = buildWorld(renderer.scene, random);
const audio = createAudio();
const hud = createHud();

// --- Actors -------------------------------------------------------------------
const player = createPlayer(renderer.scene);
const parked = [];
function parkCar(kind, spec, x, z, heading, name, hero = false) {
  const car = createCar(kind, spec, x, z, heading, name);
  car.hero = hero;
  renderer.scene.add(car.mesh);
  parked.push(car);
  return car;
}
const heroCar = parkCar('hero', HERO_CAR, -116, 286, 0.6, HERO_CAR.name, true);
parkCar('traffic', { color: 0xe8e4d8, topSpeedKmh: 96 }, -84, 44, 0, 'CORAL SEDAN');
parkCar('traffic', { color: 0x3fae9c, topSpeedKmh: 102 }, 84, -44, Math.PI, 'PALM COUPE');
parkCar('traffic', { color: 0xd9a441, topSpeedKmh: 88 }, -160, 84, -Math.PI / 2, 'SANDY HATCH');
parkCar('traffic', { color: 0x8a9bb0, topSpeedKmh: 110 }, 240, 160, Math.PI, 'BAY CRUISER');
const traffic = createTraffic(world, random);
for (const car of traffic) renderer.scene.add(car.mesh);
const police = createPolice(renderer.scene);
const heli = createHelicopter(renderer.scene);
const peds = createPedestrians(renderer.scene, world, random);
const missions = createMissions(world);

// --- Game state ---------------------------------------------------------------
const game = {
  state: SCREEN_TITLE,
  money: 1200,
  rep: 0,
  heat: 0,
  wantedStars: 0,
  hasGold: false,
  weapon: 0,
  ammo: [Infinity, WEAPONS[1].ammo, WEAPONS[2].ammo],
  currentCar: null,
  player,
  missions,
  actors: { police, heli, parked, traffic, peds, heroCar },
  district: 'Palm Boulevard',
  dialog: '',
  dialogSpeaker: 'DQ',
  station: audio.station,
  world,
  lastCrimeAt: -99,
  elapsed: 0,
  lastShotAt: -99,
  time: 0,
};

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: game.money,
      rep: game.rep,
      mission: missions.index,
      hasGold: game.hasGold,
    }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

const DIALOG_LINES = {
  start: [
    ['DARA: Kai Solano, back in Solaria Bay at last. The GT is waiting at the marina. Go get it.', 'DQ'],
    ['KAI: Five years away and the city still smells like salt and gasoline.', 'KS'],
  ],
  mission: [
    ['DARA: Nice. Now cross town — the Towers are watching, and so is the SPD.', 'DQ'],
    ['DARA: The bridge is up. Thirty metres of nothing. Do not lift, Kai.', 'DQ'],
    ['DARA: Go quiet. No sirens, no speeding. Let the heat die down.', 'DQ'],
    ['DARA: The vault, the gold, the bridge home. This is the one, Kai.', 'DQ'],
  ],
};

function setDialog(text, speaker) {
  game.dialog = text;
  game.dialogSpeaker = speaker;
}

function addHeat(amount) {
  game.heat = Math.min(1000, game.heat + amount);
  game.lastCrimeAt = game.elapsed;
}

function updateWanted() {
  const stars = game.heat <= 0 ? 0 : Math.min(WANTED.maxStars, Math.ceil(game.heat / WANTED.heatPerStar));
  game.wantedStars = stars;
  player.wantedStars = stars;
}

function nearestParked(maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of parked) {
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

function enterCar() {
  const car = nearestParked(5);
  if (!car) return false;
  parked.splice(parked.indexOf(car), 1);
  game.currentCar = car;
  player.pos.copy(car.pos);
  addHeat(WANTED.stealCar);
  setDialog(car.hero ? 'KAI: The GT. Still lime, still loud. Let\'s go.' : 'KAI: Borrowed. The owner will understand. Probably.', 'KS');
  audio.pickup();
  return true;
}

function exitCar() {
  const car = game.currentCar;
  if (!car) return false;
  game.currentCar = null;
  const side = car.heading + Math.PI / 2;
  player.pos.set(car.pos.x + Math.sin(side) * 3, car.pos.y, car.pos.z + Math.cos(side) * 3);
  player.mesh.position.copy(player.pos);
  parked.push(car);
  return true;
}

function splashRespawn() {
  // Fished out of the bay: back at the causeway approach, car and all.
  const car = game.currentCar;
  if (car) {
    car.pos.set(372, 0, 0);
    car.speed = 0;
    car.airborne = false;
    car.vy = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = Math.PI / 2;
    car.heading = Math.PI / 2;
    player.pos.copy(car.pos);
  } else {
    player.pos.set(372, 0, 0);
    player.mesh.position.copy(player.pos);
  }
  setDialog('DARA: Fished you out of the bay. The bridge is still up, Kai. Again.', 'DQ');
}

function fireWeapon() {
  if (game.currentCar) return;
  if (game.weapon === 0) return;
  if (game.elapsed - game.lastShotAt < WEAPONS[game.weapon].rate) return;
  if (game.ammo[game.weapon] <= 0) {
    setDialog('KAI: Out of ammo.', 'KS');
    return;
  }
  game.lastShotAt = game.elapsed;
  game.ammo[game.weapon] -= 1;
  audio.shot();
  addHeat(WANTED.shotFired);
  // Hitscan: the nearest police car near the camera's aim takes the hit.
  const camDir = new THREE.Vector3();
  renderer.camera.getWorldDirection(camDir);
  let best = null;
  let bestScore = Infinity;
  for (const car of police.cars) {
    if (car.disabled) continue;
    const to = new THREE.Vector3(car.pos.x - renderer.camera.position.x, 1 - renderer.camera.position.y, car.pos.z - renderer.camera.position.z);
    const dist = to.length();
    if (dist > WEAPONS[game.weapon].range) continue;
    const angle = camDir.angleTo(to.normalize());
    const score = dist + angle * 120;
    if (angle < 0.35 && score < bestScore) {
      best = car;
      bestScore = score;
    }
  }
  if (best) {
    best.condition -= WEAPONS[game.weapon].damage;
    if (best.condition <= 0) {
      best.disabled = true;
      game.rep += 2;
      addHeat(40);
    }
  }
}

function gameOver(reason) {
  game.state = SCREEN_OVER;
  document.getElementById('overlay-title').textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('overlay-lines').innerHTML = reason === 'busted'
    ? '<div>The SPD finally caught up with Kai Solano.</div><div>But Solaria Bay never forgets a driver.</div>'
    : '<div>Kai Solano did not make it out of Solaria Bay.</div>';
  document.getElementById('overlay-prompt').textContent = 'Press Enter or click TRY AGAIN';
  showOverlay(true, 'busted');
  audio.busted();
  status.textContent = 'Busted. Press Enter to try again.';
}

function showOverlay(show, kind) {
  document.getElementById('overlay').style.display = show ? 'flex' : 'none';
  if (!show) return;
  document.getElementById('btn-resume').style.display = kind === 'pause' ? 'inline-block' : 'none';
  document.getElementById('btn-retry').style.display = kind === 'busted' ? 'inline-block' : 'none';
  document.getElementById('btn-keep').style.display = kind === 'victory' ? 'inline-block' : 'none';
}

function startGame(fromSave) {
  const save = fromSave ? readSave() : null;
  game.money = save ? save.money : 1200;
  game.rep = save ? save.rep : 0;
  game.hasGold = save ? !!save.hasGold : false;
  game.heat = 0;
  game.wantedStars = 0;
  game.weapon = 0;
  game.ammo = [Infinity, WEAPONS[1].ammo, WEAPONS[2].ammo];
  player.health = 100;
  player.pos.set(-60, 0, 40);
  player.heading = Math.PI;
  player.mesh.position.copy(player.pos);
  if (game.currentCar) {
    parked.push(game.currentCar);
    game.currentCar = null;
  }
  missions.start();
  if (save && save.mission > 0) {
    // Continue jumps straight to the first unfinished mission.
    missions.skipTo(save.mission);
  }
  setDialog(DIALOG_LINES.start[0][0], 'DQ');
  game.state = SCREEN_PLAY;
  document.getElementById('title').style.display = 'none';
  showOverlay(false);
  status.textContent = 'Playing. Mission 1: First Light.';
  audio.ensure();
  audio.mission();
}

function step(dt) {
  game.elapsed += dt;
  game.time += dt;
  missions.tickMessage(dt);

  // Heat decays when the player has been quiet and no police are near.
  let nearestPolice = Infinity;
  for (const car of police.cars) {
    nearestPolice = Math.min(nearestPolice, Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z));
  }
  if (game.elapsed - game.lastCrimeAt > WANTED.decayDelay && nearestPolice > 55) {
    game.heat = Math.max(0, game.heat - WANTED.decayPerSecond * dt);
  }
  updateWanted();

  // Traffic and pedestrians always move, even on the title screen.
  stepTraffic(traffic, dt, world, game.currentCar);
  stepPedestrians(peds, dt, world, player.pos, game.wantedStars);

  if (game.state === SCREEN_TITLE) {
    world.update(dt, game.time);
    return;
  }
  if (game.state !== SCREEN_PLAY) {
    world.update(dt, game.time);
    return;
  }

  const input = game.input;
  const drive = input.drive();
  const walk = input.walk();

  if (game.currentCar) {
    const event = stepCar(game.currentCar, drive, dt, world);
    player.pos.copy(game.currentCar.pos);
    player.heading = game.currentCar.heading;
    if (event === 'splash') splashRespawn();
    else if (event === 'jump') {
      addHeat(30);
      setDialog('KAI: Airborne! Hold it steady...', 'KS');
    }
    // Shunt traffic cars the player shoves.
    for (const other of traffic) {
      const d = Math.hypot(other.pos.x - game.currentCar.pos.x, other.pos.z - game.currentCar.pos.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const nx = (other.pos.x - game.currentCar.pos.x) / d;
        const nz = (other.pos.z - game.currentCar.pos.z) / d;
        other.pos.x += nx * push;
        other.pos.z += nz * push;
        if (Math.abs(game.currentCar.speed) > 8) {
          other.condition = Math.max(0, other.condition - 20);
          if (other.condition <= 0) other.disabled = true;
          game.currentCar.condition = Math.max(0, game.currentCar.condition - 2);
        }
      }
    }
    if (game.currentCar.condition <= 0) {
      game.currentCar.disabled = true;
      exitCar();
      setDialog('KAI: The car is done. On foot now.', 'KS');
    }
  } else {
    stepPlayer(player, walk, renderer.cameraYaw, dt, world);
    if (input.firing) fireWeapon();
  }

  // Police, helicopter, audio.
  police.update(dt, world, player, game.currentCar, (impact) => {
    addHeat(25);
    setDialog(impact > 12 ? 'KAI: They rammed me! Hold on!' : 'SPD: Pull over, Solano!', 'KS');
  });
  heli.update(dt, player.pos, game.wantedStars >= 3, game.time);
  audio.setEngine(game.currentCar ? game.currentCar.speedKmh : 0, !!game.currentCar);
  audio.setSiren(police.cars.length > 0, game.time);

  // Missions.
  const result = missions.update(game);
  if (result === 'advanced') {
    const rewards = [800, 1200, 1500, 2500, 2000, 15000];
    game.money += rewards[missions.index - 1] ?? 500;
    game.rep += 10;
    audio.mission();
    writeSave();
    if (missions.index < 6) {
      const line = DIALOG_LINES.mission[missions.index - 1];
      if (line) setDialog(line[0], line[1]);
    }
  } else if (result === 'victory') {
    game.state = SCREEN_VICTORY;
    document.getElementById('overlay-title').textContent = 'SOLARIA HEIST COMPLETE';
    document.getElementById('overlay-lines').innerHTML = '<div>Kai Solano took the gold across the bridge and vanished into the golden hour.</div><div>Final take: $' + Math.round(game.money).toLocaleString('en-US') + ' · Rep ' + Math.round(game.rep) + '</div>';
    document.getElementById('overlay-prompt').textContent = 'Press Enter or click KEEP PLAYING';
    showOverlay(true, 'victory');
    audio.mission();
    writeSave();
    status.textContent = 'Victory. Solaria Heist complete.';
  }

  game.district = world.districtAt(player.pos.x, player.pos.z);
  if (player.health <= 0) gameOver('busted');
  world.update(dt, game.time);
  hud.update(game);
}

// --- Debug handle for the playtest and screenshot drivers --------------------
window.__solaria = {
  get state() { return game.state; },
  get money() { return game.money; },
  get rep() { return game.rep; },
  get heat() { return game.heat; },
  set heat(v) { game.heat = v; },
  get wantedStars() { return game.wantedStars; },
  get health() { return player.health; },
  get hasGold() { return game.hasGold; },
  set hasGold(v) { game.hasGold = v; },
  get ammo() { return game.ammo; },
  get jobs() { return missions; },
  get currentCar() { return game.currentCar; },
  get player() { return player; },
  get actors() { return game.actors; },
  get world() { return world; },
  playerSpeedKmh() { return game.currentCar ? game.currentCar.speedKmh : 0; },
  gameOver,
  set rammed(v) { game._rammed = v; },
  get rammed() { return game._rammed ?? 0; },
};
window.__solariaError = null;

function runShot(name) {
  try {
    game.state = SCREEN_PLAY;
    game.input = createInput(canvas);
    // The title screen is a DOM overlay: hide it, or it covers the scene.
    document.getElementById('title').style.display = 'none';
    // Make sure the mission chain and two interceptors exist for staging.
    missions.start();
    const view = stageShot(name, game);
    // The district label is normally set by the loop; in shot mode set it
    // from the staged position so the HUD agrees with the scene.
    game.district = world.districtAt(player.pos.x, player.pos.z);
    hud.update(game);
    let painted = 0;
    function paint() {
      renderer.draw({
        mode: 'play',
        targetPos: player.pos,
        targetHeading: player.heading,
        inCar: !!game.currentCar,
        shotCam: view.shotCam,
        time: game.time,
      }, 0.016);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
  } catch (e) {
    window.__solariaError = String(e && e.stack || e);
  }
}

function runGame() {
  game.input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function handleActions() {
    const actions = game.input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (game.state === SCREEN_TITLE) startGame(false);
      else if (game.state === SCREEN_OVER || game.state === SCREEN_VICTORY) {
        if (game.state === SCREEN_VICTORY) {
          game.state = SCREEN_PLAY;
          showOverlay(false);
        } else startGame(false);
      }
    } else if (actions & ACTION_PAUSE) {
      if (game.state === SCREEN_PLAY) {
        game.state = SCREEN_PAUSED;
        document.getElementById('overlay-title').textContent = 'PAUSED';
        document.getElementById('overlay-lines').innerHTML = '<div>The bay waits for you.</div>';
        document.getElementById('overlay-prompt').textContent = 'Press Esc or click RESUME';
        showOverlay(true, 'pause');
        announce('Paused.');
      } else if (game.state === SCREEN_PAUSED) {
        game.state = SCREEN_PLAY;
        showOverlay(false);
        announce('Playing.');
      }
    }
    if (game.state === SCREEN_PLAY) {
      if (actions & ACTION_ENTER) {
        if (game.currentCar) exitCar();
        else enterCar();
      }
      if (actions & ACTION_WEAPON_NEXT) {
        game.weapon = (actions & 512) ? 2 : (actions & 256) ? 1 : 0;
      }
      if (actions & ACTION_RADIO) {
        game.station = audio.nextStation();
      }
      if (actions & ACTION_MUTE) {
        audio.toggleMute();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    handleActions();
    while (accumulator >= STEP && game.state !== SCREEN_PAUSED) {
      step(STEP);
      accumulator -= STEP;
    }
    if (game.state === SCREEN_PAUSED) accumulator = 0;
    const view = {
      mode: game.state === SCREEN_TITLE ? 'title' : 'play',
      targetPos: player.pos,
      targetHeading: player.heading,
      inCar: !!game.currentCar,
      shotCam: null,
      time: game.time,
    };
    renderer.draw(view, Math.max(frameDt, 0.016));
    if (game.state === SCREEN_PLAY || game.state === SCREEN_TITLE) hud.update(game);
  }

  // Title screen buttons.
  document.getElementById('btn-new').addEventListener('click', () => startGame(false));
  const save = readSave();
  const continueBtn = document.getElementById('btn-continue');
  if (save && save.mission > 0) {
    continueBtn.style.display = 'inline-block';
    continueBtn.textContent = `CONTINUE — MISSION ${Math.min(save.mission + 1, 6)}`;
    continueBtn.addEventListener('click', () => startGame(true));
  }
  document.getElementById('btn-resume').addEventListener('click', () => {
    game.state = SCREEN_PLAY;
    showOverlay(false);
  });
  document.getElementById('btn-retry').addEventListener('click', () => startGame(false));
  document.getElementById('btn-keep').addEventListener('click', () => {
    game.state = SCREEN_PLAY;
    showOverlay(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === SCREEN_PLAY) {
      game.state = SCREEN_PAUSED;
      document.getElementById('overlay-title').textContent = 'PAUSED';
      document.getElementById('overlay-lines').innerHTML = '<div>The bay waits for you.</div>';
      document.getElementById('overlay-prompt').textContent = 'Press Esc or click RESUME';
      showOverlay(true, 'pause');
      announce('Paused.');
    }
  });

  announce('Solaria Bay. Press Enter or click NEW GAME to start.');
  requestAnimationFrame(frame);
}

try {
  if (shot) runShot(shot);
  else runGame();
} catch (e) {
  window.__solariaError = String(e && e.stack || e);
}
