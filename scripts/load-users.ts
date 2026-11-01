// Creates fake players on STAGING and writes load/tokens.json for load/round-pair.js.
// Usage: pnpm load-users 2000   with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// 2000 players keeps each under the limit of 20 requests a minute at 200 pairs a second.
// Before running, on staging only:
//   update campaign_config set value = '1000' where key = 'attempts_per_user';
//   raise the sign-in limit in Authentication > Rate Limits
// Tokens last an hour by default, so run k6 soon after.
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const MIN_ATTEMPTS = 30; // one round every 10 s for 5 minutes
const PASSWORD = crypto.randomUUID();
const count = Number(process.argv[2]);
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!count || !url || !anonKey || !serviceKey) {
  console.error(
    'Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... pnpm load-users <count>',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// A production campaign has 10 attempts, so this stops fake players landing there by accident.
const { data: config, error: configError } = await admin
  .from('campaign_config')
  .select('value')
  .eq('key', 'attempts_per_user')
  .single();
if (configError) throw configError;
if (Number(config.value) < MIN_ATTEMPTS) {
  console.error(`attempts_per_user is ${config.value}. Is this staging? See the top of this file.`);
  process.exit(1);
}

const tokens: string[] = [];
for (let i = 0; i < count; i++) {
  const email = `load-${crypto.randomUUID()}@load.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;

  const player = createClient(url, anonKey, { auth: { persistSession: false } });
  const signedIn = await player.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session.access_token;

  const session = await fetch(`${url}/functions/v1/session`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    body: '{}',
  });
  if (!session.ok) throw new Error(`session ${session.status}: ${await session.text()}`);
  tokens.push(token);
}

writeFileSync('load/tokens.json', JSON.stringify(tokens));
console.log(`Wrote ${tokens.length} tokens to load/tokens.json.`);
