// Model builders: every vehicle, person and prop in Solaria Bay is built
// here from primitives, so a car reads as a car at a glance. The rule for
// every model is the same: a real silhouette first, then details.
// Orientation: a vehicle's FRONT is local -z (headlights, nose,
// windshield) and its REAR is local +z (wing, taillights). The driving
// code moves a car along (-sin(heading), -cos(heading)), which is exactly
// local -z under rotation.y = heading, so the mesh always faces where it
// drives. (v1 had this backwards — headlights on the trailing side —
// which is part of why its cars read as boxes.)
import * as THREE from 'three';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function gloss(color, shininess = 90) {
  return new THREE.MeshPhongMaterial({ color, shininess, specular: 0x777788 });
}
function glassMat() {
  return new THREE.MeshPhongMaterial({ color: 0x14202f, shininess: 160, specular: 0xbbccdd });
}

function part(geo, material, x, y, z, parent) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// One road wheel: a dark tire with a silver hub on the outer face, so it
// reads as a wheel from the side instead of a black disc.
function makeWheel() {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), lambert(0x0c0d10));
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10), lambert(0xb8bec8));
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  return wheel;
}

// A wheel-arch lip: a dark half-ring above a wheel, so the wheel sits in
// an arch instead of floating beside a slab.
function makeArch(material) {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 6, 12, Math.PI), material);
  arch.rotation.z = 0;
  arch.rotation.y = Math.PI / 2;
  return arch;
}

// --- The hero: a 1980s wedge supercar (Countach / Esprit silhouette) ------
// Long low nose, sloped hood, raked windshield, set-back cabin, wide rear
// deck with louvers and a wing, side intakes, flared arches. Acid lime.
export function buildHeroCar(color) {
  const car = new THREE.Group();
  const body = gloss(color, 110);
  const trim = lambert(0x111111);
  const glass = glassMat();

  // Nose: a low wedge sloping down to the front, with a thin front lip.
  const nose = part(new THREE.BoxGeometry(1.9, 0.42, 1.5), body, 0, 0.5, -1.55, car);
  nose.rotation.x = 0.14;
  part(new THREE.BoxGeometry(1.94, 0.14, 0.5), trim, 0, 0.34, -2.22, car); // front spoiler lip
  // Hood: the long flat wedge from the nose back to the windshield.
  const hood = part(new THREE.BoxGeometry(1.86, 0.3, 1.3), body, 0, 0.66, -0.75, car);
  hood.rotation.x = 0.1;
  // Main body: the wide low slab the cabin sits on.
  part(new THREE.BoxGeometry(1.92, 0.5, 2.5), body, 0, 0.62, 0.35, car);
  // Windshield: a raked dark glass plane leaning back from the hood.
  const shield = part(new THREE.BoxGeometry(1.6, 0.08, 1.05), glass, 0, 0.98, -0.42, car);
  shield.rotation.x = -0.62;
  // Cabin: low glasshouse set well back, with a slim roof.
  part(new THREE.BoxGeometry(1.5, 0.42, 1.15), glass, 0, 1.08, 0.28, car);
  part(new THREE.BoxGeometry(1.44, 0.08, 1.05), body, 0, 1.32, 0.28, car); // roof panel
  // Rear deck with engine louvers and the wing on two struts.
  part(new THREE.BoxGeometry(1.86, 0.3, 0.9), body, 0, 0.82, 1.25, car);
  for (let i = 0; i < 4; i += 1) {
    part(new THREE.BoxGeometry(1.7, 0.05, 0.1), trim, 0, 0.99, 1.05 + i * 0.16, car);
  }
  part(new THREE.BoxGeometry(0.1, 0.3, 0.12), trim, -0.7, 1.05, 1.55, car); // wing struts
  part(new THREE.BoxGeometry(0.1, 0.3, 0.12), trim, 0.7, 1.05, 1.55, car);
  part(new THREE.BoxGeometry(1.9, 0.08, 0.42), trim, 0, 1.22, 1.58, car); // rear wing
  // Side skirts and the black side intakes behind the doors.
  part(new THREE.BoxGeometry(0.08, 0.22, 1.6), trim, -0.98, 0.42, 0.1, car);
  part(new THREE.BoxGeometry(0.08, 0.22, 1.6), trim, 0.98, 0.42, 0.1, car);
  part(new THREE.BoxGeometry(0.06, 0.3, 0.7), trim, -0.99, 0.72, 0.55, car);
  part(new THREE.BoxGeometry(0.06, 0.3, 0.7), trim, 0.99, 0.72, 0.55, car);
  // Pop-up headlights (closed) and the full-width rear light bar.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  part(new THREE.BoxGeometry(0.42, 0.1, 0.1), headMat, -0.62, 0.62, -2.28, car);
  part(new THREE.BoxGeometry(0.42, 0.1, 0.1), headMat, 0.62, 0.62, -2.28, car);
  part(new THREE.BoxGeometry(1.7, 0.14, 0.08), tailMat, 0, 0.72, 1.72, car);
  // Wheels: wide, set out at the corners, with flared arch lips above.
  const wheels = [];
  for (const [wx, wz] of [[-0.92, -1.35], [0.92, -1.35], [-0.92, 1.3], [0.92, 1.3]]) {
    const wheel = makeWheel();
    wheel.position.set(wx, 0.4, wz);
    car.add(wheel);
    wheels.push(wheel);
    const arch = makeArch(trim);
    arch.position.set(wx, 0.42, wz);
    car.add(arch);
  }
  car.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { group: car, wheels };
}

// --- A sedan: traffic cars and the SPD interceptor --------------------------
// A proper three-box sedan: long hood, cabin, trunk, all four wheels
// visible below the body line, bumpers front and rear.
export function buildSedan(color, police = false) {
  const car = new THREE.Group();
  const body = gloss(police ? 0xf4f6f8 : color, 80);
  const trim = lambert(0x111111);
  const glass = glassMat();

  // Hood, cabin, trunk: three boxes that read as a sedan, not one slab.
  const hood = part(new THREE.BoxGeometry(1.8, 0.42, 1.25), body, 0, 0.66, -1.35, car);
  hood.rotation.x = 0.06;
  part(new THREE.BoxGeometry(1.82, 0.55, 2.0), body, 0, 0.66, -0.05, car);
  part(new THREE.BoxGeometry(1.78, 0.4, 1.0), body, 0, 0.66, 1.5, car);
  // Cabin with a raked windshield and rear glass.
  const shield = part(new THREE.BoxGeometry(1.55, 0.08, 0.95), glass, 0, 1.0, -0.75, car);
  shield.rotation.x = -0.5;
  part(new THREE.BoxGeometry(1.5, 0.5, 1.35), glass, 0, 1.22, 0.05, car);
  part(new THREE.BoxGeometry(1.54, 0.08, 0.08), body, 0, 1.5, 0.05, car); // roof
  const rearGlass = part(new THREE.BoxGeometry(1.5, 0.08, 0.8), glass, 0, 1.0, 0.85, car);
  rearGlass.rotation.x = 0.45;
  // Bumpers.
  part(new THREE.BoxGeometry(1.86, 0.22, 0.18), trim, 0, 0.42, -2.02, car);
  part(new THREE.BoxGeometry(1.86, 0.22, 0.18), trim, 0, 0.42, 2.02, car);
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  part(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat, -0.6, 0.68, -2.0, car);
  part(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat, 0.6, 0.68, -2.0, car);
  part(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat, -0.6, 0.68, 2.0, car);
  part(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat, 0.6, 0.68, 2.0, car);

  let lightbar = null;
  if (police) {
    // Black doors and hood band: the SPD black-and-white livery.
    part(new THREE.BoxGeometry(1.84, 0.34, 1.9), lambert(0x14181f), 0, 0.72, -0.05, car);
    part(new THREE.BoxGeometry(1.84, 0.1, 1.2), lambert(0x14181f), 0, 0.9, -1.35, car);
    // Light bar: red on the left, blue on the right, on the roof.
    const barBase = part(new THREE.BoxGeometry(1.3, 0.12, 0.5), trim, 0, 1.62, 0.05, car);
    void barBase;
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.42), new THREE.MeshLambertMaterial({ color: 0xff2d2d, emissive: 0x881111 }));
    red.position.set(-0.32, 1.74, 0.05);
    red.name = 'lightbar-red';
    car.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.42), new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x111188 }));
    blue.position.set(0.32, 1.74, 0.05);
    blue.name = 'lightbar-blue';
    car.add(blue);
    lightbar = { red, blue };
    // Push bar on the nose.
    part(new THREE.BoxGeometry(1.5, 0.3, 0.12), trim, 0, 0.55, -2.1, car);
  }

  const wheels = [];
  for (const [wx, wz] of [[-0.88, -1.35], [0.88, -1.35], [-0.88, 1.35], [0.88, 1.35]]) {
    const wheel = makeWheel();
    wheel.position.set(wx, 0.4, wz);
    car.add(wheel);
    wheels.push(wheel);
  }
  car.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { group: car, wheels, lightbar };
}

// --- The SPD helicopter ------------------------------------------------------
// Light body (a dark body reads as a black cross from below), teal glass
// cockpit, tail boom, main rotor, tail rotor, skids. No searchlight cone
// (it reads as a strange triangle in stills) — just a soft light pool.
export function buildHelicopter() {
  const group = new THREE.Group();
  const bodyMat = lambert(0xe8e8e8);
  const body = part(new THREE.BoxGeometry(3.2, 1.5, 5.6), bodyMat, 0, 0, 0, group);
  void body;
  part(new THREE.BoxGeometry(3.3, 0.35, 5.7), lambert(0x1b263b), 0, -0.35, 0, group); // dark belly stripe
  part(new THREE.BoxGeometry(2.4, 1.0, 1.8), glassMat(), 0, 0.25, -2.2, group); // glass cockpit
  part(new THREE.BoxGeometry(0.7, 0.7, 4.8), bodyMat, 0, 0.35, 4.6, group); // tail boom
  const fin = part(new THREE.BoxGeometry(0.12, 1.6, 1.2), bodyMat, 0, 0.8, 6.8, group);
  void fin;
  const rotor = part(new THREE.BoxGeometry(10.5, 0.1, 0.6), lambert(0x111111), 0, 1.15, 0, group);
  const tailRotor = part(new THREE.BoxGeometry(0.1, 2.0, 0.5), lambert(0x111111), 0.45, 0.9, 6.6, group);
  part(new THREE.BoxGeometry(0.25, 0.25, 4.6), bodyMat, -1.25, -1.05, 0, group); // skids
  part(new THREE.BoxGeometry(0.25, 0.25, 4.6), bodyMat, 1.25, -1.05, 0, group);
  part(new THREE.BoxGeometry(0.2, 0.5, 0.2), bodyMat, -1.25, -0.8, 1.6, group);
  part(new THREE.BoxGeometry(0.2, 0.5, 0.2), bodyMat, 1.25, -0.8, 1.6, group);
  part(new THREE.BoxGeometry(0.2, 0.5, 0.2), bodyMat, -1.25, -0.8, -1.6, group);
  part(new THREE.BoxGeometry(0.2, 0.5, 0.2), bodyMat, 1.25, -0.8, -1.6, group);
  // Soft light pool on the ground beneath it.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6e5, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  group.add(pool);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { group, rotor, tailRotor, pool };
}

// --- A royal palm: leaning trunk, a crown of drooping fronds ----------------
export function buildPalm() {
  const palm = new THREE.Group();
  const trunk = part(new THREE.CylinderGeometry(0.26, 0.44, 7, 6), lambert(0x8a6b4a), 0, 3.5, 0, palm);
  trunk.rotation.z = 0.05;
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const frond = part(new THREE.BoxGeometry(4.8, 0.1, 1.15), lambert(0x3fae5a), Math.cos(angle) * 2.0, 7.2, Math.sin(angle) * 2.0, palm);
    frond.rotation.y = -angle;
    frond.rotation.z = 0.38; // droop: the tip hangs down
  }
  part(new THREE.SphereGeometry(0.7, 6, 5), lambert(0x6b4f2a), 0, 7.0, 0, palm);
  palm.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return palm;
}

// --- A moored sailboat for the marina ----------------------------------------
export function buildBoat() {
  const boat = new THREE.Group();
  part(new THREE.BoxGeometry(2.2, 1.0, 7), lambert(0xf4f1de), 0, 0.4, 0, boat);
  const bow = part(new THREE.ConeGeometry(1.1, 2.2, 4), lambert(0xf4f1de), 0, 0.4, 4.4, boat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  part(new THREE.CylinderGeometry(0.09, 0.09, 6.5, 5), lambert(0x5a4632), 0, 3.6, 0, boat);
  part(new THREE.BoxGeometry(0.12, 4.4, 2.6), lambert(0xff8c42), 0, 3.4, -0.9, boat);
  boat.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return boat;
}
