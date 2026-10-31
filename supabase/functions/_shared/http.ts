import { createClient, type User } from 'npm:@supabase/supabase-js@2';

const RATE_LIMIT_PER_MINUTE = 20;

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function logRejection(fn: string, userId: string, reason: string, roundId?: unknown): void {
  console.warn(JSON.stringify({ event: 'rejected', fn, userId, reason, roundId }));
}

export async function readConfig(): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from('campaign_config').select('key, value');
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}

/** Serves a function: CORS, method check, then for `user` handlers auth and the rate limit. */
export function serve(
  name: string,
  method: 'GET' | 'POST',
  handler: (req: Request, user: User) => Promise<Response>,
): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== method) return json({ error: 'method_not_allowed' }, 405);
    try {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return json({ error: 'unauthorized' }, 401);
      const user = data.user;

      const limit = await admin.rpc('rate_limit_hit', {
        p_user: user.id,
        p_limit: RATE_LIMIT_PER_MINUTE,
      });
      if (limit.error) throw limit.error;
      if (!limit.data) {
        logRejection(name, user.id, 'rate_limited');
        return json({ error: 'rate_limited' }, 429);
      }
      return await handler(req, user);
    } catch (error) {
      console.error(name, error);
      return json({ error: 'server_error' }, 500);
    }
  });
}
