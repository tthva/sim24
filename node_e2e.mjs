// node_e2e.mjs — authoritative auth E2E + latency verification (production build)
const H = 'http://localhost:3000';
let failures = 0;
let passes = 0;

function cookiesFrom(setCookie) {
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie || ''];
  const out = {};
  for (const sc of arr) {
    for (const part of sc.split(',')) {
      const kv = part.split(';')[0].trim().split('=');
      if (kv[0] && kv[1]) out[kv[0].trim()] = kv[1];
    }
  }
  return out;
}

function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`  PASS  ${name}`); }
  else { failures++; console.log(`  FAIL  ${name}  ${detail}`); }
}

async function req(label, url, opts = {}) {
  const sw = performance.now();
  const res = await fetch(url, opts);
  const ms = Math.round(performance.now() - sw);
  const txt = await res.text();
  return { res, ms, txt };
}

(async () => {
  console.log('=== 1. Operator login (agent1) — warm latency ===');
  const times = [];
  for (let i = 1; i <= 4; i++) {
    const t = await req(`op#${i}`, `${H}/api/operator/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'agent1', password: 'agent123' }),
    });
    times.push(t.ms);
    if (i > 1) check(`operator login #${i} status`, t.res.status === 200, `got ${t.res.status}`);
  }
  const warm = times.slice(1);
  const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
  console.log(`  warm avg: ${Math.round(avg)}ms  (raw: ${warm.join(', ')})`);
  // Warm login includes ~160-200ms of intentional bcrypt hashing. The
  // Redis fallback itself is bounded (~0.1ms, fail-open). Before the fix warm
  // login was ~5200ms; the meaningful bound here is well under 1s.
  check('operator warm login < 500ms avg (was ~5200ms)', avg < 500, `avg=${avg}`);
  check('operator cold login < 3000ms', times[0] < 3000, `${times[0]}ms`);

  console.log('=== 2. Bad password rejected ===');
  const bad = await req('bad', `${H}/api/operator/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'agent1', password: 'WRONG' }),
  });
  check('bad password -> 401', bad.res.status === 401, `got ${bad.res.status} ${bad.txt}`);

  console.log('=== 3. EndUser login ⇒ check ⇒ refresh ===');
  const eu = await req('eu-login', `${H}/api/auth/enduser`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user1', password: 'user123' }),
  });
  check('enduser login 200', eu.res.status === 200, `got ${eu.res.status} ${eu.txt}`);
  const ck = cookiesFrom(eu.res.headers.getSetCookie ? eu.res.headers.getSetCookie() : [eu.res.headers.get('set-cookie')]);
  check('token cookie present', !!ck.token, 'missing token');
  check('refresh_token cookie present', !!ck.refresh_token, 'missing refresh_token');
  const oldToken = `token=${ck.token}`;

  const chk = await req('check', `${H}/api/auth/check`, { headers: { cookie: `token=${ck.token}` } });
  check('auth check 200 authenticated', chk.res.status === 200 && chk.txt.includes('"authenticated":true'), chk.txt);

  const ref = await req('refresh', `${H}/api/auth/refresh`, {
    method: 'POST', headers: { cookie: `token=${ck.token}; refresh_token=${ck.refresh_token}` },
  });
  check('refresh 200', ref.res.status === 200, `got ${ref.res.status} ${ref.txt}`);
  const newCk = cookiesFrom(ref.res.headers.getSetCookie ? ref.res.headers.getSetCookie() : [ref.res.headers.get('set-cookie')]);
  // A fresh access token is always issued (may be byte-identical to the old
  // one when iat lands in the same epoch-second — actual rotation is in the
  // refresh token, verified by the replay test below).
  check('new access/refresh cookies issued', !!newCk.token && !!newCk.refresh_token, 'missing cookie in refresh response');

  // Stateless JWT semantics: the old access token remains valid until its
  // 15-min expiry. (requireAuth still re-validates session/tokenVersion.)
  const oldChk = await req('old-check', `${H}/api/auth/check`, { headers: { cookie: oldToken } });
  check('old access token works until expiry', oldChk.res.status === 200, `got ${oldChk.res.status}`);

  console.log('=== 4. Logout ===');
  const log = await req('logout', `${H}/api/auth/logout`, {
    method: 'POST', headers: { cookie: `token=${newCk.token}; refresh_token=${newCk.refresh_token}` },
  });
  check('logout 200', log.res.status === 200, `got ${log.res.status}`);
  const afterLogout = await req('after-logout', `${H}/api/auth/check`, { headers: { cookie: `token=${newCk.token}` } });
  check('session revoked after logout -> 401', afterLogout.res.status === 401, `got ${afterLogout.res.status}`);

  // Real rotation: the old refresh token was consumed by the first refresh,
  // so reusing it must be rejected (replay detection → family/session revoked).
  const replay = await req('replay-old-refresh', `${H}/api/auth/refresh`, {
    method: 'POST', headers: { cookie: `token=${newCk.token}; refresh_token=${ck.refresh_token}` },
  });
  check('old refresh_token replay rejected (401)', replay.res.status === 401, `got ${replay.res.status} ${replay.txt}`);

  console.log('=== 5. Middleware redirects (no auth) ===');
  for (const p of ['/operator/price-panel', '/agent/panel', '/admin/panel']) {
    const mwy = await req(`mw ${p}`, `${H}${p}`, { redirect: 'manual' });
    check(`no-auth ${p} -> 3xx`, mwy.res.status >= 300 && mwy.res.status < 400, `got ${mwy.res.status}`);
    check(`no-auth ${p} -> login redirect`, /\/login\?redirect=/.test(mwy.res.headers.get('location') || ''), mwy.res.headers.get('location'));
  }

  console.log(`\n==== RESULT: ${passes} passed, ${failures} failed ====`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });