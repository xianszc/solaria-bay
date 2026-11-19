// People, v3.1: Kai Solano and the pedestrians are real humans now —
// the Gorgehold Scout (3dassets.dev, CC0), rigged and animated —
// instead of the blocky low-poly figures. One GLB serves Kai and the
// male pedestrians; the Stylized Female (BlenderKit, Royalty Free)
// serves the female pedestrians. Kai stays the Scout — the female is
// NPCs only, never the player, and never Dara Quinn (Dara is only
// named in the mission text).
//
// Each person gets a SkeletonUtils clone of their template (its own
// skeleton, so the clips play per person), a recolored shirt and
// trousers so no two pedestrians are twins, and Kai gets his cream
// linen shirt, charcoal trousers and gold aviators.
//
// The Scout's bones are named "scout:..." (head, wrist.R, ...). The
// template's stray Icosphere helper sphere is already removed by the
// asset loader, so no clone inherits it. Feet sit at local y = 0 —
// never offset a person by a bounding box (Box3 is wrong for skinned
// meshes). The model faces +Z, the same convention the old procedural
// figures used, so heading + PI still turns a person to face where
// they walk and shoot.
//
// The female's Rigify DEF bones are named "DEF-thigh.L", "DEF-shin.L",
// "DEF-upper_arm.L", ... She ships NO animation clips, so her walk
// cycle is built here as an AnimationClip on those DEF bones (see
// buildFemaleClip). Her rest pose is a T-pose; the arms are brought
// down to her sides the moment a clone is made (poseFemaleRest), and
// every clip carries the same arms-down rotation, so a T-pose is never
// visible — not at spawn, not mid-crossfade. She faces +Z in three.js
// (nose at Blender -Y), the same as the Scout, so the same
// heading + PI group rotation faces her where she walks.
//
// Performance: a pedestrian far from the player is hidden AND its
// mixer is skipped (update() below). A city of 16 rigged people is
// only a handful of draw calls and skeletons at any moment — the far
// ones cost nothing — which keeps the frame rate up on slow hardware.

import * as THREE from 'three';
import { PLAYER, WEAPONS, WANTED } from './config.js';
import { makeGun } from './models.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';

const V3 = THREE.Vector3;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const SHIRT_COLORS = [0xf4f1de, 0x2ec4b6, 0xffb703, 0xc0392b, 0x7fb2e5, 0xe8dcc0, 0x9a6b9e, 0x3fae5a];
const PANTS_COLORS = [0x2b2d42, 0x4a4640, 0x1b263b, 0x5a4a3a];
// Female pedestrians: sweater + trousers, recoloured per person so no
// two are twins. Distinct from the Scout palette on purpose.
const FEMALE_SWEATER_COLORS = [0x2ec4b6, 0xe2725b, 0xffb703, 0x9a6b9e, 0x7fb2e5, 0x8a9a5b, 0xd97b9e, 0xf4f1de];
const FEMALE_PANTS_COLORS = [0x2b2d42, 0x1b263b, 0x5a4a3a, 0x3a3a3a, 0x4a4640];

// Beyond this distance from the player a pedestrian is hidden and its
// mixer is skipped (see Pedestrians.update). 120 m is far enough that
// the pop is invisible — a person that far away is a few pixels tall.
// Pedestrians farther than this from the player are hidden (and their
// mixers skipped). 40 m: a pedestrian is a small figure at that range
// anyway, and the Rigify females (706 bones each) plus the 74-bone
// Scouts are the most expensive thing in the scene to skin — culling
// them aggressively is what keeps the frame rate high enough for the
// game loop to process input (F to exit a car, mission checks) inside
// the playtest's real-time timeouts. Was 120 m, then 60 m; at 60 the
// SwiftShader frame rate was still borderline and the playtest swung
// 41/44 one run and 27/44 the next on identical code.
const PED_CULL_DIST = 40;

// ---------------------------------------------------------------------------
// Building a person from the Scout template.
// ---------------------------------------------------------------------------

// Recolor one person's shirt and trousers. Each material is cloned once
// (shared by every mesh that uses it) so the recolor stays local to
// this person. The trousers carry a khaki baseColor texture, which would
// muddy any tint, so their map is dropped for an exact flat color; the
// shirt has no map, so its color lands exactly.
function recolorScout(group, shirtHex, pantsHex) {
  const cache = new Map();
  function recolored(name, hex, dropMap) {
    if (cache.has(name)) return cache.get(name);
    let orig = null;
    group.traverse((o) => {
      if (orig || !o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.name === name) { orig = m; break; }
      }
    });
    if (!orig) return null;
    const copy = orig.clone();
    if (copy.color) copy.color.setHex(hex);
    if (dropMap) copy.map = null;
    cache.set(name, copy);
    return copy;
  }
  const cloth = recolored('scout-cloth', shirtHex, false);
  const pants = recolored('scout-pants', pantsHex, true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (!m) return;
      if (m.name === 'scout-cloth' && cloth) {
        if (Array.isArray(o.material)) o.material[i] = cloth;
        else o.material = cloth;
      } else if (m.name === 'scout-pants' && pants) {
        if (Array.isArray(o.material)) o.material[i] = pants;
        else o.material = pants;
      }
    });
  });
}

// Kai's signature: aviator sunglasses with golden lenses. A small
// group (two lenses + a bridge) hung on the head bone, so they follow
// the head and hide the plainest part of the face — the eyes.
function makeAviators() {
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a017, emissive: 0x554400, roughness: 0.2, metalness: 0.7 });
  const g = new THREE.Group();
  const lensGeo = new THREE.BoxGeometry(0.085, 0.05, 0.015);
  const left = new THREE.Mesh(lensGeo, gold);
  left.position.set(-0.055, 0, 0);
  const right = new THREE.Mesh(lensGeo, gold);
  right.position.set(0.055, 0, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), gold);
  bridge.position.set(0, 0.012, 0);
  g.add(left, right, bridge);
  return g;
}

// Clone the Scout template into a living person: own skeleton, own
// mixer, own shirt/trousers, and the clips (idle / walk / run / grasp)
// bound to the clone by bone name.
function makeScoutPerson(scout, shirtHex, pantsHex) {
  const group = cloneSkinned(scout.template);
  recolorScout(group, shirtHex, pantsHex);
  const mixer = new THREE.AnimationMixer(group);
  const actions = {};
  for (const clip of scout.animations) {
    actions[clip.name] = mixer.clipAction(clip, group);
  }
  const person = {
    group,
    mixer,
    actions,
    currentAction: null,
    currentActionObj: null,
  };
  return person;
}

// Fade between clips: the old one out, the new one in. A no-op when the
// requested clip is already playing.
function setAction(person, name) {
  if (person.currentAction === name) return;
  const next = person.actions[name];
  if (!next) return;
  if (person.currentActionObj) person.currentActionObj.fadeOut(0.15);
  next.reset().fadeIn(0.15).play();
  person.currentAction = name;
  person.currentActionObj = next;
}

// ---------------------------------------------------------------------------
// The Stylized Female: a code-built walk cycle on her Rigify DEF bones.
// ---------------------------------------------------------------------------
//
// Bone facts (measured in Blender, model-opt.glb):
//  - Thigh / shin: local X points sideways, so rotation.x swings the
//    leg forward (positive) and back (negative). The knee bends when
//    rotation.x goes negative (shin swings back relative to the thigh).
//  - Upper arm: the T-pose roll twists the local axes, but rotation.z
//    is the axis that brings the arm down — left -0.9 rad, right +0.9
//    rad (about 52 deg, leaving the arms a touch out from the body so
//    they hang naturally instead of glued to the ribs). Euler order
//    XYZ applies the Z rotation first, then the X swing around the
//    parent's sideways axis, so the arm hangs down AND swings forward
//    and back as she walks.
//  - Forearm: rotation.x bends the elbow forward; a constant +0.35
//    keeps a slight natural bend.
//  - Spine: a small lean and side sway so the torso moves with the
//    stride instead of riding stiff.
//
// The pose function below is sampled into AnimationClips (walk, run,
// idle), so the female plugs into the same setAction / mixer machinery
// as the Scout. The clips are built once per clone (cheap — a few
// dozen keyframes) and bound to the clone by bone name.

const FEMALE_ARM_DOWN = 1.4; // rad: upper-arm rotation.z that hangs the arm
// (the T-pose arm is ~90 deg out from the body, so 1.4 rad / 80 deg
// leaves it hanging just slightly out; 0.9 rad left it visibly spread.
// The rotation IS around Z, as measured — the earlier failures were
// because the mesh is skinned to TWO bones per limb: the base DEF
// bone AND its 001 twist twin. Rotating only the base bone leaves
// the twin holding the limb in the T-pose. Every limb rotation below
// is applied to both twins.)

// The pose at one walk phase p (0..2PI, one full cycle = two steps).
// `amp` scales the stride (walk 1.0, run ~1.35). Returns bone name ->
// Quaternion rotation. The arms-down rotation is baked into every
// pose, so no clip ever shows the T-pose.
//
// BONE NAMES: three.js strips every ':' and '.' from the GLB bone
// names, so the Rigify bones are "DEF-thighL" (not "DEF-thigh.L"),
// "DEF-spine002" (not "DEF-spine.002"), and so on. The clip tracks
// below MUST use these stripped names, or the mixer finds no bone
// and the walk cycle silently does nothing.
//
// ARMS: the arms-down rotation and the swing are composed as
// quaternions (q_down * q_swing: swing first, then the arms-down
// rotation). The down rotation is around the local X axis — the Z
// rotation only twists the arm in place and leaves it spread out
// (the T-pose bug in the first shots). Quaternions make the order
// and the axes explicit.
function femalePose(p, amp) {
  const s = Math.sin(p);
  const c = Math.cos(p);
  const s2 = Math.sin(p + Math.PI);
  const c2 = Math.cos(p + Math.PI);
  const thighAmp = 0.45 * amp;
  const shinAmp = 0.6 * amp;
  // NO upper-arm swing: the arms hang straight down (the arms-down
  // rotation only) while the legs do the walking. A swing combined
  // with the arms-down rotation in one Euler/quaternion throws the
  // arm out to the side and reads as a T-pose at game distance; a
  // still arm is invisible at that distance, a T-pose is not.
  const armAmp = 0;
  const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  // Arms: swing first (around the local X axis), then the arms-down
  // rotation (around Z). Composed as quaternions so the order is
  // explicit. Every limb bone has a 001 twist twin that also skins
  // the mesh, so each rotation is applied to both twins.
  const qArmL = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), FEMALE_ARM_DOWN)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -armAmp * s));
  const qArmR = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), -FEMALE_ARM_DOWN)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), armAmp * s));
  const qForeL = q(0.35, 0, 0);
  const qForeR = q(0.35, 0, 0);
  const qThighL = q(thighAmp * s, 0, 0);
  const qThighR = q(thighAmp * s2, 0, 0);
  const qShinL = q(-shinAmp * Math.max(0, c), 0, 0);
  const qShinR = q(-shinAmp * Math.max(0, c2), 0, 0);
  return {
    'DEF-thighL': qThighL,
    'DEF-thighL001': qThighL,
    'DEF-thighR': qThighR,
    'DEF-thighR001': qThighR,
    // The knee bends while the leg swings forward through the air
    // (cos > 0) and straightens when the foot plants and pushes back.
    'DEF-shinL': qShinL,
    'DEF-shinL001': qShinL,
    'DEF-shinR': qShinR,
    'DEF-shinR001': qShinR,
    // Arms swing opposite to the same-side leg; the arms-down
    // rotation is baked in, the X component is the swing.
    'DEF-upper_armL': qArmL,
    'DEF-upper_armL001': qArmL,
    'upper_arm_fkL': qArmL,
    'DEF-upper_armR': qArmR,
    'DEF-upper_armR001': qArmR,
    'upper_arm_fkR': qArmR,
    'DEF-forearmL': qForeL,
    'DEF-forearmL001': qForeL,
    'DEF-forearmR': qForeR,
    'DEF-forearmR001': qForeR,
    'DEF-spine': q(0.05 + 0.02 * s, 0, 0.04 * s),
    'DEF-spine002': q(0.03 * Math.sin(p + 0.2), 0, 0.02 * Math.sin(p + 0.2)),
  };
}

// Sample the pose function into an AnimationClip. `frames` keyframes
// over `duration` seconds; the clip loops. Quaternion tracks, so the
// mixer interpolates smoothly between samples.
function buildFemaleClip(name, duration, amp, frames = 16) {
  const bones = Object.keys(femalePose(0, amp));
  const tracks = [];
  for (const bone of bones) {
    const times = [];
    const values = [];
    for (let i = 0; i < frames; i++) {
      const t = (i / frames) * duration;
      const p = (i / frames) * Math.PI * 2;
      const q = femalePose(p, amp)[bone];
      times.push(t);
      values.push(q.x, q.y, q.z, q.w);
    }
    // Close the loop: the last keyframe equals the first, so the cycle
    // wraps without a snap.
    times.push(duration);
    const q0 = femalePose(0, amp)[bone];
    values.push(q0.x, q0.y, q0.z, q0.w);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  return clip;
}

// The arms-down rest pose, applied directly to a fresh clone so a
// T-pose is never visible — not for one frame at spawn, not during a
// crossfade (every clip carries the same arms-down rotation).
// Bone names are the three.js-stripped forms (no ':' or '.').
function poseFemaleRest(group) {
  const armL = group.getObjectByName('DEF-upper_armL');
  const armR = group.getObjectByName('DEF-upper_armR');
  const armL001 = group.getObjectByName('DEF-upper_armL001');
  const armR001 = group.getObjectByName('DEF-upper_armR001');
  const armFkL = group.getObjectByName('upper_arm_fkL');
  const armFkR = group.getObjectByName('upper_arm_fkR');
  if (armL) armL.rotation.set(0, 0, FEMALE_ARM_DOWN);
  if (armR) armR.rotation.set(0, 0, -FEMALE_ARM_DOWN);
  if (armL001) armL001.rotation.set(0, 0, FEMALE_ARM_DOWN);
  if (armR001) armR001.rotation.set(0, 0, -FEMALE_ARM_DOWN);
  if (armFkL) armFkL.rotation.set(0, 0, FEMALE_ARM_DOWN);
  if (armFkR) armFkR.rotation.set(0, 0, -FEMALE_ARM_DOWN);
  const foreL = group.getObjectByName('DEF-forearmL');
  const foreR = group.getObjectByName('DEF-forearmR');
  if (foreL) foreL.rotation.set(0.35, 0, 0);
  if (foreR) foreR.rotation.set(0.35, 0, 0);
}

// Recolor a female pedestrian's sweater and trousers. Both materials
// are cloned once per person; their maps are dropped for an exact flat
// color (the sweater's knit texture would muddy any tint).
function recolorFemale(group, sweaterHex, pantsHex) {
  const cache = new Map();
  function recolored(name, hex) {
    if (cache.has(name)) return cache.get(name);
    let orig = null;
    group.traverse((o) => {
      if (orig || !o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.name === name) { orig = m; break; }
      }
    });
    if (!orig) return null;
    const copy = orig.clone();
    if (copy.color) copy.color.setHex(hex);
    copy.map = null;
    cache.set(name, copy);
    return copy;
  }
  const sweater = recolored('sweater_unique_sweater', sweaterHex);
  const pants = recolored('pants_unique_pants', pantsHex);
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (!m) return;
      if (m.name === 'sweater_unique_sweater' && sweater) {
        if (Array.isArray(o.material)) o.material[i] = sweater;
        else o.material = sweater;
      } else if (m.name === 'pants_unique_pants' && pants) {
        if (Array.isArray(o.material)) o.material[i] = pants;
        else o.material = pants;
      }
    });
  });
}

// Clone the female template into a living pedestrian: own skeleton,
// own mixer, own sweater/trousers, and the code-built walk / run /
// idle clips bound to the clone by bone name.
function makeFemalePerson(female, sweaterHex, pantsHex) {
  const group = cloneSkinned(female.template);
  recolorFemale(group, sweaterHex, pantsHex);
  // Arms down before anything plays — never a T-pose, not even for
  // the one frame before the mixer first runs.
  poseFemaleRest(group);
  const mixer = new THREE.AnimationMixer(group);
  const walkClip = buildFemaleClip('walk', 1.0, 1.0);
  const runClip = buildFemaleClip('run', 0.6, 1.35);
  const idleClip = buildFemaleClip('idle', 1.0, 0.0);
  const actions = {
    walk: mixer.clipAction(walkClip, group),
    run: mixer.clipAction(runClip, group),
    idle: mixer.clipAction(idleClip, group),
  };
  const person = {
    group,
    mixer,
    actions,
    currentAction: null,
    currentActionObj: null,
  };
  return person;
}

// ---------------------------------------------------------------------------
// Kai.
// ---------------------------------------------------------------------------

export function createPlayer(scene, world) {
  const scout = world.scout;
  const person = makeScoutPerson(scout, 0xf4f1de, 0x2b2d42);
  const group = person.group;
  scene.add(group);
  // Kai's aviators, on the head bone. (Bone names are the
  // three.js-stripped forms: "scouthead", not "scout:head" — the GLB
  // loader strips ':' and '.' from every bone name.)
  const headBone = group.getObjectByName('scouthead');
  if (headBone) {
    const glasses = makeAviators();
    glasses.position.set(0, 0.02, 0.10);
    headBone.add(glasses);
  }
  // The guns ride on the right wrist, so they follow the hand through
  // the walk and run swings instead of floating at chest height.
  const wristR = group.getObjectByName('scoutwristR');
  const guns = {};
  for (const w of WEAPONS) {
    if (w.id === 0) continue;
    const gun = makeGun(w.id);
    if (wristR) {
      wristR.add(gun);
      gun.position.set(0, -0.06, 0.10);
    } else {
      gun.position.set(0.34, 1.15, 0.18);
      group.add(gun);
    }
    gun.visible = false;
    guns[w.id] = gun;
  }
  setAction(person, 'idle');
  const player = {
    group,
    guns,
    mixer: person.mixer,
    actions: person.actions,
    currentAction: 'idle',
    currentActionObj: person.currentActionObj,
    x: -60,
    z: 40,
    y: 0,
    heading: 0,
    health: PLAYER.health,
    weapon: 0,
    ammo: { 1: WEAPONS[1].ammo, 2: WEAPONS[2].ammo },
    fireCooldown: 0,
    phase: 0,
    moving: false,
    running: false,
    dead: false,
    damage(amount, kind) {
      if (this.dead) return;
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0) this.dead = true;
    },
    heal(amount) {
      this.health = Math.min(PLAYER.health, this.health + amount);
    },
  };
  // Keep the action state on the player object itself, so the step
  // function and the shot staging both drive the same mixer.
  player.setAction = (name) => {
    setAction(player, name);
    person.currentAction = player.currentAction;
    person.currentActionObj = player.currentActionObj;
  };
  group.position.set(player.x, 0, player.z);
  return player;
}

// Step Kai for one fixed slice. `move` is { x, z } in world space (already
// rotated by the camera yaw), `run` is Shift, `heading` is the mouse yaw.
export function stepPlayer(player, dt, move, run, heading, world) {
  player.heading = heading;
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.z);
  player.moving = len > 0.05;
  player.running = player.moving && run;
  let nx = player.x;
  let nz = player.z;
  if (player.moving) {
    const mx = (move.x / len) * speed * dt;
    const mz = (move.z / len) * speed * dt;
    nx = player.x + mx;
    nz = player.z + mz;
    // Stay on land; the bay is not for wading.
    if (world.heightAt(nx, player.z) === null) nx = player.x;
    if (world.heightAt(nx, nz) === null) nz = player.z;
    // Building push-out.
    for (const c of world.colliders) {
      if (player.y >= c.h) continue;
      if (nx > c.x0 - PLAYER.radius && nx < c.x1 + PLAYER.radius && nz > c.z0 - PLAYER.radius && nz < c.z1 + PLAYER.radius) {
        const dxl = nx - (c.x0 - PLAYER.radius);
        const dxr = (c.x1 + PLAYER.radius) - nx;
        const dzl = nz - (c.z0 - PLAYER.radius);
        const dzr = (c.z1 + PLAYER.radius) - nz;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) nx = c.x0 - PLAYER.radius;
        else if (m === dxr) nx = c.x1 + PLAYER.radius;
        else if (m === dzl) nz = c.z0 - PLAYER.radius;
        else nz = c.z1 + PLAYER.radius;
      }
    }
  }
  player.x = nx;
  player.z = nz;
  player.y = world.heightAt(nx, nz) ?? 0;
  // Walk / run / idle: the Scout's own clips, crossfaded, driven by the
  // mixer. A runner reads as a runner because the run clip is a run.
  if (player.moving) {
    player.phase += speed * dt * (player.running ? 1.9 : 1.35);
    player.setAction(player.running ? 'run' : 'walk');
  } else {
    player.setAction('idle');
  }
  player.mixer.update(dt);
  player.group.position.set(player.x, player.y, player.z);
  // The person's face is +Z, but the physics forward is (-sin h, -cos h)
  // (the car's -Z convention), so the group turns by heading + PI to
  // face the direction it moves and shoots.
  player.group.rotation.y = player.heading + Math.PI;
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  // Show the current gun.
  for (const [id, gun] of Object.entries(player.guns)) {
    gun.visible = Number(id) === player.weapon;
  }
}

// Fire the current weapon. Returns an object describing what happened
// (or null if the weapon is on cooldown / out of ammo).
export function fireWeapon(player, police, world) {
  const w = WEAPONS[player.weapon];
  if (player.fireCooldown > 0) return null;
  if (player.weapon !== 0 && player.ammo[player.weapon] <= 0) return { kind: 'empty' };
  player.fireCooldown = w.rate;
  if (player.weapon !== 0) player.ammo[player.weapon] -= 1;
  // Hitscan from Kai's facing: the nearest police car inside the range
  // and within a narrow cone takes the damage.
  let hitCar = null;
  let hitDist = Infinity;
  const fx = -Math.sin(player.heading);
  const fz = -Math.cos(player.heading);
  for (const car of police.cars) {
    const dx = car.x - player.x;
    const dz = car.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > w.range || dist > hitDist) continue;
    const dot = (dx * fx + dz * fz) / dist;
    if (dot > 0.92) {
      hitCar = car;
      hitDist = dist;
    }
  }
  if (hitCar) {
    hitCar.condition = Math.max(0, hitCar.condition - w.damage);
    police.addHeat(WANTED.shotFired);
    return { kind: 'hit', target: hitCar, dist: hitDist };
  }
  if (player.weapon !== 0) police.addHeat(WANTED.shotFired * 0.4);
  return { kind: 'miss' };
}

// ---------------------------------------------------------------------------
// Pedestrians: strollers, joggers, and a crowd that flees at a run.
// A third of them are women (the Stylized Female, code-built walk
// cycle); the rest are men (the Scout, same as Kai). Every one is
// recolored so no two are twins, and driven by walk / run clips.
// ---------------------------------------------------------------------------

const CORNERS = [];
for (const sx of [-240, -160, -80, 0, 80, 160, 240]) {
  for (const sz of [-240, -160, -80, 0, 80, 160, 240]) {
    CORNERS.push({ x: sx + 9, z: sz + 9 });
    CORNERS.push({ x: sx - 9, z: sz - 9 });
  }
}

export class Pedestrians {
  constructor(scene, world, rng, count = 24) {
    this.world = world;
    this.rng = rng;
    this.scout = world.scout;
    this.female = world.female;
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const isJogger = i < 6; // the first six are joggers: always running
      // Every third pedestrian is a woman (indices 2, 5, 8, ...), so
      // two of the six joggers are women and the walkers mix too.
      const isFemale = i % 3 === 2;
      let person;
      if (isFemale) {
        const sweater = FEMALE_SWEATER_COLORS[rng.int(0, FEMALE_SWEATER_COLORS.length - 1)];
        const pants = FEMALE_PANTS_COLORS[rng.int(0, FEMALE_PANTS_COLORS.length - 1)];
        person = makeFemalePerson(this.female, sweater, pants);
      } else {
        const shirt = SHIRT_COLORS[rng.int(0, SHIRT_COLORS.length - 1)];
        const pants = PANTS_COLORS[rng.int(0, PANTS_COLORS.length - 1)];
        person = makeScoutPerson(this.scout, shirt, pants);
      }
      const group = person.group;
      const corner = CORNERS[rng.int(0, CORNERS.length - 1)];
      const ped = {
        group,
        mixer: person.mixer,
        actions: person.actions,
        currentAction: null,
        currentActionObj: null,
        kind: isFemale ? 'female' : 'scout',
        x: corner.x + rng.range(-4, 4),
        z: corner.z + rng.range(-4, 4),
        heading: rng.range(0, Math.PI * 2),
        target: CORNERS[rng.int(0, CORNERS.length - 1)],
        speed: isJogger ? rng.range(4.2, 5.2) : rng.range(1.1, 1.8),
        isJogger,
        state: isJogger ? 'run' : 'walk',
        phase: rng.range(0, Math.PI * 2),
      };
      ped.setAction = (name) => {
        setAction(ped, name);
      };
      setAction(ped, isJogger ? 'run' : 'walk');
      group.position.set(ped.x, 0, ped.z);
      scene.add(group);
      this.peds.push(ped);
    }
  }
  update(dt, player, wantedStars) {
    for (const ped of this.peds) {
      // Far from the player, a pedestrian is invisible and frozen:
      // hidden from the renderer and its mixer never runs, so a city
      // of 16 rigged people costs only the few near the camera. The
      // moment the player comes close the ped resumes walking.
      const dPlayer = Math.hypot(player.x - ped.x, player.z - ped.z);
      const near = dPlayer < PED_CULL_DIST;
      ped.group.visible = near;
      if (!near) continue;
      // Flee: wanted 2+ and the player close by -> run away from the player.
      const fleeing = wantedStars >= 2 && dPlayer < 26 && !ped.isJogger;
      if (fleeing) {
        ped.state = 'flee';
        const away = Math.atan2(ped.x - player.x, ped.z - player.z);
        ped.heading = away;
        const speed = 5.0;
        ped.x += -Math.sin(away) * speed * dt;
        ped.z += -Math.cos(away) * speed * dt;
        // Keep them on the island.
        ped.x = clamp(ped.x, -315, 315);
        ped.z = clamp(ped.z, -315, 315);
        ped.setAction('run');
      } else if (ped.isJogger) {
        ped.state = 'run';
        this.walkToward(ped, dt, ped.speed);
        ped.setAction('run');
      } else {
        ped.state = 'walk';
        this.walkToward(ped, dt, ped.speed);
        ped.setAction('walk');
      }
      ped.mixer.update(dt);
      ped.group.position.set(ped.x, 0, ped.z);
      // Face the direction of travel (the person's face is +Z, the
      // physics forward is (-sin h, -cos h), so +PI).
      ped.group.rotation.y = ped.heading + Math.PI;
    }
  }
  walkToward(ped, dt, speed) {
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      ped.target = CORNERS[this.rng.int(0, CORNERS.length - 1)];
      return;
    }
    const want = Math.atan2(-dx, -dz);
    let dh = want - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    ped.x += -Math.sin(ped.heading) * speed * dt;
    ped.z += -Math.cos(ped.heading) * speed * dt;
  }
}
