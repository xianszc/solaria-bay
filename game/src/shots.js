// The screenshot scenes behind ?shot=drawbridge|boulevard|overlook|pursuit.
// Each one arranges the real game — real cars, real police, real wanted
// stars, the real sun — into the composition the brief asks for, then the
// page paints it twice and sets window.__shotReady. Nothing here is a
// mock: the same world, the same HUD, the same physics.
import * as THREE from 'three';

// Police only spawn while the game loop runs, and a staged shot never
// steps the loop — so each scene spawns the interceptors it needs by
// running the real police manager forward, then moves them to their
// marks. The cars are real: they chase, ram and blink their light bars.
function spawnPoliceForShot(game, count) {
  const police = game.actors.police;
  game.player.wantedStars = game.wantedStars;
  for (let i = 0; i < 600 && police.cars.length < count; i += 1) {
    police.update(0.016, game.world, game.player, null, () => {});
  }
}

// Put the hero car in the air over the drawbridge gap, nose up, sun
// directly behind it, Twin Prism Towers behind that.
function stageDrawbridge(game) {
  const g = game;
  g.heat = 800;
  g.wantedStars = 4;
  g.player.wantedStars = 4;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(466, 20, -1);
  hero.heading = Math.PI / 2 + 0.12; // flying east, slightly angled
  hero.speed = 26;
  hero.speedKmh = 94;
  hero.airborne = true;
  hero.vy = 4;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.set(-0.1, hero.heading, 0.04);
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  // The helicopter hangs over the gap, rotor spinning, in frame above
  // the car.
  g.actors.heli.update(0.016, new THREE.Vector3(456, 0, 0), true, 1.2);
  g.actors.heli.mesh.position.set(430, 42, -22);
  const police = g.actors.police.cars;
  const spots = [[472, 6, -6, Math.PI / 2], [470, 6, 2, Math.PI / 2]];
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
      // East of the car, just above deck level, looking west: the lime
      // car big in the frame with the sun disc right behind it and the
      // Twin Towers behind that; the deck and both interceptors below.
      pos: new THREE.Vector3(484, 8, -12),
      lookAt: new THREE.Vector3(460, 17, 0),
    },
  };
}

// Chase cam tight behind the lime GT drifting around a palm-lined corner
// on Palm Boulevard, long shadows, glass glints on the right.
function stageBoulevard(game) {
  const g = game;
  g.heat = 420;
  g.wantedStars = 3;
  g.player.wantedStars = 3;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(40, 0, -6);
  hero.heading = Math.PI * 0.94; // heading west along the boulevard
  hero.speed = 24;
  hero.speedKmh = 86;
  hero.steer = 0.55;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.y = hero.heading;
  hero.mesh.rotation.z = -0.05;
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  const police = g.actors.police.cars;
  if (police[0]) {
    police[0].pos.set(26, 0, -11);
    police[0].heading = Math.PI * 0.94;
    police[0].speed = 20;
    police[0].speedKmh = 72;
    police[0].mesh.position.copy(police[0].pos);
    police[0].mesh.rotation.y = police[0].heading;
  }
  if (police[1]) {
    police[1].pos.set(30, 0, 3);
    police[1].heading = Math.PI * 0.9;
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
      // Tight chase cam just behind the GT: the car fills the lower
      // frame, the sun and the towers ahead of it.
      pos: new THREE.Vector3(53, 3.0, -1),
      lookAt: new THREE.Vector3(34, 1.2, -6),
    },
  };
}

// Over the shoulder of Kai on the parking garage roof, pistol aimed
// west toward the roadblock below, the whole CBD skyline and apricot
// horizon behind him.
function stageOverlook(game) {
  const g = game;
  g.heat = 600;
  g.wantedStars = 3;
  g.player.wantedStars = 3;
  spawnPoliceForShot(g, 2);
  g.currentCar = null;
  g.player.pos.set(160, 12, 104);
  g.player.heading = Math.PI / 2; // facing west, toward the towers
  g.player.mesh.position.copy(g.player.pos);
  g.player.mesh.rotation.y = g.player.heading;
  g.player.parts.armR.rotation.x = -1.35; // pistol arm raised
  g.player.aiming = true; // hold the aim pose: the loop keeps running
  g.weapon = 1;
  const police = g.actors.police.cars;
  const spots = [[60, 118, Math.PI / 2], [56, 132, Math.PI / 2]];
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
      // Close over the shoulder and higher, so the street below clears
      // the parapet: Kai big in the right third, the skyline and apricot
      // horizon behind him, the roadblock visible below.
      pos: new THREE.Vector3(168, 20, 98),
      lookAt: new THREE.Vector3(140, 6, 112),
    },
  };
}

// Front-facing camera looking back at the hero car, two interceptors
// closing in, sun flare across the top, palms along the verge.
function stagePursuit(game) {
  const g = game;
  g.heat = 940;
  g.wantedStars = 5;
  g.player.wantedStars = 5;
  spawnPoliceForShot(g, 2);
  const hero = g.actors.heroCar;
  hero.pos.set(-40, 0, 2);
  hero.heading = Math.PI; // heading west, camera ahead of it
  hero.speed = 30;
  hero.speedKmh = 108;
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.y = hero.heading;
  g.currentCar = hero;
  g.player.pos.copy(hero.pos);
  const police = g.actors.police.cars;
  const spots = [[-34, -7, Math.PI], [-36, 10, Math.PI - 0.25]];
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
  g.actors.heli.mesh.position.set(-70, 20, -10);
  g.dialog = 'DARA: Five stars, Kai. The whole SPD is behind you — do not stop.';
  g.dialogSpeaker = 'DQ';
  g.missions.skipTo(5);
  g.missions.setMessage('MISSION 6: SOLARIA HEIST — Steal the gold case and escape', 8);
  return {
    shotCam: {
      // Chase view from the middle of the road, behind and above the GT:
      // the hero big in frame, both interceptors flanking it close, the
      // low sun ahead.
      pos: new THREE.Vector3(-20, 4.5, 0),
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
