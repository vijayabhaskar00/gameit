import type { Shot, SimConfig } from './sim.ts';

/** Returns a reject reason for an impossible shot log, or null when it is well formed. */
export function shotLogProblem(log: unknown, c: SimConfig): string | null {
  if (!Array.isArray(log)) return 'bad_shot_log';
  if (log.length > c.arrows) return 'too_many_shots';
  const lastTick = c.roundSeconds * c.tickRate;
  let prev: number | null = null;
  for (const shot of log as Shot[]) {
    const tick = shot?.tick;
    const angle = shot?.angle;
    if (!Number.isInteger(tick) || tick < 0 || !Number.isFinite(angle)) return 'bad_shot_log';
    if (Math.abs(angle) > c.maxAimDeg) return 'bad_shot_log';
    if (tick > lastTick) return 'tick_out_of_range';
    if (prev !== null && tick <= prev) return 'ticks_not_increasing';
    if (prev !== null && tick - prev < c.nockTicks) return 'shots_too_close';
    prev = tick;
  }
  return null;
}
