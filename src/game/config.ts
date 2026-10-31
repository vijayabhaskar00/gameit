// Every number the game draws with lives here. Numbers the server must agree on live in
// _shared/simConfig.ts, because Edge Functions cannot import from src/.
import { SIM_CONFIG } from '../../supabase/functions/_shared/simConfig';

export { SIM_CONFIG };
export const WIDTH = SIM_CONFIG.width;
export const HEIGHT = SIM_CONFIG.height;

export const VISUAL = {
  letterbox: '#0B0705',
  bossFeetY: HEIGHT * 0.78,
  bossHeight: 560,
  breatheScaleY: 1.01,
  breatheMs: 2000,
  countdownStepMs: 1000,
  goMs: 600,
  countdownStartScale: 1.4,
  headPopScale: 1.15,
  headPopMs: 250,
  headRotationDeg: 15,
  headRotationSpeed: 0.7,
  inputTopY: HEIGHT * 0.55,
  minDragPx: 40,
  maxPullPx: 160,
  timerWarnSec: 10,
  timerDangerSec: 5,
  timerWarnColor: '#FF7A1A',
  timerDangerColor: '#FF2A2A',
  gold: '#FFC83D',
  hudGrey: '#B9B2AC',
  maxStepsPerFrame: 5,
  hiddenPauseMs: 3000,
  shakeMs: 120,
  shakePx: 4,
  plusOneRisePx: 60,
  plusOneMs: 600,
  headsBounceScale: 1.3,
  headsBounceMs: 220,
  vibrateMs: 30,
  burstParticles: 30,
  shards: 6,
  trailEveryMs: 16,
  vignettePulseMs: 500,
  musicVolume: 0.5,
  musicFadeMs: 600,
} as const;
