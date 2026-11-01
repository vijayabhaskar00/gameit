// 200 round-start + round-finish pairs per second for 5 minutes, against STAGING only.
// Seed players first with `pnpm load-users`, then:
//   k6 run -e SUPABASE_URL=https://<ref>.supabase.co -e SUPABASE_ANON_KEY=<key> load/round-pair.js
// Shorter smoke run: add -e RATE=5 -e DURATION=30s
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import http from 'k6/http';

const tokens = new SharedArray('tokens', () => JSON.parse(open('./tokens.json')));
const base = `${__ENV.SUPABASE_URL}/functions/v1`;

// A full log, so the server pays the same simulation cost as a real round.
const shotLog = Array.from({ length: 12 }, (_, i) => ({ tick: 60 + i * 120, angle: i * 5 - 30 }));

export const options = {
  scenarios: {
    pairs: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE ?? 200),
      timeUnit: '1s',
      duration: __ENV.DURATION ?? '5m',
      preAllocatedVUs: 500,
      maxVUs: 3000,
    },
  },
  thresholds: { http_req_failed: ['rate<0.005'] },
};

export default function () {
  const token = tokens[exec.scenario.iterationInTest % tokens.length];
  const headers = {
    apikey: __ENV.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const started = http.post(`${base}/round-start`, '{}', {
    headers,
    tags: { name: 'round-start' },
  });
  if (!check(started, { 'round-start 200': (r) => r.status === 200 })) return;

  const body = JSON.stringify({ roundId: started.json('roundId'), shotLog, clientScore: 0 });
  const finished = http.post(`${base}/round-finish`, body, {
    headers,
    tags: { name: 'round-finish' },
  });
  check(finished, { 'round-finish 200': (r) => r.status === 200 });
}
