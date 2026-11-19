// Rendering only: the three.js renderer, the chase/foot/title cameras
// and the fixed shot cameras. No game rules live here — it takes the
// world and a view description and paints one frame. The camera is
// smoothed, easing toward where it should be instead of snapping, and
// the yaw it reports is what walking is relative to.
import * as THREE from 'three';
import { CAMERA } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffc98a, 700, 1600);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 3200);

  // The smoothed camera: a position and a look target that ease toward
  // their goals instead of jumping there.
  const pos = new THREE.Vector3(0, 60, 120);
  const look = new THREE.Vector3(0, 0, 0);
  let cameraYaw = Math.PI;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function updateCamera(view, dt) {
    if (view.shotCam) {
      camera.position.copy(view.shotCam.pos);
      camera.lookAt(view.shotCam.lookAt);
      cameraYaw = Math.atan2(-(view.shotCam.lookAt.x - view.shotCam.pos.x), -(view.shotCam.lookAt.z - view.shotCam.pos.z));
      scene.userData.cameraPosition = camera.position;
      return;
    }
    const target = view.targetPos;
    const heading = view.targetHeading;
    // Forward on the ground for this heading is (-sin, -cos).
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    if (view.mode === 'title') {
      // A slow orbit over the city: the boulevard, the towers and the
      // bay in one frame, the sun low on the left.
      const t = view.time * 0.045;
      pos.lerp(new THREE.Vector3(Math.sin(t) * 260 - 60, 95, Math.cos(t) * 260), Math.min(1, dt * 1.2));
      look.lerp(new THREE.Vector3(-140, 45, 0), Math.min(1, dt * 1.2));
    } else if (view.inCar) {
      // Chase cam: behind and above the car, looking past it down the
      // road so the city reads in front of the car, not behind it.
      pos.lerp(new THREE.Vector3(target.x - fx * CAMERA.chaseDistance, target.y + CAMERA.chaseHeight, target.z - fz * CAMERA.chaseDistance), Math.min(1, dt * 7));
      look.lerp(new THREE.Vector3(target.x + fx * 8, target.y + 1.4, target.z + fz * 8), Math.min(1, dt * 9));
    } else {
      // Foot cam: over Kai's shoulder, close enough that he fills the
      // lower third of the frame and reads as a person.
      pos.lerp(new THREE.Vector3(target.x - fx * CAMERA.footDistance, target.y + CAMERA.footHeight, target.z - fz * CAMERA.footDistance), Math.min(1, dt * 8));
      look.lerp(new THREE.Vector3(target.x + fx * 5, target.y + 1.5, target.z + fz * 5), Math.min(1, dt * 10));
    }
    camera.position.copy(pos);
    camera.lookAt(look);
    cameraYaw = Math.atan2(-(look.x - pos.x), -(look.z - pos.z));
    scene.userData.cameraPosition = camera.position;
  }

  function draw(view, dt) {
    updateCamera(view, dt);
    renderer.render(scene, camera);
  }

  return {
    scene,
    camera,
    draw,
    get cameraYaw() {
      return cameraYaw;
    },
    snapCamera(view) {
      // Jump the smoothed camera to its target (used when teleporting).
      updateCamera(view, 1);
      pos.copy(camera.position);
      look.copy(view.shotCam ? view.shotCam.lookAt : look);
    },
  };
}
