import { describe, expect, it } from 'vitest';
import { canFire, createSim, simulate, stepSim, type SimConfig } from '@sim';
import { SIM_CONFIG as c } from '../src/game/config';

// One slow head parked on the aim line, so a hit or miss depends only on the angle.
const still: SimConfig = { ...c, heads: 2, speedStart: 0.001, speedEnd: 0.001 };
const parked = (s: ReturnType<typeof createSim>, x: number, y: number) => {
  for (const h of s.heads) Object.assign(h, { cx: x, cy: y, ax: 0, ay: 0, x, y });
};

describe('sim collision', () => {
  it('hits a head on the aim line', () => {
    const s = createSim(1, still);
    parked(s, c.bowX, 600);
    stepSim(s, still, 0);
    while (s.arrow) stepSim(s, still);
    expect(s.hits).toBe(1);
  });

  it('misses a head just outside the hit radius', () => {
    const r = c.headWidth * c.hitRadiusFactor;
    const s = createSim(1, still);
    parked(s, c.bowX + r + 1, 600);
    stepSim(s, still, 0);
    while (s.arrow) stepSim(s, still);
    expect(s.hits).toBe(0);
  });

  it('destroys only the first of two overlapping heads', () => {
    const s = createSim(1, still);
    parked(s, c.bowX, 600);
    stepSim(s, still, 0);
    while (s.arrow) stepSim(s, still);
    expect(s.heads.filter((h) => h.alive)).toHaveLength(1);
  });

  it('does not tunnel past a head at arrow speed', () => {
    const s = createSim(1, still);
    parked(s, c.bowX + c.headWidth * c.hitRadiusFactor - 1, 601);
    stepSim(s, still, 0);
    while (s.arrow) stepSim(s, still);
    expect(s.hits).toBe(1);
  });

  it('refuses to fire during the nock delay', () => {
    const s = createSim(1, c);
    stepSim(s, c, 70);
    while (s.arrow) stepSim(s, c);
    expect(canFire(s)).toBe(false);
    for (let i = 0; i < c.nockTicks; i++) stepSim(s, c);
    expect(canFire(s)).toBe(true);
  });

  it('speeds heads up after a kill', () => {
    const a = createSim(5, c);
    const b = createSim(5, c);
    b.hits = 5;
    for (let i = 0; i < 60; i++) {
      stepSim(a, c);
      stepSim(b, c);
    }
    expect(b.tau).toBeCloseTo(a.tau * (1 + c.speedPerKill * 5), 6);
  });

  it('never fires more arrows than the config allows', () => {
    const shots = Array.from({ length: 30 }, (_, i) => ({ tick: i * 60, angle: 70 }));
    expect(simulate(1, c, shots).shotsFired).toBe(c.arrows);
  });

  it('gives a stable score for a fixed seed and shot log', () => {
    const shots = Array.from({ length: 12 }, (_, i) => ({ tick: 100 + i * 80, angle: i * 5 - 25 }));
    const first = simulate(99, c, shots);
    for (let i = 0; i < 5; i++) expect(simulate(99, c, shots)).toEqual(first);
  });
});
