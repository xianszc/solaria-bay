// SOLARIA BAY — the entry program for make.fun gta6-01 (Node 22, standard
// library only). The game is the static files under game/ in this same
// directory: index.html plus its ES modules and the vendored three.js
// build, all loadable offline in a desktop browser. This program hands
// the entry in: it copies game/ and screenshots/ beside this file into
// the output directory and writes output/dossier.json with the vendored
// make.fun library, so the judge can read the game from the dossier.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)
// Play the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's caps (reference/gate.json): the text cap shapes the dossier
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files or 48 MiB under
// game/, or a game/ path over 1000 bytes. game/ counts beside /output's
// own 1000-entry cap, its screenshots/ and dossier.json included.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
