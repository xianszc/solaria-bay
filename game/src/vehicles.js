// Vehicles: the hero GT, traffic, SPD interceptors, and the police
// helicopter. Every car is now a real GLB — the lime Aventador hero,
// a fleet of traffic cars, a white patrol car and a repainted SUV for
// the police — with separate wheels that spin and steer, and light bars
// that blink. The physics are arcade: real steering, acceleration,
// braking, nitro, and the drawbridge jump (hit the raised leaf fast
// enough and the car flies the 30 m gap). Wanted heat turns into stars,
// stars turn into interceptors, and three stars brings the helicopter.

import * as THREE from 'three';
import { WORLD, HERO_CAR, TRAFFIC_CAR, POLICE_CAR, WANTED } from './config.js';
import { makeHelicopter } from './models.js';

const V3 = THREE.Vector3;
const KMH_TO_MS = 1 / 3.6;

// The forward direction for a heading: the car's front is local -Z,
// so a heading of 0 points north (-z) and the forward vector is
// (-sin h, -cos h).
function forwardOf(heading) {
  return { x: -Math.sin(heading), z: -Math.cos(heading) };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// One car: a cloned GLB wrapped in a group, with physics state.
// ---------------------------------------------------------------------------

export function makeCar(assets, key, x, z, heading) {
  const spec = assets.vehicles[key];
  const inner = spec.template.clone();
  inner.rotation.y = spec.forwardY;
  inner.position.y = spec.lift;
  const group = new THREE.Group();
  group.add(inner);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  // Wheels, re-found in this clone by name.
  const wheels = [];
  inner.traverse((o) => {
    if (typeof o.name === 'string' && spec.wheelNames.includes(o.name)) {
      wheels.push(o);
    }
  });
  const frontWheels = wheels.filter((w) => /front|fl|fr/i.test(w.name));
  return {
    key,
    spec,
    group,
    inner,
    wheels,
    frontWheels,
    beacon: spec.beacon,
    name: spec.name,
    x, z,
    y: 0,
    vy: 0,
    airborne: false,
    heading,
    speed: 0, // m/s, forward positive
    steer: 0,
    condition: 100,
    nitro: false,
  };
}

function syncCarVisual(car) {
  car.group.position.set(car.x, car.y, car.z);
  car.group.rotation.y = car.heading;
  // Spin the wheels; steer the front ones a little.
  const spin = (car.speed * (1 / 60)) / 0.35;
  for (const w of car.wheels) {
    w.rotation.x += spin;
  }
  for (const w of car.frontWheels) {
    w.rotation.y = car.steer * 0.4;
  }
}

// Push a point out of every collider it is inside (and below the top of).
// Returns true if a collision happened.
function collidePoint(world, x, y, z, radius) {
  for (const c of world.colliders) {
    if (y >= c.h) continue;
    if (x > c.x0 - radius && x < c.x1 + radius && z > c.z0 - radius && z < c.z1 + radius) {
      // Push out along the smallest penetration axis.
      const dxl = x - (c.x0 - radius);
      const dxr = (c.x1 + radius) - x;
      const dzl = z - (c.z0 - radius);
      const dzr = (c.z1 + radius) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) return { x: c.x0 - radius, z };
      if (m === dxr) return { x: c.x1 + radius, z };
      if (m === dzl) return { x, z: c.z0 - radius };
      return { x, z: c.z1 + radius };
    }
  }
  return null;
}

// Drive one car for one fixed step. `controls` is { throttle, steer, nitro }
// for the player, or an AI-produced equivalent for police/traffic.
// Returns an event string ('splash' | 'jump' | 'crash' | null).
export function driveCar(car, dt, controls, world, topSpeedKmh, accel) {
  const fwd = forwardOf(car.heading);
  const speedKmh = Math.abs(car.speed) * 3.6;
  // Steering authority fades at a standstill and at very high speed.
  const authority = clamp(speedKmh / 24, 0, 1) * (1 - clamp((speedKmh - 130) / 120, 0, 0.55));
  car.steer = clamp(controls.steer, -1, 1);
  car.heading += car.steer * 1.9 * authority * dt * (car.speed >= 0 ? 1 : -1);
  // Acceleration / braking / reverse.
  const top = topSpeedKmh * KMH_TO_MS * (controls.nitro ? 1.55 : 1);
  const reverseTop = 48 * KMH_TO_MS;
  if (controls.throttle > 0) {
    car.speed = Math.min(car.speed + accel * controls.throttle * dt, top);
  } else if (controls.throttle < 0) {
    if (car.speed > 0.5) car.speed = Math.max(car.speed + 42 * controls.throttle * dt, 0);
    else car.speed = Math.max(car.speed + 14 * controls.throttle * dt, -reverseTop);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.nitro = !!controls.nitro;

  // Move.
  const nx = car.x + fwd.x * car.speed * dt;
  const nz = car.z + fwd.z * car.speed * dt;

  // Building collision: push out, scrape the paint, lose speed.
  const hit = collidePoint(world, nx, car.y, nz, 1.1);
  let event = null;
  if (hit) {
    car.x = hit.x;
    car.z = hit.z;
    if (Math.abs(car.speed) > 3) {
      car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.9);
      event = 'crash';
    }
    car.speed *= 0.45;
  } else {
    car.x = nx;
    car.z = nz;
  }

  // Ground: the leaf, the deck, the island, or water.
  const ground = world.heightAt(car.x, car.z);
  if (car.airborne) {
    car.vy -= 22 * dt;
    car.y += car.vy * dt;
    if (ground !== null && car.y <= ground) {
      car.y = ground;
      car.vy = 0;
      car.airborne = false;
    } else if (car.y < WORLD.waterY + 0.5) {
      event = 'splash';
    }
  } else if (ground === null) {
    // Drove off the edge — into the bay.
    event = 'splash';
  } else {
    // Leaving the leaf tip fast enough launches the car.
    const onLeafTip = car.x > WORLD.bridgeLeafX + 24 && car.x < WORLD.bridgeGapX1 && Math.abs(car.z) <= 12;
    const leafY = WORLD.deckY + (car.x - WORLD.bridgeLeafX) * Math.tan(WORLD.bridgeLeafAngle);
    if (onLeafTip && car.y >= leafY - 0.6 && car.speed * 3.6 > 52) {
      car.airborne = true;
      car.vy = car.speed * Math.sin(WORLD.bridgeLeafAngle) * 0.9;
      car.y = leafY;
      event = 'jump';
    } else {
      car.y = ground;
    }
  }

  syncCarVisual(car);
  return event;
}

// ---------------------------------------------------------------------------
// Traffic: cars looping rectangular street circuits, easing off for the
// car ahead so they don't pile up.
// ---------------------------------------------------------------------------

function makeCircuit(rng, half) {
  // A rectangle on the street grid: pick a random half-size.
  const h = half;
  return [
    { x: -h, z: -h }, { x: h, z: -h }, { x: h, z: h }, { x: -h, z: h },
  ];
}

export class Traffic {
  constructor(scene, assets, world, rng) {
    this.world = world;
    this.rng = rng;
    this.cars = [];
    const keys = ['taxi', 'sedan', 'hatchback', 'pickup', 'pickupOld', 'van', 'tow', 'bus'];
    for (let i = 0; i < TRAFFIC_CAR.count; i++) {
      const key = keys[i % keys.length];
      const half = rng.pick([80, 160, 240]);
      const circuit = makeCircuit(rng, half);
      const start = circuit[rng.int(0, 3)];
      const next = circuit[(rng.int(0, 3) + 1) % 4];
      const heading = Math.atan2(-(next.x - start.x), -(next.z - start.z));
      const car = makeCar(assets, key, start.x + rng.range(-4, 4), start.z + rng.range(-4, 4), heading);
      car.circuit = circuit;
      car.wp = 0;
      car.cruise = rng.range(0.55, 0.85);
      scene.add(car.group);
      this.cars.push(car);
    }
  }
  update(dt) {
    for (const car of this.cars) {
      const target = car.circuit[car.wp];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) {
        car.wp = (car.wp + 1) % car.circuit.length;
        continue;
      }
      const wantHeading = Math.atan2(-dx, -dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.6, -1, 1);
      // Ease off if the car ahead (any car) is close in front.
      let throttle = car.cruise;
      const fwd = forwardOf(car.heading);
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const ahead = ox * fwd.x + oz * fwd.z;
        const side = Math.abs(ox * fwd.z - oz * fwd.x);
        if (ahead > 0 && ahead < 9 && side < 2.4) {
          throttle = 0;
          break;
        }
      }
      driveCar(car, dt, { throttle, steer, nitro: false }, this.world, car.spec.topSpeedKmh, car.spec.accel);
    }
  }
}

// ---------------------------------------------------------------------------
// Police + wanted + helicopter.
// ---------------------------------------------------------------------------

export class Police {
  constructor(scene, assets, world, rng) {
    this.scene = scene;
    this.assets = assets;
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.heat = 0;
    this.stars = 0;
    this.quietTime = 0;
    this.blink = 0;
    this.heli = null;
    this.heliGroup = null;
  }
  addHeat(amount) {
    this.heat = Math.min(this.heat + amount, WANTED.heatPerStar * WANTED.maxStars);
    this.quietTime = 0;
  }
  get wantedStars() {
    return Math.min(WANTED.maxStars, Math.floor(this.heat / WANTED.heatPerStar));
  }
  // How many interceptors the current heat calls for.
  desiredCount() {
    return Math.min(2 + this.wantedStars, 7);
  }
  spawnOne() {
    const key = this.rng.chance(0.6) ? 'policePatrol' : 'policeSuv';
    // Spawn at an island edge, roughly toward the player.
    const edge = this.rng.pick([
      { x: -300, z: this.rng.range(-280, 280) },
      { x: 300, z: this.rng.range(-280, 280) },
      { x: this.rng.range(-280, 280), z: -300 },
      { x: this.rng.range(-280, 280), z: 300 },
    ]);
    const car = makeCar(this.assets, key, edge.x, edge.z, this.rng.range(0, Math.PI * 2));
    car.condition = POLICE_CAR.condition;
    this.scene.add(car.group);
    this.cars.push(car);
    return car;
  }
  removeCar(car) {
    this.scene.remove(car.group);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
  ensureHelicopter() {
    if (this.heliGroup) return;
    this.heliGroup = makeHelicopter();
    this.heliGroup.visible = false;
    this.scene.add(this.heliGroup);
    // A soft pool of light under the heli.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6e5, transparent: true, opacity: 0.14, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.1;
    this.heliGroup.add(pool);
    this.heliGroup.userData.pool = pool;
  }
  update(dt, player, playerCar) {
    // Stars from heat; heat decays after a quiet spell with no police near.
    this.stars = this.wantedStars;
    let nearestPolice = Infinity;
    for (const c of this.cars) {
      nearestPolice = Math.min(nearestPolice, Math.hypot(c.x - player.x, c.z - player.z));
    }
    if (this.stars > 0 && nearestPolice > 55) {
      this.quietTime += dt;
      if (this.quietTime > WANTED.decayDelay) {
        this.heat = Math.max(0, this.heat - WANTED.decayPerSecond * dt);
      }
    } else {
      this.quietTime = 0;
    }
    // Match the interceptor count to the heat.
    const want = this.stars > 0 ? this.desiredCount() : 0;
    while (this.cars.length < want) this.spawnOne();
    while (this.cars.length > want) this.removeCar(this.cars[this.cars.length - 1]);

    // Chase + ram.
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    for (const car of [...this.cars]) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dx, -dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.8, -1, 1);
      const throttle = dist > 7 ? 1 : 0.55;
      const event = driveCar(car, dt, { throttle, steer, nitro: false }, this.world, car.spec.topSpeedKmh, car.spec.accel);
      if (event === 'splash') {
        this.removeCar(car);
        continue;
      }
      // Ramming the player: close + fast = damage + heat.
      if (dist < 3.4 && Math.abs(car.speed) > 4) {
        player.damage(POLICE_CAR.ramDamage * dt * 3, 'ram');
        this.addHeat(WANTED.ramPolice * dt * 0.5);
      }
      // A wrecked interceptor is towed away after 6 s.
      if (car.condition <= 0) {
        car.wreckTimer = (car.wreckTimer || 0) + dt;
        car.group.visible = car.wreckTimer < 6 ? Math.floor(car.wreckTimer * 6) % 2 === 0 : false;
        if (car.wreckTimer >= 6) this.removeCar(car);
      }
    }

    // Light bars blink red/blue.
    this.blink += dt;
    const phase = Math.floor(this.blink * 4) % 2;
    for (const car of this.cars) {
      for (const m of car.beacon.red || []) {
        if (m.emissive) m.emissiveIntensity = phase === 0 ? 1.6 : 0.08;
      }
      for (const m of car.beacon.blue || []) {
        if (m.emissive) m.emissiveIntensity = phase === 1 ? 1.6 : 0.08;
      }
    }

    // Helicopter at 3+ stars.
    this.ensureHelicopter();
    const heli = this.heliGroup;
    const wantHeli = this.stars >= 3;
    heli.visible = wantHeli;
    if (wantHeli) {
      const target = new V3(px + 14, 52, pz - 10);
      heli.position.lerp(target, 1 - Math.pow(0.5, dt * 1.2));
      heli.userData.rotor.rotation.y += dt * 22;
      heli.userData.tailRotor.rotation.x += dt * 30;
      heli.userData.pool.position.y = -heli.position.y + 0.15;
      heli.userData.pool.material.opacity = 0.10 + 0.05 * Math.sin(this.blink * 6);
    }
  }
}
