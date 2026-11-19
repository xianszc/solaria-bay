// SOLARIA BAY v3 — every number the game tunes lives here, in one place.
// Distances are metres, speeds are km/h, colours are single decisions.
// The island is a 640 x 640 m grid; the causeway runs east across the bay
// to Solaria Key; the sun sits low in the west so the late-afternoon light
// rakes long shadows eastward across warm asphalt.

export const STEP = 1 / 60; // fixed simulation slice: 60 updates a second

// The shape of the world. x grows east, z grows south; y is up.
export const WORLD = {
  islandHalf: 320, // the main island spans x,z in [-320, 320]
  keyX0: 560, // Solaria Key begins here
  keyX1: 780,
  keyZ: 160, // the Key spans z in [-160, 160]
  waterY: -2,
  deckY: 6, // causeway deck height above the water
  bridgeGapX0: 430, // the drawbridge gap in the causeway
  bridgeGapX1: 460,
  bridgeLeafX: 430, // the raised bascule leaf pivots at the gap's west edge
  bridgeLeafAngle: 0.5236, // 30 degrees up
  garageX: 160, // parking garage (overlook) centre
  garageZ: 120,
  garageRoofY: 12,
  // The OSM district: a dense real city block placed in the north of the
  // island. Grid roads and procedural buildings skip this rectangle; the
  // block brings its own streets and footprints.
  osmX0: -134,
  osmX1: 134,
  osmZ0: -314,
  osmZ1: -6,
  osmCX: 0, // centre the block is placed at
  osmCZ: -160,
};

// The low western sun: about 12 degrees above the horizon, a little north
// of due west. The cover shot looks straight into it, between the towers.
export const SUN = {
  azimuth: Math.PI, // west (-x)
  elevation: 0.21, // ~12 degrees
  color: 0xfff6e5,
  intensity: 2.6,
  skyFill: 0x8fc3ee,
  groundBounce: 0xffd9a0,
};

// Palette. Warm charcoal asphalt (never dark teal), bright blue sky
// overhead fading to apricot at the horizon, lime hero car.
export const PALETTE = {
  skyZenith: '#2a75d3',
  skyMid: '#7fb2e5',
  skyHorizon: '#ffa756',
  sunDisc: '#fff6e5',
  glassTeal: '#2ec4b6',
  shadowCobalt: '#1b263b',
  heroLime: '#70e000',
  heroTrim: '#111111',
  asphalt: '#332e29', // warm charcoal, dark enough to stay charcoal under the low sun
  asphaltLine: '#e8e4d8',
  sidewalk: '#b9b3a4',
  ground: '#b3a37e', // warm sun-baked tan ground between the roads
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

// Kai on foot.
export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 10,
  radius: 0.6,
  health: 100,
};

// How far behind and above the car and the player the camera rides.
export const CAMERA = {
  chaseDistance: 10.5,
  chaseHeight: 4,
  footDistance: 6,
  footHeight: 3,
  fov: 58,
};

// The hero car: the acid-lime 1980s wedge, a real GLB now.
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

// Ordinary traffic.
export const TRAFFIC_CAR = {
  topSpeedKmh: 88,
  count: 10,
};

// The SPD interceptors.
export const POLICE_CAR = {
  name: 'SPD INTERCEPTOR',
  topSpeedKmh: 196,
  accel: 30,
  condition: 100,
  ramDamage: 14,
};

// Wanted: how much heat each crime adds, how heat turns into stars,
// and how fast it fades when the player goes quiet.
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

// Fists are free; the pistol and SMG spend ammo.
export const WEAPONS = [
  { id: 0, name: 'FISTS', ammo: Infinity, damage: 8, rate: 0.45, range: 2.4 },
  { id: 1, name: 'PISTOL', ammo: 24, damage: 34, rate: 0.32, range: 70 },
  { id: 2, name: 'SMG', ammo: 90, damage: 18, rate: 0.09, range: 55 },
];

// The story arc: arrive, steal the GT, cross town, jump the raised
// drawbridge, go quiet, then the heist.
export const MISSIONS = [
  {
    name: 'FIRST LIGHT',
    title: 'First Light',
    brief: 'Kai Solano is home in Solaria Bay. Head for Marina Row and find Dara Quinn.',
    objective: 'Drive to the Marina Row marker',
    steps: [{ kind: 'reach', x: -100, z: 288, radius: 14, label: 'Marina Row' }],
  },
  {
    name: 'THE PICKUP',
    title: 'The Pickup',
    brief: 'Dara hid the SOLARIA GT at the marina. Take it back — it was always yours.',
    objective: 'Steal the lime SOLARIA GT',
    steps: [{ kind: 'stealHero', label: 'SOLARIA GT' }],
  },
  {
    name: 'TOWER RUN',
    title: 'Tower Run',
    brief: 'Show the city the GT still runs. Drive right across town to the Twin Prism Towers.',
    objective: 'Drive to the Twin Prism Towers',
    steps: [{ kind: 'reach', x: -238, z: 0, radius: 16, label: 'Twin Prism Towers' }],
  },
  {
    name: 'THE JUMP',
    title: 'The Jump',
    brief: 'The causeway drawbridge is raised — 30 degrees of steel over a 30-metre gap. Hit it flat out.',
    objective: 'Cross the raised drawbridge',
    steps: [
      { kind: 'reach', x: 372, z: 0, radius: 14, label: 'Causeway approach' },
      { kind: 'jumpGap', label: 'Jump the gap' },
    ],
  },
  {
    name: 'GOLDEN HOUR',
    title: 'Golden Hour',
    brief: 'The whole SPD is on Solaria Key now. Go quiet, break line of sight, let the heat fade.',
    objective: 'Lose the cops on Solaria Key',
    steps: [{ kind: 'loseCops', label: 'Lose the cops' }],
  },
  {
    name: 'SOLARIA HEIST',
    title: 'Solaria Heist',
    brief: 'The gold case is inside the Key vault. Grab it, get back over the bridge, and disappear.',
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
