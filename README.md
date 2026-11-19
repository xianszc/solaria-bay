# SOLARIA BAY

[![Make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/xianszc/solaria-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/xianszc/solaria-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game built from scratch for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), in the spirit of GTA VI: a sun-drenched coastal city, a driver coming home, and one bridge you have to jump. Three.js, no build step, no network — and nothing taken from any commercial game. The city, the people, the cars, the names and the story are all original.

## The story

Solaria Bay is a wealthy city on barrier islands: glass towers, palm boulevards, turquoise water, and a causeway out to Solaria Key. Late afternoon — the sky is still bright blue overhead, fading to apricot at the horizon, the sun low in the west.

**Kai Solano** is back after five years away. His fixer **Dara Quinn** has six jobs lined up, and the last one is the big one: take the gold from the Key vault and get home across the bridge.

The thing no other entry does: **the drawbridge jump**. The middle of the causeway is a bascule drawbridge, raised to 30 degrees. Hit it flat out in the lime SOLARIA GT and fly the gap, straight through the police roadblock, in golden light.

## What you get

- A drivable open world — the main island, the causeway, Solaria Key — on foot and by car
- The acid-lime 1980s wedge supercar **SOLARIA GT**, plus traffic and parked cars you can take
- Wanted level 1–5: SPD interceptors that chase and ram, a police helicopter at 3+ stars, roadblocks
- Six story missions with a real arc, from the first pickup to the heist
- Combat on foot: fists, pistol, SMG — plus nitro, drift, and near-miss driving
- A full HUD: mission panel, wanted stars, cash and rep, police response list, circular minimap, speedometer, radio (SOLARIA FM 88.5)
- Saves in localStorage, a title screen with the crew, pause / busted / victory screens
- Synthesized sound: engine hum, sirens, radio chords — no audio files at all

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
