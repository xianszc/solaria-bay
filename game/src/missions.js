// The story: six missions with a clear arc — arrive, steal the GT, cross
// town, jump the raised drawbridge, go quiet, then the heist. The mission
// state lives in one object; each step kind has its own checker. When
// every step of the last mission is done, the game is won.

import { MISSIONS } from './config.js';

export function createMissions() {
  return {
    index: 0,
    step: 0,
    done: false,
    justAdvanced: false, // set for one frame when a step completes
    justFinished: false, // set for one frame when a mission completes
    get current() {
      return MISSIONS[this.index];
    },
    get currentStep() {
      return this.current ? this.current.steps[this.step] : null;
    },
    get isLast() {
      return this.index === MISSIONS.length - 1;
    },
  };
}

// Advance one step; if the mission is finished, move to the next.
function advance(missions) {
  missions.step += 1;
  missions.justAdvanced = true;
  if (missions.step >= missions.current.steps.length) {
    missions.index += 1;
    missions.step = 0;
    missions.justFinished = true;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
    }
  }
}

// Check the current step against the live game. `ctx` carries the player,
// the car they are in (or null), the police, the world, and whether the
// gold case is already in hand. Returns nothing; the flags on `missions`
// tell the caller what happened this frame.
export function updateMissions(missions, ctx) {
  missions.justAdvanced = false;
  missions.justFinished = false;
  if (missions.done) return;
  const step = missions.currentStep;
  if (!step) return;
  const { player, playerCar, police, world } = ctx;
  const px = playerCar ? playerCar.x : player.x;
  const pz = playerCar ? playerCar.z : player.z;

  if (step.kind === 'reach') {
    if (Math.hypot(px - step.x, pz - step.z) < step.radius) advance(missions);
  } else if (step.kind === 'stealHero') {
    if (playerCar && playerCar.key === 'hero') advance(missions);
  } else if (step.kind === 'jumpGap') {
    // Past the gap, on the far deck, moving east.
    if (playerCar && playerCar.x > 472 && Math.abs(playerCar.z) <= 12) advance(missions);
  } else if (step.kind === 'loseCops') {
    // On Solaria Key (mission 5) or back on the mainland (mission 6)
    // with the heat gone.
    const onKey = px >= 560;
    const onMainland = px < 300;
    const rightPlace = missions.index === 4 ? onKey : onMainland;
    if (rightPlace && police.stars === 0 && police.heat < 30) advance(missions);
  } else if (step.kind === 'grab') {
    if (!playerCar && Math.hypot(player.x - step.x, player.z - step.z) < step.radius) {
      ctx.hasGold = true;
      advance(missions);
    }
  }
}

// The dialogue lines Dara and Kai trade as the story moves.
export const DIALOGUE = {
  start: [
    ['DARA', 'Kai. You are back. Marina Row. Come find me.'],
    ['KAI', 'On my way. The city looks the same.'],
  ],
  pickup: [
    ['DARA', 'The GT is under the middle sail. It was always yours. Take it.'],
    ['KAI', 'She still runs. She remembers me.'],
  ],
  tower: [
    ['DARA', 'Show them the GT still runs. Twin Prism Towers. All the way across town.'],
    ['KAI', 'Flat out. Let them watch.'],
  ],
  jump: [
    ['DARA', 'The drawbridge is up — thirty degrees of steel over a thirty-metre gap.'],
    ['KAI', 'Then I jump it.'],
  ],
  golden: [
    ['DARA', 'The whole SPD is on the Key. Go quiet. Break line of sight. Let it fade.'],
    ['KAI', 'Quiet. Like golden hour.'],
  ],
  heist: [
    ['DARA', 'The gold case is in the Key vault. Grab it, get back over the bridge, disappear.'],
    ['KAI', 'One last run.'],
  ],
  victory: [
    ['DARA', 'You did it. The case is ours. Solaria Bay is yours, Kai.'],
    ['KAI', 'Home.'],
  ],
};
