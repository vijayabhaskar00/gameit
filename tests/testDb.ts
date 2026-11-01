import type { FinishDb } from '../supabase/functions/_shared/roundFinish.ts';

/** The parts of Supabase the migration needs on a bare Postgres. */
export const PRELUDE = `
  create schema auth;
  create table auth.users (id uuid primary key, phone text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

/** Opens the campaign whatever today's date is. */
export const OPEN_CAMPAIGN = `
  update campaign_config set value = '"2000-01-01T00:00:00Z"' where key = 'starts_at';
  update campaign_config set value = '"2100-01-01T00:00:00Z"' where key = 'ends_at';
`;

export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;

/** Same calls as the round-finish Edge Function, over any Postgres client. */
export function finishDb(query: Query): FinishDb {
  return {
    async getRound(id) {
      const { rows } = await query(
        'select user_id, seed, started_at, status from rounds where id = $1',
        [id],
      );
      const row = rows[0] as
        { user_id: string; seed: string; started_at: Date; status: string } | undefined;
      return row
        ? { ...row, seed: Number(row.seed), started_at: row.started_at.toISOString() }
        : null;
    },
    async getConfig() {
      const { rows } = await query('select key, value from campaign_config');
      return Object.fromEntries(rows.map((row) => [row.key as string, row.value]));
    },
    async reject(id, reason) {
      await query('select round_reject($1, $2)', [id, reason]);
    },
    async finish(a) {
      const { rows } = await query('select round_finish($1, $2, $3, $4, $5) as r', [
        a.roundId,
        a.userId,
        JSON.stringify(a.shotLog),
        a.clientScore,
        a.score,
      ]);
      return rows[0]!.r;
    },
  };
}
