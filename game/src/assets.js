// Asset loading for SOLARIA BAY v3.1: every GLB and PBR texture the
// game ships, loaded once up front (the boot awaits this module before
// the world is built). Real models replace the procedural cars and
// buildings: a lime Aventador hero, BlenderKit hero buildings, an OSM
// city block, a fleet of traffic / police / emergency vehicles, Poly
// Haven street furniture, and dark charcoal Asphalt025C.
//
// v3.1 additions: a real palm tree (BlenderKit "Palm Tree Medium
// Dense", CC0) replaces the procedural starburst palms, and real
// humans replace the blocky low-poly figures — the Gorgehold Scout
// (3dassets.dev, CC0), rigged and animated, is Kai and the male
// pedestrians; the Stylized Female (BlenderKit, Royalty Free), rigged
// but with NO animation clips, is the female pedestrians (her walk
// cycle is built in code, in characters.js).
//
// Orientation facts (measured in Blender, see the rebuild notes):
//  - Fleet / showroom cars face local -Z already (bonnet at -Y in Blender
//    = -Z in three.js), so they need no correction.
//  - The Aventador faces local +X (headlights at +X), so it needs an
//    inner rotation of +PI/2 to face -Z like everything else.
//  - Showroom cars sit 0.07-0.09 m below the ground; each entry carries
//    its lift so the wheels touch the asphalt.
//  - The Bajwa palm's base sits 0.30 m below its origin; at the 0.75x
//    scale the game uses, raise it 0.30 * 0.75 = 0.225 m.
//  - The Scout stands 1.81 m tall with his boots at local y = 0; do NOT
//    offset him by a bounding box (Box3 is wrong for skinned meshes).
//  - The Stylized Female stands 1.68 m tall, boots at local y = 0, and
//    faces +Z in three.js (nose at Blender -Y) — the same convention
//    as the Scout, so the same heading + PI group rotation faces her
//    where she walks. Her rest pose is a T-pose; characters.js brings
//    her arms down to her sides and drives her walk cycle.
// Wheels are the nodes whose name starts with "wheel" and has no "/"
// (the child meshes are named "wheel-.../alloy" and are skipped).

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';

// --- The vehicle catalogue: file, name, role, tuning, corrections ---------
const VEHICLES = {
  hero: { file: 'vehicles/hero.glb', name: 'SOLARIA GT', role: 'hero', color: 0x70e000, topSpeedKmh: 212, accel: 26, lift: 0, forwardY: Math.PI / 2 },
  policePatrol: { file: 'vehicles/police-patrol.glb', name: 'SPD INTERCEPTOR', role: 'police', topSpeedKmh: 196, accel: 30, lift: 0, forwardY: 0 },
  policeSuv: { file: 'vehicles/police-suv.glb', name: 'SPD INTERCEPTOR', role: 'police', topSpeedKmh: 188, accel: 28, lift: 0.083, forwardY: 0, repaint: { material: 'paint', color: 0xf4f6f8 } },
  taxi: { file: 'vehicles/taxi.glb', name: 'TAXI', role: 'traffic', topSpeedKmh: 96, accel: 20, lift: 0, forwardY: 0 },
  sedan: { file: 'vehicles/sedan.glb', name: 'SEDAN', role: 'traffic', topSpeedKmh: 92, accel: 20, lift: 0.077, forwardY: 0 },
  hatchback: { file: 'vehicles/hatchback.glb', name: 'HATCHBACK', role: 'traffic', topSpeedKmh: 88, accel: 20, lift: 0.066, forwardY: 0, repaint: { material: 'paint', color: 0xc0392b } },
  pickup: { file: 'vehicles/pickup.glb', name: 'PICKUP', role: 'traffic', topSpeedKmh: 94, accel: 22, lift: 0, forwardY: 0 },
  pickupOld: { file: 'vehicles/pickup-old.glb', name: 'PICKUP', role: 'traffic', topSpeedKmh: 82, accel: 18, lift: 0.076, forwardY: 0 },
  van: { file: 'vehicles/van.glb', name: 'VAN', role: 'traffic', topSpeedKmh: 86, accel: 18, lift: 0, forwardY: 0 },
  bus: { file: 'vehicles/bus.glb', name: 'BUS', role: 'traffic', topSpeedKmh: 78, accel: 14, lift: 0, forwardY: 0 },
  busLong: { file: 'vehicles/bus-long.glb', name: 'BUS', role: 'traffic', topSpeedKmh: 74, accel: 12, lift: 0, forwardY: 0 },
  ambulance: { file: 'vehicles/ambulance.glb', name: 'AMBULANCE', role: 'parked', topSpeedKmh: 100, accel: 20, lift: 0, forwardY: 0 },
  firePumper: { file: 'vehicles/fire-pumper.glb', name: 'FIRE ENGINE', role: 'parked', topSpeedKmh: 90, accel: 16, lift: 0, forwardY: 0 },
  fireLadder: { file: 'vehicles/fire-ladder.glb', name: 'FIRE LADDER', role: 'parked', topSpeedKmh: 84, accel: 14, lift: 0, forwardY: 0 },
  tow: { file: 'vehicles/tow.glb', name: 'TOW TRUCK', role: 'traffic', topSpeedKmh: 88, accel: 18, lift: 0, forwardY: 0 },
};

// --- The building catalogue: file, footprint (m), height, role -------------
const BUILDINGS = {
  medApartment: { file: 'buildings/med-apartment.glb', name: 'Mediterranean Apartments', w: 18.7, d: 18.7, h: 15.9 },
  frenchApartment: { file: 'buildings/french-apartment.glb', name: 'Haussmann Block', w: 45.0, d: 35.0, h: 56.0 },
  hotel: { file: 'buildings/hotel.glb', name: 'Hotel Marisol', w: 24.9, d: 16.7, h: 21.6 },
  restaurant: { file: 'buildings/restaurant.glb', name: 'Restaurant Row', w: 37.7, d: 18.0, h: 10.3 },
  supertall: { file: 'buildings/supertall.glb', name: 'Prism Tower', w: 60.0, d: 79.2, h: 240.5 },
  osmBlock: { file: 'buildings/osm-block.glb', name: 'OSM District', w: 268.5, d: 307.9, h: 25.8 },
};

// --- v3.1: the real palm and the real humans --------------------------------
// Bajwa palm: "Palm Tree Medium Dense" (BlenderKit, CC0 1.0), Draco,
// 2 meshes, 15,851 faces, 15.29 m tall, base 0.30 m below its origin.
// The game scales it 0.75x and raises it 0.225 m (see the header note).
// Scout: Gorgehold Scout (3dassets.dev, CC0 1.0), NOT Draco, 1.81 m,
// rigged (74 bones) with idle / walk / run / grasp clips. The GLB ships
// a stray 1.9 m helper sphere named "Icosphere" that must be removed
// on load, or it inflates every bounding box and can render as a giant
// ball. One file serves Kai AND every male pedestrian (cloned per
// person), so the game stays under the 48 MiB cap.
// Female: "Stylized Female Character" (BlenderKit, Royalty Free),
// 1.68 m, Rigify rig (706 bones) but NO animation clips — her walk
// cycle is built in code. The optimised GLB still ships the same stray
// "Icosphere" helper sphere, so it is removed on load exactly like the
// Scout's. One file serves every female pedestrian (cloned per person);
// Kai stays the Scout — the female is NPCs only, never the player.
const PALM_FILE = 'palms/bajwa.glb';
const SCOUT_FILE = 'characters/scout.glb';
const FEMALE_FILE = 'characters/female.glb';

function makeLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('./vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

function loadGLB(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, (e) => reject(new Error(`${url}: ${e && e.message ? e.message : e}`)));
  });
}

// Full glTF (scene + animations) — the Scout needs his clips, and the
// plain scene-only loader above throws them away.
function loadGLBFull(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g), undefined, (e) => reject(new Error(`${url}: ${e && e.message ? e.message : e}`)));
  });
}

function loadTexture(url, srgb) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      resolve(t);
    }, undefined, (e) => reject(new Error(`${url}: ${e && e.message ? e.message : e}`)));
  });
}

// Wheel pivots: nodes named "wheel-..." with no "/" (child meshes are
// named "wheel-.../alloy" and must not be treated as pivots).
function findWheelNames(root) {
  const names = [];
  root.traverse((o) => {
    if (typeof o.name === 'string' && o.name.toLowerCase().startsWith('wheel') && !o.name.includes('/')) {
      names.push(o.name);
    }
  });
  return names;
}

// Repaint a material by name on the loaded template (clones the material
// so the repaint does not leak into other vehicles sharing the name).
function repaintMaterial(root, materialName, colorHex) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (m && m.name === materialName) {
        const copy = m.clone();
        if (copy.color) copy.color.setHex(colorHex);
        if (Array.isArray(o.material)) o.material[i] = copy;
        else o.material = copy;
      }
    });
  });
}

// Police light bars: collect the meshes using the red/blue beacon
// materials so the game can blink them. Materials are cloned per vehicle
// type so blinking one car does not blink them all.
function collectBeacon(root, redNames, blueNames) {
  const red = [];
  const blue = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (!m) return;
      if (redNames.includes(m.name)) {
        const copy = m.clone();
        if (Array.isArray(o.material)) o.material[i] = copy;
        else o.material = copy;
        red.push(copy);
      } else if (blueNames.includes(m.name)) {
        const copy = m.clone();
        if (Array.isArray(o.material)) o.material[i] = copy;
        else o.material = copy;
        blue.push(copy);
      }
    });
  });
  return { red, blue };
}

// The police SUV ships with a red roof bar only. Add a blue bar beside it
// so it reads as a police light bar, and hand back both materials.
function addBlueBarToSuv(root) {
  let barCenter = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && m.name === 'accent')) {
      const box = new THREE.Box3().setFromObject(o);
      barCenter = box.getCenter(new THREE.Vector3());
    }
  });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x111188, roughness: 0.4, metalness: 0.2 });
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42), blueMat);
  if (barCenter) blue.position.set(barCenter.x + 0.62, barCenter.y, barCenter.z);
  else blue.position.set(0.62, 2.0, 0);
  blue.castShadow = true;
  root.add(blue);
  // The red bar: clone its accent material so blinking stays local.
  const red = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (m && m.name === 'accent') {
        const copy = m.clone();
        if (copy.emissive) copy.emissive.setHex(0x881111);
        if (Array.isArray(o.material)) o.material[i] = copy;
        else o.material = copy;
        red.push(copy);
      }
    });
  });
  return { red, blue: [blueMat] };
}

// Remove the stray helper sphere that both human GLBs ship with. It is a
// 1.9 m ball named "Icosphere"; left in place it inflates every bounding
// box and can render as a giant ball. Called on the template, so no
// clone ever inherits it.
function removeStrayIcosphere(root) {
  const stray = [];
  root.traverse((o) => {
    if (o.name === 'Icosphere') stray.push(o);
  });
  for (const o of stray) {
    if (o.parent) o.parent.remove(o);
  }
}

export async function loadGameAssets() {
  const loader = makeLoader();
  const base = './assets/';

  // --- Vehicles (hero + the whole fleet) ------------------------------------
  const vehicles = {};
  for (const [key, spec] of Object.entries(VEHICLES)) {
    const scene = await loadGLB(loader, base + spec.file);
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    if (spec.repaint) repaintMaterial(scene, spec.repaint.material, spec.repaint.color);
    let beacon = { red: [], blue: [] };
    if (key === 'policePatrol') beacon = collectBeacon(scene, ['lightRed'], ['lightBlue']);
    else if (key === 'policeSuv') beacon = addBlueBarToSuv(scene);
    vehicles[key] = {
      ...spec,
      template: scene,
      wheelNames: findWheelNames(scene),
      beacon,
    };
  }

  // --- Buildings -------------------------------------------------------------
  const buildings = {};
  for (const [key, spec] of Object.entries(BUILDINGS)) {
    const scene = await loadGLB(loader, base + spec.file);
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // The supertall's facade is very dark; its east face never sees the
    // low western sun, so without this it reads as a black monolith.
    // Brighten its materials so the balconies and glass read in shadow.
    if (key === 'supertall') {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.color) m.color.multiplyScalar(1.9);
          if (m && m.roughness !== undefined) m.roughness = Math.min(1, m.roughness * 0.8);
        }
      });
    }
    buildings[key] = { ...spec, template: scene };
  }

  // --- Street furniture + traffic signal --------------------------------------
  const lamp = await loadGLB(loader, base + 'lamp.glb');
  const hydrant = await loadGLB(loader, base + 'hydrant.glb');
  const bench = await loadGLB(loader, base + 'bench.glb');
  const trafficSignal = await loadGLB(loader, base + 'traffic-signal.glb');
  for (const root of [lamp, hydrant, bench, trafficSignal]) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // --- The Bajwa palm (v3.1) --------------------------------------------------
  // Draco-compressed; the loader above already carries the DRACO decoder.
  // Two meshes, so a dozen instances along the boulevard and the marina
  // cost almost nothing in draw calls.
  const palm = await loadGLB(loader, base + PALM_FILE);
  palm.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // --- The Gorgehold Scout (v3.1): Kai and the male pedestrians ---------------
  // Loaded once; each person gets a SkeletonUtils clone of this template
  // (the clone gets its own skeleton so the walk/run clips play per
  // person). The stray Icosphere helper sphere is removed here, on the
  // template, so no clone ever inherits it.
  const scoutGltf = await loadGLBFull(loader, base + SCOUT_FILE);
  const scoutScene = scoutGltf.scene;
  removeStrayIcosphere(scoutScene);
  scoutScene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const scout = { template: scoutScene, animations: scoutGltf.animations };

  // --- The Stylized Female (v3.1): the female pedestrians ---------------------
  // Loaded once; each female pedestrian gets a SkeletonUtils clone of
  // this template (her own skeleton, so the code-built walk cycle plays
  // per person). She ships NO animation clips — characters.js builds
  // her walk cycle as an AnimationClip on the Rigify DEF bones. The
  // same stray Icosphere is removed here, on the template.
  const femaleScene = await loadGLB(loader, base + FEMALE_FILE);
  removeStrayIcosphere(femaleScene);
  femaleScene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const female = { template: femaleScene };

  // --- Asphalt025C PBR (dark charcoal) ----------------------------------------
  const [asphaltMap, asphaltNormal, asphaltRough, asphaltAo] = await Promise.all([
    loadTexture(base + 'asphalt-color.jpg', true),
    loadTexture(base + 'asphalt-normal.jpg', false),
    loadTexture(base + 'asphalt-rough.jpg', false),
    loadTexture(base + 'asphalt-ao.jpg', false),
  ]);

  return {
    vehicles,
    buildings,
    furniture: { lamp, hydrant, bench },
    trafficSignal,
    palm,
    scout,
    female,
    asphalt: { map: asphaltMap, normal: asphaltNormal, rough: asphaltRough, ao: asphaltAo },
  };
}
