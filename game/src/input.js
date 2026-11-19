// Keyboard and mouse. The loop asks this module every frame what is
// held and what was just pressed, so gameplay never depends on event
// timing: held keys come back as -1..1 axes, and one-off actions
// (steal, shoot, pause, radio) arrive as edge-triggered flags that the
// loop consumes once. The pointer locks to the canvas on click so the
// mouse steers the view; Esc releases it.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let yaw = 0;
  let pitch = 0;
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    if (!locked) return;
    yaw -= e.movementX * 0.0028;
    pitch = Math.max(-0.5, Math.min(0.45, pitch + e.movementY * 0.0022));
  }
  function onClick() {
    if (!locked) canvas.requestPointerLock();
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLockChange);

  const input = {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get locked() { return locked; },
    setYaw(v) { yaw = v; },
    // Axes, -1..1.
    drive() {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      return { throttle: fwd, steer, nitro: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    walk() {
      // WASD relative to the camera yaw.
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      return {
        x: -sy * f + cy * r,
        z: -cy * f - sy * r,
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    // Edge-triggered: true once, then cleared by the loop.
    consume(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    clearPressed() {
      pressed.clear();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
  return input;
}
