# SOLARIA BAY

[![Make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/xianszc/solaria-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/xianszc/solaria-bay/reward.svg)](https://make.fun/bounty/gta6-01)

A sun-drenched open-world crime game built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) — a coastal metropolis in the spirit of GTA VI, built from scratch in three.js. No assets from any commercial game: the city, characters, vehicles, names and story are all original.

## The game

Solaria Bay is a high-wealth coastal city on barrier islands: mirror-glass skyscrapers, palm-lined boulevards, turquoise bay water, and a causeway out to Solaria Key. It is late afternoon — the sky is still bright blue, fading to apricot at the horizon, with the sun hanging low in the west.

**Kai Solano** is back in town after five years away. His fixer **Dara Quinn** has six jobs for him, and the last one is the biggest: steal the gold from the Key vault and get back across the bridge.

The twist no other entry has: **the drawbridge jump**. The center of the causeway is a raised bascule drawbridge, lifted to 30 degrees. Hit it flat out in the lime SOLARIA GT and fly the gap, through the police roadblock, in golden light.

## What is in it

- A drivable open world: the main island, the causeway, Solaria Key — on foot and by car
- The acid-lime 1980s wedge supercar **SOLARIA GT**, plus traffic and parked cars you can steal
- Wanted level 1–5 stars: SPD interceptors that chase and ram, a police helicopter at 3+ stars, roadblocks
- Six story missions with a real arc, from the first pickup to the heist
- Combat: fists, pistol, SMG — plus nitro, drift, and near-miss driving
- A full HUD: mission panel, wanted stars, cash and rep, police response list, circular minimap, speedometer, radio (SOLARIA FM 88.5)
- Saves in localStorage, a title screen with the crew, pause / busted / victory screens
- Synthesized sound: engine hum, sirens, radio chords — no audio files

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| F | Enter or steal a car / exit |
| Shift | Nitro (driving) / run (on foot) |
| Space | Brake |
| Mouse click | Shoot |
| 1 / 2 / 3 | Fists / pistol / SMG |
| Q | Change radio station |
| M | Mute |
| Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no network requests. three.js is vendored under `game/vendor/three.module.min.js`.

## License

MIT — see [LICENSE](LICENSE).
