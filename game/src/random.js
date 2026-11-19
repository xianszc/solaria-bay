// A deterministic random generator (mulberry32) so the city layout,
// traffic and pedestrians are identical for a given seed. The URL can fix
// it with ?seed=N; without one the seed is random each visit, which is
// fine for play but never for screenshots.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
