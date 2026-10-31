import { createSim, stepSim, type SimConfig } from '@sim';

/** Tries every whole-degree angle on a copy of the sim and fires the first one that hits. */
export function perfectBot(seed: number, c: SimConfig) {
  const s = createSim(seed, c);
  while (!s.endReason) {
    let angle: number | undefined;
    if (!s.arrow && s.arrowsLeft > 0 && s.tick >= s.nockTick) {
      for (let a = -c.maxAimDeg; a <= c.maxAimDeg && angle === undefined; a++) {
        const copy = structuredClone(s);
        stepSim(copy, c, a);
        while (copy.arrow && !copy.endReason) stepSim(copy, c);
        if (copy.hits > s.hits) angle = a;
      }
    }
    stepSim(s, c, angle);
  }
  return s;
}
