// The screenshot scenes behind ?shot=drawbridge|boulevard|overlook|pursuit.
// Each one arranges the real game — real cars, real police, real wanted
// stars, the real sun — into the composition the brief asks for. The page
// paints the staged scene twice and then sets window.__shotReady, which
// the shot driver waits for. Nothing here is composited or borrowed:
// every pixel comes from the game's own code.
//
// The cover (1-drawbridge) has a hard requirement: the helicopter MUST
// be visible in the frame. It is staged explicitly, hovering above and
// to the left of the airborne hero, and the camera is aimed so the
// hero, the heli, the Twin Prism Towers and the sun disc all sit in
// the same frame.

import * as THREE from 'three';

// Put a car somewhere and make it look like it belongs there.
function placeCar(car, x, z, heading, speedKmh = 0) {
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speedKmh / 3.6;
  car.y = 0;
  car.vy = 0;
  car.airborne = false;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
}

function placePerson(ped, x, z, heading, state) {
  ped.x = x;
  ped.z = z;
  ped.heading = heading;
  ped.state = state;
  ped.group.position.set(x, 0, z);
  // Face the direction of travel (face is +Z, forward is -sin/-cos).
  ped.group.rotation.y = heading + Math.PI;
}

// The four stagings. Each returns { pos, target } for the fixed camera.
export const SHOTS = {
  drawbridge(G) {
    // The hero, airborne over the gap, nose up, mid-flight, heading
    // east across the gap (heading -PI/2 is east: forward is -sin/-cos).
    // It sits just past the leaf tip (x=456), clearly in the air over
    // the 30 m gap, above the deck.
    placeCar(G.heroCar, 460, 0, -Math.PI / 2, 150);
    G.heroCar.y = 19;
    G.heroCar.vy = 6;
    G.heroCar.airborne = true;
    G.heroCar.group.position.set(460, 19, 0);
    G.heroCar.group.rotation.y = -Math.PI / 2;
    G.heroCar.group.rotation.z = -0.12; // nose up, climbing
    // Two police in the open: one on the far deck (foreground), one on
    // the near deck beside the leaf, so neither hides behind the steel.
    placeCar(G.policeCars[0], 472, -4, -Math.PI / 2, 0);
    placeCar(G.policeCars[1], 392, 15, -Math.PI / 2, 0);
    // THE HELICOPTER: hovering above the gap, left of the hero, big in frame.
    G.heli.visible = true;
    G.heli.position.set(424, 32, -22);
    G.heli.userData.rotor.rotation.y = 1.2;
    // A couple of running pedestrians on the causeway approach, fleeing
    // west back toward the island.
    placePerson(G.peds[0], 380, -8, Math.PI / 2, 'run');
    placePerson(G.peds[1], 386, 8, Math.PI / 2, 'run');
    G.police.heat = 620; // three stars on the HUD
    G.missions.index = 3;
    G.missions.step = 1;
    G.world.setMarker(472, 0, true);
    return {
      pos: new THREE.Vector3(500, 16, 20),
      target: new THREE.Vector3(430, 14, -2),
    };
  },

  boulevard(G) {
    // The hero cruising down Palm Boulevard into the sunset, a police
    // car on its tail, palms and the towers ahead. West is heading
    // PI/2 (forward is -sin/-cos, so PI/2 points at -x, the sunset).
    // The hero sits close to the camera so it leads the frame.
    placeCar(G.heroCar, 78, 0, Math.PI / 2, 95);
    placeCar(G.policeCars[0], 46, -4, Math.PI / 2, 95);
    placeCar(G.policeCars[1], 88, 5, Math.PI / 2, 80);
    placeCar(G.policeCars[2], 60, -6, Math.PI / 2, 88);
    // Traffic ahead, in the same lane as the hero.
    placeCar(G.trafficCars[0], 130, 0, Math.PI / 2, 60);
    placeCar(G.trafficCars[1], -30, 4, Math.PI / 2, 55);
    // Joggers on the sidewalk, mid-stride.
    placePerson(G.peds[0], 40, 9, Math.PI / 2, 'run');
    placePerson(G.peds[1], 48, -9, Math.PI / 2, 'run');
    placePerson(G.peds[2], 90, 9, Math.PI / 2, 'walk');
    G.heli.visible = false;
    G.police.heat = 260; // one star
    G.missions.index = 2;
    G.missions.step = 0;
    G.world.setMarker(-238, 0, true);
    return {
      pos: new THREE.Vector3(108, 3.5, 8),
      target: new THREE.Vector3(-40, 3, -2),
    };
  },

  overlook(G) {
    // Kai on the garage roof, pistol raised, the skyline and the road
    // below him. The sun is low behind the towers. Kai stands close to
    // the camera in profile, facing north, pistol aimed north, so the
    // raised arm and pistol read from the side with the towers behind.
    G.player.x = 158;
    G.player.z = 130;
    G.player.y = 12;
    G.player.heading = 0; // facing north, in profile to the camera
    G.player.weapon = 1;
    G.player.group.position.set(158, 12, 130);
    G.player.group.rotation.y = 0 + Math.PI;
    // Aim the pistol: right arm forward.
    const L = G.player.group.userData.limbs;
    L.armR.rotation.x = -1.35;
    L.armL.rotation.x = -0.4;
    // A runner crossing the roof, and cars parked on the roof so it
    // reads as a parking deck, not an empty slab. Roof cars sit at
    // y=12 (the roof), not y=0 — placeCar leaves them at ground level.
    placePerson(G.peds[0], 168, 114, Math.PI / 2, 'run');
    G.peds[0].group.position.y = 12;
    placeCar(G.trafficCars[0], 150, 112, Math.PI / 2, 0);
    G.trafficCars[0].y = 12;
    G.trafficCars[0].group.position.y = 12;
    placeCar(G.trafficCars[1], 170, 128, -Math.PI / 2, 0);
    G.trafficCars[1].y = 12;
    G.trafficCars[1].group.position.y = 12;
    // The hero and a police car on the street below the garage.
    placeCar(G.heroCar, 150, 92, Math.PI, 0);
    placeCar(G.policeCars[0], 190, 96, -Math.PI / 2, 0);
    G.heli.visible = false;
    G.police.heat = 420; // two stars
    G.missions.index = 5;
    G.missions.step = 0;
    G.world.setMarker(668, 40, true);
    return {
      pos: new THREE.Vector3(163, 14.5, 132),
      target: new THREE.Vector3(-120, 38, 70),
    };
  },

  pursuit(G) {
    // The hero flat out on Palm Boulevard, driving west straight into
    // the low sun, police flanking both sides, the helicopter high
    // above. West is heading PI/2 (forward is -sin/-cos).
    placeCar(G.heroCar, 40, 0, Math.PI / 2, 180);
    placeCar(G.policeCars[0], 28, -7, Math.PI / 2, 175);
    placeCar(G.policeCars[1], 32, 7, Math.PI / 2, 170);
    placeCar(G.policeCars[2], 62, -5, Math.PI / 2, 185);
    // The helicopter, high and ahead, in the top of the frame.
    G.heli.visible = true;
    G.heli.position.set(-10, 42, -28);
    G.heli.userData.rotor.rotation.y = 2.4;
    // Traffic scattering ahead, and a jogger on the sidewalk.
    placeCar(G.trafficCars[0], 100, 4, Math.PI / 2, 70);
    placeCar(G.trafficCars[1], 110, -5, Math.PI / 2, 65);
    placePerson(G.peds[0], 60, 9, Math.PI / 2, 'run');
    G.police.heat = 640; // three stars
    // Tower Run: the boulevard drive to the towers, which is where
    // this chase is happening.
    G.missions.index = 2;
    G.missions.step = 0;
    G.world.setMarker(-238, 0, true);
    return {
      pos: new THREE.Vector3(80, 5, 2),
      target: new THREE.Vector3(-30, 5, -4),
    };
  },
};

export const SHOT_NAMES = ['drawbridge', 'boulevard', 'overlook', 'pursuit'];
