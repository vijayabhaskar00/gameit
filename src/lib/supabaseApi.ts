import { createClient } from '@supabase/supabase-js';
import { ApiError, type Api, type Copy, type RoundResult, type RoundStart } from './api';
import type { Session } from './api';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(url, anonKey);
const TIMEOUT_MS = 10_000;

async function call<T>(name: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  // AbortSignal.timeout is missing on iOS 15, the newest version an original iPhone SE runs.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${data.session?.access_token ?? anonKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout.signal,
    });
    const json = await response.json();
    if (!response.ok) throw new ApiError(json.error ?? 'server_error');
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export const supabaseApi: Api = {
  async isLoggedIn() {
    const { data } = await supabase.auth.getSession();
    return data.session !== null;
  },

  async publicConfig() {
    const { data, error } = await supabase.from('campaign_config').select('key, value');
    if (error) return null;
    const c = Object.fromEntries(data.map((row) => [row.key, row.value]));
    const now = Date.now();
    const copy: Copy = {
      rewardShort: c.reward_short,
      rewardTitle: c.reward_title,
      rewardConditions: c.reward_conditions,
    };
    const inWindow = now >= Date.parse(c.starts_at) && now < Date.parse(c.ends_at);
    return { copy, campaignOpen: c.is_open === true && inWindow };
  },

  async sendOtp(phone) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new ApiError(error.message);
  },

  async verifyOtp(phone, otp) {
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error) throw new ApiError(error.message);
  },

  async loginWithToken(token) {
    const { tokenHash } = await call<{ tokenHash: string }>('auth-embed', { token });
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (error) throw new ApiError(error.message);
  },

  session: (displayName) => call<Session>('session', { displayName }),
  roundStart: () => call<RoundStart>('round-start', {}),
  roundFinish: (roundId, shotLog, clientScore) =>
    call<RoundResult>('round-finish', { roundId, shotLog, clientScore }),

  async roundScore(roundId) {
    const { data } = await supabase
      .from('rounds')
      .select('server_score')
      .eq('id', roundId)
      .maybeSingle();
    return data?.server_score ?? null;
  },
};
