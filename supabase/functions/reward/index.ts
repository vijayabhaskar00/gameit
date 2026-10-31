import { admin, json, serve } from '../_shared/http.ts';

serve('reward', 'GET', async (_req, user) => {
  const { data, error } = await admin
    .from('rewards')
    .select('coupon_code, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return json({ reward: data && { code: data.coupon_code, expiresAt: data.expires_at } });
});
