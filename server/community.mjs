/**
 * IAYA community API for Cloudflare Workers + D1. No runtime dependencies.
 * Required bindings: DB, GOOGLE_CLIENT_ID. ADMIN_EMAILS is a comma-separated
 * deployment allowlist; the browser can never grant a role or approve itself.
 * Apply migrations/schema.sql once before enabling this service.
 *
 * Google Identity Services must initialize with the nonce returned by
 * GET /api/auth/nonce. Its JS callback posts {credential, nonce} as JSON.
 * Authenticated mutations require X-CSRF-Token from GET /api/session.
 */
const SESSION_COOKIE = '__Host-iaya_session';
const NONCE_COOKIE = '__Host-iaya_nonce';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const NONCE_TTL = 600;
const SESSION_TTL = 86400;
const MAX_BODY_BYTES = 24000;
const RATE_WINDOW = 300;
const KEY_REFRESH_COOLDOWN = 30000;
const encoder = new TextEncoder();
const keyCaches = new WeakMap();

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(value, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(value), { status, headers });
}

function fail(status, code, message) {
  throw new ApiError(status, code, message);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalStrings(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string') return false;
  const firstBytes = encoder.encode(first);
  const secondBytes = encoder.encode(second);
  let different = firstBytes.length ^ secondBytes.length;
  for (let index = 0; index < Math.max(firstBytes.length, secondBytes.length); index += 1) {
    different |= (firstBytes[index] || 0) ^ (secondBytes[index] || 0);
  }
  return different === 0;
}

function cookie(request, name) {
  const entries = (request.headers.get('Cookie') || '').split(';');
  const matching = entries.map((entry) => entry.trim()).filter((entry) => entry.startsWith(`${name}=`));
  // Reject ambiguous cookies rather than trusting the first attacker-controlled value.
  if (matching.length !== 1) return null;
  const value = matching[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function setCookie(name, value, lifetime) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${lifetime}`;
}

function clearCookie(name) {
  return setCookie(name, '', 0);
}

function sameOrigin(request, mutation = false) {
  const origin = new URL(request.url).origin;
  const supplied = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if ((mutation && supplied !== origin) || (supplied && supplied !== origin)
      || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
    fail(403, 'ORIGIN_FORBIDDEN', 'Use the community website to make this request.');
  }
}

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) {
    fail(415, 'JSON_REQUIRED', 'Send this request as JSON.');
  }
  const suppliedLength = Number(request.headers.get('Content-Length') || 0);
  if (suppliedLength > MAX_BODY_BYTES) fail(413, 'BODY_TOO_LARGE', 'The request is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'INVALID_JSON', 'The request body is required.');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        fail(413, 'BODY_TOO_LARGE', 'The request is too large.');
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(400, 'INVALID_JSON', 'The request body must be a valid JSON object.');
  }
}

async function limitAuthentication(request, env, action, maximum) {
  const timestamp = nowSeconds();
  const windowStart = Math.floor(timestamp / RATE_WINDOW) * RATE_WINDOW;
  // CF-Connecting-IP is supplied by the Cloudflare edge. Do not trust arbitrary
  // X-Forwarded-For values. Non-Cloudflare requests share a conservative bucket.
  const suppliedAddress = request.headers.get('CF-Connecting-IP') || '';
  const address = /^[a-f0-9:.]{3,64}$/i.test(suppliedAddress) ? suppliedAddress : 'unknown';
  const bucket = await hashToken(`${action}:${address}:${windowStart}`);
  await env.DB.prepare('DELETE FROM community_rate_limits WHERE expires_at <= ?').bind(timestamp).run();
  const accepted = await env.DB.prepare(`INSERT INTO community_rate_limits (bucket_key, requests, expires_at)
    VALUES (?, 1, ?) ON CONFLICT(bucket_key) DO UPDATE SET requests = requests + 1
    WHERE community_rate_limits.requests < ? RETURNING requests`)
    .bind(bucket, windowStart + RATE_WINDOW, maximum).first();
  if (!accepted) fail(429, 'RATE_LIMITED', 'Please wait a few minutes before trying again.');
}

function textField(value, field, minimum, maximum) {
  if (typeof value !== 'string') fail(400, 'INVALID_APPLICATION', `${field} is required.`);
  const clean = value.trim().normalize('NFC');
  if (clean.length < minimum || clean.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(clean)) {
    fail(400, 'INVALID_APPLICATION', `${field} must contain ${minimum}–${maximum} characters.`);
  }
  return clean;
}

function adminEmails(env) {
  return new Set(String(env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)));
}

function isAdmin(user, env) {
  // Google is not authoritative for a third-party email with no Workspace hd claim.
  // A verified gmail/Workspace identity is required for email-based admin access.
  return Boolean(user.email_authoritative && adminEmails(env).has(user.email.toLowerCase()));
}

async function configuration(request, env) {
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  const hasClient = /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const hasDatabase = Boolean(env.DB && typeof env.DB.prepare === 'function');
  let schemaReady = false;
  if (hasDatabase) {
    try { schemaReady = Boolean(await env.DB.prepare('SELECT version FROM community_schema WHERE version = 1').first()); }
    catch { schemaReady = false; }
  }
  const secure = new URL(request.url).protocol === 'https:';
  const configured = secure && hasClient && schemaReady;
  let reason = null;
  if (!secure) reason = 'Community sign-in requires HTTPS.';
  else if (!hasDatabase || !schemaReady) reason = 'Membership storage has not been connected yet.';
  else if (!hasClient) reason = 'Google sign-in is awaiting the association’s OAuth configuration.';
  return {
    configured,
    google_client_id: configured ? clientId : null,
    requires_approval: true,
    admin_review_enabled: adminEmails(env).size > 0,
    reason,
  };
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(decoded, (letter) => letter.charCodeAt(0));
  } catch { fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.'); }
}

function decodeJsonSegment(value) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64Url(value))); }
  catch { fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.'); }
}

async function googleKeys(fetcher, refresh = false) {
  const previous = keyCaches.get(fetcher);
  if (previous?.pending) return previous.pending;
  if (!refresh && previous && previous.expires > Date.now()) return previous.keys;
  if (refresh && previous?.keys && previous.fetchedAt + KEY_REFRESH_COOLDOWN > Date.now()) return previous.keys;
  const pending = (async () => {
    try {
      const response = await fetcher(JWKS_URL, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data.keys) || data.keys.length > 20) throw new Error('invalid keys');
      const keys = data.keys.filter((key) => key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
      if (!keys.length) throw new Error('no keys');
      const maxAge = Math.min(86400, Math.max(0, Number(/(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('Cache-Control') || '')?.[1] || 300)));
      const age = Math.max(0, Number(response.headers.get('Age') || 0) || 0);
      keyCaches.set(fetcher, { keys, expires: Date.now() + Math.max(0, maxAge - age) * 1000, fetchedAt: Date.now() });
      return keys;
    } catch {
      keyCaches.delete(fetcher);
      fail(503, 'GOOGLE_UNAVAILABLE', 'Google verification is temporarily unavailable. Try again later.');
    }
  })();
  keyCaches.set(fetcher, { ...previous, pending });
  return pending;
}

/** Real signature verification; never treats a decoded JWT as authenticated. */
export async function verifyGoogleCredential(credential, { clientId, nonce, now = nowSeconds() }, fetcher = fetch) {
  if (typeof credential !== 'string' || credential.length > 16000) fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  const parts = credential.split('.');
  if (parts.length !== 3) fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  const header = decodeJsonSegment(parts[0]);
  const claims = decodeJsonSegment(parts[1]);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200
      || header.crit || !claims || typeof claims !== 'object' || Array.isArray(claims)) {
    fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  }
  let keys = await googleKeys(fetcher);
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) { keys = await googleKeys(fetcher, true); jwk = keys.find((key) => key.kid === header.kid); }
  if (!jwk) fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new Error('signature');
  } catch { fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.'); }
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
      || claims.aud !== clientId || (claims.azp && claims.azp !== clientId)
      || !Number.isInteger(claims.exp) || claims.exp <= now
      || !Number.isInteger(claims.iat) || claims.iat > now + 60 || claims.iat < now - 7200
      || !equalStrings(claims.nonce, nonce)
      || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)
      || claims.email_verified !== true || typeof claims.email !== 'string'
      || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) {
    fail(401, 'INVALID_CREDENTIAL', 'Google sign-in could not be verified.');
  }
  const email = claims.email.toLowerCase();
  return {
    google_sub: claims.sub,
    email,
    name: typeof claims.name === 'string' ? claims.name.trim().slice(0, 120) : '',
    email_authoritative: email.endsWith('@gmail.com') || (typeof claims.hd === 'string' && claims.hd.toLowerCase() === email.split('@')[1]) ? 1 : 0,
  };
}

function publicMembership(row) {
  if (!row) return null;
  const { id, full_name, university, field, message, status, consent_at, created_at, updated_at, reviewed_at, review_note, version } = row;
  return { id, full_name, university, field, message, status, consent_at, created_at, updated_at, reviewed_at, review_note, version };
}

async function membershipFor(env, userId) {
  return env.DB.prepare('SELECT * FROM membership_applications WHERE user_id = ?').bind(userId).first();
}

async function getSession(request, env) {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT s.user_id, s.csrf_token, s.expires_at,
      u.id, u.email, u.name, u.email_authoritative FROM community_sessions s
      JOIN community_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(await hashToken(token), nowSeconds()).first();
  if (!row) return null;
  return {
    user: { id: row.id, email: row.email, name: row.name, is_admin: isAdmin(row, env) },
    csrf_token: row.csrf_token,
    membership: publicMembership(await membershipFor(env, row.id)),
  };
}

async function requireSession(request, env, mutation = false) {
  const session = await getSession(request, env);
  if (!session) fail(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
  if (mutation && !equalStrings(request.headers.get('X-CSRF-Token'), session.csrf_token)) {
    fail(403, 'CSRF_REQUIRED', 'Refresh this page and try again.');
  }
  return session;
}

async function signIn(request, env, config) {
  const body = await readJson(request);
  const savedNonce = cookie(request, NONCE_COOKIE);
  if (!savedNonce || !equalStrings(savedNonce, body.nonce)) fail(401, 'NONCE_REQUIRED', 'Start Google sign-in again.');
  const nonceHash = await hashToken(savedNonce);
  const nonceRow = await env.DB.prepare('SELECT nonce_hash FROM auth_nonces WHERE nonce_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(nonceHash, nowSeconds()).first();
  if (!nonceRow) fail(401, 'NONCE_EXPIRED', 'Start Google sign-in again.');
  const identity = await verifyGoogleCredential(body.credential, { clientId: config.google_client_id, nonce: savedNonce });
  const timestamp = nowSeconds();
  // The conditional UPDATE atomically consumes the nonce: parallel logins cannot replay it.
  const consumed = await env.DB.prepare('UPDATE auth_nonces SET used_at = ? WHERE nonce_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING nonce_hash')
    .bind(timestamp, nonceHash, timestamp).first();
  if (!consumed) fail(401, 'NONCE_REPLAYED', 'Start Google sign-in again.');
  const candidateId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO community_users (id, google_sub, email, name, email_authoritative, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name,
      email_authoritative = excluded.email_authoritative, updated_at = excluded.updated_at`)
    .bind(candidateId, identity.google_sub, identity.email, identity.name, identity.email_authoritative, timestamp, timestamp).run();
  const user = await env.DB.prepare('SELECT * FROM community_users WHERE google_sub = ?').bind(identity.google_sub).first();
  const sessionToken = randomToken();
  const csrf = randomToken();
  const oldToken = cookie(request, SESSION_COOKIE);
  const operations = [env.DB.prepare('DELETE FROM community_sessions WHERE expires_at <= ?').bind(timestamp),
    env.DB.prepare('DELETE FROM auth_nonces WHERE expires_at <= ?').bind(timestamp),
    env.DB.prepare('INSERT INTO community_sessions (token_hash, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await hashToken(sessionToken), user.id, csrf, timestamp + SESSION_TTL, timestamp)];
  if (oldToken) operations.push(env.DB.prepare('DELETE FROM community_sessions WHERE token_hash = ?').bind(await hashToken(oldToken)));
  await env.DB.batch(operations);
  const response = json({
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin(user, env) },
    membership: publicMembership(await membershipFor(env, user.id)),
    csrf_token: csrf,
  });
  response.headers.append('Set-Cookie', setCookie(SESSION_COOKIE, sessionToken, SESSION_TTL));
  response.headers.append('Set-Cookie', clearCookie(NONCE_COOKIE));
  return response;
}

async function submitMembership(request, env, session) {
  const body = await readJson(request);
  if (body.consent !== true) fail(400, 'CONSENT_REQUIRED', 'Agree to the membership privacy notice to apply.');
  const profile = {
    full_name: textField(body.full_name, 'Full name', 2, 120),
    university: textField(body.university ?? '', 'University or organisation', 0, 180),
    field: textField(body.field ?? '', 'Field of study or work', 0, 180),
    message: textField(body.message ?? '', 'Message', 0, 2000),
  };
  const timestamp = nowSeconds();
  // Omit every client-provided role/status. Approved membership cannot be demoted or
  // self-promoted through an application form. Rejected members may reapply for review.
  await env.DB.prepare(`INSERT INTO membership_applications
    (id, user_id, full_name, university, field, message, consent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, university = excluded.university,
      field = excluded.field, message = excluded.message, consent_at = excluded.consent_at,
      status = 'pending', review_note = '', reviewed_by = NULL, reviewed_at = NULL, review_token = NULL,
      updated_at = excluded.updated_at, version = membership_applications.version + 1
    WHERE membership_applications.status != 'approved'
      AND (membership_applications.status = 'rejected' OR membership_applications.full_name != excluded.full_name
      OR membership_applications.university != excluded.university OR membership_applications.field != excluded.field
      OR membership_applications.message != excluded.message)`)
    .bind(crypto.randomUUID(), session.user.id, profile.full_name, profile.university, profile.field, profile.message, timestamp, timestamp, timestamp).run();
  return json({ membership: publicMembership(await membershipFor(env, session.user.id)) });
}

async function applications(request, env) {
  const search = new URL(request.url).searchParams;
  const status = search.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) fail(400, 'INVALID_STATUS', 'Choose a valid application status.');
  const cursor = search.get('cursor');
  if (cursor && !/^[a-f0-9-]{36}$/.test(cursor)) fail(400, 'INVALID_CURSOR', 'The page cursor is invalid.');
  const clauses = [];
  const values = [];
  if (status !== 'all') { clauses.push('a.status = ?'); values.push(status); }
  if (cursor) { clauses.push('a.id > ?'); values.push(cursor); }
  const results = await env.DB.prepare(`SELECT a.*, u.email FROM membership_applications a
    JOIN community_users u ON u.id = a.user_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY a.id ASC LIMIT 51`).bind(...values).all();
  const rows = results.results || [];
  const countRows = await env.DB.prepare('SELECT status, COUNT(*) AS total FROM membership_applications GROUP BY status').all();
  const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const row of countRows.results || []) { counts[row.status] = Number(row.total); counts.total += Number(row.total); }
  return json({ applications: rows.slice(0, 50).map((row) => ({ ...publicMembership(row), email: row.email })),
    next_cursor: rows.length > 50 ? rows[49].id : null, counts });
}

async function reviewApplication(request, env, session, applicationId) {
  if (!/^[a-f0-9-]{36}$/.test(applicationId)) fail(404, 'APPLICATION_NOT_FOUND', 'The application was not found.');
  const body = await readJson(request);
  if (!['approved', 'rejected'].includes(body.status)) fail(400, 'INVALID_STATUS', 'Choose approved or rejected.');
  if (!Number.isInteger(body.version) || body.version < 1) fail(400, 'VERSION_REQUIRED', 'Refresh the application before reviewing it.');
  const note = textField(body.note ?? '', 'Review note', 0, 1000);
  const current = await env.DB.prepare('SELECT * FROM membership_applications WHERE id = ?').bind(applicationId).first();
  if (!current) fail(404, 'APPLICATION_NOT_FOUND', 'The application was not found.');
  if (current.user_id === session.user.id) fail(403, 'SELF_REVIEW_FORBIDDEN', 'Another administrator must review your application.');
  const timestamp = nowSeconds();
  const auditId = crypto.randomUUID();
  const reviewToken = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE membership_applications SET status = ?, review_note = ?, reviewed_by = ?,
      reviewed_at = ?, updated_at = ?, review_token = ?, version = version + 1
      WHERE id = ? AND status = 'pending' AND version = ?`)
      .bind(body.status, note, session.user.id, timestamp, timestamp, reviewToken, applicationId, body.version),
    env.DB.prepare(`INSERT INTO membership_audit (id, application_id, actor_id, old_status, new_status, note, created_at)
      SELECT ?, id, ?, 'pending', status, review_note, ? FROM membership_applications WHERE id = ? AND review_token = ?`)
      .bind(auditId, session.user.id, timestamp, applicationId, reviewToken),
  ]);
  if (!results[0]?.meta?.changes) fail(409, 'APPLICATION_CHANGED', 'This application has changed. Refresh before reviewing it.');
  return json({ membership: publicMembership(await env.DB.prepare('SELECT * FROM membership_applications WHERE id = ?').bind(applicationId).first()) });
}

function communityResources(env) {
  if (!env.COMMUNITY_RESOURCES) return [];
  try {
    const items = JSON.parse(env.COMMUNITY_RESOURCES);
    if (!Array.isArray(items)) return [];
    return items.slice(0, 50).filter((item) => typeof item.title === 'string' && typeof item.description === 'string'
      && typeof item.url === 'string' && /^https:\/\//.test(item.url))
      .map((item) => ({ title: item.title.slice(0, 160), description: item.description.slice(0, 500), url: item.url }));
  } catch { return []; }
}

export async function handleCommunity(request, env = {}) {
  try {
    const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    const method = request.method;
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    sameOrigin(request, mutation);
    const config = await configuration(request, env);
    if (path === '/api/config' && method === 'GET') return json(config);
    if (path === '/api/session' && method === 'GET') {
      if (!config.configured) return json({ authenticated: false, configured: false, ...config });
      const session = await getSession(request, env);
      return json(session ? { authenticated: true, ...session } : { authenticated: false });
    }
    if (!config.configured) fail(503, 'COMMUNITY_NOT_CONFIGURED', config.reason || 'Community sign-in is not ready yet.');
    if (path === '/api/auth/nonce' && method === 'GET') {
      await limitAuthentication(request, env, 'nonce', 20);
      const nonce = randomToken();
      const timestamp = nowSeconds();
      const oldNonce = cookie(request, NONCE_COOKIE);
      const operations = [env.DB.prepare('DELETE FROM auth_nonces WHERE expires_at <= ?').bind(timestamp),
        env.DB.prepare('INSERT INTO auth_nonces (nonce_hash, expires_at) VALUES (?, ?)').bind(await hashToken(nonce), timestamp + NONCE_TTL)];
      if (oldNonce) operations.push(env.DB.prepare('DELETE FROM auth_nonces WHERE nonce_hash = ?').bind(await hashToken(oldNonce)));
      await env.DB.batch(operations);
      return json({ nonce }, 200, { 'Set-Cookie': setCookie(NONCE_COOKIE, nonce, NONCE_TTL) });
    }
    if (path === '/api/auth/google' && method === 'POST') {
      await limitAuthentication(request, env, 'google', 30);
      return await signIn(request, env, config);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      await requireSession(request, env, true);
      await env.DB.prepare('DELETE FROM community_sessions WHERE token_hash = ?').bind(await hashToken(cookie(request, SESSION_COOKIE))).run();
      const response = json({ authenticated: false });
      response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
      response.headers.append('Set-Cookie', clearCookie(NONCE_COOKIE));
      return response;
    }
    const session = await requireSession(request, env, mutation);
    if (path === '/api/membership' && method === 'GET') return json({ membership: session.membership });
    if (path === '/api/membership' && method === 'POST') return await submitMembership(request, env, session);
    if (path === '/api/community' && method === 'GET') {
      if (session.membership?.status !== 'approved' && !session.user.is_admin) {
        fail(403, 'APPROVAL_REQUIRED', 'Membership approval is required to enter the community.');
      }
      return json({ membership: session.membership, resources: communityResources(env),
        message: 'The members area is ready. Association resources will appear here when published.' });
    }
    if (path === '/api/admin/applications' || path.startsWith('/api/admin/applications/')) {
      if (!session.user.is_admin) fail(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
      if (path === '/api/admin/applications' && method === 'GET') return await applications(request, env);
      if (path.startsWith('/api/admin/applications/') && method === 'PATCH') {
        return await reviewApplication(request, env, session, path.slice('/api/admin/applications/'.length));
      }
    }
    return json({ error: 'The community endpoint was not found.', code: 'NOT_FOUND' }, 404);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status,
      error.status === 429 ? { 'Retry-After': String(RATE_WINDOW) } : {});
    // Never leak tokens, Google credentials, database errors, or application PII.
    return json({ error: 'The community service is temporarily unavailable. Try again later.', code: 'COMMUNITY_UNAVAILABLE' }, 503);
  }
}
