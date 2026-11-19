// Procedural models for SOLARIA BAY v3. Everything the game cannot buy
// as a GLB is built here: the helicopter, palms, boats, the gold case,
// people (Kai and the pedestrians — the known stylised ceiling), and
// the detailed procedural building system that fills the city between
// the real GLB hero buildings. The filler buildings are the Phase 2
// system: real geometry (window frames, recessed glass, sills, balconies
// with railings, cornices, parapets, shopfronts with sign bands and
// striped awnings, rooftop bulkheads and AC units) merged per material
// through a Bucket so a whole block costs a handful of draw calls.

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { PALETTE } from './config.js';

// ---------------------------------------------------------------------------
// Canvas textures: facades are painted once, then reused across the city.
// ---------------------------------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(200 + Math.random() * 55);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

export function facadeTextures() {
  return {
    brick: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#a2594a';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        const off = (y / 16) % 2 ? 16 : 0;
        for (let x = -16; x < w; x += 32) {
          g.fillStyle = `hsl(${8 + Math.random() * 8},${42 + Math.random() * 12}%,${38 + Math.random() * 10}%)`;
          g.fillRect(x + off + 1, y + 1, 30, 14);
        }
      }
      speckle(g, w, h, 300, 0.08);
    }),
    plaster: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#e8dcc0';
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 500, 0.05);
    }),
    concrete: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#9a968c';
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 600, 0.09);
    }),
    glass: canvasTexture(128, 128, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#7fb8d9');
      grad.addColorStop(0.5, '#3f6d8c');
      grad.addColorStop(1, '#2a4a63');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(w * 0.35, 0);
      g.lineTo(w * 0.55, 0);
      g.lineTo(w * 0.2, h);
      g.fill();
    }),
  };
}

// ---------------------------------------------------------------------------
// Bucket: collect boxes per material, merge once.
// ---------------------------------------------------------------------------

export class Bucket {
  constructor() {
    this.map = new Map(); // material -> geometries[]
  }
  add(geom, material) {
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(geom);
  }
  box(material, x, y, z, w, h, d, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.add(g, material);
  }
  build(scene) {
    const group = new THREE.Group();
    for (const [mat, geoms] of this.map) {
      const merged = mergeGeometries(geoms, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    scene.add(group);
    return group;
  }
}

// ---------------------------------------------------------------------------
// Detailed procedural building (Phase 2 system). Footprint w x d, height h.
// ---------------------------------------------------------------------------

export function buildBuilding(bucket, mats, rng, x, z, opts = {}) {
  const w = opts.w || rng.range(16, 26);
  const d = opts.d || rng.range(16, 26);
  const h = opts.h || rng.range(12, 30);
  const floors = Math.max(2, Math.round(h / 3));
  const floorH = h / floors;
  const facade = opts.facade || rng.pick([mats.brick, mats.plaster, mats.concrete]);
  const trim = opts.trim || new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.85 });
  const glassMat = opts.glass || new THREE.MeshStandardMaterial({ color: 0x2a4a63, roughness: 0.15, metalness: 0.55 });
  const frameMat = opts.frame || new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.7 });

  // The solid body.
  bucket.box(facade, x, h / 2, z, w, h, d);
  // Cornice + parapet.
  bucket.box(trim, x, h + 0.15, z, w + 0.5, 0.3, d + 0.5);
  bucket.box(trim, x, h + 0.55, z, w + 0.2, 0.5, d + 0.2);
  // Rooftop bulkhead + AC units.
  bucket.box(mats.concrete, x - w / 4, h + 1.4, z - d / 4, 3, 2.2, 2.5);
  bucket.box(mats.concrete, x + w / 4, h + 0.9, z + d / 4, 2, 1.2, 1.6);
  bucket.box(mats.concrete, x + w / 5, h + 0.7, z - d / 3, 1.4, 0.8, 1.2);

  const cols = Math.max(3, Math.floor(w / 3.2));
  const rows = floors;
  const winW = 1.5;
  const winH = 1.5;
  const stepX = w / cols;
  const stepY = floorH;
  // Windows on the two long faces (+z and -z), frames + recessed glass + sills.
  for (const side of [1, -1]) {
    const zz = z + side * (d / 2);
    for (let r = 0; r < rows; r++) {
      const y = stepY * (r + 0.5);
      // Skip the ground floor on the front if a shopfront is going there.
      if (r === 0 && opts.shop) continue;
      for (let c = 0; c < cols; c++) {
        const xx = x - w / 2 + stepX * (c + 0.5);
        bucket.box(frameMat, xx, y, zz + side * 0.04, winW + 0.25, winH + 0.25, 0.08);
        bucket.box(glassMat, xx, y, zz + side * 0.06, winW, winH, 0.06);
        bucket.box(trim, xx, y - winH / 2 - 0.08, zz + side * 0.1, winW + 0.4, 0.12, 0.16);
      }
    }
  }
  // Balconies on the upper floors (every other column, front face).
  if (opts.balconies !== false && floors >= 3) {
    for (let r = 1; r < rows; r += 2) {
      for (let c = 0; c < cols; c += 2) {
        const xx = x - w / 2 + stepX * (c + 0.5);
        const y = stepY * (r + 0.5) - 0.9;
        const zz = z + d / 2 + 0.55;
        bucket.box(mats.concrete, xx, y, zz, 2.4, 0.18, 1.1);
        // Railing: thin top rail + verticals.
        bucket.box(frameMat, xx, y + 1.05, zz + 0.5, 2.4, 0.07, 0.07);
        bucket.box(frameMat, xx - 1.15, y + 0.55, zz + 0.5, 0.07, 1.0, 0.07);
        bucket.box(frameMat, xx + 1.15, y + 0.55, zz + 0.5, 0.07, 1.0, 0.07);
        bucket.box(frameMat, xx, y + 0.55, zz + 0.5, 0.07, 1.0, 0.07);
      }
    }
  }
  // Shopfront on the ground floor: glass + sign band + striped awning.
  if (opts.shop) {
    const zz = z + d / 2;
    bucket.box(glassMat, x, 1.5, zz + 0.06, w - 2, 2.6, 0.08);
    bucket.box(trim, x, 3.1, zz + 0.12, w - 1.2, 0.7, 0.14);
    // Awning: alternating coloured stripes.
    const stripeW = 1.1;
    const n = Math.floor((w - 2) / stripeW);
    for (let i = 0; i < n; i++) {
      const mat = i % 2 ? new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 });
      bucket.box(mat, x - (w - 2) / stripeW + stripeW * (i + 0.5), 3.6, zz + 0.65, stripeW, 0.08, 1.3);
    }
  }
  return { x, z, w, d, h };
}

// ---------------------------------------------------------------------------
// People: Kai and the pedestrians. Stylised low-poly (the known ceiling),
// but jointed so arms and legs swing — and so a runner reads as running.
// ---------------------------------------------------------------------------

export function makePerson(palette) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin || 0xd9a066, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: palette.shirt || 0xf4f1de, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: palette.pants || 0x2b2d42, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: palette.hair || 0x2b2d42, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.28), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hair);
  hairM.position.y = 1.8;
  g.add(hairM);
  // Aviator sunglasses with golden lenses (Kai's signature).
  if (palette.sunglasses) {
    const lens = new THREE.MeshStandardMaterial({ color: 0xd4a017, emissive: 0x554400, roughness: 0.2, metalness: 0.7 });
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), lens);
    glasses.position.set(0, 1.62, 0.16);
    g.add(glasses);
  }
  const limbs = {};
  const mkLimb = (mat, w, h, d, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  };
  limbs.armL = mkLimb(shirt, 0.14, 0.62, 0.14, -0.34, 1.38);
  limbs.armR = mkLimb(shirt, 0.14, 0.62, 0.14, 0.34, 1.38);
  limbs.legL = mkLimb(pants, 0.18, 0.78, 0.18, -0.13, 0.8);
  limbs.legR = mkLimb(pants, 0.18, 0.78, 0.18, 0.13, 0.8);
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.3), shoe);
  footL.position.set(0, -0.78, 0.05);
  limbs.legL.add(footL);
  const footR = footL.clone();
  limbs.legR.add(footR);
  g.userData.limbs = limbs;
  g.userData.torso = torso;
  g.userData.head = head;
  return g;
}

// Swing the limbs. `phase` advances with distance travelled; `amp`
// controls how big the swing is. A runner uses a bigger amplitude, a
// faster phase and a forward lean; a walker is gentle and upright.
export function animatePerson(person, phase, amp, lean) {
  const L = person.userData.limbs;
  const s = Math.sin(phase);
  const c = Math.sin(phase + Math.PI);
  L.legL.rotation.x = s * amp;
  L.legR.rotation.x = c * amp;
  L.armL.rotation.x = c * amp * 0.85;
  L.armR.rotation.x = s * amp * 0.85;
  person.userData.torso.rotation.x = lean;
  person.userData.head.rotation.x = lean * 0.5;
}

// ---------------------------------------------------------------------------
// Helicopter: the SPD air unit. Built procedurally (no free GLB exists),
// body + tail boom + main rotor + tail rotor + skids + searchlight.
// ---------------------------------------------------------------------------

export function makeHelicopter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a3a52, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), glassMat);
  nose.position.set(0, 0.1, 2.4);
  g.add(nose);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat);
  boom.position.set(0, 0.25, -4.2);
  boom.castShadow = true;
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 1.2), darkMat);
  fin.position.set(0, 0.9, -6.2);
  g.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.18), darkMat);
  tailRotor.position.set(0.35, 0.5, -6.2);
  g.add(tailRotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), darkMat);
  mast.position.y = 0.95;
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.05, 0.42), darkMat);
    blade.castShadow = true;
    const holder = new THREE.Group();
    holder.rotation.y = (i * Math.PI) / 2;
    holder.add(blade);
    rotor.add(holder);
  }
  g.add(rotor);
  // Skids.
  for (const sx of [-0.85, 0.85]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.4), darkMat);
    skid.position.set(sx, -0.95, 0);
    g.add(skid);
    for (const sz of [-1.4, 1.4]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), darkMat);
      strut.position.set(sx, -0.6, sz);
      g.add(strut);
    }
  }
  // Searchlight under the nose + a red beacon on the tail.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6e5, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  const search = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lightMat);
  search.position.set(0, -0.75, 1.9);
  g.add(search);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xff2222, emissiveIntensity: 1 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), beaconMat);
  beacon.position.set(0, 1.0, -2.0);
  g.add(beacon);
  g.userData.rotor = rotor;
  g.userData.tailRotor = tailRotor;
  g.userData.beacon = beacon;
  return g;
}

// ---------------------------------------------------------------------------
// Palm tree, boat, shade sail, gold case, guns.
// ---------------------------------------------------------------------------

export function makePalm() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 0.8, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 4.6, 8), trunkMat);
  trunk.position.y = 2.3;
  trunk.rotation.z = 0.06;
  trunk.castShadow = true;
  g.add(trunk);
  // Wide fronds that droop outward and down, like a real palm crown.
  for (let i = 0; i < 10; i++) {
    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 3.0), leafMat);
    const a = (i / 10) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.35, 4.85 - (i % 2) * 0.25, Math.sin(a) * 1.35);
    frond.rotation.y = -a + Math.PI / 2;
    frond.rotation.x = 0.85;
    frond.castShadow = true;
    g.add(frond);
  }
  // A crown of coconuts.
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), nutMat);
    nut.position.set(Math.cos(i * 2.1) * 0.3, 4.55, Math.sin(i * 2.1) * 0.3);
    g.add(nut);
  }
  return g;
}

export function makeBoat() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.5 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6.5), hullMat);
  hull.position.y = 0.45;
  hull.castShadow = true;
  g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 6.6), stripeMat);
  stripe.position.y = 0.85;
  g.add(stripe);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 2.2), hullMat);
  cabin.position.set(0, 1.2, -0.6);
  cabin.castShadow = true;
  g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x1a3a52, roughness: 0.15, metalness: 0.5 }));
  glass.position.set(0, 1.35, 0.4);
  g.add(glass);
  return g;
}

export function makeShadeSail(colorHex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9, side: THREE.DoubleSide });
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), mat);
  sail.rotation.x = -Math.PI / 2;
  sail.rotation.z = 0.08;
  sail.position.y = 5.2;
  sail.castShadow = true;
  g.add(sail);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.5, metalness: 0.4 });
  for (const [px, pz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.2, 8), poleMat);
    pole.position.set(px, 2.6, pz);
    pole.castShadow = true;
    g.add(pole);
  }
  return g;
}

export function makeGoldCase() {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0x664400, roughness: 0.3, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.3), darkMat);
  body.position.y = 0.3;
  body.castShadow = true;
  g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.32), goldMat);
  lid.position.y = 0.62;
  g.add(lid);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.34), goldMat);
  glow.position.y = 0.3;
  g.add(glow);
  const point = new THREE.PointLight(0xffb703, 12, 9, 2);
  point.position.y = 1.2;
  g.add(point);
  return g;
}

export function makeGun(kind) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.4, metalness: 0.6 });
  if (kind === 1) {
    // Pistol.
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.34), dark);
    barrel.position.set(0, 0.02, 0.14);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), dark);
    grip.position.set(0, -0.06, -0.02);
    grip.rotation.x = 0.25;
    g.add(grip);
  } else {
    // SMG.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.55), dark);
    g.add(body);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.07), dark);
    mag.position.set(0, -0.12, 0.08);
    g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.3), dark);
    stock.position.set(0, 0, -0.4);
    g.add(stock);
  }
  return g;
}

// A sun disc: a bright circle that reads as the sun, not a glow blob.
export function makeSunDisc(radius) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff8e7, fog: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
  return disc;
}

// A simple glass skyscraper for the CBD (the second tower of the pair is
// the supertall GLB; these fill the skyline behind it).
export function makeGlassTower(w, h, d, tintHex) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.12, metalness: 0.65 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Vertical mullions every 3 m.
  const cols = Math.max(3, Math.floor(w / 3));
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + (i / cols) * w;
    for (const side of [1, -1]) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), frame);
      mull.position.set(x, h / 2, side * (d / 2 + 0.05));
      g.add(mull);
    }
  }
  // A crown that catches the sunset.
  const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 3, d * 0.6), frame);
  crown.position.y = h + 1.5;
  g.add(crown);
  return g;
}
