import type { Shot } from '@sim';

export interface Reward {
  code: string;
  expiresAt: string;
}

export interface Copy {
  rewardShort: string;
  rewardTitle: string;
  rewardConditions: string;
}

export interface Session {
  displayName: string | null;
  bestScore: number;
  lastScore: number | null;
  attemptsLeft: number;
  reward: Reward | null;
  campaignOpen: boolean;
  copy: Copy;
}

export interface RoundStart {
  roundId: string;
  seed: number;
  roundSeconds: number;
  arrows: number;
  heads: number;
}

export interface RoundResult {
  score: number;
  best: number;
  attemptsLeft: number;
  reward: Reward | null;
}

export class ApiError extends Error {}

export interface Api {
  isLoggedIn(): Promise<boolean>;
  publicConfig(): Promise<{ copy: Copy; campaignOpen: boolean } | null>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, otp: string): Promise<void>;
  loginWithToken(token: string): Promise<void>;
  session(displayName?: string): Promise<Session>;
  roundStart(seedHint?: number): Promise<RoundStart>;
  roundFinish(roundId: string, shotLog: Shot[], clientScore: number): Promise<RoundResult>;
  roundScore(roundId: string): Promise<number | null>;
}

/** Runs a built site on the browser mock. A real Supabase URL always wins over this. */
export const DEMO_MODE = import.meta.env.VITE_DEMO === '1' && !import.meta.env.VITE_SUPABASE_URL;

let backend: Promise<Api> | undefined;

/** Loaded on demand so the landing page does not carry the Supabase client. */
export function api(): Promise<Api> {
  backend ??= (async () => {
    if (import.meta.env.VITE_SUPABASE_URL) return (await import('./supabaseApi')).supabaseApi;
    if (import.meta.env.DEV || DEMO_MODE) return (await import('./mockApi')).mockApi;
    throw new ApiError('VITE_SUPABASE_URL is not set');
  })();
  return backend;
}
