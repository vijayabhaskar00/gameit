import { admin, json, logRejection, readConfig, serve } from '../_shared/http.ts';
import { finishRound, type FinishDb } from '../_shared/roundFinish.ts';

const db: FinishDb = {
  async getRound(id) {
    const { data, error } = await admin
      .from('rounds')
      .select('user_id, seed, started_at, status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  getConfig: readConfig,
  async reject(id, reason) {
    const { error } = await admin.rpc('round_reject', { p_round: id, p_reason: reason });
    if (error) throw error;
  },
  async finish({ roundId, userId, shotLog, clientScore, score }) {
    const { data, error } = await admin.rpc('round_finish', {
      p_round: roundId,
      p_user: userId,
      p_shot_log: shotLog,
      p_client_score: clientScore,
      p_score: score,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

serve('round-finish', 'POST', async (req, user) => {
  const body = await req.json().catch(() => ({}));
  const result = await finishRound(db, user.id, body, Date.now(), (reason, roundId) =>
    logRejection('round-finish', user.id, reason, roundId),
  );
  return json(result.body, result.status);
});
