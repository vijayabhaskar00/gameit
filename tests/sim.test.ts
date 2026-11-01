import { describe, expect, it } from 'vitest';
import { createSim, simulate, sin, stepSim } from '@sim';
import { SIM_CONFIG as c } from '../src/game/config';
import { humanBot, perfectBot } from './bot';

describe('difficulty', () => {
  it('the +/-6 deg, 300 ms bot wins 10-15% of 1,000 rounds', () => {
    let wins = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      if (humanBot(seed, c, { errorDeg: 6, reactionTicks: 18 }).endReason === 'win') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(100);
    expect(wins).toBeLessThanOrEqual(150);
  });
});

describe('sim', () => {
  it('sin matches Math.sin', () => {
    for (let x = -50; x < 50; x += 0.37) expect(sin(x)).toBeCloseTo(Math.sin(x), 8);
  });

  it('a perfect player wins and the replay gives the same result', () => {
    const live = perfectBot(7, c);
    expect(live.endReason).toBe('win');
    expect(simulate(7, c, live.shotLog)).toEqual({
      score: live.hits,
      reason: live.endReason,
      ticks: live.tick,
      shotsFired: live.shotLog.length,
    });
  });

  it('different seeds give different paths', () => {
    const a = createSim(1, c);
    const b = createSim(2, c);
    for (let i = 0; i < 60; i++) {
      stepSim(a, c);
      stepSim(b, c);
    }
    expect(a.heads[0]!.x).not.toBe(b.heads[0]!.x);
  });

  it('starts heads on a symmetric crown arc and keeps them inside the zone', () => {
    const s = createSim(123, c);
    expect(s.heads[0]!.y).toBeCloseTo(s.heads[9]!.y, 6);
    expect(s.heads[0]!.x).toBeLessThan(s.heads[9]!.x);
    while (!s.endReason) {
      stepSim(s, c);
      for (const h of s.heads) {
        expect(h.x).toBeGreaterThanOrEqual(c.zone.minX - 1e-6);
        expect(h.x).toBeLessThanOrEqual(c.zone.maxX + 1e-6);
        expect(h.y).toBeGreaterThanOrEqual(c.zone.minY - 1e-6);
        expect(h.y).toBeLessThanOrEqual(c.zone.maxY + 1e-6);
      }
    }
  });

  it('ends on time when nobody shoots', () => {
    expect(simulate(1, c, [])).toMatchObject({
      score: 0,
      reason: 'time',
      ticks: c.roundSeconds * c.tickRate,
    });
  });

  it('ends when arrows run out and the last arrow has left the screen', () => {
    const shots = Array.from({ length: c.arrows }, (_, i) => ({ tick: i * 120, angle: 70 }));
    const r = simulate(1, c, shots);
    expect(r.reason).toBe('arrows');
    expect(r.score).toBe(0);
    expect(r.ticks).toBeGreaterThan(shots.at(-1)!.tick);
  });

  it('ignores a shot fired while the previous arrow is in flight', () => {
    const shots = [
      { tick: 0, angle: 0 },
      { tick: 1, angle: 0 },
    ];
    expect(simulate(1, c, shots).shotsFired).toBe(1);
  });
});
