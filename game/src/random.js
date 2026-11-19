// A small deterministic random source (mulberry32) so the city layout,
// traffic and pedestrians are identical for a given seed. Pass ?seed=N
// in the URL to fix it; without one the seed is random each visit, which
// is fine for play but never for screenshots.

export function createRandom(seed) {
  let s = seed >>> 0;
  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let m = Math.imul(s ^ (s >>> 15), 1 | s);
    m = (m + Math.imul(m ^ (m >>> 7), 61 | m)) ^ m;
    return ((m ^ (m >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}
