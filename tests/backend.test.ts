import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SIM_CONFIG as c } from '../src/game/config';
import { finishRound, type FinishDb } from '../supabase/functions/_shared/roundFinish';
import { perfectBot } from './bot';

// Runs the real migration on PGlite, an in-process Postgres.
// ponytail: PGlite has one connection, so "parallel" here means queued. Row-lock behaviour
// needs a real server: rerun against local Supabase once Docker is available.
const PRELUDE = `
  create schema auth;
  create table auth.users (id uuid primary key, phone text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

const SEED = 7;
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const winning = perfectBot(SEED, c);

let pg: PGlite;
const logged: string[] = [];

const db: FinishDb = {
  async getRound(id) {
    const r = await pg.query<{ user_id: string; seed: string; started_at: Date; status: string }>(
      'select user_id, seed, started_at, status from rounds where id = $1',
      [id],
    );
    const row = r.rows[0];
    return row
      ? { ...row, seed: Number(row.seed), started_at: row.started_at.toISOString() }
      : null;
  },
  async getConfig() {
    const r = await pg.query<{ key: string; value: unknown }>(
      'select key, value from campaign_config',
    );
    return Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
  },
  async reject(id, reason) {
    await pg.query('select round_reject($1, $2)', [id, reason]);
  },
  async finish(a) {
    const r = await pg.query<{ r: unknown }>('select round_finish($1, $2, $3, $4, $5) as r', [
      a.roundId,
      a.userId,
      JSON.stringify(a.shotLog),
      a.clientScore,
      a.score,
    ]);
    return r.rows[0]!.r;
  },
};

const start = async (user = A, seed = SEED) => {
  const r = await pg.query<{ round_id: string }>('select * from round_start($1, $2, 120)', [
    user,
    seed,
  ]);
  return r.rows[0]!.round_id;
};

const finish = (roundId: string, shotLog: unknown, clientScore: unknown = 0, user = A) =>
  finishRound(db, user, { roundId, shotLog, clientScore }, Date.now(), (r) => logged.push(r));

const scalar = async (sql: string) =>
  Object.values((await pg.query<Record<string, unknown>>(sql)).rows[0]!)[0];

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(PRELUDE);
  await pg.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
  await pg.exec(`update campaign_config set value = '"2000-01-01T00:00:00Z"' where key = 'starts_at';
    update campaign_config set value = '"2100-01-01T00:00:00Z"' where key = 'ends_at';`);
});

beforeEach(async () => {
  logged.length = 0;
  await pg.exec(`reset role; set test.uid = ''; update campaign_config set value = 'true'
    where key = 'is_open'; delete from rewards; delete from coupons; delete from rounds;
    delete from profiles; delete from auth.users; delete from rate_limits;
    insert into auth.users (id) values ('${A}'), ('${B}');
    insert into coupons (code, campaign) values
      ('C1', 'raavan-2026'), ('C2', 'raavan-2026'), ('C3', 'raavan-2026');`);
  await pg.query(`select session_upsert($1, 'A', null), session_upsert($2, 'B', null)`, [A, B]);
});

describe('round-start', () => {
  it('decrements attempts and hands back a round', async () => {
    await start();
    expect(await scalar(`select attempts_left from profiles where id = '${A}'`)).toBe(9);
  });

  it('refuses a second live round', async () => {
    await start();
    await expect(start()).rejects.toThrow('round_in_progress');
    expect(await scalar(`select attempts_left from profiles where id = '${A}'`)).toBe(9);
  });

  it('frees a player whose round was abandoned', async () => {
    const old = await start();
    await pg.query(`update rounds set started_at = now() - interval '3 minutes' where id = $1`, [
      old,
    ]);
    await start();
    expect(await scalar(`select reject_reason from rounds where id = '${old}'`)).toBe('abandoned');
  });

  it('refuses when out of attempts', async () => {
    await pg.exec(`update profiles set attempts_left = 0 where id = '${A}'`);
    await expect(start()).rejects.toThrow('no_attempts');
  });

  it('refuses while the campaign is closed', async () => {
    await pg.exec(`update campaign_config set value = 'false' where key = 'is_open'`);
    await expect(start()).rejects.toThrow('campaign_closed');
  });
});

describe('round-finish', () => {
  it('pays a real win', async () => {
    const r = await finish(await start(), winning.shotLog, 10);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ score: 10, best: 10, attemptsLeft: 9 });
    expect((r.body as { reward: { code: string } }).reward.code).toBe('C1');
  });

  it('ignores a forged client score', async () => {
    const r = await finish(await start(), [], 10);
    expect(r.body).toMatchObject({ score: 0, reward: null });
    expect(await scalar(`select count(*)::int from coupons where assigned_to is not null`)).toBe(0);
    expect(logged.join()).toContain('score_mismatch');
  });

  it('rejects a reused round id', async () => {
    const id = await start();
    await finish(id, winning.shotLog, 10);
    const again = await finish(id, winning.shotLog, 10);
    expect(again).toMatchObject({ status: 409, body: { error: 'round_not_started' } });
  });

  it('rejects another player finishing my round', async () => {
    const r = await finish(await start(A), winning.shotLog, 10, B);
    expect(r).toMatchObject({ status: 403, body: { error: 'not_your_round' } });
  });

  it('rejects 13 shots', async () => {
    const id = await start();
    const shots = Array.from({ length: 13 }, (_, i) => ({ tick: i * 60, angle: 0 }));
    expect((await finish(id, shots)).body).toEqual({ error: 'too_many_shots' });
    expect(await scalar(`select status from rounds where id = '${id}'`)).toBe('rejected');
  });

  it('rejects shots 100 ms apart', async () => {
    const shots = [
      { tick: 60, angle: 0 },
      { tick: 66, angle: 0 },
    ];
    expect((await finish(await start(), shots)).body).toEqual({ error: 'shots_too_close' });
  });

  it('rejects a finish 3 minutes late', async () => {
    const id = await start();
    await pg.query(`update rounds set started_at = now() - interval '3 minutes' where id = $1`, [
      id,
    ]);
    const r = await finish(id, winning.shotLog, 10);
    expect(r.body).toEqual({ error: 'finished_late' });
    expect(await scalar(`select count(*)::int from rewards`)).toBe(0);
  });

  it('50 queued finishes on one winning round pay one coupon', async () => {
    const id = await start();
    const results = await Promise.all(
      Array.from({ length: 50 }, () => finish(id, winning.shotLog, 10)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await scalar(`select count(*)::int from rewards`)).toBe(1);
    expect(await scalar(`select count(*)::int from coupons where assigned_to is not null`)).toBe(1);
  });

  it('a second win keeps the first coupon', async () => {
    await finish(await start(), winning.shotLog, 10);
    const second = await finish(await start(), winning.shotLog, 10);
    expect((second.body as { reward: { code: string } }).reward.code).toBe('C1');
    expect(await scalar(`select count(*)::int from coupons where assigned_to is not null`)).toBe(1);
  });

  it('survives an empty coupon pool', async () => {
    await pg.exec('delete from coupons');
    const r = await finish(await start(), winning.shotLog, 10);
    expect(r.body).toMatchObject({ score: 10, reward: null });
  });
});

describe('row level security', () => {
  const as = async (user: string, role = 'authenticated') => {
    await pg.exec(`set test.uid = '${user}'; set role ${role}`);
  };

  it('shows a player only their own rows', async () => {
    await finish(await start(A), winning.shotLog, 10);
    await as(B);
    expect((await pg.query('select * from profiles')).rows).toHaveLength(1);
    expect((await pg.query('select * from rounds')).rows).toHaveLength(0);
    expect((await pg.query('select * from rewards')).rows).toHaveLength(0);
    expect((await pg.query('select * from coupons')).rows).toHaveLength(0);
  });

  it('stops players writing directly', async () => {
    await as(A);
    await pg.exec(`update profiles set attempts_left = 999`);
    await expect(pg.exec(`insert into coupons values ('X', 'y')`)).rejects.toThrow();
    await pg.exec('reset role');
    expect(await scalar(`select attempts_left from profiles where id = '${A}'`)).toBe(10);
  });

  it('stops players calling the transactional functions', async () => {
    await as(A);
    await expect(start()).rejects.toThrow('permission denied');
  });
});

describe('rate limit', () => {
  it('allows 20 calls a minute and refuses the 21st', async () => {
    const hit = () => scalar(`select rate_limit_hit('${A}', 20)`);
    for (let i = 0; i < 20; i++) expect(await hit()).toBe(true);
    expect(await hit()).toBe(false);
  });
});
