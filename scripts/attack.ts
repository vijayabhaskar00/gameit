// Attacks the real migration and the real finishRound on a real Postgres server, so row locks
// and SKIP LOCKED run with truly parallel connections. PGlite in tests/ cannot do that.
// ponytail: skips the HTTP and auth layers because `supabase start` needs Docker.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { finishRound } from '../supabase/functions/_shared/roundFinish.ts';
import { SIM_CONFIG } from '../supabase/functions/_shared/simConfig.ts';
import { perfectBot } from '../tests/bot.ts';
import { finishDb, OPEN_CAMPAIGN, PRELUDE, type Query } from '../tests/testDb.ts';

const PORT = 54329;
const CAMPAIGN = 'raavan-2026';
const SEED = 7;
const winning = perfectBot(SEED, SIM_CONFIG).shotLog;

const server = new EmbeddedPostgres({
  databaseDir: mkdtempSync(join(tmpdir(), 'gameit-attack-')),
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  // On Windows an io_worker outlives server.stop() and keeps the port.
  postgresFlags: ['-c', 'io_method=sync'],
  onLog: () => {},
  onError: () => {},
});
await server.initialise();
await server.start();
const pool = new pg.Pool({
  host: 'localhost',
  port: PORT,
  user: 'postgres',
  password: 'postgres',
  max: 60,
});
const query: Query = (sql, params) => pool.query(sql, params as unknown[]);
const db = finishDb(query);

const rows = async (sql: string, params?: unknown[]) => (await query(sql, params)).rows;
const count = async (sql: string) => Number(Object.values((await rows(sql))[0]!)[0]);

let nextUser = 0;
async function player(): Promise<string> {
  const id = `00000000-0000-4000-8000-${String(++nextUser).padStart(12, '0')}`;
  await query('insert into auth.users (id) values ($1)', [id]);
  await query(`select session_upsert($1, 'attacker', null)`, [id]);
  return id;
}
const start = async (user: string) =>
  (await rows('select * from round_start($1, $2, 120)', [user, SEED]))[0]!.round_id as string;
const finish = (user: string, roundId: string, shotLog: unknown, clientScore: unknown = 10) =>
  finishRound(db, user, { roundId, shotLog, clientScore }, Date.now(), () => {});
const statuses = (results: { status: number }[]) =>
  [...new Set(results.map((r) => r.status))].sort().join('/');
const addCoupons = (n: number, prefix: string) =>
  query(
    `insert into coupons (code, campaign)
     select $1 || i, $2 from generate_series(1, $3::int) i`,
    [prefix, CAMPAIGN, n],
  );

let failed = 0;
function report(name: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? 'BLOCKED' : 'BREACH '}  ${name}: ${detail}`);
}

try {
  await pool.query(PRELUDE);
  await pool.query(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
  await pool.query(OPEN_CAMPAIGN);
  await addCoupons(100, 'C');

  {
    const u = await player();
    const r = await finish(u, await start(u), []);
    const score = (r.body as { score: number }).score;
    const won = await count(`select count(*) from rewards where user_id = '${u}'`);
    report('forged 10/10', score === 0 && won === 0, `server score ${score}, rewards ${won}`);
  }
  {
    const u = await player();
    const id = await start(u);
    const first = await finish(u, id, winning);
    const again = await finish(u, id, winning);
    report(
      'reused round id',
      first.status === 200 && again.status === 409,
      `first ${first.status}, second ${again.status} ${JSON.stringify(again.body)}`,
    );
  }
  {
    const u = await player();
    const shots = Array.from({ length: 13 }, (_, i) => ({ tick: i * 60, angle: 0 }));
    const r = await finish(u, await start(u), shots);
    report('13 shots', r.status === 422, `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const u = await player();
    const shots = [
      { tick: 60, angle: 0 },
      { tick: 66, angle: 0 },
    ];
    const r = await finish(u, await start(u), shots);
    report('shots 100 ms apart', r.status === 422, `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const u = await player();
    const id = await start(u);
    await query(`update rounds set started_at = now() - interval '3 minutes' where id = $1`, [id]);
    const r = await finish(u, id, winning);
    report('finish after 3 minutes', r.status === 422, `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const u = await player();
    const id = await start(u);
    const results = await Promise.all(Array.from({ length: 50 }, () => finish(u, id, winning)));
    const paid = results.filter((r) => r.status === 200).length;
    const coupons = await count(`select count(*) from coupons where assigned_to = '${u}'`);
    report(
      '50 parallel finishes on one winning round',
      paid === 1 && coupons === 1,
      `${paid} accepted, statuses ${statuses(results)}, coupons ${coupons}`,
    );
  }
  {
    const u = await player();
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => start(u)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const left = await count(`select attempts_left from profiles where id = '${u}'`);
    report(
      '20 parallel round starts',
      ok === 1 && left === 9,
      `${ok} started, attempts left ${left}`,
    );
  }
  {
    await query('delete from coupons where assigned_to is null');
    await addCoupons(5, 'RACE');
    const users = await Promise.all(Array.from({ length: 30 }, player));
    const ids = await Promise.all(users.map(start));
    const results = await Promise.all(users.map((u, i) => finish(u, ids[i]!, winning)));
    const taken = await count(
      `select count(*) from coupons where code like 'RACE%' and assigned_to is not null`,
    );
    report(
      '30 winners race for 5 coupons',
      taken === 5 && results.every((r) => r.status === 200),
      `${taken} issued, statuses ${statuses(results)}`,
    );
  }

  const doubled = await count(
    `select count(*) from (select assigned_to from coupons where assigned_to is not null
       group by assigned_to having count(*) > 1) t`,
  );
  report('no player holds two coupons', doubled === 0, `${doubled} players with two or more`);
} finally {
  await pool.end();
  await server.stop();
}

console.log(failed ? `\n${failed} attack(s) got through` : '\nEvery attack failed.');
process.exit(failed ? 1 : 0);
