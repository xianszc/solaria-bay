// People: Kai Solano, the player character, and the pedestrians who fill
// the sidewalks. Everyone is built from boxes with realistic proportions —
// a real person, not a blocky placeholder — with swinging limbs while
// they walk and a flee response when the wanted level climbs.
import * as THREE from 'three';
import { PLAYER } from './config.js';

// A low-poly human: legs, torso, arms, head, hair wedge and sunglasses.
// Parts are named so the walk animation can swing them.
export function buildHuman({ shirt = 0xf4f1de, trousers = 0x2b2d42, skin = 0xc98e6b, hair = 0x1a1a1a, helmet = null }) {
  const person = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const trouserMat = new THREE.MeshLambertMaterial({ color: trousers });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: hair });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), trouserMat);
  legL.position.set(-0.14, 0.39, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.34), shirtMat);
  torso.position.y = 1.12;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), helmet ? shirtMat : skinMat);
  armL.position.set(-0.4, 1.14, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  // A small pistol in the right hand, hidden unless the player is aiming.
  // It is a child of the arm so it follows the aim pose.
  const pistol = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.1), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.34), new THREE.MeshLambertMaterial({ color: 0x2b2f38 }));
  barrel.position.set(0, -0.03, -0.18);
  pistol.add(grip, barrel);
  pistol.position.set(0, -0.62, -0.05);
  pistol.visible = false;
  armR.add(pistol);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.y = 1.66;
  // Hair wedge: a clean side-part / ponytail slab on top of the head.
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hairMat);
  hairMesh.position.set(0, 1.88, -0.02);
  // Aviator sunglasses: a thin dark slab across the face.
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.06), new THREE.MeshPhongMaterial({ color: 0xd9a441, shininess: 160, specular: 0xffffff }));
  shades.position.set(0, 1.68, 0.17);
  person.add(legL, legR, torso, armL, armR, head, hairMesh, shades);
  if (helmet) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: helmet }));
    helm.position.y = 1.72;
    person.add(helm);
    person.remove(hairMesh);
    person.remove(shades);
  }
  person.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  // Pivot the limbs at the shoulder/hip for the walk swing.
  legL.geometry.translate(0, -0.39, 0);
  legL.position.y = 0.78;
  legR.geometry.translate(0, -0.39, 0);
  legR.position.y = 0.78;
  armL.geometry.translate(0, -0.31, 0);
  armL.position.y = 1.45;
  armR.geometry.translate(0, -0.31, 0);
  armR.position.y = 1.45;
  return { group: person, legL, legR, armL, armR, pistol };
}

export function createPlayer(scene) {
  const { group, legL, legR, armL, armR, pistol } = buildHuman({ shirt: 0xf4f1de, trousers: 0x2b2d42, skin: 0xc98e6b, hair: 0x222222 });
  // Kai's cream linen shirt, rolled sleeves, charcoal trousers, gold aviators.
  scene.add(group);
  const player = {
    pos: new THREE.Vector3(-60, 0, 40),
    heading: Math.PI,
    health: PLAYER.health,
    mesh: group,
    parts: { legL, legR, armL, armR, pistol },
    walkPhase: 0,
    moving: false,
    aiming: false,
    wantedStars: 0,
  };
  group.position.copy(player.pos);
  return player;
}

// Walk the player in camera space. Returns true when the player moved.
export function stepPlayer(player, move, cameraYaw, dt, world) {
  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const forward = move.forward;
  const strafe = move.strafe;
  if (forward === 0 && strafe === 0) {
    player.moving = false;
    animateWalk(player, 0, dt);
    return false;
  }
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  // Camera forward on the ground plane is (-sin(yaw), -cos(yaw)).
  let dx = (-sin * forward + -cos * strafe);
  let dz = (-cos * forward + sin * strafe);
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const nextX = player.pos.x + dx * speed * dt;
  const nextZ = player.pos.z + dz * speed * dt;
  // Stay out of the water and out of buildings.
  const ground = world.heightAt(nextX, nextZ);
  if (ground !== null && ground < 8) {
    let blocked = false;
    for (const c of world.colliders) {
      if (nextX > c.x0 - PLAYER.radius && nextX < c.x1 + PLAYER.radius && nextZ > c.z0 - PLAYER.radius && nextZ < c.z1 + PLAYER.radius) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      player.pos.x = nextX;
      player.pos.z = nextZ;
      player.pos.y = ground;
    }
  }
  player.heading = Math.atan2(-dx, -dz);
  player.moving = true;
  animateWalk(player, speed, dt);
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  return true;
}

function animateWalk(player, speed, dt) {
  const { legL, legR, armL, armR, pistol } = player.parts;
  if (pistol) pistol.visible = !!player.aiming;
  // Aiming holds the pistol arm up no matter how many frames pass — the
  // staged overlook shot depends on this, since the loop keeps running.
  if (player.aiming) {
    legL.rotation.x *= 0.8;
    legR.rotation.x *= 0.8;
    armR.rotation.x = -1.35;
    armL.rotation.x = -0.55;
    return;
  }
  if (speed === 0) {
    legL.rotation.x *= 0.8;
    legR.rotation.x *= 0.8;
    armL.rotation.x *= 0.8;
    armR.rotation.x *= 0.8;
    return;
  }
  player.walkPhase += dt * speed * 1.35;
  const swing = Math.sin(player.walkPhase) * 0.55;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing * 0.8;
  armR.rotation.x = swing * 0.8;
}

// --- Pedestrians ---------------------------------------------------------------
const PED_OUTFITS = [
  { shirt: 0xe88a7a, trousers: 0x2b2d42, skin: 0x8a5a3b, hair: 0x1a1a1a },
  { shirt: 0x3fae9c, trousers: 0x5a4632, skin: 0xe8b88a, hair: 0x4a2f1a },
  { shirt: 0x8a9bb0, trousers: 0x1b263b, skin: 0xc98e6b, hair: 0x777777 },
  { shirt: 0xd9a441, trousers: 0x2b2d42, skin: 0x6b4f2a, hair: 0x1a1a1a },
  { shirt: 0xf4f1de, trousers: 0x7a6a9b, skin: 0xe8b88a, hair: 0x2a1a0a },
];

export function createPedestrians(scene, world, random) {
  const peds = [];
  for (let i = 0; i < 22; i += 1) {
    const outfit = random.pick(PED_OUTFITS);
    const { group, legL, legR, armL, armR } = buildHuman(outfit);
    const x = random.range(-280, 280);
    const z = random.range(-280, 280);
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      pos: new THREE.Vector3(x, 0, z),
      heading: random.range(0, Math.PI * 2),
      mesh: group,
      parts: { legL, legR, armL, armR },
      walkPhase: random.range(0, 6),
      speed: random.range(1.2, 2.4),
      target: null,
      fleeing: false,
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, world, playerPos, wantedStars) {
  for (const ped of peds) {
    const toPlayer = Math.hypot(playerPos.x - ped.pos.x, playerPos.z - ped.pos.z);
    ped.fleeing = wantedStars >= 2 && toPlayer < 26;
    if (!ped.target || Math.hypot(ped.target[0] - ped.pos.x, ped.target[1] - ped.pos.z) < 4) {
      if (ped.fleeing) {
        const away = Math.atan2(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
        ped.target = [ped.pos.x + Math.sin(away) * 40, ped.pos.z + Math.cos(away) * 40];
      } else {
        // Wander to a nearby street corner.
        const streets = [-240, -160, -80, 0, 80, 160, 240];
        ped.target = [ped.pos.x + (Math.random() - 0.5) * 90, streets[Math.floor(Math.random() * streets.length)]];
      }
    }
    const dx = ped.target[0] - ped.pos.x;
    const dz = ped.target[1] - ped.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
    const nx = ped.pos.x + (dx / dist) * speed * dt;
    const nz = ped.pos.z + (dz / dist) * speed * dt;
    const ground = world.heightAt(nx, nz);
    if (ground !== null && ground < 8) {
      ped.pos.x = nx;
      ped.pos.z = nz;
      ped.pos.y = ground;
    }
    ped.heading = Math.atan2(dx, dz);
    ped.walkPhase += dt * speed * 1.5;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.parts.legL.rotation.x = swing;
    ped.parts.legR.rotation.x = -swing;
    ped.parts.armL.rotation.x = -swing * 0.7;
    ped.parts.armR.rotation.x = swing * 0.7;
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.heading;
  }
}
