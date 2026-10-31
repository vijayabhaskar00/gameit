import { simulate } from '@sim';
import { campaign } from '../config/campaign';
import { SIM_CONFIG } from '../game/config';
import { ApiError, type Api, type Reward, type Session } from './api';
import { readStorage, writeStorage } from './storage';

// Dev-only stand-in for Supabase, so `pnpm dev` works with no backend. api.ts never loads
// this in a production build.
const KEY = 'mock_backend';

interface Saved {
  loggedIn: boolean;
  displayName: string | null;
  bestScore: number;
  lastScore: number | null;
  attemptsLeft: number;
  reward: Reward | null;
  rounds: Record<string, { seed: number; score: number | null }>;
}

const load = (): Saved => {
  const raw = readStorage(KEY);
  if (raw) return JSON.parse(raw) as Saved;
  return {
    loggedIn: false,
    displayName: null,
    bestScore: 0,
    lastScore: null,
    attemptsLeft: 10,
    reward: null,
    rounds: {},
  };
};
const save = (state: Saved) => writeStorage(KEY, JSON.stringify(state));

const copy = {
  rewardShort: campaign.rewardShort,
  rewardTitle: campaign.rewardTitle,
  rewardConditions: campaign.rewardConditions,
};

const toSession = (s: Saved): Session => ({
  displayName: s.displayName,
  bestScore: s.bestScore,
  lastScore: s.lastScore,
  attemptsLeft: s.attemptsLeft,
  reward: s.reward,
  campaignOpen: true,
  copy,
});

export const mockApi: Api = {
  isLoggedIn: async () => load().loggedIn,
  publicConfig: async () => ({ copy, campaignOpen: true }),
  sendOtp: async () => {},
  async verifyOtp() {
    save({ ...load(), loggedIn: true });
  },
  async loginWithToken() {
    save({ ...load(), loggedIn: true });
  },
  async session(displayName) {
    const s = load();
    if (displayName) s.displayName = displayName;
    save(s);
    return toSession(s);
  },
  async roundStart(seedHint) {
    const s = load();
    if (s.attemptsLeft <= 0) throw new ApiError('no_attempts');
    const roundId = crypto.randomUUID();
    const seed = seedHint ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
    s.attemptsLeft--;
    s.rounds[roundId] = { seed, score: null };
    save(s);
    const { roundSeconds, arrows, heads } = SIM_CONFIG;
    return { roundId, seed, roundSeconds, arrows, heads };
  },
  async roundFinish(roundId, shotLog) {
    const s = load();
    const round = s.rounds[roundId];
    if (!round) throw new ApiError('round_not_found');
    const { score } = simulate(round.seed, SIM_CONFIG, shotLog);
    round.score = score;
    s.lastScore = score;
    s.bestScore = Math.max(s.bestScore, score);
    if (score === SIM_CONFIG.heads && !s.reward) {
      const expiresAt = new Date(Date.now() + 3 * 86400000).toISOString();
      s.reward = { code: 'DEMO-50OFF', expiresAt };
    }
    save(s);
    return { score, best: s.bestScore, attemptsLeft: s.attemptsLeft, reward: s.reward };
  },
  roundScore: async (roundId) => load().rounds[roundId]?.score ?? null,
};
