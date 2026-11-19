// Rendering only: the three.js renderer, the chase / foot / title
// cameras and the fixed shot cameras. No game rules live here — it takes
// the world and a view description and paints one frame. The camera is
// a chase camera: it trails behind the car or the player, smoothed so
// it never snaps, and it looks slightly ahead of where they are going.

import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createCamera() {
  return new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 3200);
}

// Smooth a value toward a target: 1 - 0.5^(dt*k) is frame-rate independent.
function damp(current, target, k, dt) {
  const a = 1 - Math.pow(0.5, dt * k);
  return current + (target - current) * a;
}

// `view` is { mode: 'chase' | 'foot' | 'title' | 'fixed', yaw, pitch,
// target: Vector3, pos: Vector3 (for fixed) }.
export function updateCamera(camera, view, dt) {
  if (view.mode === 'fixed') {
    camera.position.copy(view.pos);
    camera.lookAt(view.target);
    return;
  }
  const t = view.target;
  let dist;
  let height;
  let lookAhead = 4;
  if (view.mode === 'chase') {
    dist = CAMERA.chaseDistance;
    height = CAMERA.chaseHeight;
    lookAhead = 7;
  } else if (view.mode === 'foot') {
    dist = CAMERA.footDistance;
    height = CAMERA.footHeight;
    lookAhead = 2.5;
  } else {
    // Title: a slow orbit over the marina, looking at the towers.
    const a = view.time * 0.04;
    const px = -40 + Math.cos(a) * 120;
    const pz = 282 + Math.sin(a) * 120;
    camera.position.set(px, 55, pz);
    camera.lookAt(-280, 60, 0);
    return;
  }
  const yaw = view.yaw;
  const pitch = view.pitch || 0;
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const want = new THREE.Vector3(
    t.x + back.x * dist,
    t.y + height + Math.sin(pitch) * dist * 0.4,
    t.z + back.z * dist,
  );
  camera.position.x = damp(camera.position.x, want.x, 6, dt);
  camera.position.y = damp(camera.position.y, want.y, 6, dt);
  camera.position.z = damp(camera.position.z, want.z, 6, dt);
  const look = new THREE.Vector3(
    t.x - back.x * lookAhead,
    t.y + 1.2,
    t.z - back.z * lookAhead,
  );
  camera.lookAt(look);
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
