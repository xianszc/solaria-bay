// SOLARIA BAY's city: the main island, the causeway with its raised
// drawbridge, Solaria Key, the bay, and the low western sun. This file
// also answers the gameplay questions the other systems ask: how high is
// the ground here, is this water, which district is this, what is solid.
// The visual rules that v1 broke are fixed here: the road is warm
// charcoal asphalt (never dark teal), the sky is bright blue overhead
// fading to apricot (never mostly purple), and the drawbridge is a real
// bridge — asphalt deck, lane markings, guardrails, steel girders.
import * as THREE from 'three';
import { PALETTE, SUN, WORLD } from './config.js';
import { buildBoat, buildPalm } from './models.js';

const TAN30 = 0.57735; // tan(30 degrees): the drawbridge leaf's slope

// The street grid on the main island.
const STREETS = [-240, -160, -80, 0, 80, 160, 240];
const ROAD_HALF = 7;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function facadeMat(color, shine = 0) {
  return new THREE.MeshPhongMaterial({ color, shininess: shine || 60, specular: 0x8899aa });
}

// A shared facade texture: pale glass with a grid of lit and dark
// windows, so a tower reads as a building instead of a flat coloured
// slab. The texture multiplies the material colour, so each district
// keeps its own tint while sharing the window grid.
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b7c8d4';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 16; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const lit = Math.random() < 0.42;
      ctx.fillStyle = lit ? (Math.random() < 0.6 ? '#ffd98a' : '#fff6e5') : '#2b3a4a';
      ctx.fillRect(6 + col * 15, 8 + row * 15, 9, 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, material, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function buildWorld(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const windowTexture = makeWindowTexture();
  function facade(color, shininess = 0) {
    if (shininess) {
      return new THREE.MeshPhongMaterial({ color, map: windowTexture, shininess, specular: 0x8899aa });
    }
    return new THREE.MeshLambertMaterial({ color, map: windowTexture });
  }
  const mat = {
    ground: lambert(0xb3a37e), // warm sun-baked tan (config PALETTE.ground)
    beach: lambert(0xe8d8a8),
    asphalt: lambert(0x3b3835), // warm charcoal — the v1 teal is gone
    dash: lambert(0xe8e4d8),
    sidewalk: lambert(0xb9b3a4),
    water: new THREE.MeshLambertMaterial({ color: 0x1f9db4, transparent: true, opacity: 0.92 }),
    waterDeep: lambert(0x0e6f8f),
    glass: facade(0x2ec4b6, 120),
    glassBlue: facade(0x4fb3d9, 120),
    glassGold: facade(0xd9a441, 100),
    concrete: lambert(0xcfc8b8),
    cream: facade(0xf2e8d5),
    coral: facade(0xe88a7a),
    rose: facade(0xe8a0b4),
    teal: facade(0x3fae9c),
    white: facade(0xf4f1de),
    steel: lambert(0x5a6270),
    deckSteel: lambert(0x8a8f96),
    hazard: lambert(0xffc300),
  };

  // --- Sky: a three-stop gradient dome ---------------------------------------
  // Zenith blue overhead, a pale blue mid-band, apricot only in a thin
  // band at the horizon. The two-stage mix keeps the mid-sky pale blue —
  // v1 mixed horizon straight into zenith and the middle turned purple.
  // The sun hangs due west (z = 0), so it sets directly BETWEEN the Twin
  // Prism Towers (z = -58 and +58) instead of hiding behind the south one.
  // The 0.12 south offset v1 used put the disc behind the south tower.
  const sunDir = new THREE.Vector3(-Math.cos(SUN.elevation), Math.sin(SUN.elevation), 0).normalize();
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(PALETTE.skyZenith) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      sunDirection: { value: sunDir },
      sunColor: { value: new THREE.Color(PALETTE.sunDisc) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 zenith;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 low = mix(horizon, mid, smoothstep(0.0, 0.28, h));
        vec3 col = mix(low, zenith, smoothstep(0.22, 0.75, h));
        float sunAmount = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);
        col += sunColor * pow(sunAmount, 220.0) * 1.4;
        col += sunColor * pow(sunAmount, 8.0) * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMaterial);
  sky.frustumCulled = false;
  group.add(sky);

  // The sun disc itself: a bright circle far to the west, big enough to
  // read clearly in the cover shot, with a soft glow around it.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6e5, fog: false }),
  );
  sunDisc.position.copy(sunDir).multiplyScalar(1250);
  group.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35, fog: false }),
  );
  sunGlow.position.copy(sunDir).multiplyScalar(1240);
  group.add(sunGlow);

  // --- Lights: a warm low sun plus a soft sky fill ------------------------------
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.position.copy(sunDir).multiplyScalar(600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(SUN.skyFill), new THREE.Color(SUN.groundBounce), 1.25);
  scene.add(hemi);

  // --- Water and land ---------------------------------------------------------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2400), mat.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterY;
  water.receiveShadow = true;
  group.add(water);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2400), mat.waterDeep);
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = WORLD.waterY - 0.6;
  group.add(deep);

  // Ground slabs: their tops MUST sit at y = 0, exactly the height
  // heightAt() reports for the island and the Key. v2 centred them at
  // y = -0.1, so their tops were at +0.5 — half a metre ABOVE the
  // gameplay ground. That buried every road strip (tops at 0.12), every
  // lane dash, the median, the car wheels (bottoms at 0), Kai's feet and
  // the palm trunks, which is why the streets read as one flat
  // grey-green field. Centring the slabs at -0.6 puts their tops at 0.
  const beach = box(680, 1, 680, mat.beach, 0, -0.6, 0, group);
  beach.receiveShadow = true;
  const island = box(640, 1.2, 640, mat.ground, 0, -0.6, 0, group);
  island.receiveShadow = true;
  box(230, 1.2, 330, mat.ground, (WORLD.keyX0 + WORLD.keyX1) / 2, -0.6, 0, group);
  box(250, 1, 350, mat.beach, (WORLD.keyX0 + WORLD.keyX1) / 2, -0.6, 0, group);

  // --- Roads: warm asphalt strips on the grid, with centre dashes -------------
  // Thin raised strips (tops at 0.06, just above the ground at 0) so the
  // street reads as a street: dark charcoal against the tan blocks, with
  // pale dashes. The wheels sit at y = 0, so a 0.06 strip only hides
  // 6 cm of tyre — invisible — while the old 0.12 strips were buried
  // under the old 0.5 ground and never seen at all.
  for (const line of STREETS) {
    box(14, 0.06, 640, mat.asphalt, line, 0.03, 0, group).receiveShadow = true;
    box(640, 0.06, 14, mat.asphalt, 0, 0.03, line, group).receiveShadow = true;
    for (let d = -300; d <= 300; d += 24) {
      box(0.7, 0.02, 3.4, mat.dash, line, 0.07, d, group);
      box(3.4, 0.02, 0.7, mat.dash, d, 0.07, line, group);
    }
  }
  // Palm Boulevard (z = 0) keeps a wider planted median.
  box(640, 0.1, 4, mat.sidewalk, 0, 0.05, 0, group);

  // --- Buildings ---------------------------------------------------------------
  // The player spawn (must match createPlayer in characters.js and the
  // reset in main.js). No building may cover it: the layout is random
  // per visit, and a tower on the spawn traps the player inside its
  // collider on ~1 in 3 loads, so the player cannot walk at all.
  const SPAWN = { x: -60, z: 40 };
  const buildingMats = [mat.glass, mat.glassBlue, mat.glassGold, mat.cream, mat.coral, mat.rose, mat.teal, mat.concrete];
  function addBuilding(x, z, w, d, h, material) {
    if (x - w / 2 - 4 < SPAWN.x && SPAWN.x < x + w / 2 + 4 && z - d / 2 - 4 < SPAWN.z && SPAWN.z < z + d / 2 + 4) return null;
    const mesh = box(w, h, d, material, x, h / 2, z, group);
    mesh.receiveShadow = true;
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // A set-back crown and a rooftop plant box: the roofline is not flat.
    box(w * 0.62, 1.4, d * 0.62, mat.white, x, h + 0.7, z, group);
    box(w * 0.3, 2.2, d * 0.3, mat.steel, x + w * 0.2, h + 1.1, z - d * 0.18, group);
    return mesh;
  }

  // The Twin Prism Towers: two 60-floor glass prisms with a skybridge at
  // floor 45, angled so the sun sets directly between them.
  addBuilding(-262, -58, 26, 26, 182, mat.glass);
  addBuilding(-262, 58, 26, 26, 182, mat.glassBlue);
  const skybridge = box(26, 5, 92, mat.glassGold, -262, 136, 0, group);
  skybridge.castShadow = true;
  colliders.push({ x0: -275, z0: -8, x1: -249, z1: 8 });
  for (const [tx, tz] of [[-262, -58], [-262, 58]]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 4), mat.glassGold);
    tip.position.set(tx, 193, tz);
    tip.rotation.y = Math.PI / 4;
    tip.castShadow = true;
    group.add(tip);
  }

  // CBD cluster: glass towers of varied heights on the block centres
  // around the prisms. Buildings stay inside their blocks so the roads
  // between them stay clear.
  for (const gx of [-280, -200, -120, -40]) {
    for (const gz of [-200, -120, -40, 40, 120, 200]) {
      if (Math.abs(gx + 262) < 45 && Math.abs(gz) < 110) continue; // keep the twins clear
      if (random.next() < 0.3) continue;
      const h = random.range(55, 150);
      addBuilding(gx + random.range(-8, 8), gz + random.range(-8, 8), random.range(22, 34), random.range(22, 34), h, random.pick(buildingMats));
    }
  }
  // Mid-rise and low-rise blocks across the rest of the island.
  for (const gx of [-280, -200, -120, -40, 40, 120, 200, 280]) {
    for (const gz of [-280, -200, -120, -40, 40, 120, 200, 280]) {
      if (gx < -180 && Math.abs(gz) < 220) continue; // CBD handled above
      if (Math.abs(gx) < 30 && Math.abs(gz) < 30) continue; // central plaza stays open
      if (gz >= 240) continue; // the marina strip stays open for the boardwalk
      if (Math.abs(gx - WORLD.garageX) < 56 && Math.abs(gz - WORLD.garageZ) < 48) continue; // keep the parking garage clear
      if (random.next() < 0.25) continue;
      const h = gz > 220 ? random.range(8, 18) : random.range(14, 46);
      addBuilding(gx + random.range(-8, 8), gz + random.range(-8, 8), random.range(24, 36), random.range(24, 36), h, random.pick(buildingMats));
    }
  }

  // --- Marina (south shore): boardwalk, shade sails, boats, lighthouse -------
  box(420, 0.3, 26, mat.sidewalk, -60, 0.15, 292, group);
  for (let i = 0; i < 5; i += 1) {
    const sx = -220 + i * 80;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sail.position.set(sx, 9, 292);
    sail.rotation.x = -0.5;
    sail.rotation.z = 0.12;
    sail.castShadow = true;
    group.add(sail);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), mat.concrete);
    pole.position.set(sx - 11, 4.5, 296);
    group.add(pole);
  }
  for (let i = 0; i < 6; i += 1) {
    const boat = buildBoat();
    boat.position.set(-240 + i * 62, WORLD.waterY + 0.4, 330 + random.range(-4, 4));
    boat.rotation.y = random.range(-0.4, 0.4);
    group.add(boat);
  }
  const light = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 26, 8), mat.cream);
  light.position.set(150, 13, 300);
  light.castShadow = true;
  group.add(light);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6e5 }));
  lamp.position.set(150, 27, 300);
  group.add(lamp);
  colliders.push({ x0: 144, z0: 294, x1: 156, z1: 306 });

  // --- Parking garage (overlook shot): three open decks, roof at 12 m --------
  const gx = WORLD.garageX;
  const gz = WORLD.garageZ;
  for (let level = 0; level < 3; level += 1) {
    box(56, 1, 44, mat.concrete, gx, 0.5 + level * 4, gz, group);
  }
  for (const [cx, cz] of [[-24, -18], [24, -18], [-24, 18], [24, 18]]) {
    box(2, 12, 2, mat.concrete, gx + cx, 6, gz + cz, group);
  }
  colliders.push({ x0: gx - 28, z0: gz - 22, x1: gx + 28, z1: gz + 22 });
  // A low parapet on the roof, and roof props so the deck is not an
  // empty slab: AC units, a vent, a stair bulkhead.
  box(56, 1.2, 2, mat.concrete, gx, 12.6, gz - 21, group);
  box(56, 1.2, 2, mat.concrete, gx, 12.6, gz + 21, group);
  box(6, 1.6, 5, mat.white, gx - 16, 12.8, gz - 12, group);
  box(5, 1.2, 4, mat.teal, gx + 10, 12.6, gz + 10, group);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 8), mat.concrete);
  vent.position.set(gx + 20, 13.3, gz - 8);
  vent.castShadow = true;
  group.add(vent);
  box(8, 3.2, 6, mat.glassBlue, gx - 20, 13.6, gz + 14, group); // stair bulkhead

  // --- Solaria Key: the vault, a few towers, palms -----------------------------
  addBuilding(668, 40, 30, 24, 26, mat.glassGold); // the Key vault
  addBuilding(620, -80, 26, 26, 64, mat.glassBlue);
  addBuilding(700, -90, 24, 24, 48, mat.teal);
  addBuilding(740, 60, 28, 28, 38, mat.cream);
  box(220, 0.06, 14, mat.asphalt, 670, 0.03, 0, group);
  box(14, 0.06, 320, mat.asphalt, 670, 0.03, 0, group);

  // --- Palms: boulevards, marina, causeway --------------------------------------
  const palmSpots = [];
  for (let x = -300; x <= 300; x += 40) {
    palmSpots.push([x, -12]);
    palmSpots.push([x + 20, 12]);
  }
  for (let z = -280; z <= 240; z += 44) {
    palmSpots.push([-12, z]);
    palmSpots.push([12, z + 22]);
  }
  for (let x = -260; x <= 280; x += 44) palmSpots.push([x, 276]);
  for (let x = 580; x <= 760; x += 44) {
    palmSpots.push([x, -12]);
    palmSpots.push([x + 22, 12]);
  }
  for (const [px, pz] of palmSpots) {
    if (random.next() < 0.3) continue;
    const palm = buildPalm();
    palm.position.set(px, 0, pz);
    palm.rotation.y = random.range(0, Math.PI * 2);
    group.add(palm);
  }

  // --- The Causeway Viaduct -------------------------------------------------------
  // Elevated deck at y=6 from the island (x=320) to the Key (x=560), with
  // a 30 m gap where the drawbridge leaf rises at 30 degrees.
  function deckSection(x0, x1) {
    const w = x1 - x0;
    const deck = box(w, 1.4, 20, mat.deckSteel, (x0 + x1) / 2, WORLD.deckY - 0.7, 0, group);
    deck.receiveShadow = true;
    // Asphalt driving surface on the deck, with centre dashes.
    box(w, 0.14, 16, mat.asphalt, (x0 + x1) / 2, WORLD.deckY + 0.07, 0, group);
    for (let x = x0 + 8; x < x1 - 4; x += 16) {
      box(3, 0.06, 0.6, mat.dash, x, WORLD.deckY + 0.16, 0, group);
    }
    // Guardrails: posts and two rails, not a solid wall — you can see the
    // bay and the skyline through them.
    for (const side of [-9.6, 9.6]) {
      for (let x = x0 + 4; x < x1; x += 9) {
        box(0.35, 1.2, 0.35, mat.steel, x, WORLD.deckY + 0.6, side, group);
      }
      box(w, 0.14, 0.14, mat.steel, (x0 + x1) / 2, WORLD.deckY + 1.15, side, group);
      box(w, 0.14, 0.14, mat.steel, (x0 + x1) / 2, WORLD.deckY + 0.6, side, group);
    }
    // Steel girder truss under the deck, and support pillars to the water.
    for (let x = x0 + 18; x < x1; x += 36) {
      box(2.4, WORLD.deckY + 2, 3, mat.concrete, x, (WORLD.deckY + 2) / 2 - 2, -6, group);
      box(2.4, WORLD.deckY + 2, 3, mat.concrete, x, (WORLD.deckY + 2) / 2 - 2, 6, group);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 0.5), mat.steel);
      truss.position.set(x + 9, WORLD.deckY - 1.6, -9.4);
      truss.rotation.z = 0.12;
      group.add(truss);
    }
  }
  deckSection(320, WORLD.bridgeGapX0);
  deckSection(WORLD.bridgeGapX1, 560);
  // Approach ramps: island up to the deck, deck down to the Key.
  function approachRamp(x0, x1, fromY, toY) {
    const length = x1 - x0;
    const rise = toY - fromY;
    const angle = Math.atan2(rise, length);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(length, rise) + 2, 1.2, 20), mat.deckSteel);
    ramp.position.set((x0 + x1) / 2, (fromY + toY) / 2 - 0.6, 0);
    ramp.rotation.z = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
    const top = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(length, rise) + 2, 0.14, 16), mat.asphalt);
    top.position.set((x0 + x1) / 2, (fromY + toY) / 2 + 0.07, 0);
    top.rotation.z = -angle;
    group.add(top);
  }
  approachRamp(298, 320, 0, WORLD.deckY);
  approachRamp(560, 582, WORLD.deckY, 0);

  // The raised bascule leaf: a 28 m steel deck pivoted at the gap's west
  // edge, lifted to 30 degrees. It is a BRIDGE, not a slab: asphalt
  // driving surface with lane markings, guardrails on both edges, hazard
  // stripes at the tip, a barrier arm, and the counterweight pit below.
  const leaf = new THREE.Group();
  leaf.position.set(WORLD.bridgeLeafX, WORLD.deckY, 0);
  const leafDeck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.1, 20), mat.deckSteel);
  leafDeck.position.set(14, 0, 0);
  leafDeck.castShadow = true;
  leaf.add(leafDeck);
  const leafTop = new THREE.Mesh(new THREE.BoxGeometry(28, 0.14, 16), mat.asphalt);
  leafTop.position.set(14, 0.62, 0);
  leaf.add(leafTop);
  for (let i = 0; i < 5; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.6), mat.dash);
    stripe.position.set(5 + i * 5, 0.72, 0);
    leaf.add(stripe);
  }
  for (const side of [-9.4, 9.4]) {
    for (let x = 3; x <= 27; x += 6) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), mat.steel);
      post.position.set(x, 0.6, side);
      leaf.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(28, 0.14, 0.14), mat.steel);
    rail.position.set(14, 1.15, side);
    leaf.add(rail);
  }
  for (let i = 0; i < 6; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 20), i % 2 ? mat.hazard : mat.deckSteel);
    stripe.position.set(3 + i * 4.4, 0.65, 0);
    leaf.add(stripe);
  }
  const barrierArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 18), mat.hazard);
  barrierArm.position.set(1, 2.2, 0);
  leaf.add(barrierArm);
  // The counterweight block under the pivot, and girder ribs under the leaf.
  const counter = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 18), mat.concrete);
  counter.position.set(-3, -2.4, 0);
  leaf.add(counter);
  for (let i = 0; i < 4; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 0.5), mat.steel);
    rib.position.set(14, -0.9, -7.5 + i * 5);
    leaf.add(rib);
  }
  leaf.rotation.z = WORLD.bridgeLeafAngle;
  group.add(leaf);
  // The counterweight pit and the traffic cones on the far side.
  box(10, 4, 22, mat.concrete, WORLD.bridgeGapX0 - 8, 2, 0, group);
  for (let i = 0; i < 4; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), mat.hazard);
    cone.position.set(466 + i * 3, WORLD.deckY + 0.7, -6 + (i % 2) * 12);
    cone.castShadow = true;
    group.add(cone);
  }

  // --- Mission marker beacon -------------------------------------------------------
  const marker = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  marker.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  marker.add(ring);
  marker.visible = false;
  group.add(marker);

  // --- Ground height, water and district queries ----------------------------------
  function onIsland(x, z) {
    return Math.abs(x) <= WORLD.islandHalf && Math.abs(z) <= WORLD.islandHalf;
  }
  function onKey(x, z) {
    return x >= WORLD.keyX0 && x <= WORLD.keyX1 && Math.abs(z) <= WORLD.keyZ;
  }
  function onCauseway(x, z) {
    return Math.abs(z) <= 10 && x >= 298 && x <= 582;
  }

  function heightAt(x, z) {
    if (onCauseway(x, z)) {
      if (x < 320) return ((x - 298) / 22) * WORLD.deckY; // approach ramp
      if (x < WORLD.bridgeGapX0) return WORLD.deckY; // near deck
      if (x < 452) return WORLD.deckY + (x - WORLD.bridgeLeafX) * TAN30; // the leaf
      if (x < WORLD.bridgeGapX1) return null; // the gap: open water below
      if (x < 560) return WORLD.deckY; // far deck
      return WORLD.deckY - ((x - 560) / 22) * WORLD.deckY; // exit ramp
    }
    if (onIsland(x, z) || onKey(x, z)) return 0;
    return null; // open water
  }

  function inWater(x, z) {
    return heightAt(x, z) === null;
  }

  function districtAt(x, z) {
    if (x >= 560) return 'Solaria Key';
    if (x >= 298) return 'Causeway';
    if (x < -200 && Math.abs(z) < 120) return 'Twin Prism Towers';
    if (x < -40 && Math.abs(z) < 220) return 'Prism District';
    if (z > 240) return 'Marina Row';
    if (Math.abs(z) < 20) return 'Palm Boulevard';
    if (z > 140) return 'South Solaria';
    return 'Old Solaria';
  }

  function setMarker(x, z) {
    const h = heightAt(x, z);
    marker.position.set(x, h === null ? 0 : h, z);
    marker.visible = true;
  }
  function clearMarker() {
    marker.visible = false;
  }

  function update(dt, time) {
    water.material.opacity = 0.9 + Math.sin(time * 0.7) * 0.03;
    if (marker.visible) {
      const s = 1 + Math.sin(time * 3) * 0.12;
      ring.scale.set(s, s, 1);
      beam.material.opacity = 0.24 + Math.sin(time * 3) * 0.08;
    }
    sunDisc.lookAt(scene.userData.cameraPosition || new THREE.Vector3(0, 0, 0));
    sunGlow.lookAt(scene.userData.cameraPosition || new THREE.Vector3(0, 0, 0));
    void dt;
  }

  return {
    group,
    colliders,
    heightAt,
    inWater,
    districtAt,
    setMarker,
    clearMarker,
    sun,
    sunDirection: sunDir,
    update,
  };
}
