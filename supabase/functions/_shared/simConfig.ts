import type { SimConfig } from './sim.ts';

// Lives beside sim.ts because Edge Functions cannot import from src/.
// src/game/config.ts re-exports it, so the game has one import point for numbers.

/** A round finished later than this after /round-start is rejected. */
export const MAX_ROUND_SECONDS = 120;

const WIDTH = 1080;
const HEIGHT = 1920;

export const SIM_CONFIG: SimConfig = {
  width: WIDTH,
  height: HEIGHT,
  tickRate: 60,
  roundSeconds: 30,
  arrows: 12,
  heads: 10,
  zone: {
    minX: WIDTH * 0.08,
    maxX: WIDTH * 0.92,
    minY: HEIGHT * 0.12,
    maxY: HEIGHT * 0.55,
  },
  crown: { x: WIDTH / 2, y: 960, radius: 340, spreadDeg: 80 },
  ampX: [160, 380],
  ampY: [120, 340],
  // Vertical frequency relative to horizontal, so paths are not plain ellipses.
  freqRatio: [0.6, 1.4],
  speedStart: 120,
  speedEnd: 260,
  // Speed reaches speedEnd here and holds for the last 10 s.
  speedRampEndSec: 20,
  speedPerKill: 0.08,
  headWidth: 130,
  hitRadiusFactor: 0.35,
  bowX: WIDTH * 0.5,
  bowY: HEIGHT * 0.88,
  maxAimDeg: 70,
  arrowSpeed: 2400,
  arrowSubStep: 20,
  nockTicks: 15, // 250 ms at 60 Hz
};
