// Vehicles: the hero wedge supercar, traffic, police interceptors and the
// SPD helicopter. Cars are arcade-physics boxes with real steering,
// acceleration, braking, nitro and a jump: drive up the raised drawbridge
// leaf fast enough and the car goes ballistic across the gap.
import * as THREE from 'three';
import { HERO_CAR, POLICE_CAR, TRAFFIC_CAR } from './config.js';

const CAR_RADIUS = 2.1;

// A low-poly car. The hero wedge gets a sloped nose and a rear wing;
// traffic and police get a plain sedan body with a light bar for police.
function buildCarMesh(kind, color) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x666677 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1b263b, shininess: 140, specular: 0xaaaaaa });

  if (kind === 'hero') {
    // Wedge silhouette: low sloped nose, cabin set back, wide rear.
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.9), bodyMat);
    nose.position.set(0, 0.55, 1.55);
    nose.rotation.x = -0.16;
    car.add(nose);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 2.6), bodyMat);
    body.position.set(0, 0.62, -0.35);
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.5), glassMat);
    cabin.position.set(0, 1.15, -0.55);
    car.add(cabin);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.45), trimMat);
    wing.position.set(0, 1.05, -1.75);
    car.add(wing);
    const louver = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.9), trimMat);
    louver.position.set(0, 0.98, -1.35);
    car.add(louver);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 4.1), bodyMat);
    body.position.y = 0.68;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), glassMat);
    cabin.position.set(0, 1.3, -0.2);
    car.add(cabin);
    if (kind === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2d2d, emissive: 0x881111 }));
      bar.position.set(0, 1.7, -0.2);
      bar.name = 'lightbar';
      car.add(bar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.87, 0.2, 4.12), new THREE.MeshLambertMaterial({ color: 0x14181f }));
      stripe.position.y = 0.85;
      car.add(stripe);
    }
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  for (const side of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(side, 0.62, kind === 'hero' ? 2.5 : 2.08);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(side, 0.72, kind === 'hero' ? -1.68 : -2.08);
    car.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d10 });
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    car.add(wheel);
    wheels.push(wheel);
  }
  car.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { group: car, wheels };
}

export function createCar(kind, spec, x, z, heading, name) {
  const color = spec.color ?? 0xdddddd;
  const { group, wheels } = buildCarMesh(kind, color);
  const topSpeed = (spec.topSpeedKmh ?? 120) / 3.6;
  const car = {
    kind,
    name: name ?? spec.name ?? 'CAR',
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0, // m/s along the heading
    speedKmh: 0,
    topSpeed,
    accel: spec.accel ?? 22,
    brake: spec.brake ?? 40,
    condition: spec.condition ?? 100,
    maxCondition: spec.condition ?? 100,
    mesh: group,
    wheels,
    steer: 0,
    airborne: false,
    vy: 0,
    nitro: 100,
    disabled: false,
    color,
  };
  group.position.copy(car.pos);
  group.rotation.y = heading;
  return car;
}

// One arcade-physics step. `controls` is { throttle, steer, brake, nitro }.
// Returns 'jump' when the car leaves the leaf airborne, 'splash' when it
// lands in the water, 'landed' when an airborne car touches down.
export function stepCar(car, controls, dt, world) {
  if (car.disabled) {
    car.speed *= Math.max(0, 1 - 2.2 * dt);
    car.pos.x += -Math.sin(car.heading) * car.speed * dt;
    car.pos.z += -Math.cos(car.heading) * car.speed * dt;
    car.speedKmh = car.speed * 3.6;
    syncMesh(car, world);
    return null;
  }
  const nitroOn = controls.nitro && car.nitro > 0 && controls.throttle > 0;
  if (nitroOn) car.nitro = Math.max(0, car.nitro - 34 * dt);
  else car.nitro = Math.min(100, car.nitro + 6 * dt);
  const boost = nitroOn ? 1.55 : 1;
  if (controls.throttle > 0) car.speed += car.accel * boost * dt;
  else if (controls.throttle < 0) {
    if (car.speed > 0.5) car.speed -= car.brake * dt;
    else car.speed -= car.accel * 0.5 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  const reverseTop = -13;
  car.speed = Math.min(car.speed, car.topSpeed * boost);
  car.speed = Math.max(car.speed, reverseTop);

  // Steering fades at a standstill and at very high speed.
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 6) * (1 - Math.min(0.45, Math.abs(car.speed) / (car.topSpeed * 2.4)));
  car.steer += (controls.steer - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * steerAuthority * 2.1 * dt * Math.sign(car.speed || 1);

  const fx = -Math.sin(car.heading);
  const fz = -Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;

  // Ground: follow the deck, the leaf, the ramps — or fly.
  const ground = world.heightAt(car.pos.x, car.pos.z);
  let event = null;
  if (car.airborne) {
    car.vy -= 9.8 * dt;
    car.pos.y += car.vy * dt;
    if (ground !== null && car.pos.y <= ground) {
      car.pos.y = ground;
      car.airborne = false;
      car.vy = 0;
      event = 'landed';
    } else if (ground === null && car.pos.y <= -1) {
      event = 'splash';
    }
  } else if (ground === null) {
    // Drove off an edge with no ground: it is a splash, not a flight.
    event = 'splash';
  } else {
    // Leaving the leaf's tip fast enough launches the car.
    const onLeaf = car.pos.x > 430 && car.pos.x < 452 && Math.abs(car.pos.z) <= 10;
    if (onLeaf && car.speed * 3.6 > 52 && car.pos.x > 449) {
      car.airborne = true;
      car.vy = car.speed * Math.sin(0.5236);
      event = 'jump';
    }
    car.pos.y = ground;
  }

  // Building collisions: push out of the AABB, lose speed.
  for (const c of world.colliders) {
    const px = Math.max(c.x0 - CAR_RADIUS, Math.min(car.pos.x, c.x1 + CAR_RADIUS));
    const pz = Math.max(c.z0 - CAR_RADIUS, Math.min(car.pos.z, c.z1 + CAR_RADIUS));
    if (px === car.pos.x && pz === car.pos.z) continue;
    const dx = car.pos.x - px;
    const dz = car.pos.z - pz;
    if (dx * dx + dz * dz < CAR_RADIUS * CAR_RADIUS) {
      // Push out along the smallest penetration axis.
      const pushLeft = car.pos.x - (c.x0 - CAR_RADIUS);
      const pushRight = (c.x1 + CAR_RADIUS) - car.pos.x;
      const pushTop = car.pos.z - (c.z0 - CAR_RADIUS);
      const pushBottom = (c.z1 + CAR_RADIUS) - car.pos.z;
      const min = Math.min(pushLeft, pushRight, pushTop, pushBottom);
      if (min === pushLeft) car.pos.x = c.x0 - CAR_RADIUS;
      else if (min === pushRight) car.pos.x = c.x1 + CAR_RADIUS;
      else if (min === pushTop) car.pos.z = c.z0 - CAR_RADIUS;
      else car.pos.z = c.z1 + CAR_RADIUS;
      car.speed *= 0.55;
      car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.12);
      if (car.condition <= 0) car.disabled = true;
    }
  }

  car.speedKmh = car.speed * 3.6;
  syncMesh(car, world);
  return event;
}

function syncMesh(car, world) {
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  // Lean into steering, pitch when airborne.
  car.mesh.rotation.z = -car.steer * 0.06 * Math.min(1, Math.abs(car.speed) / 12);
  car.mesh.rotation.x = car.airborne ? -0.12 : 0;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed / 0.42) * 0.016;
  void world;
}

// --- Traffic -----------------------------------------------------------------
// Cars loop on rectangular street circuits. They slow for the car ahead and
// keep the city feeling alive without any pathfinding.

export function createTraffic(world, random) {
  const cars = [];
  const colors = [0xe8e4d8, 0x3fae9c, 0xe88a7a, 0x8a9bb0, 0xd9a441, 0x7a6a9b, 0x4a7a3a, 0xc0c8d0];
  const circuits = [
    [[-240, -240], [240, -240], [240, 240], [-240, 240]],
    [[-160, -160], [160, -160], [160, 160], [-160, 160]],
    [[-80, -80], [80, -80], [80, 80], [-80, 80]],
    [[-240, 0], [240, 0], [240, -240], [-240, -240]],
    [[0, -240], [0, 240], [160, 240], [160, -240]],
  ];
  for (let i = 0; i < TRAFFIC_CAR.count; i += 1) {
    const circuit = circuits[i % circuits.length];
    const start = circuit[Math.floor(random.next() * circuit.length)];
    const car = createCar('traffic', { color: colors[i % colors.length], topSpeedKmh: TRAFFIC_CAR.topSpeedKmh }, start[0] + random.range(-4, 4), start[1] + random.range(-4, 4), random.range(0, Math.PI * 2), 'TRAFFIC');
    car.circuit = circuit;
    car.waypoint = Math.floor(random.next() * circuit.length);
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, world, playerCar) {
  for (const car of cars) {
    if (car.disabled) continue;
    const target = car.circuit[car.waypoint];
    const dx = target[0] - car.pos.x;
    const dz = target[1] - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 8) {
      car.waypoint = (car.waypoint + 1) % car.circuit.length;
      continue;
    }
    const wantHeading = Math.atan2(-dx, -dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Slow down for the player's car ahead.
    let throttle = 0.75;
    if (playerCar) {
      const pdx = playerCar.pos.x - car.pos.x;
      const pdz = playerCar.pos.z - car.pos.z;
      const ahead = pdx * -Math.sin(car.heading) + pdz * -Math.cos(car.heading);
      const side = Math.abs(pdx * Math.cos(car.heading) - pdz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 14 && side < 4) throttle = 0;
    }
    stepCar(car, { throttle, steer, brake: false, nitro: false }, dt, world);
  }
}

// --- Police ------------------------------------------------------------------
// Interceptors spawn at the island edges and chase the player. They ram;
// a hard ram damages the player's car and raises heat. A wrecked
// interceptor (condition 0) smokes, stops, and is towed away.

export function createPolice(scene) {
  const cars = [];
  let spawnTimer = 0;
  return {
    cars,
    update(dt, world, player, playerCar, onRam) {
      const wanted = player.wantedStars;
      const wantCount = wanted === 0 ? 0 : Math.min(2 + wanted, 7);
      spawnTimer -= dt;
      if (cars.length < wantCount && spawnTimer <= 0) {
        spawnTimer = 1.6;
        const angle = Math.random() * Math.PI * 2;
        const px = player.pos.x + Math.cos(angle) * 90;
        const pz = player.pos.z + Math.sin(angle) * 90;
        const clampedX = Math.max(-300, Math.min(300, px));
        const clampedZ = Math.max(-300, Math.min(300, pz));
        const car = createCar('police', { color: 0xf4f6f8, topSpeedKmh: POLICE_CAR.topSpeedKmh, accel: POLICE_CAR.accel, condition: POLICE_CAR.condition }, clampedX, clampedZ, 0, POLICE_CAR.name);
        car.chase = true;
        scene.add(car.mesh);
        cars.push(car);
      }
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        if (car.disabled) {
          car.removeTimer = (car.removeTimer ?? 6) - dt;
          if (car.removeTimer <= 0) {
            scene.remove(car.mesh);
            cars.splice(i, 1);
          }
          continue;
        }
        const dx = player.pos.x - car.pos.x;
        const dz = player.pos.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(-dx, -dz);
        let diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 2.4));
        stepCar(car, { throttle: dist > 6 ? 1 : 0.4, steer, brake: false, nitro: false }, dt, world);
        // Ram: touching the player's car damages it; touching the player
        // on foot damages the player.
        if (playerCar && dist < 4.6) {
          const impact = Math.abs(car.speed - playerCar.speed);
          if (impact > 4) {
            playerCar.condition = Math.max(0, playerCar.condition - POLICE_CAR.ramDamage * (impact / 18));
            car.condition = Math.max(0, car.condition - 8);
            onRam(impact);
            if (playerCar.condition <= 0) playerCar.disabled = true;
            if (car.condition <= 0) car.disabled = true;
            // Shove apart so they do not stick together.
            car.pos.x += (dx / (dist || 1)) * -2;
            car.pos.z += (dz / (dist || 1)) * -2;
          }
        } else if (!playerCar && dist < 2.2) {
          player.health = Math.max(0, player.health - 26 * dt);
        }
        // Blink the light bar.
        const bar = car.mesh.getObjectByName('lightbar');
        if (bar) bar.material.emissive.setHex(Math.floor(performance.now() / 280) % 2 ? 0xff2222 : 0x2222ff);
      }
    },
  };
}

// --- Helicopter --------------------------------------------------------------
// Appears at 3+ wanted stars and hovers over the player. No searchlight
// cone (it reads as a strange triangle in stills) — just a soft pool of
// light on the ground beneath it.

export function createHelicopter(scene) {
  const group = new THREE.Group();
  // Light body so the helicopter reads against a bright sky from below;
  // a dark body was just a black cross. The teal glass and dark stripe
  // give it definition.
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6.4), bodyMat);
  body.castShadow = true;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 6.5), new THREE.MeshLambertMaterial({ color: 0x1b263b }));
  stripe.position.y = -0.3;
  group.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.0), new THREE.MeshPhongMaterial({ color: 0x2ec4b6, shininess: 120 }));
  glass.position.set(0, 0.3, 2.4);
  group.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5.4), bodyMat);
  tail.position.set(0, 0.4, -5.4);
  group.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.3;
  group.add(rotor);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 5), bodyMat);
  skidL.position.set(-1.3, -1.1, 0);
  group.add(skidL);
  const skidR = skidL.clone();
  skidR.position.x = 1.3;
  group.add(skidR);
  // Soft light pool on the ground.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6e5, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  group.add(pool);
  group.visible = false;
  scene.add(group);
  return {
    mesh: group,
    update(dt, targetPos, active, time) {
      group.visible = active;
      if (!active) return;
      const hover = new THREE.Vector3(targetPos.x + 14, 52, targetPos.z - 10);
      group.position.lerp(hover, Math.min(1, dt * 1.4));
      group.rotation.y = Math.atan2(-(targetPos.x - group.position.x), -(targetPos.z - group.position.z));
      rotor.rotation.y += dt * 22;
      pool.position.set(0, -group.position.y + 0.4, 0);
      pool.material.opacity = 0.11 + Math.sin(time * 2.2) * 0.03;
    },
  };
}
