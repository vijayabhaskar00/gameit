import { describe, expect, it } from 'vitest';
import { SIM_CONFIG as c } from '../src/game/config';
import { shotLogProblem } from '../supabase/functions/_shared/validate';

const shots = (n: number, gap = 60) =>
  Array.from({ length: n }, (_, i) => ({ tick: i * gap, angle: 0 }));

describe('shotLogProblem', () => {
  it('accepts a legal log', () => expect(shotLogProblem(shots(12), c)).toBeNull());
  it('accepts an empty log', () => expect(shotLogProblem([], c)).toBeNull());
  it('rejects 13 shots', () => expect(shotLogProblem(shots(13), c)).toBe('too_many_shots'));
  it('rejects shots 100 ms apart', () =>
    expect(shotLogProblem(shots(3, 6), c)).toBe('shots_too_close'));
  it('rejects non-increasing ticks', () =>
    expect(
      shotLogProblem(
        [
          { tick: 50, angle: 0 },
          { tick: 50, angle: 0 },
        ],
        c,
      ),
    ).toBe('ticks_not_increasing'));
  it('rejects ticks after the round', () =>
    expect(shotLogProblem([{ tick: 1801, angle: 0 }], c)).toBe('tick_out_of_range'));
  it('rejects junk', () => {
    expect(shotLogProblem('nope', c)).toBe('bad_shot_log');
    expect(shotLogProblem([null], c)).toBe('bad_shot_log');
    expect(shotLogProblem([{ tick: 1.5, angle: 0 }], c)).toBe('bad_shot_log');
    expect(shotLogProblem([{ tick: 1, angle: 90 }], c)).toBe('bad_shot_log');
  });
});
