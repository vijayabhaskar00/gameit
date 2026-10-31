// Deterministic round simulation, shared by the game and the Edge Functions.
// Pure functions of (seed, config, shotLog) at a fixed tick rate.
// No Math.random, no Date, no Phaser. No Math.sin/cos either: the spec lets engines
// round those differently, so Safari and Deno could disagree on a close hit.

export interface SimConfig {
  width: number;
  height: number;
  tickRate: number;
  roundSeconds: number;
  arrows: number;
  heads: number;
  zone: { minX: number; maxX: number; minY: number; maxY: number };
  crown: { x: number; y: number; radius: number; spreadDeg: number };
  ampX: [number, number];
  ampY: [number, number];
  freqRatio: [number, number];
  speedStart: number;
  speedEnd: number;
  speedRampEndSec: number;
  speedPerKill: number;
  headWidth: number;
  hitRadiusFactor: number;
  bowX: number;
  bowY: number;
  maxAimDeg: number;
  arrowSpeed: number;
  arrowSubStep: number;
  nockTicks: number;
}

export interface Shot {
  tick: number;
  angle: number;
}

export type EndReason = 'win' | 'time' | 'arrows';

export interface Head {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface Arrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
  angle: number;
}

export interface SimState {
  tick: number;
  // Motion clock. Runs faster than real time as heads speed up, so paths stay continuous.
  tau: number;
  heads: Head[];
  arrow: Arrow | null;
  arrowsLeft: number;
  hits: number;
  nockTick: number;
  endReason: EndReason | null;
  shotLog: Shot[];
}

export interface SimResult {
  score: number;
  reason: EndReason;
  ticks: number;
  shotsFired: number;
}

const PI = 3.141592653589793;
const TAU = 2 * PI;

/** Sine from IEEE +,-,*,/ only, so every engine gets the same bits. */
export function sin(x: number): number {
  let r = x - TAU * Math.floor(x / TAU + 0.5);
  if (r > PI / 2) r = PI - r;
  else if (r < -PI / 2) r = -PI - r;
  const r2 = r * r;
  let p = 1 / 6227020800;
  p = p * r2 - 1 / 39916800;
  p = p * r2 + 1 / 362880;
  p = p * r2 - 1 / 5040;
  p = p * r2 + 1 / 120;
  p = p * r2 - 1 / 6;
  return r * (1 + p * r2);
}

export const cos = (x: number): number => sin(x + PI / 2);

const toRad = (deg: number): number => (deg * PI) / 180;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Largest amplitude that keeps a path through `start` at phase sine `s` inside [min, max]. */
function fitAmp(wanted: number, start: number, s: number, min: number, max: number): number {
  return Math.min(wanted, (start - min) / (1 + s), (max - start) / (1 - s));
}

function makeHeads(seed: number, c: SimConfig): Head[] {
  const rand = mulberry32(seed);
  const heads: Head[] = [];
  for (let i = 0; i < c.heads; i++) {
    const slot = toRad(lerp(-c.crown.spreadDeg, c.crown.spreadDeg, i / (c.heads - 1)));
    const startX = c.crown.x + c.crown.radius * sin(slot);
    const startY = c.crown.y - c.crown.radius * cos(slot);
    const px = rand() * TAU;
    const py = rand() * TAU;
    const sx = sin(px);
    const sy = sin(py);
    const ax = fitAmp(lerp(c.ampX[0], c.ampX[1], rand()), startX, sx, c.zone.minX, c.zone.maxX);
    const ay = fitAmp(lerp(c.ampY[0], c.ampY[1], rand()), startY, sy, c.zone.minY, c.zone.maxY);
    const ratio = lerp(c.freqRatio[0], c.freqRatio[1], rand());
    // Scale frequencies so RMS speed equals speedStart when tau runs at real time.
    const wx = c.speedStart / Math.sqrt((ax * ax + ay * ay * ratio * ratio) / 2);
    heads.push({
      // Solved so the path passes through the crown slot at tau = 0.
      cx: startX - ax * sx,
      cy: startY - ay * sy,
      ax,
      ay,
      wx,
      wy: wx * ratio,
      px,
      py,
      x: startX,
      y: startY,
      alive: true,
    });
  }
  return heads;
}

export function createSim(seed: number, c: SimConfig): SimState {
  return {
    tick: 0,
    tau: 0,
    heads: makeHeads(seed, c),
    arrow: null,
    arrowsLeft: c.arrows,
    hits: 0,
    nockTick: 0,
    endReason: null,
    shotLog: [],
  };
}

export function canFire(s: SimState): boolean {
  return !s.endReason && !s.arrow && s.arrowsLeft > 0 && s.tick >= s.nockTick;
}

function stepArrow(s: SimState, c: SimConfig): void {
  const arrow = s.arrow;
  if (!arrow) return;
  const hitRadius = c.headWidth * c.hitRadiusFactor;
  const hitRadiusSq = hitRadius * hitRadius;
  const subSteps = Math.ceil(c.arrowSpeed / c.tickRate / c.arrowSubStep);
  for (let i = 0; i < subSteps; i++) {
    arrow.x += arrow.dx * c.arrowSubStep;
    arrow.y += arrow.dy * c.arrowSubStep;
    for (const h of s.heads) {
      if (!h.alive) continue;
      const dx = arrow.x - h.x;
      const dy = arrow.y - h.y;
      if (dx * dx + dy * dy <= hitRadiusSq) {
        h.alive = false;
        s.hits++;
        s.arrow = null;
        s.nockTick = s.tick + c.nockTicks;
        return;
      }
    }
    if (arrow.x < 0 || arrow.x > c.width || arrow.y < 0) {
      s.arrow = null;
      s.nockTick = s.tick + c.nockTicks;
      return;
    }
  }
}

/** Advances one tick. An `angle` fires before motion; it is dropped when canFire is false. */
export function stepSim(s: SimState, c: SimConfig, angle?: number): void {
  if (s.endReason) return;

  if (angle !== undefined && canFire(s)) {
    const rad = toRad(angle);
    s.arrow = { x: c.bowX, y: c.bowY, dx: sin(rad), dy: -cos(rad), angle };
    s.arrowsLeft--;
    s.shotLog.push({ tick: s.tick, angle });
  }

  const seconds = s.tick / c.tickRate;
  const speed = lerp(c.speedStart, c.speedEnd, Math.min(1, seconds / c.speedRampEndSec));
  s.tau += ((speed / c.speedStart) * (1 + c.speedPerKill * s.hits)) / c.tickRate;
  for (const h of s.heads) {
    if (!h.alive) continue;
    h.x = h.cx + h.ax * sin(h.wx * s.tau + h.px);
    h.y = h.cy + h.ay * sin(h.wy * s.tau + h.py);
  }

  stepArrow(s, c);
  s.tick++;

  if (s.hits >= c.heads) s.endReason = 'win';
  else if (s.tick >= c.roundSeconds * c.tickRate) s.endReason = 'time';
  else if (s.arrowsLeft === 0 && !s.arrow) s.endReason = 'arrows';
}

export function simulate(seed: number, c: SimConfig, shotLog: Shot[]): SimResult {
  const s = createSim(seed, c);
  let next = 0;
  while (!s.endReason) {
    while (next < shotLog.length && shotLog[next]!.tick < s.tick) next++;
    const shot = shotLog[next];
    stepSim(s, c, shot?.tick === s.tick ? shot.angle : undefined);
  }
  return { score: s.hits, reason: s.endReason, ticks: s.tick, shotsFired: s.shotLog.length };
}
