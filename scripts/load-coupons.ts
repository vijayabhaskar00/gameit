// Usage: pnpm coupons <file.csv> <campaign>
// The CSV needs one coupon code per line in its first column; a "code" header is skipped.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BATCH = 500;
const [file, campaign] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!file || !campaign || !url || !key) {
  console.error(
    'Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm coupons <file.csv> <campaign>',
  );
  process.exit(1);
}

const codes = new Set(
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.split(',')[0]!.trim())
    .filter((code) => code && code.toLowerCase() !== 'code'),
);

const supabase = createClient(url, key, { auth: { persistSession: false } });
const rows = [...codes].map((code) => ({ code, campaign }));

for (let i = 0; i < rows.length; i += BATCH) {
  // ignoreDuplicates leaves already assigned coupons untouched when a file is loaded twice.
  const { error } = await supabase
    .from('coupons')
    .upsert(rows.slice(i, i + BATCH), { onConflict: 'code', ignoreDuplicates: true });
  if (error) throw error;
}
console.log(`Loaded ${rows.length} codes into ${campaign}.`);
