// SOLARIA BAY's city, v3.1: the main island, the causeway with its
// raised drawbridge, Solaria Key, the bay, and the low western sun.
// The city mixes real models with procedural filler: BlenderKit hero
// buildings and an OSM city block sit on the street grid, a dense
// glass-tower CBD rises behind the Twin Prism Towers, detailed
// procedural mid-rise buildings fill the remaining blocks, and real
// Bajwa palm trees line the boulevard and the marina. This file also
// answers the gameplay questions the other systems ask: how high is
// the ground here, which district is this, and where is the mission
// marker.
//
// v3.1 layout (Xian's brief): the CBD is a tight, legible cluster —
// two columns of tall towers packed around the Twin Prism Towers —
// and the streets around it are filled with mid-rise buildings, so
// the city reads as a real downtown with a clear centre, not a few
// lonely slabs scattered over empty blocks.

import * as THREE from 'three';
import { WORLD, SUN, PALETTE } from './config.js';
import {
  Bucket, buildBuilding, facadeTextures,
  makeBoat, makeShadeSail, makeSunDisc, makeGoldCase,
} from './models.js';

const V3 = THREE.Vector3;
const STREETS = [-240, -160, -80, 0, 80, 160, 240];
const BLOCKS = [-280, -200, -120, -40, 40, 120, 200, 280];
const ROAD_W = 12;
const WALK_W = 2.5;

function inRect(x, z, x0, z0, x1, z1) {
  return x >= x0 && x <= x1 && z >= z0 && z <= z1;
}

// A tall glass tower for the dense CBD, merged into the caller's
// Bucket (so a whole downtown costs a handful of draw calls, not one
// per mullion). Body + vertical mullions + a crown that catches the
// sunset + a darker base band.
function buildCbdTower(bucket, glassMats, frameMat, rng, x, z, w, h, d) {
  const glass = glassMats[rng.int(0, glassMats.length - 1)];
  bucket.box(glass, x, h / 2, z, w, h, d);
  bucket.box(frameMat, x, h + 1.5, z, w * 0.6, 3, d * 0.6);
  bucket.box(frameMat, x, 1.5, z, w + 0.4, 3, d + 0.4);
  const cols = Math.max(3, Math.floor(w / 4));
  for (let i = 0; i <= cols; i++) {
    const mx = x - w / 2 + (i / cols) * w;
    for (const side of [1, -1]) {
      bucket.box(frameMat, mx, h / 2, z + side * (d / 2 + 0.05), 0.18, h, 0.18);
    }
  }
  return { x, z, w, d, h };
}

// A sky dome: bright blue overhead fading to apricot at the horizon.
function makeSky(scene) {
  const geo = new THREE.SphereGeometry(1800, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(PALETTE.skyZenith) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
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
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 c = h > 0.45 ? mix(mid, zenith, smoothstep(0.45, 1.0, h))
                          : mix(horizon, mid, smoothstep(0.0, 0.45, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.position.y = 0;
  scene.add(sky);
  return sky;
}

export function buildWorld(scene, assets, rng) {
  const colliders = [];
  const addCollider = (x, z, w, d, h) => {
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, h });
  };

  // --- Sky, sun, lights ------------------------------------------------------
  makeSky(scene);
  const sunDir = new V3(
    Math.cos(SUN.elevation) * Math.cos(SUN.azimuth),
    Math.sin(SUN.elevation),
    Math.cos(SUN.elevation) * Math.sin(SUN.azimuth),
  );
  const sunDisc = makeSunDisc(46);
  sunDisc.position.copy(sunDir).multiplyScalar(950);
  sunDisc.rotation.y = Math.PI / 2; // face east, toward the city
  scene.add(sunDisc);

  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.position.copy(sunDir).multiplyScalar(500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -420;
  sun.shadow.camera.right = 420;
  sun.shadow.camera.top = 420;
  sun.shadow.camera.bottom = -420;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(SUN.skyFill, SUN.groundBounce, 1.5);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffe8c8, 0.6));
  // A soft fill from the east so the faces the low western sun never
  // reaches (the towers' east sides, the leaf's shadow side) are not
  // pitch black.
  const fill = new THREE.DirectionalLight(0xbfd9f2, 1.0);
  fill.position.set(400, 200, 100);
  scene.add(fill);
  scene.fog = new THREE.Fog(0xf6c89a, 500, 1500);

  // --- Water and ground -------------------------------------------------------
  const waterMat = new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.15 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterY;
  water.receiveShadow = true;
  scene.add(water);
  // A deeper band far out so the bay reads as a bay, not a puddle.
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.MeshStandardMaterial({ color: PALETTE.waterDeep, roughness: 0.3 }));
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = WORLD.waterY - 0.4;
  scene.add(deep);

  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 0.95 });
  const island = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), groundMat);
  island.rotation.x = -Math.PI / 2;
  island.position.y = 0.0;
  island.receiveShadow = true;
  scene.add(island);
  const keyGround = new THREE.Mesh(new THREE.PlaneGeometry(220, 320), groundMat);
  keyGround.rotation.x = -Math.PI / 2;
  keyGround.position.set(670, 0.0, 0);
  keyGround.receiveShadow = true;
  scene.add(keyGround);
  // Sandy beaches on the south and east edges.
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
  const beachS = new THREE.Mesh(new THREE.PlaneGeometry(640, 26), sandMat);
  beachS.rotation.x = -Math.PI / 2;
  beachS.position.set(0, 0.02, 307);
  beachS.receiveShadow = true;
  scene.add(beachS);

  // --- Roads (Asphalt025C PBR) + sidewalks + markings -------------------------
  const asphalt = assets.asphalt;
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt.map, normalMap: asphalt.normal, roughnessMap: asphalt.rough, aoMap: asphalt.ao,
    roughness: 1, metalness: 0,
  });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8c832, roughness: 0.8 });
  const zebraMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.85 });
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.95 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, roughness: 0.9 });

  const roadGroup = new THREE.Group();
  scene.add(roadGroup);
  function roadStrip(cx, cz, w, d) {
    // Sidewalk bed (wider, flush), asphalt on top, so the street reads as
    // a raised sidewalk + a dark road.
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(w + WALK_W * 2, d + WALK_W * 2), walkMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(cx, 0.015, cz);
    bed.receiveShadow = true;
    roadGroup.add(bed);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat.clone());
    strip.material.map = asphalt.map.clone();
    strip.material.map.needsUpdate = true;
    strip.material.map.repeat.set(Math.max(1, w / 8), Math.max(1, d / 8));
    strip.material.normalMap = asphalt.normal.clone();
    strip.material.normalMap.needsUpdate = true;
    strip.material.normalMap.repeat.set(Math.max(1, w / 8), Math.max(1, d / 8));
    strip.material.roughnessMap = asphalt.rough.clone();
    strip.material.roughnessMap.needsUpdate = true;
    strip.material.roughnessMap.repeat.set(Math.max(1, w / 8), Math.max(1, d / 8));
    strip.material.aoMap = asphalt.ao.clone();
    strip.material.aoMap.needsUpdate = true;
    strip.material.aoMap.repeat.set(Math.max(1, w / 8), Math.max(1, d / 8));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(cx, 0.03, cz);
    strip.receiveShadow = true;
    roadGroup.add(strip);
  }
  function dashes(cx, cz, w, d, horizontal) {
    // Yellow centre dashes every 6 m.
    const n = Math.floor((horizontal ? w : d) / 6);
    for (let i = 0; i < n; i++) {
      const t = -((horizontal ? w : d) / 2) + 3 + i * 6;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 3 : 0.35, horizontal ? 0.35 : 3), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(horizontal ? cx + t : cx, 0.05, horizontal ? cz : cz + t);
      roadGroup.add(dash);
    }
  }
  function zebra(cx, cz) {
    for (let i = -4; i <= 4; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, ROAD_W), zebraMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(cx + i * 1.6, 0.05, cz);
      roadGroup.add(bar);
    }
  }
  // The OSM district and the tower plaza break the grid: road segments
  // that would cross them are drawn around them instead.
  const O = WORLD;
  for (const sx of STREETS) {
    // Vertical street x = sx, running along z.
    const inOsmX = sx > O.osmX0 && sx < O.osmX1;
    const zSegs = inOsmX ? [[O.osmZ1, 320]] : [[-320, 320]];
    for (const [z0, z1] of zSegs) {
      const len = z1 - z0;
      if (len < 10) continue;
      roadStrip(sx, (z0 + z1) / 2, ROAD_W, len);
      dashes(sx, (z0 + z1) / 2, ROAD_W, len, false);
    }
  }
  for (const sz of STREETS) {
    // Horizontal street z = sz, running along x.
    const inOsmZ = sz > O.osmZ0 && sz < O.osmZ1;
    let xSegs = inOsmZ ? [[-320, O.osmX0], [O.osmX1, 320]] : [[-320, 320]];
    // The Twin Prism Towers block the z = +/-80 streets in the west strip.
    if (sz === -80 || sz === 80) {
      xSegs = xSegs.flatMap(([a, b]) => {
        if (b <= -240) return [];
        if (a < -240) return [[-240, b]];
        return [[a, b]];
      });
    }
    for (const [x0, x1] of xSegs) {
      const len = x1 - x0;
      if (len < 10) continue;
      roadStrip((x0 + x1) / 2, sz, len, ROAD_W);
      dashes((x0 + x1) / 2, sz, len, ROAD_W, true);
    }
  }
  // Zebra crossings at the main intersections.
  for (const sx of [-160, -80, 0, 80, 160]) {
    for (const sz of [-160, -80, 0, 80, 160]) {
      if (inRect(sx, sz, O.osmX0, O.osmZ0, O.osmX1, O.osmZ1)) continue;
      zebra(sx, sz);
    }
  }

  // --- Causeway, drawbridge, Key ---------------------------------------------
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.35, metalness: 0.8 });
  const causeway = new THREE.Group();
  scene.add(causeway);
  function deckBox(x0, x1, y, w = 24) {
    const len = x1 - x0;
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, w), deckMat);
    box.position.set((x0 + x1) / 2, y - 0.6, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    causeway.add(box);
    // Edge rails.
    for (const side of [1, -1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.3), steelMat);
      rail.position.set((x0 + x1) / 2, y + 0.45, side * (w / 2 - 0.15));
      rail.castShadow = true;
      causeway.add(rail);
    }
    // Asphalt top + dashes.
    const top = new THREE.Mesh(new THREE.PlaneGeometry(len, w - 2), roadMat.clone());
    top.material.map = asphalt.map.clone();
    top.material.map.needsUpdate = true;
    top.material.map.repeat.set(Math.max(1, len / 8), 3);
    top.rotation.x = -Math.PI / 2;
    top.position.set((x0 + x1) / 2, y + 0.02, 0);
    top.receiveShadow = true;
    causeway.add(top);
    for (let i = 0; i < Math.floor(len / 6); i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x0 + 3 + i * 6, y + 0.04, 0);
      causeway.add(dash);
    }
  }
  function ramp(x0, x1, y0, y1) {
    // A sloped approach: a rotated box whose top surface runs y0 -> y1.
    const len = x1 - x0;
    const rise = y1 - y0;
    const slope = Math.atan2(rise, len);
    const box = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(len, rise) + 0.5, 1.2, 24), deckMat);
    box.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.6, 0);
    box.rotation.z = -slope;
    box.castShadow = true;
    box.receiveShadow = true;
    causeway.add(box);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(len, rise), 22), roadMat.clone());
    top.material.map = asphalt.map.clone();
    top.material.map.needsUpdate = true;
    top.material.map.repeat.set(Math.max(1, len / 8), 3);
    top.rotation.x = -Math.PI / 2;
    top.rotation.y = slope;
    top.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.05, 0);
    top.receiveShadow = true;
    causeway.add(top);
  }
  ramp(298, 340, 0, WORLD.deckY);
  deckBox(340, 430, WORLD.deckY);
  deckBox(460, 520, WORLD.deckY);
  ramp(520, 560, WORLD.deckY, 0);
  // The raised bascule leaf: 30 m of steel at 30 degrees, pivoting at the
  // gap's west edge. The car drives up it and launches off the tip.
  // Medium-light steel: reads as steel in the low sun from either side
  // (not a black wedge, not a tan board).
  const leafSteel = new THREE.MeshStandardMaterial({ color: 0x9aa2ae, roughness: 0.45, metalness: 0.6 });
  const leafLen = 30;
  const leaf = new THREE.Group();
  leaf.position.set(WORLD.bridgeLeafX, WORLD.deckY, 0);
  leaf.rotation.z = WORLD.bridgeLeafAngle;
  const leafDeck = new THREE.Mesh(new THREE.BoxGeometry(leafLen, 0.8, 22), leafSteel);
  leafDeck.position.set(leafLen / 2, 0, 0);
  leafDeck.castShadow = true;
  leafDeck.receiveShadow = true;
  leaf.add(leafDeck);
  const leafTop = new THREE.Mesh(new THREE.PlaneGeometry(leafLen, 20), roadMat.clone());
  leafTop.material.map = asphalt.map.clone();
  leafTop.material.map.needsUpdate = true;
  leafTop.material.map.repeat.set(4, 3);
  leafTop.rotation.x = -Math.PI / 2;
  leafTop.position.set(leafLen / 2, 0.45, 0);
  leafTop.receiveShadow = true;
  leaf.add(leafTop);
  // Truss ribs along the leaf.
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 22), leafSteel);
    rib.position.set(4 + i * 6, 1.8, 0);
    rib.castShadow = true;
    leaf.add(rib);
  }
  causeway.add(leaf);
  // Warning lights on the leaf tip.
  const warnMat = new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xff2222, emissiveIntensity: 1 });
  for (const side of [1, -1]) {
    const warn = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), warnMat);
    warn.position.set(leafLen - 0.5, 1.2, side * 10);
    leaf.add(warn);
  }
  // Support pillars in the bay under the deck.
  for (const px of [360, 400, 480, 500]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 8, 12), new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9 }));
    pillar.position.set(px, 2, 0);
    pillar.castShadow = true;
    causeway.add(pillar);
  }

  // --- Hero GLB buildings -----------------------------------------------------
  function placeGLB(template, x, z, ry = 0, scale = 1) {
    const obj = template.clone();
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(scale);
    scene.add(obj);
    return obj;
  }
  const B = assets.buildings;
  // Twin Prism Towers: two supertalls + the skybridge at floor 45.
  // Both face the same way so their bright facades catch the same light.
  placeGLB(B.supertall.template, -280, -58, 0);
  placeGLB(B.supertall.template, -280, 58, 0);
  addCollider(-280, -58, 60, 79, 240);
  addCollider(-280, 58, 60, 79, 240);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 116), new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.2, metalness: 0.6 }));
  bridge.position.set(-280, 136, 0);
  bridge.castShadow = true;
  scene.add(bridge);
  // Street heroes.
  placeGLB(B.medApartment.template, 120, 80, 0);
  addCollider(120, 80, 18.7, 18.7, 16);
  placeGLB(B.frenchApartment.template, -120, 160, Math.PI / 2);
  addCollider(-120, 160, 35, 45, 56);
  placeGLB(B.hotel.template, -40, 260, 0);
  addCollider(-40, 260, 24.9, 16.7, 22);
  placeGLB(B.restaurant.template, 200, -80, Math.PI / 2);
  addCollider(200, -80, 18, 37.7, 11);

  // --- OSM district: a dense real city block in the north --------------------
  const osm = B.osmBlock.template.clone();
  osm.position.set(WORLD.osmCX, 0, WORLD.osmCZ);
  scene.add(osm);
  // Colliders from the block's own building meshes (tall meshes only;
  // the ground plane and low kerbs are skipped).
  const osmBox = new THREE.Box3();
  osm.traverse((o) => {
    if (!o.isMesh) return;
    osmBox.setFromObject(o);
    const size = new THREE.Vector3();
    osmBox.getSize(size);
    if (size.y < 2.5 || size.y > 60) return;
    const centre = new THREE.Vector3();
    osmBox.getCenter(centre);
    colliders.push({
      x0: osmBox.min.x, z0: osmBox.min.z,
      x1: osmBox.max.x, z1: osmBox.max.z,
      h: osmBox.max.y,
    });
  });

  // --- Dense CBD: a tight cluster of tall glass towers in the west -----------
  // v3.1: the six scattered glass towers are gone, replaced by a dense,
  // legible downtown — two columns of tall towers packed around the
  // Twin Prism Towers, so the skyline reads as a real CBD from the
  // boulevard and the causeway. Bucket-merged (a handful of draw calls
  // for the whole cluster); the supertalls stay the landmarks. The
  // z = 0 road stays clear so the Tower Run approach is never blocked,
  // and no tower sits on a street.
  const cbdSpots = [
    [-280, -280], [-280, -200], [-280, 200], [-280, 280],
    [-200, -280], [-200, -200], [-200, -120], [-200, -40],
    [-200, 40], [-200, 120], [-200, 200], [-200, 280],
  ];
  const cbdGlass = [
    new THREE.MeshStandardMaterial({ color: 0x6a9ab8, roughness: 0.12, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x4a7a9a, roughness: 0.12, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x8fb8d9, roughness: 0.12, metalness: 0.65 }),
  ];
  const cbdFrame = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6 });
  const cbdBucket = new Bucket();
  for (const [cx, cz] of cbdSpots) {
    const w = rng.range(20, 26);
    const d = rng.range(20, 26);
    const h = rng.range(60, 140);
    buildCbdTower(cbdBucket, cbdGlass, cbdFrame, rng, cx, cz, w, h, d);
    addCollider(cx, cz, w, d, h);
  }
  cbdBucket.build(scene);

  // --- Procedural filler buildings (Phase 2 system, Bucket-merged) ------------
  // v3.1: denser. The skip rate drops (22% -> 8%) and the second
  // building per block rises (45% -> 65%), so the streets between the
  // heroes fill with mid-rise buildings instead of empty lots. Heights
  // stay mid-rise (9-34 m) — the tall stuff belongs to the CBD.
  const mats = facadeTextures();
  const facadeMats = {
    brick: new THREE.MeshStandardMaterial({ map: mats.brick, roughness: 0.9 }),
    plaster: new THREE.MeshStandardMaterial({ map: mats.plaster, roughness: 0.9 }),
    concrete: new THREE.MeshStandardMaterial({ map: mats.concrete, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ map: mats.glass, roughness: 0.2, metalness: 0.4 }),
  };
  const bucket = new Bucket();
  const heroRects = [
    { x0: 110, z0: 70, x1: 130, z1: 90 },
    { x0: -143, z0: 142, x1: -97, z1: 178 },
    { x0: -53, z0: 251, x1: -27, z1: 269 },
    { x0: 181, z0: -90, x1: 219, z1: -70 },
    { x0: -311, z0: -98, x1: -249, z1: -18 },
    { x0: -311, z0: 18, x1: -249, z1: 98 },
  ];
  function blockFree(bx, bz) {
    if (inRect(bx, bz, O.osmX0 - 20, O.osmZ0 - 20, O.osmX1 + 20, O.osmZ1 + 20)) return false;
    if (bz > 225) return false; // marina strip
    if (bx < -225) return false; // tower strip
    if (Math.abs(bx - 160) < 45 && Math.abs(bz - 120) < 40) return false; // garage
    if (Math.abs(bx + 60) < 40 && Math.abs(bz - 40) < 40) return false; // spawn clearing
    // The dense CBD: no filler building inside a tower's block.
    for (const [cx, cz] of cbdSpots) {
      if (Math.abs(bx - cx) < 40 && Math.abs(bz - cz) < 40) return false;
    }
    for (const r of heroRects) {
      if (bx > r.x0 - 30 && bx < r.x1 + 30 && bz > r.z0 - 30 && bz < r.z1 + 30) return false;
    }
    return true;
  }
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (!blockFree(bx, bz)) continue;
      if (rng.chance(0.08)) continue;
      const ox = rng.range(-8, 8);
      const oz = rng.range(-8, 8);
      const nearRoad = Math.abs(bx) < 100 || Math.abs(bz) < 100;
      const info = buildBuilding(bucket, facadeMats, rng, bx + ox, bz + oz, {
        w: rng.range(16, 26),
        d: rng.range(16, 26),
        h: rng.range(12, nearRoad ? 26 : 34),
        shop: rng.chance(0.4),
      });
      addCollider(info.x, info.z, info.w, info.d, info.h);
      // A second smaller building in the same block, offset so they don't touch.
      if (rng.chance(0.65)) {
        const info2 = buildBuilding(bucket, facadeMats, rng, bx - ox * 1.6, bz - oz * 1.6, {
          w: rng.range(12, 18),
          d: rng.range(12, 18),
          h: rng.range(9, 20),
          shop: rng.chance(0.3),
        });
        addCollider(info2.x, info2.z, info2.w, info2.d, info2.h);
      }
    }
  }
  bucket.build(scene);

  // --- Parking garage (the overlook) ------------------------------------------
  const garageMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9 });
  const garage = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 24), garageMat);
  gBody.position.set(160, 6, 120);
  gBody.castShadow = true;
  gBody.receiveShadow = true;
  garage.add(gBody);
  // Open parking levels: dark bands on the long faces.
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.8 });
  for (const side of [1, -1]) {
    for (const ly of [3.5, 8]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(28, 2.2, 0.3), bandMat);
      band.position.set(160, ly, 120 + side * 12.1);
      garage.add(band);
    }
  }
  // Roof parapet + a PARKING sign band.
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(30.6, 0.8, 24.6), garageMat);
  parapet.position.set(160, 12.4, 120);
  garage.add(parapet);
  const signMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, emissive: 0x0a4a44, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 0.4), signMat);
  sign.position.set(160, 11, 132.2);
  garage.add(sign);
  // The ramp up the east side.
  const rampLen = 24;
  const rampSlope = Math.atan2(12, rampLen);
  const gRamp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(rampLen, 12), 0.8, 12), garageMat);
  gRamp.position.set(187, 6, 120);
  gRamp.rotation.z = -rampSlope;
  gRamp.castShadow = true;
  gRamp.receiveShadow = true;
  garage.add(gRamp);
  scene.add(garage);
  addCollider(160, 120, 30, 24, 12);

  // --- Marina: boardwalk, docks, boats, shade sails ---------------------------
  const marina = new THREE.Group();
  scene.add(marina);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.9 });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(220, 0.5, 12), woodMat);
  boardwalk.position.set(-40, 0.25, 292);
  boardwalk.castShadow = true;
  boardwalk.receiveShadow = true;
  marina.add(boardwalk);
  // Docks reaching into the bay.
  for (const dx of [-120, -60, 0, 60]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 42), woodMat);
    dock.position.set(dx, 0.2, 340);
    dock.castShadow = true;
    dock.receiveShadow = true;
    marina.add(dock);
    const boat = makeBoat();
    boat.position.set(dx + 5, WORLD.waterY + 0.4, 352);
    boat.rotation.y = rng.range(-0.15, 0.15);
    marina.add(boat);
  }
  // Shade sails over the promenade.
  for (const [sx, sz, c] of [[-100, 282, 0xf4f1de], [-40, 282, 0x2ec4b6], [20, 282, 0xffb703]]) {
    const sail = makeShadeSail(c);
    sail.position.set(sx, 0, sz);
    marina.add(sail);
  }
  // The hero GT waits under the middle sail.
  const heroSpawn = { x: -40, z: 282, heading: Math.PI / 2 };

  // --- Solaria Key: the vault + a few low buildings ----------------------------
  const keyGroup = new THREE.Group();
  scene.add(keyGroup);
  const vaultMat = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, roughness: 0.85 });
  const vault = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 18), vaultMat);
  vault.position.set(668, 4.5, 40);
  vault.castShadow = true;
  vault.receiveShadow = true;
  keyGroup.add(vault);
  const vaultDoor = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.5), steelMat);
  vaultDoor.position.set(668, 3, 30.8);
  keyGroup.add(vaultDoor);
  addCollider(668, 40, 26, 18, 9);
  const goldCase = makeGoldCase();
  goldCase.position.set(668, 0, 40);
  keyGroup.add(goldCase);
  // Key roads + a couple of low buildings (their own bucket — the main
  // filler bucket is already merged by this point).
  roadStrip(670, 0, 200, ROAD_W);
  dashes(670, 0, 200, ROAD_W, true);
  const keyBucket = new Bucket();
  for (const [kx, kz, kw, kh] of [[620, -80, 18, 10], [720, 90, 20, 12], [600, 110, 16, 8]]) {
    const info = buildBuilding(keyBucket, facadeMats, rng, kx, kz, { w: kw, d: 16, h: kh, shop: false });
    addCollider(info.x, info.z, info.w, info.d, info.h);
  }
  keyBucket.build(scene);

  // --- Bajwa palms, lamps, hydrants, benches, traffic signals -----------------
  // v3.1: the procedural starburst palms are gone. Fifteen real Bajwa
  // palms (BlenderKit, CC0) line the boulevard, the marina and the
  // causeway approach. Two meshes each, so fifteen cost ~30 draw calls.
  // Scale 0.75x (~11.5 m tall), raised 0.225 m — the model's base sits
  // 0.30 m below its origin, and 0.30 * 0.75 = 0.225.
  //
  // PLACEMENT RULE (Xian): a palm NEVER stands on a drivable road
  // surface. Every palm below is on a sidewalk, on the marina
  // waterfront ground, or on a planting verge — never on asphalt, never
  // on a zebra crossing, never on a mission path. The roads are 12 m
  // wide (asphalt |offset| <= 6 m) with a 2.5 m sidewalk (6 m <
  // |offset| <= 8.5 m), so a roadside palm sits at |offset| 7.5 m —
  // the middle of the sidewalk. And a palm is placed MID-BLOCK, never
  // at an intersection: a palm at (streetX, +/-7.5) would stand on the
  // crossing street's centreline, in the middle of that road. So the
  // boulevard palms use BLOCK x positions (between the north-south
  // streets), and the x = 0 road palms use BLOCK z positions (between
  // the east-west streets). The north sidewalk of the boulevard inside
  // the OSM district's x-range would sit inside the district itself
  // (the district's south edge is z = -6), so those palms use the
  // south sidewalk instead. The marina palms sit on the ground at the
  // water's edge (z = 300, just south of the boardwalk), BETWEEN the
  // docks (docks at x = -120, -60, 0, 60) so no palm stands on a dock.
  const palmSpots = [
    // Palm Boulevard (z = 0), mid-block, on the sidewalk (z = +/-7.5).
    [-200, -7.5], [-120, 7.5], [-40, 7.5], [40, 7.5], [120, 7.5], [200, -7.5],
    // The x = 0 road, mid-block, on the sidewalk (x = +/-7.5), south of
    // the OSM district (the road does not run through the district).
    [7.5, 40], [-7.5, 120], [7.5, 200], [-7.5, 280],
    // Marina waterfront, on the ground at the water's edge, between docks.
    [-90, 300], [-30, 300], [30, 300],
    // Causeway approach (the z = 0 road east to the causeway), mid-block
    // on both sidewalks.
    [280, 7.5], [280, -7.5],
  ];
  for (const [px, pz] of palmSpots) {
    const palm = assets.palm.clone();
    palm.scale.setScalar(0.75);
    palm.position.set(px, 0.225, pz);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(palm);
  }
  // Street lamps along the main roads (real GLB, ~6.6 m tall).
  const lampSpots = [];
  for (const sz of [-160, -80, 0, 80, 160]) {
    for (let x = -280; x <= 280; x += 80) {
      if (inRect(x, sz, O.osmX0, O.osmZ0, O.osmX1, O.osmZ1)) continue;
      lampSpots.push([x, sz - 8.5]);
    }
  }
  for (const [lx, lz] of lampSpots) {
    const lamp = assets.furniture.lamp.clone();
    lamp.position.set(lx, 0, lz);
    lamp.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(lamp);
  }
  // Hydrants + benches near the marina and the boulevard.
  for (const [hx, hz] of [[-80, 286], [0, 286], [80, 286], [-160, 76], [80, -76]]) {
    const hyd = assets.furniture.hydrant.clone();
    hyd.position.set(hx, 0, hz);
    scene.add(hyd);
  }
  for (const [bx, bz] of [[-60, 288], [40, 288], [-120, 84]]) {
    const bench = assets.furniture.bench.clone();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = rng.range(0, Math.PI);
    scene.add(bench);
  }
  // Traffic signals at the main intersections.
  for (const [tx, tz] of [[0, -80], [0, 80], [-80, 0], [80, 0], [160, 0]]) {
    const sig = assets.trafficSignal.clone();
    sig.position.set(tx + 7.5, 0, tz + 7.5);
    sig.rotation.y = Math.PI / 4;
    scene.add(sig);
  }

  // --- Mission marker: a floating ring + a light beam --------------------------
  const marker = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 8, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.5;
  marker.add(ring);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.12, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 22, 12, 1, true), beamMat);
  beam.position.y = 11;
  marker.add(beam);
  marker.visible = false;
  scene.add(marker);
  const setMarker = (x, z, visible = true) => {
    marker.position.set(x, 0, z);
    marker.visible = visible;
  };

  // --- Ground height and districts ----------------------------------------------
  function heightAt(x, z) {
    // Garage roof + ramp.
    if (x >= 145 && x <= 175 && z >= 108 && z <= 132) return 12;
    if (x > 175 && x <= 199 && z >= 114 && z <= 126) return 12 - ((x - 175) / 24) * 12;
    // Causeway (z within the deck, x from the island to the Key).
    if (Math.abs(z) <= 12 && x >= 298 && x <= 582) {
      if (x < 340) return ((x - 298) / 42) * WORLD.deckY;
      if (x < WORLD.bridgeGapX0) return WORLD.deckY;
      if (x < WORLD.bridgeGapX1) {
        // On the raised leaf: the steel rises 30 degrees from the deck.
        const along = x - WORLD.bridgeLeafX;
        const leafRun = leafLen * Math.cos(WORLD.bridgeLeafAngle);
        if (along >= 0 && along <= leafRun) return WORLD.deckY + along * Math.tan(WORLD.bridgeLeafAngle);
        return null; // past the leaf tip: airborne over the gap
      }
      if (x < 520) return WORLD.deckY;
      if (x <= 560) return WORLD.deckY - ((x - 520) / 40) * WORLD.deckY;
      return 0;
    }
    // Solaria Key.
    if (x >= WORLD.keyX0 && x <= WORLD.keyX1 && Math.abs(z) <= WORLD.keyZ) return 0;
    // Main island.
    if (Math.abs(x) <= WORLD.islandHalf && Math.abs(z) <= WORLD.islandHalf) return 0;
    return null; // water
  }

  function districtAt(x, z) {
    if (x >= WORLD.keyX0) return 'Solaria Key';
    if (Math.abs(z) <= 12 && x >= 298) return 'Causeway Viaduct';
    if (z > 240) return 'Marina Row';
    if (x < -240) return 'Twin Prism Towers';
    if (inRect(x, z, O.osmX0, O.osmZ0, O.osmX1, O.osmZ1)) return 'Old Solaria';
    if (Math.abs(x) < 90 && Math.abs(z) < 90) return 'Palm Boulevard';
    if (x > 100 && z > 100) return 'Southside';
    if (x > 100) return 'Eastside';
    if (z < -100) return 'Northside';
    return 'Downtown';
  }

  return {
    colliders,
    heightAt,
    districtAt,
    setMarker,
    marker,
    sunDisc,
    heroSpawn,
    goldCase,
    garageRoof: { x: 160, z: 120, y: 12 },
    keyVault: { x: 668, z: 40 },
    // The Scout template + clips, for Kai and the male pedestrians,
    // and the female template, for the female pedestrians
    // (characters.js reads these off the world so main.js needs no change).
    scout: assets.scout,
    female: assets.female,
  };
}
