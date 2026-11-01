import { createSim, stepSim, type SimConfig } from '../supabase/functions/_shared/sim.ts';

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

const DEG = 180 / Math.PI;

function lcg(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export interface HumanBot {
  errorDeg: number;
  reactionTicks: number;
}

/** Sees the head nearest the bow, waits out its reaction, then shoots where the head was. */
export function humanBot(seed: number, c: SimConfig, bot: HumanBot) {
  const s = createSim(seed, c);
  const rand = lcg(seed ^ 0x9e3779b9);
  let aim: number | null = null;
  let fireAt = 0;
  while (!s.endReason) {
    const ready = !s.arrow && s.arrowsLeft > 0 && s.tick >= s.nockTick;
    if (ready && aim === null) {
      const target = s.heads
        .filter((h) => h.alive)
        .map((h) => ({ dx: h.x - c.bowX, dy: c.bowY - h.y }))
        .filter(({ dx, dy }) => Math.abs(Math.atan2(dx, dy) * DEG) <= c.maxAimDeg)
        .sort((a, b) => a.dx ** 2 + a.dy ** 2 - (b.dx ** 2 + b.dy ** 2))[0];
      if (target) {
        const error = (rand() * 2 - 1) * bot.errorDeg;
        const wanted = Math.atan2(target.dx, target.dy) * DEG + error;
        aim = Math.round(Math.max(-c.maxAimDeg, Math.min(c.maxAimDeg, wanted)) * 10) / 10;
        fireAt = s.tick + bot.reactionTicks;
      }
    }
    if (aim !== null && s.tick >= fireAt) {
      stepSim(s, c, aim);
      aim = null;
    } else {
      stepSim(s, c);
    }
  }
  return s;
}
