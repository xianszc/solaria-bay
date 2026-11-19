// Keyboard and mouse. The loop asks this module every frame what is
// held and what was just pressed, so gameplay never depends on event
// timing: held keys come back as -1..1 axes, and one-off actions
// (confirm, pause, enter, weapon, radio, mute) are queued as bits and
// consumed the first time the loop reads them.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_WEAPON_NEXT = 8;
export const ACTION_RADIO = 16;
export const ACTION_MUTE = 32;
export const ACTION_NITRO = 64;

// Keys that count as held movement (as opposed to one-off actions).
const MOVE_CODES = new Set([
  'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown',
  'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
]);

// One-off keys: which action bit they set. Digit2/Digit3 carry an extra
// bit so the loop can tell which weapon was picked.
const ACTION_KEYS = {
  Enter: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyF: ACTION_ENTER,
  Digit1: ACTION_WEAPON_NEXT,
  Digit2: ACTION_WEAPON_NEXT | 256,
  Digit3: ACTION_WEAPON_NEXT | 512,
  KeyQ: ACTION_RADIO,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  let pending = 0;
  let firing = false;
  let pointerX = 0;
  let pointerY = 0;

  function keyDown(e) {
    if (e.repeat) return;
    if (MOVE_CODES.has(e.code)) {
      held.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') pending |= ACTION_NITRO;
      e.preventDefault();
      return;
    }
    const action = ACTION_KEYS[e.code];
    if (action) pending |= action;
  }

  function keyUp(e) {
    held.delete(e.code);
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousedown', (e) => {
    firing = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    firing = false;
  });
  window.addEventListener('mousemove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());

  const up = () => held.has('KeyW') || held.has('ArrowUp');
  const downKey = () => held.has('KeyS') || held.has('ArrowDown');
  const left = () => held.has('KeyA') || held.has('ArrowLeft');
  const right = () => held.has('KeyD') || held.has('ArrowRight');
  const nitro = () => held.has('ShiftLeft') || held.has('ShiftRight');

  return {
    // Driving axes for this frame: throttle -1..1 (W/S), steering -1..1
    // (A is +1, left; D is -1, right), brake, nitro.
    drive() {
      return {
        throttle: (up() ? 1 : 0) - (downKey() ? 1 : 0),
        steer: (left() ? 1 : 0) - (right() ? 1 : 0),
        brake: held.has('Space'),
        nitro: nitro(),
      };
    },
    // Walking axes for this frame, in camera space: forward -1..1 (W/S),
    // strafe -1..1 (D is +1, right; A is -1, left), run.
    walk() {
      return {
        forward: (up() ? 1 : 0) - (downKey() ? 1 : 0),
        strafe: (right() ? 1 : 0) - (left() ? 1 : 0),
        run: nitro(),
      };
    },
    takeActions() {
      const out = pending;
      pending = 0;
      return out;
    },
    get firing() {
      return firing;
    },
    get pointer() {
      return { x: pointerX, y: pointerY };
    },
  };
}
