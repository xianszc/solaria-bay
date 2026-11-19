// Rendering only: the three.js renderer, the chase/foot/title cameras and
// the fixed shot cameras. No game rules live here — it takes the world and
// a view description and paints one frame.
import * as THREE from 'three';

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
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3200);

  // Smoothed camera state so the chase cam never snaps.
  const camPos = new THREE.Vector3(0, 60, 120);
  const camLook = new THREE.Vector3(0, 0, 0);
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
    if (view.mode === 'title') {
      const t = view.time * 0.045;
      const radius = 300;
      const want = new THREE.Vector3(Math.sin(t) * radius - 60, 110, Math.cos(t) * radius);
      camPos.lerp(want, Math.min(1, dt * 1.2));
      camLook.lerp(new THREE.Vector3(-180, 60, 0), Math.min(1, dt * 1.2));
    } else if (view.inCar) {
      const back = 10.5;
      const height = 4.0;
      const fx = -Math.sin(heading);
      const fz = -Math.cos(heading);
      const want = new THREE.Vector3(target.x - fx * back, target.y + height, target.z - fz * back);
      camPos.lerp(want, Math.min(1, dt * 7));
      camLook.lerp(new THREE.Vector3(target.x + fx * 8, target.y + 1.4, target.z + fz * 8), Math.min(1, dt * 9));
    } else {
      const back = 6.0;
      const height = 3.0;
      const fx = -Math.sin(heading);
      const fz = -Math.cos(heading);
      const want = new THREE.Vector3(target.x - fx * back, target.y + height, target.z - fz * back);
      camPos.lerp(want, Math.min(1, dt * 8));
      camLook.lerp(new THREE.Vector3(target.x + fx * 5, target.y + 1.5, target.z + fz * 5), Math.min(1, dt * 10));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    cameraYaw = Math.atan2(-(camLook.x - camPos.x), -(camLook.z - camPos.z));
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
      camPos.copy(camera.position);
      camLook.copy(view.shotCam ? view.shotCam.lookAt : camLook);
    },
  };
}
