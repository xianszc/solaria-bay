// The screenshot scenes behind ?shot=drawbridge|boulevard|overlook|pursuit.
// Each one arranges the real game — real cars, real police, real wanted
// stars, the real sun — into the composition the brief asks for. The page
// then paints it twice and sets window.__shotReady. Nothing here is a
// mock: the same world, the same HUD, the same physics.
//
// Orientation note (the v1 bug): a car flies EAST across the gap, so its
// heading is -PI/2 — forward (-sin, -cos) is (+1, 0). v1 staged the
// cover with heading +PI/2, which flies WEST, opposite the mission.
import * as THREE from 'three';

// Police only spawn while the game loop runs, and a staged shot never
// steps the loop — so each scene spawns the interceptors it needs by
// running the real police manager forward, then moves them to their
// marks. The cars are real: they chase, ram and blink their light bars.
// The staging player is a copy parked at the city centre, so the
// interceptors chase that point instead of converging on Kai and
// hurting him while the scene is arranged.
function spawnPoliceForShot(game, count) {
  const police = game.actors.police;
  game.player.wantedStars = game.wantedStars;
  const stagingPlayer = { ...game.player, pos: new THREE.Vector3(0, 0, 0) };
  for (let i = 0; i < 600 && police.cars.length < count; i += 1) {
    police.update(0.016, game.world, stagingPlayer, null, () => {});
  }
}

// The hero car in the air over the drawbridge gap, nose up, sun directly
// behind it, Twin Prism Towers behind that.
function stageDrawbridge(game) {
  const g = game;
  g.heat = 800;
  g.wantedStars = 4;
  g.player.wantedStars = 4;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(466, 20, -1);
  hero.heading = -Math.PI / 2; // flying EAST across the gap, toward the camera
  hero.speed = 26;
  hero.speedKmh = 94;
  hero.airborne = true;
  hero.vy = 4;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.set(-0.1, hero.heading, 0.04);
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  // The helicopter hangs over the gap, rotor turning, in frame above the car.
  g.actors.heli.update(0.016, new THREE.Vector3(456, 0, 0), true, 1.2);
  g.actors.heli.mesh.position.set(430, 42, -22);
  const police = g.actors.police.cars;
  // The interceptors are right under the car on the near side of the gap,
  // close enough to read (8 m per the HUD) and centred in the frame —
  // v1's spots sat at the frame edges and one was cut off entirely.
  const spots = [[456, 6, -5, -Math.PI / 2], [456, 6, 5, -Math.PI / 2]];
  spots.forEach(([x, y, z, h], i) => {
    const car = police[i];
    if (!car) return;
    car.pos.set(x, y, z);
    car.heading = h;
    car.speed = 12;
    car.speedKmh = 43;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = h;
  });
  // The marker sits on the far deck, clear of the car, so its beam does
  // not cut through the hero.
  g.world.setMarker(478, 4);
  g.dialog = 'DARA: The bridge is up — hit it flat out, Kai. Do not lift.';
  g.dialogSpeaker = 'DQ';
  g.missions.skipTo(3);
  g.missions.setMessage('MISSION 4: THE JUMP — Cross the raised drawbridge', 8);
  return {
    shotCam: {
      // Close and high on the north-east side, looking west: the lime car
      // big in the frame in side-rear 3/4, the sun disc right behind it,
      // the Twin Towers behind that, and the leaf's asphalt deck (not its
      // tan underside) visible beneath the car. High enough that the near
      // deck reads as deck, not a black void at the frame's bottom edge.
      pos: new THREE.Vector3(476, 23, -12),
      lookAt: new THREE.Vector3(460, 15, -1),
    },
  };
}

// A tight chase cam behind the lime GT as it drifts around a palm-lined
// corner on Palm Boulevard — long shadows, glass glinting on the right.
function stageBoulevard(game) {
  const g = game;
  g.heat = 420;
  g.wantedStars = 3;
  g.player.wantedStars = 3;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(40, 0, -6);
  hero.heading = Math.PI / 2; // heading west along the boulevard
  hero.speed = 24;
  hero.speedKmh = 86;
  hero.steer = 0.55;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.y = hero.heading;
  hero.mesh.rotation.z = -0.05;
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  const police = g.actors.police.cars;
  // The interceptors are AHEAD of the hero (west of it), inside the
  // chase camera's frame — v1 put them east of the camera, so the HUD
  // claimed a pursuit no shot ever showed.
  if (police[0]) {
    police[0].pos.set(28, 0, -10);
    police[0].heading = Math.PI / 2;
    police[0].speed = 20;
    police[0].speedKmh = 72;
    police[0].mesh.position.copy(police[0].pos);
    police[0].mesh.rotation.y = police[0].heading;
  }
  if (police[1]) {
    police[1].pos.set(26, 0, 0);
    police[1].heading = Math.PI / 2;
    police[1].speed = 18;
    police[1].speedKmh = 65;
    police[1].mesh.position.copy(police[1].pos);
    police[1].mesh.rotation.y = police[1].heading;
  }
  g.actors.heli.update(0.016, new THREE.Vector3(40, 0, 0), true, 2.0);
  g.actors.heli.mesh.position.set(16, 50, -34);
  g.dialog = 'DARA: Boulevard is clear past the palms. Keep it sideways, Kai.';
  g.dialogSpeaker = 'DQ';
  g.missions.skipTo(2);
  g.missions.setMessage('MISSION 3: TOWER RUN — Drive to the Twin Prism Towers', 8);
  return {
    shotCam: {
      // A TIGHT chase cam just behind the GT: the car fills the lower
      // frame, the interceptors ahead of it in frame, the sun and the
      // towers ahead of them. v1's camera was ~19 m back and the car
      // read as a toy.
      pos: new THREE.Vector3(48, 2.6, -2),
      lookAt: new THREE.Vector3(36, 1.0, -6),
    },
  };
}

// Kai on the parking garage roof, over his shoulder, pistol aimed west
// at the roadblock below — the whole CBD skyline and the apricot horizon
// behind him.
function stageOverlook(game) {
  const g = game;
  g.heat = 600;
  g.wantedStars = 3;
  g.player.wantedStars = 3;
  spawnPoliceForShot(g, 2);
  g.currentCar = null;
  // Kai stands on the GROUND at the garage gate (not the roof): from a
  // rooftop camera the roof deck occludes the street below, so the
  // roadblock was invisible in every roof staging. On the ground, Kai,
  // the roadblock and the skyline are all on one sight line.
  g.player.pos.set(128, 0, 116);
  g.player.heading = Math.PI / 2; // facing west, toward the towers
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.y = g.player.heading;
  g.player.parts.armR.rotation.x = 1.35; // pistol arm raised forward (see characters.js: positive = forward)
  g.player.aiming = true; // hold the aim pose: the loop keeps running
  // Shot mode does not step the simulation, so animateWalk never runs
  // here — set the pistol and the support arm directly, or the gun stays
  // invisible and the left arm hangs (the v1.1 overlook bug).
  g.player.parts.pistol.visible = true;
  g.player.parts.armL.rotation.x = 0.7;
  g.weapon = 1;
  const police = g.actors.police.cars;
  // The roadblock sits on the street just west of the gate, ~16 m from
  // Kai and straddling his line of sight, so BOTH interceptors are in
  // frame and big enough to read as police cars.
  const spots = [[112, 104, Math.PI / 2], [112, 128, Math.PI / 2]];
  spots.forEach(([x, z, h], i) => {
    const car = police[i];
    if (!car) return;
    car.pos.set(x, 0, z);
    car.heading = h;
    car.speed = 0;
    car.speedKmh = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = h;
  });
  g.dialog = 'KAI: Two units at the garage gate. I can see the whole bay from here.';
  g.dialogSpeaker = 'KS';
  g.missions.skipTo(4);
  g.missions.setMessage('MISSION 5: GOLDEN HOUR — Lose the cops on Solaria Key', 8);
  return {
    shotCam: {
      // Close over the shoulder at street level, ~7 m north-east of Kai
      // (his pistol side): Kai big in the right third with the pistol arm
      // in profile, the roadblock visible ahead in the centre, and the
      // skyline + apricot horizon behind. Ground level keeps all four
      // elements on one sight line (the roof occluded the street in every
      // earlier staging).
      pos: new THREE.Vector3(134, 2.4, 111),
      lookAt: new THREE.Vector3(112, 1.5, 114),
    },
  };
}

// A front-facing camera looking back at the hero car, two interceptors
// closing in behind it, sun flare across the top, palms along the verge.
function stagePursuit(game) {
  const g = game;
  g.heat = 940;
  g.wantedStars = 5;
  g.player.wantedStars = 5;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(-40, 0, 2);
  hero.heading = -Math.PI / 2; // heading east, toward the camera
  hero.speed = 30;
  hero.speedKmh = 108;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.y = hero.heading;
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  const police = g.actors.police.cars;
  // The interceptors are west of the hero, chasing east behind it,
  // close enough to read as pursuers instead of distant toys.
  const spots = [[-52, -4, -Math.PI / 2], [-54, 7, -Math.PI / 2]];
  spots.forEach(([x, z, h], i) => {
    const car = police[i];
    if (!car) return;
    car.pos.set(x, 0, z);
    car.heading = h;
    car.speed = 28;
    car.speedKmh = 101;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = h;
  });
  g.actors.heli.update(0.016, new THREE.Vector3(-40, 0, 0), true, 3.1);
  g.actors.heli.mesh.position.set(-30, 40, -20);
  g.dialog = 'DARA: Five stars, Kai. The whole SPD is behind you — do not stop.';
  g.dialogSpeaker = 'DQ';
  g.missions.skipTo(5);
  g.missions.setMessage('MISSION 6: SOLARIA HEIST — Steal the gold case and escape', 8);
  return {
    shotCam: {
      // From the middle of the road ahead of the GT, looking west: the
      // hero's nose big in frame, both interceptors flanking it close
      // behind, the low sun flaring over the top. Closer than v1 (34 m
      // back) so the cars read instead of sitting small in an empty road.
      pos: new THREE.Vector3(-22, 3.4, 0),
      lookAt: new THREE.Vector3(-42, 1.5, 2),
    },
  };
}

const STAGES = {
  drawbridge: stageDrawbridge,
  boulevard: stageBoulevard,
  overlook: stageOverlook,
  pursuit: stagePursuit,
};

export function stageShot(name, game) {
  const stage = STAGES[name] || STAGES.drawbridge;
  return stage(game);
}
