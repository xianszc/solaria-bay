// SOLARIA BAY — boot and the single game loop. Each frame the loop reads
// input, steps the world forward in fixed 1/60 s slices, and paints the
// result. Five screens: title, play, paused, victory, busted. With
// ?shot=drawbridge|boulevard|overlook|pursuit the page instead stages
// one screenshot scene, paints it twice, and sets window.__shotReady.
//
// The boot is async: the real GLB assets (hero car, buildings, the
// fleet) load first, then the world is built from them, then the game
// starts. If the assets fail to load, the error is reported on screen
// and on window.__solariaError instead of a black page.

import * as THREE from 'three';
import { STEP, WORLD, MISSIONS, SAVE_KEY, HERO_CAR, WANTED } from './config.js';
import { createRandom } from './random.js';
import { loadGameAssets } from './assets.js';
import { buildWorld } from './city.js';
import { makeCar, driveCar, Traffic, Police } from './vehicles.js';
import { createPlayer, stepPlayer, fireWeapon, Pedestrians } from './characters.js';
import { createMissions, updateMissions, DIALOGUE } from './missions.js';
import { createRenderer, createCamera, updateCamera, resizeRenderer } from './render.js';
import { createHUD, injectHUDStyles } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { SHOTS } from './shots.js';

const PAYOUTS = [800, 1200, 1500, 2500, 2000, 15000];

function params() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot'),
    seed: q.get('seed') ? Number(q.get('seed')) : (Math.random() * 1e9) | 0,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked: the game still runs, it just won't save.
  }
}

async function boot() {
  const { shot, seed } = params();
  const rng = createRandom(seed);
  const canvas = document.getElementById('game');
  const errorBox = document.getElementById('error');
  window.__solariaError = null;

  // --- Screens (DOM overlays) -------------------------------------------------
  const titleScreen = document.getElementById('title-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const victoryScreen = document.getElementById('victory-screen');
  const bustedScreen = document.getElementById('busted-screen');
  const loadingScreen = document.getElementById('loading-screen');
  const showOnly = (which) => {
    for (const [el, name] of [[titleScreen, 'title'], [pauseScreen, 'pause'], [victoryScreen, 'victory'], [bustedScreen, 'busted'], [loadingScreen, 'loading']]) {
      if (el) el.style.display = name === which ? 'flex' : 'none';
    }
  };

  let renderer;
  let camera;
  let scene;
  let world;
  let assets;
  try {
    renderer = createRenderer(canvas);
    camera = createCamera();
    camera.position.set(-40, 55, 402);
    camera.lookAt(-280, 60, 0);
    scene = new THREE.Scene();
    assets = await loadGameAssets();
    world = buildWorld(scene, assets, rng);
  } catch (e) {
    const msg = `Failed to load Solaria Bay: ${e && e.message ? e.message : e}`;
    window.__solariaError = msg;
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
    if (loadingScreen) loadingScreen.style.display = 'none';
    throw e;
  }

  // --- The game objects ---------------------------------------------------------
  const save = loadSave();
  const player = createPlayer(scene, world);
  const peds = new Pedestrians(scene, world, rng, 16);
  const traffic = new Traffic(scene, assets, world, rng);
  const police = new Police(scene, assets, world, rng);
  const missions = createMissions();
  const hud = createHUD();
  injectHUDStyles();
  const audio = createAudio();
  const input = createInput(canvas);

  // The hero GT, parked under the middle shade sail at the marina.
  const heroCar = makeCar(assets, 'hero', world.heroSpawn.x, world.heroSpawn.z, world.heroSpawn.heading);
  heroCar.isHero = true;
  scene.add(heroCar.group);
  // Parked cars the player can steal: the fire trucks, the ambulance,
  // and a few ordinary cars left on the street.
  const parkedCars = [];
  const parkedSpecs = [
    ['firePumper', 200, 200, Math.PI / 2],
    ['fireLadder', 212, 200, Math.PI / 2],
    ['ambulance', -200, -200, 0],
    ['sedan', 80, 40, Math.PI / 2],
    ['hatchback', -80, -40, 0],
    ['van', 120, -120, Math.PI],
  ];
  for (const [key, x, z, heading] of parkedSpecs) {
    const car = makeCar(assets, key, x, z, heading);
    car.parked = true;
    scene.add(car.group);
    parkedCars.push(car);
  }

  // --- State ----------------------------------------------------------------------
  const state = {
    screen: shot ? 'play' : 'title',
    money: save ? save.money || 0 : 0,
    rep: save ? save.rep || 0 : 0,
    hasGold: save ? !!save.hasGold : false,
    playerCar: null, // the car Kai is driving, or null when on foot
    gameOver: false,
    time: 0,
    camYaw: 0,
  };
  if (save && typeof save.mission === 'number' && save.mission > 0 && save.mission < MISSIONS.length) {
    missions.index = save.mission;
    missions.step = 0;
  }

  // The debug handle (used by the playtest and the shot driver).
  window.__solaria = {
    get state() { return state.screen; },
    get money() { return state.money; },
    get rep() { return state.rep; },
    get heat() { return police.heat; },
    get wantedStars() { return police.stars; },
    get health() { return player.health; },
    get hasGold() { return state.hasGold; },
    get ammo() { return { ...player.ammo }; },
    get currentCar() { return state.playerCar ? state.playerCar.key : null; },
    get drivenCar() { return state.playerCar; },
    get gameOver() { return state.gameOver; },
    // Exposed for the performance tool: the renderer's info holds the
    // real draw calls + triangles of the last rendered frame.
    get rendererInfo() { return { ...renderer.info.render }; },
    get peds() { return peds.peds; },
    player,
    world,
    missions,
    police,
    traffic,
    heroCar,
    parkedCars,
    playerSpeedKmh() {
      return state.playerCar ? Math.abs(state.playerCar.speed) * 3.6 : 0;
    },
  };

  // --- Dialogue + mission flow ------------------------------------------------------
  let dialogueQueue = [];
  function say(lines) {
    dialogueQueue = lines.slice();
  }
  function pumpDialogue() {
    if (dialogueQueue.length === 0) return;
    const [who, text] = dialogueQueue.shift();
    hud.showDialogue(who, text);
  }
  say(DIALOGUE.start);

  function onMissionComplete() {
    const finished = missions.index - 1;
    const payout = PAYOUTS[finished] || 0;
    state.money += payout;
    state.rep += 10 + finished * 5;
    audio.missionDone();
    writeSave({ money: state.money, rep: state.rep, mission: missions.index, hasGold: state.hasGold });
    const next = DIALOGUE[Object.keys(DIALOGUE)[missions.index]] || null;
    if (next) say(next);
  }

  // --- Entering / leaving cars -------------------------------------------------------
  function nearestStealable() {
    const candidates = [heroCar, ...parkedCars];
    let best = null;
    let bestDist = 3.6;
    for (const car of candidates) {
      if (state.playerCar === car) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestDist) {
        best = car;
        bestDist = d;
      }
    }
    return best;
  }
  function enterCar(car) {
    state.playerCar = car;
    car.parked = false;
    player.group.visible = false;
    if (car.key !== 'hero') police.addHeat(WANTED.stealCar);
    audio.pickup();
  }
  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    state.playerCar = null;
    // Kai steps out to the left of the car.
    const lx = car.x + Math.cos(car.heading) * 1.6;
    const lz = car.z - Math.sin(car.heading) * 1.6;
    player.x = lx;
    player.z = lz;
    player.y = world.heightAt(lx, lz) ?? 0;
    player.group.position.set(player.x, player.y, player.z);
    player.group.visible = true;
    car.parked = true;
    if (!parkedCars.includes(car) && car.key !== 'hero') parkedCars.push(car);
  }

  // --- Shooting (mouse click) ---------------------------------------------------------
  let shootQueued = false;
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && state.screen === 'play' && !state.playerCar) shootQueued = true;
  });

  // --- The fixed-step update ------------------------------------------------------------
  // Refresh the HUD from the live state. Called every step AND
  // synchronously the moment the game starts, so the mission panel,
  // minimap and radio read correctly even before the first frame paints
  // (on very slow hardware a frame can take seconds, and a HUD that
  // only updates per-frame would still show the title screen's blanks).
  function refreshHUD() {
    const stepInfo = missions.currentStep;
    const focusPos = state.playerCar
      ? { x: state.playerCar.x, z: state.playerCar.z, heading: state.playerCar.heading }
      : { x: player.x, z: player.z, heading: player.heading };
    hud.update({
      mission: missions,
      stars: police.stars,
      money: state.money,
      rep: state.rep,
      police: police.cars,
      speedKmh: state.playerCar ? Math.abs(state.playerCar.speed) * 3.6 : 0,
      inCar: !!state.playerCar,
      carName: state.playerCar ? state.playerCar.name : '',
      weapon: player.weapon,
      radioOn: audio.radioOn,
      station: audio.stationName,
      player: focusPos,
      marker: stepInfo && (stepInfo.kind === 'reach' || stepInfo.kind === 'grab' || stepInfo.kind === 'jumpGap')
        ? { x: stepInfo.x ?? 472, z: stepInfo.z ?? 0 }
        : null,
    });
  }

  function step(dt) {
    state.time += dt;
    const inCar = !!state.playerCar;
    // --- Input: pause / radio / weapons / steal --------------------------------------
    if (input.consume('KeyP') || input.consume('Escape')) {
      if (state.screen === 'play') {
        state.screen = 'pause';
        showOnly('pause');
      } else if (state.screen === 'pause') {
        state.screen = 'play';
        showOnly(null);
      }
    }
    if (state.screen !== 'play') return;
    if (input.consume('KeyR')) {
      const name = audio.cycleStation();
      hud.showDialogue('RADIO', name);
    }
    if (input.consume('Digit1')) player.weapon = 0;
    if (input.consume('Digit2')) player.weapon = 1;
    if (input.consume('Digit3')) player.weapon = 2;
    if (input.consume('KeyF')) {
      if (inCar) exitCar();
      else {
        const car = nearestStealable();
        if (car) enterCar(car);
      }
    }

    // --- Player or car ------------------------------------------------------------------
    if (state.playerCar) {
      const car = state.playerCar;
      const controls = input.drive();
      const event = driveCar(car, dt, controls, world, car.spec.topSpeedKmh, car.spec.accel);
      if (event === 'splash') {
        // Fished out: back on the causeway approach, car a little worse.
        car.x = 372;
        car.z = 0;
        car.y = WORLD.deckY;
        car.heading = Math.PI / 2;
        car.speed = 0;
        car.vy = 0;
        car.airborne = false;
        car.condition = Math.max(20, car.condition - 15);
        audio.crash();
      } else if (event === 'crash') {
        audio.crash();
      } else if (event === 'jump') {
        hud.showDialogue('KAI', 'Flying!');
      }
      // Speeding past the police adds heat.
      if (Math.abs(car.speed) * 3.6 > 120) {
        for (const pc of police.cars) {
          if (Math.hypot(pc.x - car.x, pc.z - car.z) < 30) {
            police.addHeat(WANTED.speedNearPolice * dt);
            break;
          }
        }
      }
      // The camera rides behind the car.
      state.camYaw = car.heading;
      audio.setSpeed(Math.abs(car.speed) * 3.6);
    } else {
      const w = input.walk();
      stepPlayer(player, dt, { x: w.x, z: w.z }, w.run, input.yaw, world);
      state.camYaw = input.yaw;
      audio.setSpeed(0);
      if (shootQueued) {
        shootQueued = false;
        const result = fireWeapon(player, police, world);
        if (result && result.kind !== 'empty') audio.shot();
        if (result && result.kind === 'hit') {
          hud.showDialogue('KAI', 'Hit.');
        }
      }
    }

    // --- The world around the player -------------------------------------------------------
    traffic.update(dt);
    const focus = state.playerCar || player;
    police.update(dt, player, state.playerCar);
    peds.update(dt, player, police.stars);
    audio.setSiren(police.stars > 0, police.cars.some((c) => Math.hypot(c.x - focus.x, c.z - focus.z) < 40));

    // --- Missions ----------------------------------------------------------------------------
    const ctx = { player, playerCar: state.playerCar, police, world, hasGold: state.hasGold };
    updateMissions(missions, ctx);
    state.hasGold = ctx.hasGold;
    if (missions.justFinished) onMissionComplete();
    if (missions.done && !state.gameOver) {
      state.gameOver = true;
      state.screen = 'victory';
      showOnly('victory');
      say(DIALOGUE.victory);
      pumpDialogue();
      writeSave({ money: state.money, rep: state.rep, mission: MISSIONS.length, hasGold: true });
    }
    if (player.dead && !state.gameOver) {
      state.gameOver = true;
      state.screen = 'busted';
      showOnly('busted');
      audio.busted();
    }
    if (missions.justAdvanced || missions.justFinished) pumpDialogue();

    // --- Marker + HUD ------------------------------------------------------------------------------
    const stepInfo = missions.currentStep;
    if (stepInfo && (stepInfo.kind === 'reach' || stepInfo.kind === 'grab')) {
      world.setMarker(stepInfo.x, stepInfo.z, true);
    } else if (stepInfo && stepInfo.kind === 'jumpGap') {
      world.setMarker(472, 0, true);
    } else {
      world.setMarker(0, 0, false);
    }
    refreshHUD();
  }

  // --- Camera + render ------------------------------------------------------------------
  function frame(dt) {
    const inCar = !!state.playerCar;
    const target = inCar
      ? new THREE.Vector3(state.playerCar.x, state.playerCar.y + 1, state.playerCar.z)
      : new THREE.Vector3(player.x, player.y + 1.2, player.z);
    updateCamera(camera, {
      mode: inCar ? 'chase' : 'foot',
      yaw: state.camYaw,
      pitch: input.pitch,
      target,
      time: state.time,
    }, dt);
    renderer.render(scene, camera);
  }

  // --- The loop -----------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    // The clamp is the game's time budget per frame: at 60 FPS dt is
    // ~0.016 s and the clamp never bites, so real gameplay is untouched.
    // On very slow hardware (software rendering) a frame can take many
    // seconds; a 1.0 s budget lets game time advance 60 fixed steps
    // per frame, so the game stays playable — the car still moves, the
    // heat still decays, input (F to exit a car) and mission checks
    // still land inside real-time timeouts — instead of freezing in
    // real time while the renderer catches up.
    const dt = Math.min((now - last) / 1000, 1.0);
    last = now;
    if (state.screen === 'title') {
      updateCamera(camera, { mode: 'title', time: state.time, target: new THREE.Vector3() }, dt);
      state.time += dt;
      renderer.render(scene, camera);
      return;
    }
    acc += dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    frame(dt);
  }

  // --- Buttons --------------------------------------------------------------------------------
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      audio.start();
      state.screen = 'play';
      showOnly(null);
      // Paint the HUD now, synchronously — the mission panel, stars and
      // radio must read correctly the moment play starts, not after the
      // next (possibly seconds-away) frame.
      refreshHUD();
      pumpDialogue();
    });
  }
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      state.screen = 'play';
      showOnly(null);
    });
  }
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
  const victoryBtn = document.getElementById('victory-btn');
  if (victoryBtn) {
    victoryBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  window.addEventListener('resize', () => resizeRenderer(renderer, camera));

  // --- Shot driver ------------------------------------------------------------------------------
  if (shot && SHOTS[shot]) {
    showOnly(null);
    hud.setVisible(true);
    audio.start();
    // Spawn the police the staging needs, then stage the scene.
    police.heat = 600;
    for (let i = 0; i < 3; i++) police.spawnOne();
    police.ensureHelicopter();
    const G = {
      scene,
      world,
      player,
      heroCar,
      trafficCars: traffic.cars,
      policeCars: police.cars,
      police,
      peds: peds.peds,
      missions,
      heli: police.heliGroup,
      camera,
    };
    const view = SHOTS[shot](G);
    // The staging sets the heat; the star count is derived from it.
    // (In normal play police.update() does this every frame, but a
    // still never steps the simulation.)
    police.stars = police.wantedStars;
    // Light the police bars for the still.
    for (const car of police.cars) {
      for (const m of car.beacon.red || []) if (m.emissive) m.emissiveIntensity = 1.6;
      for (const m of car.beacon.blue || []) if (m.emissive) m.emissiveIntensity = 0.1;
    }
    // The HUD for this shot. The overlook and the chase are Kai on
    // foot; the other two are the hero at speed. On foot, the minimap
    // arrow sits on Kai, not on the hero car.
    const stepInfo = missions.currentStep;
    const onFoot = shot === 'overlook' || shot === 'chase';
    hud.update({
      mission: missions,
      stars: police.stars,
      money: state.money,
      rep: state.rep,
      police: police.cars,
      speedKmh: onFoot ? 0 : Math.abs(heroCar.speed) * 3.6,
      inCar: !onFoot,
      carName: heroCar.name,
      weapon: player.weapon,
      radioOn: true,
      station: audio.stationName,
      player: onFoot
        ? { x: player.x, z: player.z, heading: player.heading }
        : { x: heroCar.x, z: heroCar.z, heading: heroCar.heading },
      marker: stepInfo ? { x: stepInfo.x ?? 472, z: stepInfo.z ?? 0 } : null,
    });
    // Paint twice (shadows + the HUD settle), then signal readiness.
    updateCamera(camera, { mode: 'fixed', pos: view.pos, target: view.target }, 0);
    renderer.render(scene, camera);
    updateCamera(camera, { mode: 'fixed', pos: view.pos, target: view.target }, 0);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }

  // --- Go ----------------------------------------------------------------------------------------
  if (loadingScreen) loadingScreen.style.display = 'none';
  showOnly('title');
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  // The error is already reported on window.__solariaError and on screen.
  console.error(e);
});
