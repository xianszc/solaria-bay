// People: Kai Solano, the player character, and the pedestrians who
// fill the sidewalks. Everyone is jointed, so arms and legs swing —
// and so a runner reads as a runner: faster feet, a bigger swing, and
// a forward lean. Most pedestrians stroll; a few are joggers who always
// run; and when the heat is on and the player is close, the crowd flees
// at a run. Kai fights on foot with fists, a pistol and an SMG.

import * as THREE from 'three';
import { PLAYER, WEAPONS, WANTED } from './config.js';
import { makePerson, animatePerson, makeGun } from './models.js';

const V3 = THREE.Vector3;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const SHIRT_COLORS = [0xf4f1de, 0x2ec4b6, 0xffb703, 0xc0392b, 0x7fb2e5, 0xe8dcc0, 0x9a6b9e, 0x3fae5a];
const PANTS_COLORS = [0x2b2d42, 0x4a4640, 0x1b263b, 0x5a4a3a];
const SKIN_COLORS = [0xd9a066, 0xc98a5a, 0xa06a42, 0xe8b88a];

// ---------------------------------------------------------------------------
// Kai.
// ---------------------------------------------------------------------------

export function createPlayer(scene, world) {
  const group = makePerson({ shirt: 0xf4f1de, pants: 0x2b2d42, skin: 0xd9a066, hair: 0x2b2d42, sunglasses: true });
  scene.add(group);
  // The guns, one in each hand's reach; only the current one shows.
  const guns = {};
  for (const w of WEAPONS) {
    if (w.id === 0) continue;
    const gun = makeGun(w.id);
    gun.position.set(0.34, 1.15, 0.18);
    gun.visible = false;
    group.add(gun);
    guns[w.id] = gun;
  }
  const player = {
    group,
    guns,
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
  // Walk / run animation: the phase advances with distance, the swing and
  // the lean grow when running.
  if (player.moving) {
    player.phase += speed * dt * (player.running ? 1.9 : 1.35);
  }
  const amp = player.running ? 0.95 : 0.5;
  const lean = player.running ? 0.16 : 0.03;
  animatePerson(player.group, player.phase, amp, lean);
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
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const isJogger = i < 6; // the first six are joggers: always running
      const palette = {
        shirt: SHIRT_COLORS[rng.int(0, SHIRT_COLORS.length - 1)],
        pants: PANTS_COLORS[rng.int(0, PANTS_COLORS.length - 1)],
        skin: SKIN_COLORS[rng.int(0, SKIN_COLORS.length - 1)],
        hair: rng.pick([0x2b2d42, 0x4a2c1a, 0x8a8a8a, 0x1a1a1a]),
      };
      const group = makePerson(palette);
      const corner = CORNERS[rng.int(0, CORNERS.length - 1)];
      const ped = {
        group,
        x: corner.x + rng.range(-4, 4),
        z: corner.z + rng.range(-4, 4),
        heading: rng.range(0, Math.PI * 2),
        target: CORNERS[rng.int(0, CORNERS.length - 1)],
        speed: isJogger ? rng.range(4.2, 5.2) : rng.range(1.1, 1.8),
        isJogger,
        state: isJogger ? 'run' : 'walk',
        phase: rng.range(0, Math.PI * 2),
      };
      group.position.set(ped.x, 0, ped.z);
      scene.add(group);
      this.peds.push(ped);
    }
  }
  update(dt, player, wantedStars) {
    for (const ped of this.peds) {
      // Flee: wanted 2+ and the player close by -> run away from the player.
      const dPlayer = Math.hypot(player.x - ped.x, player.z - ped.z);
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
        ped.phase += speed * dt * 1.9;
        animatePerson(ped.group, ped.phase, 0.95, 0.18);
      } else if (ped.isJogger) {
        ped.state = 'run';
        this.walkToward(ped, dt, ped.speed, 0.95, 0.16);
      } else {
        ped.state = 'walk';
        this.walkToward(ped, dt, ped.speed, 0.5, 0.03);
      }
      ped.group.position.set(ped.x, 0, ped.z);
      // Face the direction of travel (the person's face is +Z, the
      // physics forward is (-sin h, -cos h), so +PI).
      ped.group.rotation.y = ped.heading + Math.PI;
    }
  }
  walkToward(ped, dt, speed, amp, lean) {
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
    ped.phase += speed * dt * 1.35;
    animatePerson(ped.group, ped.phase, amp, lean);
  }
}
