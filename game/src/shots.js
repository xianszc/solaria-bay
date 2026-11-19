// The screenshot scenes behind ?shot=chase|boulevard|overlook|pursuit.
// Each one arranges the real game — real cars, real police, real wanted
// stars, the real sun — into the composition the brief asks for. The page
// paints the staged scene twice and then sets window.__shotReady, which
// the shot driver waits for. Nothing here is composited or borrowed:
// every pixel comes from the game's own code.
//
// The cover (1-chase) is a police chase on foot, shot from the FRONT:
// Kai runs toward the camera, his face (Scout + gold aviators) lit by
// the low western sun behind the camera, while SPD cars chase him from
// behind and panicked pedestrians run on both sidewalks. The camera is
// close and low, so Kai fills the frame — an intimate, dramatic shot,
// not a far wide one. The background is the boulevard stretching east,
// dense with traffic and mid-rise buildings. The chase is staged
// mid-block (x=60, between the x=0 and x=80 cross streets) so no zebra
// crossing fills the foreground.
//
// v3.1: Kai and the pedestrians are the Scout / Stylized Female (skinned
// rigs), so a staged person is posed through the mixer's clips and the
// arm bones — never through the procedural limb pivots v3 used. Shot mode
// never steps the simulation, so a pose set here is exactly what the
// camera sees. Bone names are the three.js-stripped forms (no ':' or '.').

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
  // Pose the pedestrian mid-stride (or mid-walk) so the still reads as
  // a person in motion, not a statue: play the clip and advance the
  // mixer to a mid-cycle pose. Each pedestrian carries a random phase,
  // so no two share the same stride. Shot mode never steps the mixer
  // again, so this pose is what the camera sees.
  if (ped.setAction && ped.mixer) {
    ped.setAction(state === 'run' ? 'run' : 'walk');
    ped.mixer.update(0.3 + (ped.phase % 0.7));
  }
}

// Pose Kai mid-stride for a foot-chase shot: he runs, so the run clip
// plays and the mixer is advanced to a mid-stride pose. The mixer never
// runs again in shot mode, so this pose is what the camera sees.
function poseKaiRunning(player, x, z, heading) {
  player.x = x;
  player.z = z;
  player.y = 0;
  player.heading = heading;
  player.weapon = 0; // fleeing on foot — no gun out, just running
  player.group.position.set(x, 0, z);
  player.group.rotation.y = heading + Math.PI;
  if (player.setAction && player.mixer) {
    player.setAction('run');
    player.mixer.update(0.35);
  }
}

// The four stagings. Each returns { pos, target } for the fixed camera.
export const SHOTS = {
  chase(G) {
    // THE COVER. Kai runs WEST down Palm Boulevard, straight toward the
    // camera, his face lit by the low western sun behind the camera.
    // Two SPD cars chase him from behind (east), their light bars lit,
    // and panicked pedestrians run on both sidewalks. The camera is
    // close and low, just off his path, so Kai fills the frame and the
    // chase reads in a single image: his face, the police behind him,
    // the crowd, the dense street. Staged mid-block (x=60) so the
    // foreground is asphalt, not a zebra crossing.
    //
    // West is heading PI/2 (forward is -sin/-cos, so PI/2 points at
    // -x, into the sunset). Kai runs west, toward the camera.
    poseKaiRunning(G.player, 60, 0, Math.PI / 2);
    // The pursuers, close behind him on the road, light bars flashing.
    // Offset to either side of Kai so they read beside him, not
    // hidden directly behind him.
    placeCar(G.policeCars[0], 66, -3.5, Math.PI / 2, 55);
    placeCar(G.policeCars[1], 70, 4, Math.PI / 2, 50);
    // Panicked pedestrians, running west on both sidewalks — a man and
    // a woman on the far (north) side, two men on the near side.
    placePerson(G.peds[0], 56, -7.5, Math.PI / 2, 'run');
    placePerson(G.peds[1], 58, 7.5, Math.PI / 2, 'run');
    placePerson(G.peds[2], 64, -7.5, Math.PI / 2, 'run');
    placePerson(G.peds[3], 66, 7.5, Math.PI / 2, 'run');
    // Dense traffic behind the chase, filling the boulevard east.
    placeCar(G.trafficCars[0], 90, 2, Math.PI / 2, 40);
    placeCar(G.trafficCars[1], 100, -3, Math.PI / 2, 35);
    placeCar(G.trafficCars[2], 85, 5, Math.PI / 2, 30);
    // The lime GT, abandoned at the kerb — Kai ditched it to run.
    placeCar(G.heroCar, 78, -6, Math.PI / 2, 0);
    G.heli.visible = false;
    G.police.heat = 620; // three stars on the HUD
    // GOLDEN HOUR: lose the cops. The marker points to the Key, where
    // he has to go quiet — far east, out of this frame.
    G.missions.index = 4;
    G.missions.step = 0;
    G.world.setMarker(650, 0, true);
    // Close and low, just off Kai's path to the south-west, looking
    // east-north-east at him: his face front-lit, the police looming
    // behind him, the street and the city filling the background.
    // The camera is ~5 m from Kai, so he fills ~a third of the
    // frame height and his face reads.
    return {
      pos: new THREE.Vector3(55, 1.7, 2),
      target: new THREE.Vector3(61, 1.5, -0.2),
    };
  },

  boulevard(G) {
    // The hero cruising down Palm Boulevard into the sunset, a police
    // car on its tail, palms and the towers ahead. West is heading
    // PI/2 (forward is -sin/-cos, so PI/2 points at -x, the sunset).
    // The hero sits close to the camera so it leads the frame.
    placeCar(G.heroCar, 95, 0, Math.PI / 2, 95);
    placeCar(G.policeCars[0], 80, -4, Math.PI / 2, 95);
    placeCar(G.policeCars[1], 95, 6, Math.PI / 2, 80);
    placeCar(G.policeCars[2], 70, -6, Math.PI / 2, 88);
    // Traffic ahead, in the same lane as the hero.
    placeCar(G.trafficCars[0], 140, 0, Math.PI / 2, 60);
    placeCar(G.trafficCars[1], -20, 4, Math.PI / 2, 55);
    // Joggers on the sidewalk, mid-stride.
    placePerson(G.peds[0], 60, 9, Math.PI / 2, 'run');
    placePerson(G.peds[1], 70, -9, Math.PI / 2, 'run');
    placePerson(G.peds[2], 100, 9, Math.PI / 2, 'walk');
    G.heli.visible = false;
    G.police.heat = 260; // one star
    G.missions.index = 2;
    G.missions.step = 0;
    G.world.setMarker(-238, 0, true);
    return {
      pos: new THREE.Vector3(112, 3.5, 7),
      target: new THREE.Vector3(-40, 3, -2),
    };
  },

  overlook(G) {
    // Kai on the street below the garage, pistol raised, the skyline
    // and the towers behind him. The sun is low behind the towers.
    // Kai stands in profile, facing north, pistol aimed north, so the
    // raised arm and pistol read from the side with the towers behind.
    // Street level (not the garage roof): the roof parapet is a solid
    // slab that buries anyone standing on it, and the roof sight lines
    // kept hiding Kai. On the street he is unmistakable.
    // The camera sits east of Kai at his height, looking west across
    // him at the towers — he is centred, large, and in profile.
    // Pose via poseKaiRunning (proven to render Kai — the manual
    // positioning + setAction path left him invisible in this shot),
    // then switch to the pistol and override the arms for the aim.
    poseKaiRunning(G.player, 150, 100, 0);
    G.player.heading = 0; // facing north, in profile to the camera
    G.player.weapon = 1;
    G.player.group.rotation.y = 0 + Math.PI;
    // Aim the pistol: raise Kai's right arm forward. The Scout is a
    // skinned rig, so the arm is posed by rotating the upper-arm bone
    // (the mixer never runs in shot mode, so this pose is what the
    // camera sees). Bone names are the three.js-stripped forms
    // ("scoutupperarm01R", not "scout:upperarm01.R").
    const upperArmR = G.player.group.getObjectByName('scoutupperarm01R');
    if (upperArmR) upperArmR.rotation.x = -1.35;
    const upperArmL = G.player.group.getObjectByName('scoutupperarm01L');
    if (upperArmL) upperArmL.rotation.x = -0.4;
    // A runner crossing the street behind Kai, and the hero and a
    // police car parked at the kerb so the street reads as a game
    // moment, not an empty road.
    placePerson(G.peds[0], 140, 108, Math.PI / 2, 'run');
    placeCar(G.heroCar, 150, 92, Math.PI, 0);
    placeCar(G.policeCars[0], 190, 96, -Math.PI / 2, 0);
    G.heli.visible = false;
    G.police.heat = 420; // two stars
    G.missions.index = 5;
    G.missions.step = 0;
    G.world.setMarker(668, 40, true);
    return {
      pos: new THREE.Vector3(165, 2.5, 108),
      target: new THREE.Vector3(100, 4, 92),
    };
  },

  pursuit(G) {
    // The hero flat out on Palm Boulevard, driving west straight into
    // the low sun, police flanking both sides, the helicopter high
    // above. West is heading PI/2 (forward is -sin/-cos).
    placeCar(G.heroCar, 62, 0, Math.PI / 2, 180);
    placeCar(G.policeCars[0], 48, -7, Math.PI / 2, 175);
    placeCar(G.policeCars[1], 52, 7, Math.PI / 2, 170);
    placeCar(G.policeCars[2], 74, -5, Math.PI / 2, 185);
    // The helicopter, high and ahead, in the top of the frame.
    G.heli.visible = true;
    G.heli.position.set(-10, 42, -28);
    G.heli.userData.rotor.rotation.y = 2.4;
    // Traffic scattering ahead, and a jogger on the sidewalk — a woman
    // (peds[2] is a female jogger), mid-stride, so the female walk
    // cycle reads in this shot as well as the boulevard.
    placeCar(G.trafficCars[0], 110, 4, Math.PI / 2, 70);
    placeCar(G.trafficCars[1], 120, -5, Math.PI / 2, 65);
    placePerson(G.peds[2], 70, 9, Math.PI / 2, 'run');
    G.police.heat = 640; // three stars
    // Tower Run: the boulevard drive to the towers, which is where
    // this chase is happening.
    G.missions.index = 2;
    G.missions.step = 0;
    G.world.setMarker(-238, 0, true);
    return {
      pos: new THREE.Vector3(78, 5, 3),
      target: new THREE.Vector3(-30, 5, -4),
    };
  },
};

export const SHOT_NAMES = ['chase', 'boulevard', 'overlook', 'pursuit'];
