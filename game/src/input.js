// Keyboard and mouse input. Keys are read as a bitfield each frame so the
// loop never depends on event timing; actions (confirm, pause, enter car,
// weapon switch, radio, mute) are edge-triggered and consumed by the loop.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_WEAPON_NEXT = 8;
export const ACTION_RADIO = 16;
export const ACTION_MUTE = 32;
export const ACTION_NITRO = 64;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'nitro',
  ShiftRight: 'nitro',
  Space: 'brake',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    const mapped = KEYMAP[e.code];
    if (mapped) {
      held.add(mapped);
      if (mapped === 'nitro') actions |= ACTION_NITRO;
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'Enter':
        actions |= ACTION_CONFIRM;
        break;
      case 'Escape':
      case 'KeyP':
        actions |= ACTION_PAUSE;
        break;
      case 'KeyF':
        actions |= ACTION_ENTER;
        break;
      case 'Digit1':
        actions |= ACTION_WEAPON_NEXT;
        break;
      case 'Digit2':
        actions |= ACTION_WEAPON_NEXT | 256;
        break;
      case 'Digit3':
        actions |= ACTION_WEAPON_NEXT | 512;
        break;
      case 'KeyQ':
        actions |= ACTION_RADIO;
        break;
      case 'KeyM':
        actions |= ACTION_MUTE;
        break;
      default:
        break;
    }
  }

  function onKeyUp(e) {
    const mapped = KEYMAP[e.code];
    if (mapped) held.delete(mapped);
  }

  function onMouseDown(e) {
    mouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());

  return {
    // -1..1 throttle (W/S) and steering (A/D) for this frame.
    drive() {
      const throttle = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      const steer = (held.has('left') ? 1 : 0) - (held.has('right') ? 1 : 0);
      return { throttle, steer, brake: held.has('brake'), nitro: held.has('nitro') };
    },
    // -1..1 walk direction in camera space for this frame.
    walk() {
      const forward = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      const strafe = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      return { forward, strafe, run: held.has('nitro') };
    },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    get firing() {
      return mouseDown;
    },
    get pointer() {
      return { x: mouseX, y: mouseY };
    },
  };
}
