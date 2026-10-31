import { simulate, type Shot, type SimConfig } from './sim.ts';
import { MAX_ROUND_SECONDS, SIM_CONFIG } from './simConfig.ts';
import { shotLogProblem } from './validate.ts';

export interface RoundRow {
  user_id: string;
  seed: number;
  started_at: string;
  status: string;
}

export interface FinishBody {
  roundId?: unknown;
  shotLog?: unknown;
  clientScore?: unknown;
}

/** The only database calls this flow makes. Edge Function and tests each supply one. */
export interface FinishDb {
  getRound(id: string): Promise<RoundRow | null>;
  getConfig(): Promise<Record<string, unknown>>;
  reject(id: string, reason: string): Promise<void>;
  finish(args: {
    roundId: string;
    userId: string;
    shotLog: Shot[];
    clientScore: number;
    score: number;
  }): Promise<unknown>;
}

export function campaignSimConfig(values: Record<string, unknown>): SimConfig {
  return {
    ...SIM_CONFIG,
    roundSeconds: Number(values.round_seconds ?? SIM_CONFIG.roundSeconds),
    arrows: Number(values.arrows ?? SIM_CONFIG.arrows),
    heads: Number(values.heads ?? SIM_CONFIG.heads),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function finishRound(
  db: FinishDb,
  userId: string,
  body: FinishBody,
  now: number,
  log: (reason: string, roundId: unknown) => void,
): Promise<{ status: number; body: unknown }> {
  const deny = (status: number, reason: string) => {
    log(reason, body.roundId);
    return { status, body: { error: reason } };
  };

  if (typeof body.roundId !== 'string' || !UUID.test(body.roundId)) {
    return deny(400, 'bad_round_id');
  }
  const roundId = body.roundId;
  const round = await db.getRound(roundId);
  if (!round) return deny(404, 'round_not_found');
  if (round.user_id !== userId) return deny(403, 'not_your_round');
  if (round.status !== 'started') return deny(409, 'round_not_started');

  const reject = async (reason: string) => {
    await db.reject(roundId, reason);
    return deny(422, reason);
  };

  if (now - new Date(round.started_at).getTime() > MAX_ROUND_SECONDS * 1000) {
    return reject('finished_late');
  }
  const config = campaignSimConfig(await db.getConfig());
  const problem = shotLogProblem(body.shotLog, config);
  if (problem) return reject(problem);

  const shotLog = body.shotLog as Shot[];
  const { score } = simulate(round.seed, config, shotLog);
  const clientScore = Number.isInteger(body.clientScore) ? (body.clientScore as number) : -1;
  if (clientScore !== score) log(`score_mismatch client=${clientScore} server=${score}`, roundId);

  try {
    return { status: 200, body: await db.finish({ roundId, userId, shotLog, clientScore, score }) };
  } catch (error) {
    // A parallel finish got there first.
    if (String(error).includes('round_not_started')) return deny(409, 'round_not_started');
    throw error;
  }
}
