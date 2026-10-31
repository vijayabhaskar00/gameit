import { admin, json, logRejection, readConfig, serve } from '../_shared/http.ts';
import { campaignSimConfig } from '../_shared/roundFinish.ts';
import { MAX_ROUND_SECONDS } from '../_shared/simConfig.ts';

const REFUSALS = ['campaign_closed', 'no_attempts', 'round_in_progress', 'no_profile'];

serve('round-start', 'POST', async (_req, user) => {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const { data, error } = await admin.rpc('round_start', {
    p_user: user.id,
    p_seed: seed,
    p_stale_seconds: MAX_ROUND_SECONDS,
  });
  if (error) {
    const reason = REFUSALS.find((r) => error.message.includes(r));
    if (!reason) throw error;
    logRejection('round-start', user.id, reason);
    return json({ error: reason }, 409);
  }
  const { roundSeconds, arrows, heads } = campaignSimConfig(await readConfig());
  return json({ roundId: data[0].round_id, seed: data[0].seed, roundSeconds, arrows, heads });
});
