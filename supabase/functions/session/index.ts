import { admin, json, readConfig, serve } from '../_shared/http.ts';

serve('session', 'POST', async (req, user) => {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 60) : '';

  const profile = await admin.rpc('session_upsert', {
    p_user: user.id,
    p_name: name,
    p_phone: user.phone ?? null,
  });
  if (profile.error) throw profile.error;

  const reward = await admin
    .from('rewards')
    .select('coupon_code, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (reward.error) throw reward.error;

  const open = await admin.rpc('campaign_is_open');
  if (open.error) throw open.error;

  const c = await readConfig();
  return json({
    displayName: profile.data.display_name,
    bestScore: profile.data.best_score,
    lastScore: profile.data.last_score,
    attemptsLeft: profile.data.attempts_left,
    reward: reward.data && { code: reward.data.coupon_code, expiresAt: reward.data.expires_at },
    campaignOpen: open.data,
    copy: {
      rewardShort: c.reward_short,
      rewardTitle: c.reward_title,
      rewardConditions: c.reward_conditions,
    },
  });
});
