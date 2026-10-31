import { jwtVerify } from 'npm:jose@5';
import { admin, json, logRejection } from '../_shared/http.ts';

// The host app signs { sub, exp } with HS256 and HOST_JWT_SECRET. No session exists yet, so
// this function cannot use the shared auth wrapper.
const secret = new TextEncoder().encode(Deno.env.get('HOST_JWT_SECRET')!);

async function emailFor(sub: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 40)}@host.invalid`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json(null);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const { token } = await req.json();
    const { payload } = await jwtVerify(String(token), secret, {
      algorithms: ['HS256'],
      requiredClaims: ['sub', 'exp'],
    });
    // generateLink finds the user, or creates it on the first visit.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: await emailFor(payload.sub!),
    });
    if (error) throw error;
    return json({ tokenHash: data.properties.hashed_token });
  } catch (error) {
    logRejection('auth-embed', 'unknown', String(error));
    return json({ error: 'invalid_token' }, 401);
  }
});
