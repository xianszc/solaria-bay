// SOLARIA BAY — every tuning number and colour in one place.
// The world is measured in metres. The main island is a 640 x 640 m
// grid; the causeway runs east from it across the bay to Solaria Key.
// The sun sits low in the west (centre-west, ~12 degrees up), so long
// shadows fall eastward across the asphalt.

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

export const WORLD = {
  islandHalf: 320, // main island spans x,z in [-320, 320]
  keyX0: 560, // Solaria Key island starts here
  keyX1: 780,
  keyZ: 160,
  waterY: -2,
  deckY: 6, // causeway deck height above the water
  bridgeGapX0: 430, // the drawbridge gap in the causeway
  bridgeGapX1: 460,
  bridgeLeafX: 430, // the raised bascule leaf pivots here
  bridgeLeafAngle: 0.5236, // 30 degrees
};

export const SUN = {
  // Direction the sun hangs in: west, a little north of due west,
  // 12 degrees above the horizon. The cover shot looks straight at it.
  azimuth: Math.PI, // pointing west (-x) in world space
  elevation: 0.21, // ~12 degrees
  color: 0xfff6e5,
  intensity: 2.6,
  ambientSky: 0x8fc3ee,
  ambientGround: 0xffd9a0,
};

export const PALETTE = {
  skyZenith: '#2a75d3',
  skyHorizon: '#ffa756',
  sunDisc: '#fff6e5',
  glassTeal: '#2ec4b6',
  shadowCobalt: '#1b263b',
  heroLime: '#70e000',
  heroTrim: '#111111',
  asphalt: '#2b2f38',
  asphaltLine: '#e8e4d8',
  sidewalk: '#b9b3a4',
  sand: '#e8d8a8',
  water: '#1f9db4',
  waterDeep: '#0e6f8f',
  palmTrunk: '#8a6b4a',
  palmLeaf: '#3fae5a',
  policeWhite: '#f4f6f8',
  policeBlack: '#14181f',
  policeLight: '#ff2d2d',
  gold: '#ffb703',
  hudPanel: 'rgba(27,38,59,0.6)',
  hudText: '#ffffff',
  hudAmber: '#ffb703',
  hudLime: '#70e000',
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 10,
  radius: 0.6,
  health: 100,
};

export const HERO_CAR = {
  name: 'SOLARIA GT',
  color: 0x70e000,
  topSpeedKmh: 212,
  accel: 26,
  brake: 42,
  reverseTopKmh: 48,
  grip: 2.6,
  condition: 100,
};

export const TRAFFIC_CAR = {
  topSpeedKmh: 88,
  count: 10,
};

export const POLICE_CAR = {
  name: 'SPD INTERCEPTOR',
  topSpeedKmh: 196,
  accel: 30,
  condition: 100,
  ramDamage: 14,
};

export const WANTED = {
  stealCar: 250,
  ramPolice: 90,
  shotFired: 70,
  speedNearPolice: 30,
  heatPerStar: 200,
  maxStars: 5,
  decayPerSecond: 14,
  decayDelay: 5,
};

export const WEAPONS = [
  { id: 0, name: 'FISTS', ammo: Infinity, damage: 8, rate: 0.45, range: 2.4 },
  { id: 1, name: 'PISTOL', ammo: 24, damage: 34, rate: 0.32, range: 70 },
  { id: 2, name: 'SMG', ammo: 90, damage: 18, rate: 0.09, range: 55 },
];

export const MISSIONS = [
  {
    name: 'FIRST LIGHT',
    title: 'First Light',
    brief: 'Kai Solano is back in Solaria Bay. Drive to Marina Row and meet Dara Quinn.',
    objective: 'Drive to the Marina Row marker',
    steps: [{ kind: 'reach', x: -100, z: 288, radius: 14, label: 'Marina Row' }],
  },
  {
    name: 'THE PICKUP',
    title: 'The Pickup',
    brief: 'Dara stashed the SOLARIA GT at the marina. Steal it back — it is yours, after all.',
    objective: 'Steal the lime SOLARIA GT',
    steps: [{ kind: 'stealHero', label: 'SOLARIA GT' }],
  },
  {
    name: 'TOWER RUN',
    title: 'Tower Run',
    brief: 'Show the city the GT still runs. Cross town to the Twin Prism Towers.',
    objective: 'Drive to the Twin Prism Towers',
    steps: [{ kind: 'reach', x: -238, z: 0, radius: 16, label: 'Twin Prism Towers' }],
  },
  {
    name: 'THE JUMP',
    title: 'The Jump',
    brief: 'The causeway drawbridge is up — 30 degrees of steel and a 30-metre gap. Hit it flat out.',
    objective: 'Cross the raised drawbridge',
    steps: [
      { kind: 'reach', x: 372, z: 0, radius: 14, label: 'Causeway approach' },
      { kind: 'jumpGap', label: 'Jump the gap' },
    ],
  },
  {
    name: 'GOLDEN HOUR',
    title: 'Golden Hour',
    brief: 'The whole SPD is on Solaria Key now. Go quiet, break line of sight, let the heat die.',
    objective: 'Lose the cops on Solaria Key',
    steps: [{ kind: 'loseCops', label: 'Lose the cops' }],
  },
  {
    name: 'SOLARIA HEIST',
    title: 'Solaria Heist',
    brief: 'The gold case is in the Key vault. Grab it, get back across the bridge, and vanish.',
    objective: 'Steal the gold case and escape',
    steps: [
      { kind: 'grab', x: 668, z: 40, radius: 6, label: 'Key vault' },
      { kind: 'reach', x: 260, z: 0, radius: 16, label: 'Mainland' },
      { kind: 'loseCops', label: 'Lose the cops' },
    ],
  },
];

export const SAVE_KEY = 'solaria-bay-save-v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
