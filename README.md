# SOLARIA BAY

[![Make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/xianszc/solaria-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/xianszc/solaria-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game built from scratch for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), in the spirit of GTA VI: a sun-drenched coastal city, a driver coming home, and one bridge you have to jump. Three.js, no build step, no network — and nothing taken from any commercial game. The city, the people, the cars, the names and the story are all original.

**Version 3** rebuilds the visuals from scratch with real models: a lime supercar, BlenderKit hero buildings, a dense real city block, a fleet of traffic and emergency vehicles, and dark charcoal asphalt — while the streets between them stay dense with detailed procedural buildings in the SimCity / Cities: Skylines manner.

## The story

Solaria Bay is a wealthy city on barrier islands: glass towers, palm boulevards, turquoise water, and a causeway out to Solaria Key. Late afternoon — the sky is still bright blue overhead, fading to apricot at the horizon, the sun low in the west.

**Kai Solano** is back after five years away. His fixer **Dara Quinn** has six jobs lined up, and the last one is the big one: take the gold from the Key vault and get home across the bridge.

The thing no other entry does: **the drawbridge jump**. The middle of the causeway is a bascule drawbridge, raised to 30 degrees. Hit it flat out in the lime SOLARIA GT and fly the gap, straight through the police roadblock, in golden light.

## What you get

- A drivable open world — the main island, the causeway, Solaria Key — on foot and by car
- The acid-lime 1980s wedge supercar **SOLARIA GT** (a real model), plus traffic, police, taxi, bus, fire and ambulance vehicles you can drive or steal
- Real buildings: Mediterranean apartments, a Haussmann block, a glass hotel, a restaurant row, two supertall Prism Towers, and a dense OSM city block — with detailed procedural buildings filling the streets between them
- Wanted level 1–5: SPD interceptors that chase and ram, a police helicopter at 3+ stars, roadblocks
- Six story missions with a real arc, from the first pickup to the heist
- Pedestrians who walk, jog, and run for cover when the heat is on
- Combat on foot: fists, pistol, SMG — plus nitro, drift, and near-miss driving
- A full HUD: mission panel, wanted stars, cash and rep, police response list, circular minimap, speedometer, radio (SOLARIA FM, BAY 94, GOLDEN HOUR)
- Saves in localStorage, a title screen with the crew, pause / busted / victory screens
- Synthesized sound: engine hum, sirens, radio chords — no audio files at all

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| F | Enter or steal a car / exit |
| Shift | Nitro (driving) / run (on foot) |
| Mouse click | Shoot |
| 1 / 2 / 3 | Fists / pistol / SMG |
| R | Change radio station |
| P / Esc | Pause |

## Play it

Serve the `game/` directory as static files and open `index.html`, for example:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no network requests. three.js is vendored under `game/vendor/`.

## Assets and licences

- Hero car, buildings, vehicles, street furniture and asphalt are free models under CC0 or the BlenderKit Royalty Free licence; the OSM city block is © OpenStreetMap contributors (ODbL). All are credited in `game/src/assets.js`.
- The procedural buildings, the helicopter, the palms, the boats and every person are built from scratch in `game/src/models.js`.
- No Rockstar / GTA VI assets, no real car brands, no real songs.

## License

MIT — see [LICENSE](LICENSE).
