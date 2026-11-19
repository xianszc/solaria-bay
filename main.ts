// SOLARIA BAY — entry program for the make.fun gta6-01 bounty.
// Node 22, standard library only. It takes the static game in game/
// (index.html, the ES modules, the vendored three.js build — everything
// a desktop browser needs, offline) plus the screenshots beside this
// file, copies them into the output directory, and writes
// output/dossier.json through the vendored make.fun library so the
// judge can read the game from the dossier.
// v3: game/ also carries the real models (GLB cars, BlenderKit hero
// buildings, the OSM block, Asphalt025C PBR) under game/assets/ —
// plain files, copied like everything else, no build step.

//
// To run it outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output when the grader is absent.)
// To play the game locally instead: `node serve.ts`, then open
// http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

function buildEntry() {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');

  mkdirSync(dest, { recursive: true });
  cpSync(gameDir, join(dest, 'game'), { recursive: true });
  mkdirSync(join(dest, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(dest, 'screenshots'), { recursive: true });
  }

  // The gate's caps, from reference/gate.json. The text cap shapes the
  // dossier bytes; the rest refuse an entry the scorer would refuse:
  // more than 4 screenshots or one over 256 KiB, more than 993 files
  // or 48 MiB under game/, or a game/ path over 1000 bytes. game/
  // counts beside /output's own 1000-entry cap, its screenshots/ and
  // dossier.json included.
  const dossier = buildDossier(dest, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(dest, 'dossier.json'), dossier);
}

buildEntry();
