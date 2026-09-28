// Phase 4.8e hardening — durable regression test for:
//   Q-A) GET /api/admin/queue — auth gate (401 unauth / 403 non-admin /
//        200 admin) + payload shape + live counters
//   Q-B) Automation rules scoping — a crm.manage user WITHOUT view_all
//        cannot GET/PATCH/DELETE a foreign rule (404), but CAN on own rule;
//        crm.view_all user sees everything.
// Fixture: queue_probe_tester role/user (crm.manage only) + one automation
// rule created by a different admin. Everything self-reverts in finally.
// Run: npm run test:crm-queue-monitor   (server on :3000, DB container up)

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const TESTER = { username: "queue_probe_tester", password: "operator123" }; // crm.manage, no view_all
const ADMIN = { username: "price_admin", password: "password123" }; // real ADMIN (JWT role=admin)
const CSRF = { cookie: "csrf_token", header: "x-csrf-token" };

function psql(sqlText) {
  return execFileSync(
    "docker",
    ["exec", "sim24-db", "psql", "-U", "sim24", "-d", "sim24", "-t", "-A", "-c", sqlText],
    { encoding: "utf8" }
  ).trim();
}
const scalar = (q) => psql(q).split("\n")[0].trim();
const psqlRun = (q) => psql(q);

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};

(async () => {
  // ── fixture user: crm.manage WITHOUT view_all (same recipe as idor-write) ──
  psqlRun(`DO $$
  DECLARE rid uuid; pid uuid; pid2 uuid;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'crm.manage') THEN
      INSERT INTO permissions (id, code, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'crm.manage', 'crm.manage', now(), now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'crm.read') THEN
      INSERT INTO permissions (id, code, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'crm.read', 'crm.read', now(), now());
    END IF;
    SELECT id INTO pid FROM permissions WHERE code = 'crm.manage';
    SELECT id INTO pid2 FROM permissions WHERE code = 'crm.read';
    IF NOT EXISTS (SELECT 1 FROM roles WHERE code = 'queue_probe_tester') THEN
      INSERT INTO roles (id, code, title, "isSystem", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'queue_probe_tester', 'Queue probe tester', false, now(), now());
    END IF;
    SELECT id INTO rid FROM roles WHERE code = 'queue_probe_tester';
    INSERT INTO role_permissions (id, "roleId", "permissionId")
    SELECT gen_random_uuid(), rid, pid
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE "roleId" = rid AND "permissionId" = pid);
    INSERT INTO role_permissions (id, "roleId", "permissionId")
    SELECT gen_random_uuid(), rid, pid2
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE "roleId" = rid AND "permissionId" = pid2);
  END $$;`);
  psqlRun(`DO $$
  DECLARE uid uuid; rid uuid;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'queue_probe_tester') THEN
      INSERT INTO users (id, username, password, "userType", active, "tokenVersion", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'queue_probe_tester',
              (SELECT password FROM users WHERE username = 'operator_crm'),
              'AGENT', true, 0, now(), now());
    END IF;
    SELECT id INTO uid FROM users WHERE username = 'queue_probe_tester';
    IF NOT EXISTS (SELECT 1 FROM agents WHERE "userId" = uid) THEN
      INSERT INTO agents (id, "userId", department, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), uid, 'PRODUCT', true, now(), now());
    END IF;
    SELECT r.id INTO rid FROM roles r WHERE r.code = 'queue_probe_tester';
    INSERT INTO user_role_assignments (id, "userId", "roleId", "createdAt")
    SELECT gen_random_uuid(), uid, rid, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_role_assignments WHERE "userId" = uid AND "roleId" = rid
    );
  END $$;`);

  const foreignAdminId = scalar(`SELECT id FROM users WHERE username = 'admin';`);
  psqlRun(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM automation_rules WHERE name = 'QPROBE-FORRULE'
    ) THEN
      INSERT INTO automation_rules (id, name, "isActive", priority, trigger, conditions, actions, "runCount", "createdById", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'QPROBE-FORRULE', false, 0, 'customer_created', '[]'::jsonb, '[]'::jsonb, 0,
              '${foreignAdminId}', now(), now());
    END IF;
  END $$;`);
  const foreignRuleId = scalar(`SELECT id FROM automation_rules WHERE name = 'QPROBE-FORRULE';`);
  const rulesBefore = scalar(`SELECT count(*) FROM automation_rules;`);
  check("fixtures ready", !!foreignRuleId, `foreignRuleId=${foreignRuleId}`);

  let ownedRuleId = null;
  try {
    const browser = await chromium.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
      args: ["--no-sandbox"],
    });
    const mkSession = async (user) => {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
      const boxes = page.getByRole("textbox");
      await boxes.nth(0).fill(user.username);
      await boxes.nth(1).fill(user.password);
      await page.getByRole("button", { name: "ورود" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
      return page;
    };
    const send = (page, method, url, body) =>
      page.evaluate(
        async ({ method, url, body, ck, hd }) => {
          const csrf = document.cookie.split("; ").find((c) => c.startsWith(ck + "="))?.split("=")[1] || "";
          const r = await fetch(url, {
            method,
            credentials: "include",
            headers: { "content-type": "application/json", [hd]: csrf },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          let j = null; try { j = await r.json(); } catch {}
          return { status: r.status, json: j };
        },
        { method, url, body, ck: CSRF.cookie, hd: CSRF.header }
      );

    const adminPage = await mkSession(ADMIN);
    const testerPage = await mkSession(TESTER);

    // ── Q-A: /api/admin/queue ──
    console.log("\n── Q-A: admin queue endpoint ──");
    const qAdmin = await send(adminPage, "GET", "/api/admin/queue");
    check(`queue GET as admin → 200`, qAdmin.status === 200, JSON.stringify(qAdmin.json).slice(0, 120));
    check("payload shape (backend/counters/handlers)",
      qAdmin.json?.data &&
        ["redis", "memory"].includes(qAdmin.json.data.backend) &&
        Number.isFinite(qAdmin.json.data.waiting) &&
        Number.isFinite(qAdmin.json.data.active) &&
        Number.isFinite(qAdmin.json.data.completed) &&
        Number.isFinite(qAdmin.json.data.failed) &&
        Array.isArray(qAdmin.json.data.registeredHandlers),
      JSON.stringify(qAdmin.json?.data).slice(0, 200));

    const qTester = await send(testerPage, "GET", "/api/admin/queue");
    check(`queue GET as crm.manage-only → 403`, qTester.status === 403, `got ${qTester.status}`);

    // unauthenticated (fresh context, no login)
    const anonCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(BASE, { waitUntil: "domcontentloaded" });
    const qAnon = await anonPage.evaluate(async () => {
      const r = await fetch("/api/admin/queue", { credentials: "include" });
      return r.status;
    });
    check(`queue GET unauthenticated → 401`, qAnon === 401, `got ${qAnon}`);
    await anonCtx.close();

    // ── Q-B: automation rules scoping ──
    console.log("\n── Q-B: automation rules [id] scoping ──");
    // tester (crm.manage, no view_all) on FOREIGN rule → 404
    const f1 = await send(testerPage, "GET", `/api/crm/automation/rules/${foreignRuleId}`);
    check(`foreign rule GET → 404 (deny: not creator)`, f1.status === 404, `got ${f1.status} ${JSON.stringify(f1.json).slice(0, 120)}`);
    const f2 = await send(testerPage, "PATCH", `/api/crm/automation/rules/${foreignRuleId}`, { isActive: true });
    check(`foreign rule PATCH → 404`, f2.status === 404, `got ${f2.status}`);
    const f3 = await send(testerPage, "DELETE", `/api/crm/automation/rules/${foreignRuleId}`);
    check(`foreign rule DELETE → 404`, f3.status === 404, `got ${f3.status}`);
    check("foreign rule survived tester attempts",
      scalar(`SELECT count(*) FROM automation_rules WHERE id = '${foreignRuleId}';`) === "1");

    // tester creates OWN rule → full CRUD for owner
    const own = await send(testerPage, "POST", "/api/crm/automation/rules", {
      name: "QPROBE-OWNRULE",
      trigger: "customer_created",
      conditions: [],
      actions: [],
    });
    check(`own rule POST → 2xx`, own.status >= 200 && own.status < 300, JSON.stringify(own.json).slice(0, 120));
    ownedRuleId = own.json?.data?.id ?? null;
    if (ownedRuleId) {
      const o1 = await send(testerPage, "GET", `/api/crm/automation/rules/${ownedRuleId}`);
      check(`own rule GET → 200`, o1.status === 200, `got ${o1.status}`);
      const o2 = await send(testerPage, "PATCH", `/api/crm/automation/rules/${ownedRuleId}`, { isActive: false });
      check(`own rule PATCH → 200`, o2.status === 200, `got ${o2.status}`);
    }

    // admin (view_all) still sees the foreign rule
    const a1 = await send(adminPage, "GET", `/api/crm/automation/rules/${foreignRuleId}`);
    check(`view_all admin GET foreign rule → 200`, a1.status === 200, `got ${a1.status}`);

    // tester cannot DELETE own rule? they CAN (owner) — verify then cleanup below
    if (ownedRuleId) {
      const o3 = await send(testerPage, "DELETE", `/api/crm/automation/rules/${ownedRuleId}`);
      check(`own rule DELETE → 200`, o3.status === 200, `got ${o3.status}`);
      ownedRuleId = null; // deleted, nothing to revert
    }

    await browser.close();
  } finally {
    console.log("\n── revert fixtures ──");
    if (ownedRuleId) psqlRun(`DELETE FROM automation_rules WHERE id = '${ownedRuleId}';`);
    psqlRun(`DELETE FROM automation_rules WHERE name = 'QPROBE-FORRULE';`);
    psqlRun(`DELETE FROM user_role_assignments WHERE "userId" = (SELECT id FROM users WHERE username = 'queue_probe_tester');`);
    psqlRun(`DELETE FROM agents WHERE "userId" = (SELECT id FROM users WHERE username = 'queue_probe_tester');`);
    psqlRun(`DELETE FROM users WHERE username = 'queue_probe_tester';`);
    psqlRun(`DELETE FROM role_permissions WHERE "roleId" = (SELECT id FROM roles WHERE code = 'queue_probe_tester');`);
    psqlRun(`DELETE FROM roles WHERE code = 'queue_probe_tester';`);

    // QPROBE-FORRULE is re-inserted only if missing (the DO-block guard), so a
    // leaked rule from an aborted earlier run is the ONLY way the count can
    // differ. Assert no QPROBE residue instead of a strict count equality.
    const qprobeResidue = scalar(`SELECT count(*) FROM automation_rules WHERE name LIKE 'QPROBE%';`);
    check("no QPROBE rule residue", qprobeResidue === "0", `residue=${qprobeResidue}`);
    const u = scalar(`SELECT count(*) FROM users WHERE username = 'queue_probe_tester';`);
    const ro = scalar(`SELECT count(*) FROM roles WHERE code = 'queue_probe_tester';`);
    check("fixture user/role removed", u === "0" && ro === "0", `users=${u} roles=${ro}`);
  }

  console.log(`\n== RESULT: ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"} ==`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
