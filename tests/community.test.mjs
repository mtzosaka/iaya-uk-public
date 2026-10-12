import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { handleCommunity, verifyGoogleCredential, hashToken } from '../server/community.mjs';

const migration = await readFile(new URL('../migrations/schema.sql', import.meta.url), 'utf8');
const clientId = '123-iaya-test.apps.googleusercontent.com';
const origin = 'https://iaya.example';
const originalFetch = globalThis.fetch;
const signingKeys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', signingKeys.publicKey), kid: 'test-key', use: 'sig', alg: 'RS256' };
const fetchKeys = async (url) => {
  assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs');
  return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Cache-Control': 'max-age=3600' } });
};
globalThis.fetch = fetchKeys;
after(() => { globalThis.fetch = originalFetch; });

class TestD1 {
  constructor() { this.database = new DatabaseSync(':memory:'); this.database.exec(migration); }
  prepare(sql) {
    const database = this.database;
    const make = (values = []) => ({
      bind: (...bound) => make(bound),
      first: async () => database.prepare(sql).get(...values) || null,
      all: async () => ({ results: database.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: database.prepare(sql).run(...values).changes } }),
    });
    return make();
  }
  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  close() { this.database.close(); }
}

function environment() { return { DB: new TestD1(), GOOGLE_CLIENT_ID: clientId, ADMIN_EMAILS: 'chair@gmail.com' }; }
function request(path, { method = 'GET', body, headers = {}, cookie, csrf } = {}) {
  return new Request(`${origin}${path}`, { method,
    headers: { ...(!['GET', 'HEAD'].includes(method) ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}
function segment(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
async function token(nonce, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iss: 'https://accounts.google.com', aud: clientId, sub: 'member-one',
    email: 'member@gmail.com', email_verified: true, name: 'Member One', iat: now - 10,
    exp: now + 3600, nonce, ...overrides };
  const unsigned = `${segment({ alg: 'RS256', kid: 'test-key' })}.${segment(body)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKeys.privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
}
async function login(env, overrides = {}) {
  const nonceResponse = await handleCommunity(request('/api/auth/nonce'), env);
  assert.equal(nonceResponse.status, 200);
  const nonce = (await nonceResponse.json()).nonce;
  const nonceCookie = nonceResponse.headers.get('Set-Cookie').split(';')[0];
  const credential = await token(nonce, overrides);
  const response = await handleCommunity(request('/api/auth/google', { method: 'POST', body: { credential, nonce }, cookie: nonceCookie }), env);
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const state = await response.json();
  const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith('__Host-iaya_session=')).split(';')[0];
  return { state, cookie: sessionCookie, csrf: state.csrf_token, nonce, nonceCookie, credential, response };
}
const profile = { full_name: 'Member One', university: 'University of Cambridge', field: 'Engineering',
  message: 'I would like to support the association.', consent: true };
async function apply(env, member, body = profile) {
  return handleCommunity(request('/api/membership', { method: 'POST', body, ...member }), env);
}

test('unconfigured auth fails closed and config never leaks a fake enabled state', async () => {
  const config = await handleCommunity(request('/api/config'), {});
  const readiness = await config.json();
  assert.equal(readiness.configured, false);
  assert.equal(readiness.google_client_id, null);
  assert.equal((await handleCommunity(request('/api/auth/nonce'), {})).status, 503);
  assert.equal((await handleCommunity(request('/api/auth/google', { method: 'POST', body: { credential: 'fake' } }), {})).status, 503);
  assert.equal((await handleCommunity(request('/api/session'), {})).status, 200);
  const db = new TestD1();
  assert.equal((await (await handleCommunity(request('/api/config'), { DB: db })).json()).configured, false);
  db.database.exec('DROP TABLE community_schema');
  assert.equal((await (await handleCommunity(request('/api/config'), { DB: db, GOOGLE_CLIENT_ID: clientId })).json()).configured, false);
  db.close();
});

test('only HTTPS and same-origin mutations are accepted', async () => {
  const env = environment();
  const insecure = await handleCommunity(new Request('http://iaya.example/api/config'), env);
  assert.equal((await insecure.json()).configured, false);
  const foreign = await handleCommunity(request('/api/auth/google', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(foreign.status, 403);
  const missing = request('/api/auth/google', { method: 'POST', body: {} }); missing.headers.delete('Origin');
  assert.equal((await handleCommunity(missing, env)).status, 403);
  assert.equal((await handleCommunity(request('/api/auth/nonce', { headers: { 'Sec-Fetch-Site': 'cross-site' } }), env)).status, 403);
  env.DB.close();
});

test('signature, audience, issuer, expiry, email verification and nonce are checked', async () => {
  const nonce = 'a'.repeat(64);
  const valid = await token(nonce);
  assert.equal((await verifyGoogleCredential(valid, { clientId, nonce }, fetchKeys)).google_sub, 'member-one');
  for (const claims of [{ aud: 'wrong' }, { iss: 'https://evil.example' }, { exp: 1 }, { email_verified: false },
    { nonce: 'b'.repeat(64) }, { azp: 'wrong-client' }, { iat: Math.floor(Date.now() / 1000) + 300 }, { sub: '' }]) {
    await assert.rejects(verifyGoogleCredential(await token(nonce, claims), { clientId, nonce }, fetchKeys));
  }
  const parts = valid.split('.');
  parts[1] = segment({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), email: 'chair@gmail.com' });
  await assert.rejects(verifyGoogleCredential(parts.join('.'), { clientId, nonce }, fetchKeys));
  await assert.rejects(verifyGoogleCredential('x.y.z', { clientId, nonce }, fetchKeys));
  await assert.rejects(verifyGoogleCredential(valid, { clientId, nonce }, async () => { throw new Error('offline'); }), { code: 'GOOGLE_UNAVAILABLE' });
});

test('nonce is browser-bound and consumed once; sessions are HttpOnly and hashed in D1', async () => {
  const env = environment();
  const member = await login(env);
  const replay = await handleCommunity(request('/api/auth/google', { method: 'POST', body: { credential: member.credential, nonce: member.nonce }, cookie: member.nonceCookie }), env);
  assert.equal(replay.status, 401);
  const noCookie = await handleCommunity(request('/api/auth/google', { method: 'POST', body: { credential: member.credential, nonce: member.nonce } }), env);
  assert.equal(noCookie.status, 401);
  assert.match(member.response.headers.getSetCookie()[0], /Secure; HttpOnly; SameSite=Lax/);
  const sessionToken = member.cookie.split('=')[1];
  const stored = env.DB.database.prepare('SELECT token_hash FROM community_sessions').get();
  assert.equal(stored.token_hash, await hashToken(sessionToken));
  assert.notEqual(stored.token_hash, sessionToken);
  const state = await (await handleCommunity(request('/api/session', member), env)).json();
  assert.equal(state.authenticated, true);
  assert.equal(state.user.is_admin, false);
  env.DB.close();
});

test('applications are durable, idempotent, validate consent, and cannot self-approve', async () => {
  const env = environment();
  const member = await login(env);
  const missingCsrf = await apply(env, { cookie: member.cookie });
  assert.equal(missingCsrf.status, 403);
  assert.equal((await apply(env, member, { ...profile, consent: false })).status, 400);
  assert.equal((await apply(env, member, { ...profile, full_name: 'x'.repeat(121) })).status, 400);
  const submitted = await (await apply(env, member, { ...profile, status: 'approved', is_admin: true })).json();
  assert.equal(submitted.membership.status, 'pending');
  const duplicate = await (await apply(env, member)).json();
  assert.equal(duplicate.membership.id, submitted.membership.id);
  assert.equal(duplicate.membership.version, submitted.membership.version);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) AS count FROM membership_applications').get().count, 1);
  const read = await (await handleCommunity(request('/api/membership', member), env)).json();
  assert.equal(read.membership.id, submitted.membership.id);
  assert.equal((await handleCommunity(request('/api/community', member), env)).status, 403);
  assert.equal((await handleCommunity(request('/api/admin/applications', member), env)).status, 403);
  env.DB.close();
});

test('only allowlisted administrators approve; stale decisions conflict and audits persist', async () => {
  const env = environment();
  const member = await login(env);
  const application = (await (await apply(env, member)).json()).membership;
  const admin = await login(env, { sub: 'chair-one', email: 'chair@gmail.com', name: 'Chair' });
  assert.equal(admin.state.user.is_admin, true);
  const queue = await (await handleCommunity(request('/api/admin/applications', admin), env)).json();
  assert.equal(queue.applications.length, 1);
  assert.equal(queue.counts.pending, 1);
  const endpoint = `/api/admin/applications/${application.id}`;
  const forged = await handleCommunity(request(endpoint, { ...member, method: 'PATCH', body: { status: 'approved', version: 1 } }), env);
  assert.equal(forged.status, 403);
  const approved = await handleCommunity(request(endpoint, { ...admin, method: 'PATCH', body: { status: 'approved', version: application.version, note: 'Welcome' } }), env);
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).membership.status, 'approved');
  assert.equal((await handleCommunity(request(endpoint, { ...admin, method: 'PATCH', body: { status: 'rejected', version: application.version } }), env)).status, 409);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) AS count FROM membership_audit').get().count, 1);
  const resources = await handleCommunity(request('/api/community', member), env);
  assert.equal(resources.status, 200);
  assert.deepEqual((await resources.json()).resources, []);
  const resubmitted = await (await apply(env, member, { ...profile, status: 'pending' })).json();
  assert.equal(resubmitted.membership.status, 'approved');
  // Removing the deployment allowlist immediately removes active-session admin access.
  env.ADMIN_EMAILS = '';
  assert.equal((await handleCommunity(request('/api/admin/applications', admin), env)).status, 403);
  env.DB.close();
});

test('administrator cannot approve own application, rejection may reapply, third-party email cannot become admin', async () => {
  const env = environment();
  const admin = await login(env, { sub: 'chair-one', email: 'chair@gmail.com' });
  const own = (await (await apply(env, admin)).json()).membership;
  assert.equal((await handleCommunity(request(`/api/admin/applications/${own.id}`, { ...admin, method: 'PATCH', body: { status: 'approved', version: own.version } }), env)).status, 403);
  const member = await login(env);
  const application = (await (await apply(env, member)).json()).membership;
  const rejected = await handleCommunity(request(`/api/admin/applications/${application.id}`, { ...admin, method: 'PATCH', body: { status: 'rejected', version: application.version, note: 'Please add more details.' } }), env);
  assert.equal(rejected.status, 200);
  const again = (await (await apply(env, member)).json()).membership;
  assert.equal(again.status, 'pending');
  assert.equal(again.id, application.id);
  assert.equal(again.review_note, '');
  env.ADMIN_EMAILS = 'chair@external.example';
  const outside = await login(env, { sub: 'external-chair', email: 'chair@external.example' });
  assert.equal(outside.state.user.is_admin, false);
  const workspace = await login(env, { sub: 'workspace-chair', email: 'chair@external.example', hd: 'external.example' });
  assert.equal(workspace.state.user.is_admin, true);
  env.DB.close();
});

test('logout invalidates server session and expired cookies confer no access', async () => {
  const env = environment();
  const member = await login(env);
  assert.equal((await handleCommunity(request('/api/auth/logout', { ...member, method: 'POST', body: {} }), env)).status, 200);
  assert.equal((await handleCommunity(request('/api/membership', member), env)).status, 401);
  assert.equal((await (await handleCommunity(request('/api/session', member), env)).json()).authenticated, false);
  const fresh = await login(env);
  env.DB.database.exec('UPDATE community_sessions SET expires_at = 1');
  assert.equal((await handleCommunity(request('/api/community', fresh), env)).status, 401);
  const ambiguous = `${fresh.cookie}; ${fresh.cookie}`;
  assert.equal((await handleCommunity(request('/api/membership', { cookie: ambiguous }), env)).status, 401);
  env.DB.close();
});

test('admin pagination returns accurate global counts and never exposes session secrets', async () => {
  const env = environment();
  const member = await login(env);
  await apply(env, member);
  const admin = await login(env, { sub: 'chair-one', email: 'chair@gmail.com' });
  const result = await handleCommunity(request('/api/admin/applications?status=all', admin), env);
  const body = await result.json();
  assert.deepEqual(body.counts, { pending: 1, approved: 0, rejected: 0, total: 1 });
  assert.equal(body.next_cursor, null);
  assert.equal('user_id' in body.applications[0], false);
  assert.equal('review_token' in body.applications[0], false);
  assert.equal((await handleCommunity(request('/api/admin/applications?status=invalid', admin), env)).status, 400);
  assert.equal((await handleCommunity(request('/api/admin/applications?cursor=invalid', admin), env)).status, 400);
  env.DB.close();
});

test('public auth rate limits bound nonce writes and failed credential attempts', async () => {
  const env = environment();
  for (let index = 0; index < 20; index += 1) {
    assert.equal((await handleCommunity(request('/api/auth/nonce'), env)).status, 200);
  }
  const blocked = await handleCommunity(request('/api/auth/nonce'), env);
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, 'RATE_LIMITED');
  assert.equal(blocked.headers.get('Retry-After'), '300');
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) AS count FROM auth_nonces').get().count, 20);
  for (let index = 0; index < 30; index += 1) {
    assert.equal((await handleCommunity(request('/api/auth/google', { method: 'POST', body: {} }), env)).status, 401);
  }
  assert.equal((await handleCommunity(request('/api/auth/google', { method: 'POST', body: {} }), env)).status, 429);
  assert.equal(env.DB.database.prepare('SELECT COUNT(*) AS count FROM community_rate_limits').get().count, 2);
  env.DB.close();
});

test('Google key fetching is deduplicated and unknown kids cannot force refresh loops', async () => {
  const nonce = 'c'.repeat(64);
  const credential = await token(nonce);
  let calls = 0;
  const countingFetch = async (url) => { calls += 1; return fetchKeys(url); };
  await Promise.all(Array.from({ length: 10 }, () => verifyGoogleCredential(credential, { clientId, nonce }, countingFetch)));
  assert.equal(calls, 1);
  for (let index = 0; index < 10; index += 1) {
    const parts = credential.split('.');
    parts[0] = segment({ alg: 'RS256', kid: `unknown-${index}` });
    await assert.rejects(verifyGoogleCredential(parts.join('.'), { clientId, nonce }, countingFetch));
  }
  assert.equal(calls, 1);
});
