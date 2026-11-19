// The story: six missions with a clear arc — arrive, steal the GT, cross
// town, jump the raised drawbridge, go quiet, then the heist. The mission
// state lives in one object; each step kind has its own checker in a
// dispatch table, so adding a kind means adding one function, not
// another branch in a switch.
import { MISSIONS } from './config.js';

export function createMissions(world) {
  const state = {
    index: 0,
    step: 0,
    active: false,
    done: false,
    message: '',
    timer: 0,
  };

  // After the final mission the index runs past the list; keep showing
  // the last mission instead of crashing the HUD.
  function current() {
    return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
  }
  function currentStep() {
    const mission = current();
    return mission.steps[Math.min(state.step, mission.steps.length - 1)];
  }

  function showMarker() {
    const s = currentStep();
    if (s.kind === 'reach' || s.kind === 'grab') world.setMarker(s.x, s.z);
    else world.clearMarker();
  }

  function announce(text, seconds) {
    state.message = text;
    state.timer = seconds;
  }

  function start() {
    state.index = 0;
    state.step = 0;
    state.active = true;
    state.done = false;
    showMarker();
    announce(`MISSION 1: ${current().name} — ${current().objective}`, 6);
  }

  function advance() {
    state.step += 1;
    const mission = current();
    if (state.step >= mission.steps.length) {
      state.index += 1;
      state.step = 0;
      if (state.index >= MISSIONS.length) {
        state.active = false;
        state.done = true;
        world.clearMarker();
        announce('SOLARIA HEIST COMPLETE — the gold is yours, Kai.', 8);
        return 'victory';
      }
      announce(`MISSION ${state.index + 1}: ${current().name} — ${current().objective}`, 6);
    } else {
      announce(`Next: ${currentStep().label}`, 4);
    }
    showMarker();
    return 'advanced';
  }

  // One checker per step kind. Each takes the live game and the step
  // definition and answers: is this step done?
  const CHECKERS = {
    reach(game, s) {
      return Math.hypot(game.player.pos.x - s.x, game.player.pos.z - s.z) < s.radius;
    },
    grab(game, s) {
      if (game.currentCar) return false; // the case is taken on foot
      if (Math.hypot(game.player.pos.x - s.x, game.player.pos.z - s.z) >= s.radius) return false;
      game.hasGold = true;
      return true;
    },
    stealHero(game) {
      return !!(game.currentCar && game.currentCar.hero);
    },
    jumpGap(game) {
      // The car crossed the gap and is on the far deck (or beyond).
      const car = game.currentCar;
      return !!(car && car.pos.x > 472 && Math.abs(car.pos.z) <= 12);
    },
    loseCops(game) {
      return game.heat <= 0 && game.wantedStars === 0;
    },
  };

  // Test the current step against the live game state. Returns
  // 'advanced', 'victory' or null.
  function update(game) {
    if (!state.active || state.done) return null;
    const s = currentStep();
    const checker = CHECKERS[s.kind];
    if (checker && checker(game, s)) return advance();
    return null;
  }

  function tickMessage(dt) {
    if (state.timer > 0) state.timer -= dt;
  }

  function skipTo(n) {
    state.index = Math.min(n, MISSIONS.length - 1);
    state.step = 0;
    state.active = true;
    state.done = false;
    showMarker();
    announce(`MISSION ${state.index + 1}: ${current().name} — ${current().objective}`, 6);
  }

  return {
    get index() {
      return state.index;
    },
    get step() {
      return state.step;
    },
    get active() {
      return state.active;
    },
    get done() {
      return state.done;
    },
    get message() {
      return state.timer > 0 ? state.message : '';
    },
    current,
    currentStep,
    start,
    skipTo,
    update,
    tickMessage,
    setMessage(text, seconds = 5) {
      announce(text, seconds);
    },
  };
}
