// SOLARIA BAY's world: the city itself. Builds the three.js scene for the
// main island, the causeway with its raised drawbridge, Solaria Key, the
// bay, the sky and the low western sun. Also answers the gameplay
// questions the other systems ask: how high is the ground here, is this
// water, which district is this, and what is solid.
import * as THREE from 'three';
import { PALETTE, SUN, WORLD } from './config.js';

const TAN30 = 0.57735; // tan(30 degrees), the drawbridge leaf's slope

// The street grid on the main island: roads run along these lines.
const STREETS = [-240, -160, -80, 0, 80, 160, 240];
const ROAD_HALF = 7; // half the width of a road

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function phong(color, shininess = 60) {
  return new THREE.MeshPhongMaterial({ color, shininess, specular: 0x8899aa });
}

// One shared facade texture: a pale glass face with a grid of lit and
// dark windows, so the towers read as buildings instead of flat slabs.
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a8bfcc';
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

// A low-poly royal palm: a leaning trunk and a crown of flat fronds.
function makePalm(materials) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 6), materials.trunk);
  trunk.position.y = 3.5;
  trunk.rotation.z = 0.06;
  trunk.castShadow = true;
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 1.1), materials.leaf);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.9, 7.1, Math.sin(angle) * 1.9);
    frond.rotation.y = -angle;
    frond.rotation.z = 0.32;
    frond.castShadow = true;
    palm.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), materials.coconut);
  crown.position.y = 7.0;
  palm.add(crown);
  return palm;
}

// A moored sailboat for the marina: hull, mast and a furled sail.
function makeBoat(materials) {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 7), materials.hull);
  hull.position.y = 0.4;
  hull.castShadow = true;
  boat.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), materials.hull);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.4, 4.4);
  boat.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.5, 5), materials.mast);
  mast.position.y = 3.6;
  boat.add(mast);
  const sail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 2.6), materials.sail);
  sail.position.set(0, 3.4, -0.9);
  boat.add(sail);
  return boat;
}

export function buildWorld(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Facade texture: a pale face with a grid of lit and dark windows, so
  // every building reads as a building instead of a flat coloured slab.
  // The texture multiplies the material colour, so each district keeps
  // its own tint while sharing the window grid.
  const windowTexture = makeWindowTexture();
  function facade(color, phongShininess = 0) {
    if (phongShininess) return new THREE.MeshPhongMaterial({ color, map: windowTexture, shininess: phongShininess, specular: 0x8899aa });
    return new THREE.MeshLambertMaterial({ color, map: windowTexture });
  }
  const materials = {
    ground: lambert(0x9aa78a),
    beach: lambert(0xe8d8a8),
    asphalt: lambert(0x4a5160),
    dash: lambert(0xe8e4d8),
    sidewalk: lambert(0xb9b3a4),
    water: new THREE.MeshLambertMaterial({ color: 0x2fb3c9, transparent: true, opacity: 0.92 }),
    waterDeep: lambert(0x0e6f8f),
    glass: facade(0x2ec4b6, 120),
    glassBlue: facade(0x4fb3d9, 120),
    glassGold: facade(0xd9a441, 100),
    concrete: lambert(0xcfc8b8),
    cream: facade(0xf2e8d5),
    coral: facade(0xe88a7a),
    pink: facade(0xe8a0b4),
    teal: facade(0x3fae9c),
    white: facade(0xf4f1de),
    trunk: lambert(0x8a6b4a),
    leaf: lambert(0x3fae5a),
    coconut: lambert(0x6b4f2a),
    hull: lambert(0xf4f1de),
    mast: lambert(0x5a4632),
    sail: lambert(0xff8c42),
    deck: lambert(0x8a8f96),
    leafSteel: lambert(0xaab0b8),
    barrier: lambert(0xffc300),
  };

  // --- Sky: a gradient dome with a warm glow around the sun -----------------
  const sunDir = new THREE.Vector3(
    -Math.cos(SUN.elevation),
    Math.sin(SUN.elevation),
    0.12,
  ).normalize();
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(PALETTE.skyZenith) },
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
      uniform vec3 horizon;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.55));
        float sunAmount = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);
        col += sunColor * pow(sunAmount, 220.0) * 1.4;
        col += sunColor * pow(sunAmount, 8.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMaterial);
  sky.frustumCulled = false;
  group.add(sky);

  // The sun disc itself: a bright circle far to the west, big enough to
  // read clearly in the cover shot. The renderer keeps it facing the camera.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
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

  // --- Lights: warm low sun + soft sky fill --------------------------------
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
  const hemi = new THREE.HemisphereLight(new THREE.Color(SUN.ambientSky), new THREE.Color(SUN.ambientGround), 1.25);
  scene.add(hemi);

  // --- Water and land --------------------------------------------------------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2400), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterY;
  water.receiveShadow = true;
  group.add(water);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2400), materials.waterDeep);
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = WORLD.waterY - 0.6;
  group.add(deep);

  // Main island ground + beach ring.
  const beach = box(680, 1, 680, materials.beach, 0, -0.6, 0, group);
  beach.receiveShadow = true;
  const island = box(640, 1.2, 640, materials.ground, 0, -0.1, 0, group);
  island.receiveShadow = true;
  // Solaria Key island.
  box(230, 1.2, 330, materials.ground, (WORLD.keyX0 + WORLD.keyX1) / 2, -0.1, 0, group);
  box(250, 1, 350, materials.beach, (WORLD.keyX0 + WORLD.keyX1) / 2, -0.6, 0, group);

  // --- Roads: asphalt strips on the grid, with centre dashes ----------------
  for (const line of STREETS) {
    const roadX = box(14, 0.12, 640, materials.asphalt, line, 0.06, 0, group);
    roadX.receiveShadow = true;
    const roadZ = box(640, 0.12, 14, materials.asphalt, 0, 0.06, line, group);
    roadZ.receiveShadow = true;
    for (let d = -300; d <= 300; d += 24) {
      box(0.7, 0.05, 3.4, materials.dash, line, 0.14, d, group);
      box(3.4, 0.05, 0.7, materials.dash, d, 0.14, line, group);
    }
  }
  // Palm Boulevard (z = 0) gets a wider planted median.
  box(640, 0.2, 4, materials.sidewalk, 0, 0.1, 0, group);

  // --- Buildings: towers in the CBD, mid-rise elsewhere ---------------------
  const buildingMats = [materials.glass, materials.glassBlue, materials.glassGold, materials.cream, materials.coral, materials.pink, materials.teal, materials.concrete];
  function addBuilding(x, z, w, d, h, material) {
    const mesh = box(w, h, d, material, x, h / 2, z, group);
    mesh.receiveShadow = true;
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // A flat roof cap and a few lit windows catch the sun.
    box(w * 0.7, 1.2, d * 0.7, materials.white, x, h + 0.6, z, group);
    return mesh;
  }

  // The Twin Prism Towers: two 60-floor glass prisms with a skybridge at
  // floor 45, angled so the sun sets directly between them.
  const towerA = addBuilding(-262, -58, 26, 26, 182, materials.glass);
  const towerB = addBuilding(-262, 58, 26, 26, 182, materials.glassBlue);
  const skybridge = box(26, 5, 92, materials.glassGold, -262, 136, 0, group);
  skybridge.castShadow = true;
  colliders.push({ x0: -275, z0: -8, x1: -249, z1: 8 });
  // Prism caps: pyramid tips that catch the light.
  for (const [tx, tz] of [[-262, -58], [-262, 58]]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 4), materials.glassGold);
    tip.position.set(tx, 193, tz);
    tip.rotation.y = Math.PI / 4;
    tip.castShadow = true;
    group.add(tip);
  }
  void towerA;
  void towerB;

  // CBD cluster: glass towers of varied heights on block centres around
  // the prisms. Buildings stay inside their blocks (offset at most 8 m,
  // size at most 34 m) so the roads between them stay clear.
  const cbdBlocks = [-280, -200, -120, -40];
  for (const gx of cbdBlocks) {
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
      if (random.next() < 0.25) continue;
      const h = gz > 220 ? random.range(8, 18) : random.range(14, 46);
      addBuilding(gx + random.range(-8, 8), gz + random.range(-8, 8), random.range(24, 36), random.range(24, 36), h, random.pick(buildingMats));
    }
  }

  // --- Marina (south shore): boardwalk, shade sails, boats, lighthouse ------
  box(420, 0.3, 26, materials.sidewalk, -60, 0.15, 292, group);
  for (let i = 0; i < 5; i += 1) {
    const sx = -220 + i * 80;
    // A shade sail: a white angled plane on two poles.
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sail.position.set(sx, 9, 292);
    sail.rotation.x = -0.5;
    sail.rotation.z = 0.12;
    sail.castShadow = true;
    group.add(sail);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), materials.concrete);
    pole.position.set(sx - 11, 4.5, 296);
    group.add(pole);
  }
  for (let i = 0; i < 6; i += 1) {
    const boat = makeBoat(materials);
    boat.position.set(-240 + i * 62, WORLD.waterY + 0.4, 330 + random.range(-4, 4));
    boat.rotation.y = random.range(-0.4, 0.4);
    group.add(boat);
  }
  // Lighthouse at the marina point.
  const light = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 26, 8), materials.cream);
  light.position.set(150, 13, 300);
  light.castShadow = true;
  group.add(light);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6e5 }));
  lamp.position.set(150, 27, 300);
  group.add(lamp);
  colliders.push({ x0: 144, z0: 294, x1: 156, z1: 306 });

  // --- Parking garage (overlook shot): three open decks, roof at 12 m -------
  const garageX = 160;
  const garageZ = 120;
  for (let level = 0; level < 3; level += 1) {
    box(56, 1, 44, materials.concrete, garageX, 0.5 + level * 4, garageZ, group);
  }
  for (const [cx, cz] of [[-24, -18], [24, -18], [-24, 18], [24, 18]]) {
    box(2, 12, 2, materials.concrete, garageX + cx, 6, garageZ + cz, group);
  }
  colliders.push({ x0: garageX - 28, z0: garageZ - 22, x1: garageX + 28, z1: garageZ + 22 });
  // The garage roof is where the overlook shot stands: a low parapet.
  box(56, 1.2, 2, materials.concrete, garageX, 12.6, garageZ - 21, group);
  box(56, 1.2, 2, materials.concrete, garageX, 12.6, garageZ + 21, group);
  // Roof props so the deck is not an empty slab: AC units and a vent.
  box(6, 1.6, 5, materials.white, garageX - 16, 12.8, garageZ - 12, group);
  box(5, 1.2, 4, materials.teal, garageX + 10, 12.6, garageZ + 10, group);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 8), materials.concrete);
  vent.position.set(garageX + 20, 13.3, garageZ - 8);
  vent.castShadow = true;
  group.add(vent);

  // --- Solaria Key: the vault, a few towers, palms ---------------------------
  addBuilding(668, 40, 30, 24, 26, materials.glassGold); // the Key vault
  addBuilding(620, -80, 26, 26, 64, materials.glassBlue);
  addBuilding(700, -90, 24, 24, 48, materials.teal);
  addBuilding(740, 60, 28, 28, 38, materials.cream);
  // Key streets.
  box(220, 0.12, 14, materials.asphalt, 670, 0.06, 0, group);
  box(14, 0.12, 320, materials.asphalt, 670, 0.06, 0, group);

  // --- Palms: boulevards, marina, causeway ----------------------------------
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
    const palm = makePalm(materials);
    palm.position.set(px, 0, pz);
    palm.rotation.y = random.range(0, Math.PI * 2);
    group.add(palm);
  }

  // --- The Causeway Viaduct ---------------------------------------------------
  // Elevated deck at y=6 from the island (x=320) to the Key (x=560), with
  // a 30 m gap where the drawbridge leaf rises at 30 degrees.
  function deckSection(x0, x1) {
    const w = x1 - x0;
    const deck = box(w, 1.4, 20, materials.deck, (x0 + x1) / 2, WORLD.deckY - 0.7, 0, group);
    deck.receiveShadow = true;
    // Guardrails.
    box(w, 1.1, 0.5, materials.concrete, (x0 + x1) / 2, WORLD.deckY + 0.5, -10, group);
    box(w, 1.1, 0.5, materials.concrete, (x0 + x1) / 2, WORLD.deckY + 0.5, 10, group);
    // Centre dashes on the deck.
    for (let x = x0 + 8; x < x1 - 4; x += 16) box(3, 0.06, 0.6, materials.dash, x, WORLD.deckY + 0.06, 0, group);
    // Support pillars down to the water.
    for (let x = x0 + 18; x < x1; x += 36) {
      box(2.4, WORLD.deckY + 2, 3, materials.concrete, x, (WORLD.deckY + 2) / 2 - 2, -6, group);
      box(2.4, WORLD.deckY + 2, 3, materials.concrete, x, (WORLD.deckY + 2) / 2 - 2, 6, group);
    }
  }
  deckSection(320, WORLD.bridgeGapX0);
  deckSection(WORLD.bridgeGapX1, 560);
  // Approach ramps: island up to the deck, deck down to the Key.
  function approachRamp(x0, x1, fromY, toY) {
    const length = x1 - x0;
    const rise = toY - fromY;
    const angle = Math.atan2(rise, length);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(length, rise) + 2, 1.2, 20), materials.deck);
    ramp.position.set((x0 + x1) / 2, (fromY + toY) / 2 - 0.6, 0);
    ramp.rotation.z = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
  }
  approachRamp(298, 320, 0, WORLD.deckY);
  approachRamp(560, 582, WORLD.deckY, 0);

  // The raised bascule leaf: a 28 m steel deck pivoted at the gap's near
  // edge, lifted to 30 degrees, with hazard stripes and a barrier arm.
  const leaf = new THREE.Group();
  leaf.position.set(WORLD.bridgeLeafX, WORLD.deckY, 0);
  const leafDeck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.1, 20), materials.leafSteel);
  leafDeck.position.set(14, 0, 0);
  leafDeck.castShadow = true;
  leaf.add(leafDeck);
  for (let i = 0; i < 6; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 20), i % 2 ? materials.barrier : materials.deck);
    stripe.position.set(3 + i * 4.4, 0.65, 0);
    leaf.add(stripe);
  }
  const barrierArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 18), materials.barrier);
  barrierArm.position.set(1, 2.2, 0);
  leaf.add(barrierArm);
  leaf.rotation.z = WORLD.bridgeLeafAngle;
  group.add(leaf);
  // The counterweight pit and the roadblock on the far side of the gap.
  box(10, 4, 22, materials.concrete, WORLD.bridgeGapX0 - 8, 2, 0, group);
  for (let i = 0; i < 4; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), materials.barrier);
    cone.position.set(466 + i * 3, WORLD.deckY + 0.7, -6 + (i % 2) * 12);
    cone.castShadow = true;
    group.add(cone);
  }

  // --- Mission marker beacon ---------------------------------------------------
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

  // --- Ground height, water and district queries ------------------------------
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
    // Gentle water shimmer and a slow pulse on the marker ring.
    water.material.opacity = 0.9 + Math.sin(time * 0.7) * 0.03;
    if (marker.visible) {
      const s = 1 + Math.sin(time * 3) * 0.12;
      ring.scale.set(s, s, 1);
      beam.material.opacity = 0.24 + Math.sin(time * 3) * 0.08;
    }
    // Keep the sun disc and its glow facing the camera.
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
