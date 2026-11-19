// The story: six missions with a clear arc — arrive, steal the GT, cross
// town, jump the raised drawbridge, go quiet, then the heist. Each step
// is one of a few kinds the game knows how to test: reach a place, steal
// the hero car, cross the gap, grab the case, lose the cops.
import { MISSIONS } from './config.js';

export function createMissions(world) {
  let index = 0;
  let step = 0;
  let active = false;
  let done = false;
  let message = '';
  let messageTimer = 0;

  function current() {
    // After the final mission the index runs past the list; keep showing
    // the last mission instead of crashing the HUD.
    return MISSIONS[Math.min(index, MISSIONS.length - 1)];
  }
  function currentStep() {
    const mission = current();
    return mission.steps[Math.min(step, mission.steps.length - 1)];
  }

  function start() {
    index = 0;
    step = 0;
    active = true;
    done = false;
    const s = currentStep();
    if (s.kind === 'reach' || s.kind === 'grab') world.setMarker(s.x, s.z);
    message = `MISSION ${index + 1}: ${current().name} — ${current().objective}`;
    messageTimer = 6;
  }

  function advance() {
    step += 1;
    const mission = current();
    if (step >= mission.steps.length) {
      index += 1;
      step = 0;
      if (index >= MISSIONS.length) {
        active = false;
        done = true;
        world.clearMarker();
        message = 'SOLARIA HEIST COMPLETE — the gold is yours, Kai.';
        messageTimer = 8;
        return 'victory';
      }
      message = `MISSION ${index + 1}: ${current().name} — ${current().objective}`;
      messageTimer = 6;
    } else {
      message = `Next: ${currentStep().label}`;
      messageTimer = 4;
    }
    const s = currentStep();
    if (s.kind === 'reach' || s.kind === 'grab') world.setMarker(s.x, s.z);
    else world.clearMarker();
    return 'advanced';
  }

  // Test the current step against the live game state. Returns
  // 'advanced', 'victory' or null.
  function update(game) {
    if (!active || done) return null;
    const s = currentStep();
    const px = game.player.pos.x;
    const pz = game.player.pos.z;
    switch (s.kind) {
      case 'reach': {
        if (Math.hypot(px - s.x, pz - s.z) < s.radius) return advance();
        break;
      }
      case 'grab': {
        if (!game.currentCar && Math.hypot(px - s.x, pz - s.z) < s.radius) {
          game.hasGold = true;
          return advance();
        }
        break;
      }
      case 'stealHero': {
        if (game.currentCar && game.currentCar.hero) return advance();
        break;
      }
      case 'jumpGap': {
        // The car crossed the gap and is on the far deck (or beyond).
        const car = game.currentCar;
        if (car && car.pos.x > 472 && Math.abs(car.pos.z) <= 12) return advance();
        break;
      }
      case 'loseCops': {
        if (game.heat <= 0 && game.wantedStars === 0) return advance();
        break;
      }
      default:
        break;
    }
    return null;
  }

  function tickMessage(dt) {
    if (messageTimer > 0) messageTimer -= dt;
  }

  function skipTo(n) {
    index = Math.min(n, MISSIONS.length - 1);
    step = 0;
    active = true;
    done = false;
    const s = currentStep();
    if (s.kind === 'reach' || s.kind === 'grab') world.setMarker(s.x, s.z);
    else world.clearMarker();
    message = `MISSION ${index + 1}: ${current().name} — ${current().objective}`;
    messageTimer = 6;
  }

  return {
    get index() {
      return index;
    },
    get step() {
      return step;
    },
    get active() {
      return active;
    },
    get done() {
      return done;
    },
    get message() {
      return messageTimer > 0 ? message : '';
    },
    current,
    currentStep,
    start,
    skipTo,
    update,
    tickMessage,
    setMessage(text, seconds = 5) {
      message = text;
      messageTimer = seconds;
    },
  };
}
