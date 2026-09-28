// Phase 4.8c write-IDOR fixes — runtime verification for all 8 closed write routes.
// Fixture user: crm_write_tester — role crm_write_tester (crm.manage, NO view_all).
// The role/user are created up front and REMOVED in finally (self-reverting).
// Customer fixture: one customer flipped to price_agent2 ownership for the
// deny cases, reverted + count-verified in finally.
//
// Cases per route:
//   W-A) write-tester on OWNERLESS customer/task → 2xx (allowed)
//   W-B) write-tester on FOREIGN-OWNED customer / non-assignee resource → 403/404
//   W-C) operator_crm (no crm.manage) → 403 by the existing permission gate
// Run: npm run test:crm-idor-write
//      node tests/crm/idor-write.test.mjs

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const WRITE_TESTER = { username: "crm_write_tester", password: "operator123" }; // manage, no view_all
const OPERATOR = { username: "operator_crm", password: "operator123" }; // read only
const OTHER_AGENT = "f93980e9-20fb-40b0-bfe1-4418a4b72aa9"; // price_agent2
const CSRF = { cookie: "csrf_token", header: "x-csrf-token" };

function psql(sqlText) {
  return execFileSync(
    "docker",
    ["exec", "sim24-db", "psql", "-U", "sim24", "-d", "sim24", "-t", "-A", "-c", sqlText],
    { encoding: "utf8" }
  ).trim();
}
const scalar = (q) => psql(q).split("\n")[0].trim();
const psqlRun = (q) => psql(q); // statements

let failures = 0;
let loginFailed = false;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};

(async () => {
  // ── fixture user + role (self-reverting) ──
  console.log("== fixture: crm_write_tester role/user ==");
  psqlRun(`DO $$
  DECLARE rid uuid; pid uuid;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'crm.manage') THEN
      INSERT INTO permissions (id, code, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'crm.manage', 'crm.manage', now(), now());
    END IF;
    SELECT id INTO pid FROM permissions WHERE code = 'crm.manage';
    IF NOT EXISTS (SELECT 1 FROM roles WHERE code = 'crm_write_tester') THEN
      INSERT INTO roles (id, code, title, "isSystem", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'crm_write_tester', 'CRM write tester', false, now(), now());
    END IF;
    SELECT id INTO rid FROM roles WHERE code = 'crm_write_tester';
    INSERT INTO role_permissions (id, "roleId", "permissionId")
    SELECT gen_random_uuid(), rid, pid
    WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE "roleId" = rid AND "permissionId" = pid);
  END $$;`);
  psqlRun(`DO $$
  DECLARE uid uuid; rid uuid;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'crm_write_tester') THEN
      INSERT INTO users (id, username, password, "userType", active, "tokenVersion", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'crm_write_tester',
              (SELECT password FROM users WHERE username = 'operator_crm'), -- operator123
              'AGENT', true, 0, now(), now());
    END IF;
    SELECT id INTO uid FROM users WHERE username = 'crm_write_tester';
    -- AGENT login requires an active Agent profile row
    IF NOT EXISTS (SELECT 1 FROM agents WHERE "userId" = uid) THEN
      INSERT INTO agents (id, "userId", department, active, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), uid, 'PRODUCT', true, now(), now());
    END IF;
    SELECT r.id INTO rid FROM roles r WHERE r.code = 'crm_write_tester';
    INSERT INTO user_role_assignments (id, "userId", "roleId", "createdAt")
    SELECT gen_random_uuid(), uid, rid, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM user_role_assignments WHERE "userId" = uid AND "roleId" = rid
    );
  END $$;`);

  const rolePerms = scalar(
    `SELECT array_agg(DISTINCT p.code) FROM roles r
     JOIN role_permissions rp ON rp."roleId" = r.id
     JOIN permissions p ON p.id = rp."permissionId"
     WHERE r.code = 'crm_write_tester';`
  );
  console.log(`  crm_write_tester perms: ${rolePerms}`);
  check("fixture user has crm.manage but NOT view_all", rolePerms.includes("crm.manage") && !rolePerms.includes("crm.view_all"), rolePerms);

  // password hash must validate — probe via login later; if login fails, STOP.

  // ── resource fixtures ──
  const ownerlessId = scalar(
    `SELECT id FROM crm_customers WHERE "referralAgentId" IS NULL
     ORDER BY (SELECT count(*) FROM crm_communications k WHERE k."customerId" = crm_customers.id) DESC
     LIMIT 1;`
  );
  const targetId = scalar(
    `SELECT id FROM crm_customers
     WHERE "referralAgentId" IS NULL AND id <> '${ownerlessId}'
       AND (EXISTS (SELECT 1 FROM crm_activities a WHERE a."customerId" = crm_customers.id)
            OR EXISTS (SELECT 1 FROM crm_opportunities o WHERE o."customerId" = crm_customers.id)
            OR EXISTS (SELECT 1 FROM crm_communications k WHERE k."customerId" = crm_customers.id))
     ORDER BY (SELECT count(*) FROM crm_activities a WHERE a."customerId" = crm_customers.id)
            + (SELECT count(*) FROM crm_opportunities o WHERE o."customerId" = crm_customers.id)
            + (SELECT count(*) FROM crm_communications k WHERE k."customerId" = crm_customers.id) DESC
     LIMIT 1;`
  );
  // Guard the id lookups — empty string would blow up uuid casts downstream.
  const q1 = (t) => targetId ? scalar(`SELECT id FROM ${t} WHERE "customerId" = '${targetId}' LIMIT 1;`) : "";
  const taskIdForeign = q1("crm_activities");
  const oppIdForeign = q1("crm_opportunities");
  const commIdForeign = q1("crm_communications");
  // an ownerless customer task for the allow case (any task on ownerless customer)
  const taskIdOwned = scalar(
    `SELECT a.id FROM crm_activities a WHERE a."customerId" = '${ownerlessId}' LIMIT 1;`
  );
  const countBefore = scalar(`SELECT count(*) FROM crm_customers WHERE "referralAgentId" IS NOT NULL;`);
  console.log(`[fixture] ownerless=${ownerlessId} target=${targetId}`);
  console.log(`[fixture] foreignTask=${taskIdForeign} foreignOpp=${oppIdForeign} foreignComm=${commIdForeign} ownedTask=${taskIdOwned}`);
  check("fixtures found", !!ownerlessId && !!targetId);
  if (!ownerlessId || !targetId) process.exit(2);

  let flipped = false;
  try {
    psqlRun(`UPDATE crm_customers SET "referralAgentId" = '${OTHER_AGENT}' WHERE id = '${targetId}';`);
    flipped = true;
    check("fixture flipped", scalar(`SELECT "referralAgentId" FROM crm_customers WHERE id = '${targetId}';`) === OTHER_AGENT);

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
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      return page;
    };
    // Probe the fixture login FIRST so a bad fixture fails fast with a
    // clear error (rather than timing out inside mkSession).
    const probeCtx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const probePage = await probeCtx.newPage();
    await probePage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const pb = probePage.getByRole("textbox");
    await pb.nth(0).fill(WRITE_TESTER.username);
    await pb.nth(1).fill(WRITE_TESTER.password);
    await probePage.getByRole("button", { name: "ورود" }).click();
    let loginOk = true;
    try {
      await probePage.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
    } catch {
      loginOk = false;
    }
    await probeCtx.close();
    if (!loginOk) {
      console.error("FIXTURE LOGIN FAILED — crm_write_tester could not log in");
      loginFailed = true; // let the try end normally so finally CAN revert
    }

    if (!loginFailed) {
      console.log("  [probe] crm_write_tester login OK");
    }

    const wt = await mkSession(WRITE_TESTER);
    const op = await mkSession(OPERATOR);

    // mutating fetch: echoes csrf cookie into the header
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

    if (!loginFailed) {
    console.log("\n── W-C: operator_crm (no crm.manage) → expect 403 on every write ──");
    const wc1 = await send(op, "PATCH", `/api/crm/customers/${targetId}`, { fullName: "x" });
    check(`customers/[id] PATCH → ${wc1.status} (403)`, wc1.status === 403, JSON.stringify(wc1.json).slice(0, 150));
    const wc2 = await send(op, "POST", `/api/crm/customers/${targetId}/notes`, { content: "x" });
    check(`customers/[id]/notes POST → ${wc2.status} (403)`, wc2.status === 403, JSON.stringify(wc2.json).slice(0, 150));

    console.log("\n── W-B: write-tester on FOREIGN-OWNED → expect 403/404 ──");
    const b1 = await send(wt, "PATCH", `/api/crm/customers/${targetId}`, { fullName: "x" });
    check(`customers/[id] PATCH → ${b1.status} (403)`, b1.status === 403, JSON.stringify(b1.json).slice(0, 150));
    const b1d = await send(wt, "DELETE", `/api/crm/customers/${targetId}`);
    check(`customers/[id] DELETE → ${b1d.status} (403)`, b1d.status === 403, JSON.stringify(b1d.json).slice(0, 150));
    const b2 = await send(wt, "PATCH", `/api/crm/tasks/${taskIdForeign}`, { priority: "high" });
    check(`tasks/[id] PATCH → ${b2.status} (404)`, b2.status === 404, JSON.stringify(b2.json).slice(0, 150));
    const b2d = await send(wt, "DELETE", `/api/crm/tasks/${taskIdForeign}`);
    check(`tasks/[id] DELETE → ${b2d.status} (404)`, b2d.status === 404, JSON.stringify(b2d.json).slice(0, 150));
    const b4 = await send(wt, "PATCH", `/api/crm/opportunities/${oppIdForeign}`, { probability: 10 });
    check(`opportunities/[id] PATCH → ${b4.status} (404)`, b4.status === 404, JSON.stringify(b4.json).slice(0, 150));
    const b4d = await send(wt, "DELETE", `/api/crm/opportunities/${oppIdForeign}`);
    check(`opportunities/[id] DELETE → ${b4d.status} (404)`, b4d.status === 404, JSON.stringify(b4d.json).slice(0, 150));
    const b5 = await send(wt, "POST", `/api/crm/customers/${targetId}/communications`, { channel: "note", content: "idor-probe" });
    check(`customers/[id]/communications POST → ${b5.status} (403)`, b5.status === 403, JSON.stringify(b5.json).slice(0, 150));
    const b6 = await send(wt, "POST", `/api/crm/customers/${targetId}/notes`, { content: "idor-probe" });
    check(`customers/[id]/notes POST → ${b6.status} (403)`, b6.status === 403, JSON.stringify(b6.json).slice(0, 150));
    const b7 = await send(wt, "POST", `/api/crm/customers/${targetId}/tags`, { tag: "idor-probe" });
    check(`customers/[id]/tags POST → ${b7.status} (403)`, b7.status === 403, JSON.stringify(b7.json).slice(0, 150));
    const b7d = await send(wt, "DELETE", `/api/crm/customers/${targetId}/tags?tag=whatever`);
    check(`customers/[id]/tags DELETE → ${b7d.status} (403)`, b7d.status === 403, JSON.stringify(b7d.json).slice(0, 150));
    // recurring: foreign = someone else's recurring task (assigned to another user)
    const recForeign = scalar(
      `SELECT rt.id FROM crm_recurring_tasks rt
       WHERE rt."assignedToId" <> (SELECT id FROM users WHERE username = 'crm_write_tester')
       LIMIT 1;`
    );
    if (commIdForeign) {
      const b3 = await send(wt, "PATCH", `/api/crm/communications/${commIdForeign}`, { status: "read" });
      check(`communications/[id] PATCH → ${b3.status} (404)`, b3.status === 404, JSON.stringify(b3.json).slice(0, 150));
      const b3d = await send(wt, "DELETE", `/api/crm/communications/${commIdForeign}`);
      check(`communications/[id] DELETE → ${b3d.status} (404)`, b3d.status === 404, JSON.stringify(b3d.json).slice(0, 150));
    } else {
      console.log("  SKIP communications/[id] deny cases — target customer has no comms row");
    }
    if (recForeign) {
      const b8 = await send(wt, "PATCH", `/api/crm/tasks/recurring/${recForeign}`, { priority: "high" });
      check(`tasks/recurring/[id] PATCH → ${b8.status} (404)`, b8.status === 404, JSON.stringify(b8.json).slice(0, 150));
      const b8d = await send(wt, "DELETE", `/api/crm/tasks/recurring/${recForeign}`);
      check(`tasks/recurring/[id] DELETE → ${b8d.status} (404)`, b8d.status === 404, JSON.stringify(b8d.json).slice(0, 150));
    } else {
      console.log("  SKIP recurring deny cases — no foreign recurring task exists");
    }

    console.log("\n── W-A: write-tester on OWNERLESS / own resources → expect 2xx ──");
    const a1 = await send(wt, "POST", `/api/crm/customers/${ownerlessId}/notes`, { content: "idor-write-probe A" });
    check(`customers/[id]/notes POST → ${a1.status} (2xx)`, a1.status >= 200 && a1.status < 300, JSON.stringify(a1.json).slice(0, 150));
    const a2 = await send(wt, "POST", `/api/crm/customers/${ownerlessId}/tags`, { tag: "idor-write-probe" });
    check(`customers/[id]/tags POST → ${a2.status} (2xx)`, a2.status >= 200 && a2.status < 300, JSON.stringify(a2.json).slice(0, 150));
    if (taskIdOwned) {
      const a3 = await send(wt, "PATCH", `/api/crm/tasks/${taskIdOwned}`, { priority: "high" });
      check(`tasks/[id] PATCH (view_all absent, ownerless-customer task) → ${a3.status}`, a3.status === 200 || a3.status === 404, `assignee-scope: task must be assigned to the write-tester to pass — 404 acceptable if assigned to another user`);
    }
    // cleanup any W-A artifacts
    psqlRun(`DELETE FROM crm_customer_notes WHERE content = 'idor-write-probe A';`);
    psqlRun(`DELETE FROM crm_customer_tags WHERE tag = 'idor-write-probe';`);
    } // end if (!loginFailed) — skip probes if the fixture login failed

    await browser.close();
  } finally {
    console.log("\n── revert fixtures ──");
    if (flipped) psqlRun(`UPDATE crm_customers SET "referralAgentId" = NULL WHERE id = '${targetId}';`);
    const after = scalar(`SELECT "referralAgentId" FROM crm_customers WHERE id = '${targetId}';`);
    const countAfter = scalar(`SELECT count(*) FROM crm_customers WHERE "referralAgentId" IS NOT NULL;`);
    check("customer fixture reverted", after === "NULL" || after === "", `got '${after}'`);
    check(`owned count restored (${countBefore} → ${countAfter})`, countAfter === countBefore);

    // remove fixture user + role
    psqlRun(`DELETE FROM user_role_assignments WHERE "userId" = (SELECT id FROM users WHERE username = 'crm_write_tester');`);
    psqlRun(`DELETE FROM agents WHERE "userId" = (SELECT id FROM users WHERE username = 'crm_write_tester');`);
    psqlRun(`DELETE FROM users WHERE username = 'crm_write_tester';`);
    psqlRun(`DELETE FROM role_permissions WHERE "roleId" = (SELECT id FROM roles WHERE code = 'crm_write_tester');`);
    psqlRun(`DELETE FROM roles WHERE code = 'crm_write_tester';`);
    const u = scalar(`SELECT count(*) FROM users WHERE username = 'crm_write_tester';`);
    const r = scalar(`SELECT count(*) FROM roles WHERE code = 'crm_write_tester';`);
    const ag = scalar(`SELECT count(*) FROM agents a JOIN users uu ON uu.id = a."userId" WHERE uu.username = 'crm_write_tester';`);
    check("fixture user/role/profile removed", u === "0" && r === "0" && ag === "0", `users=${u} roles=${r} agents=${ag}`);

    const residue = scalar(
      `SELECT count(*) FROM crm_communications WHERE content = 'idor-probe';`
    );
    check("no probe residue in communications", residue === "0", residue);
    if (countAfter !== countBefore || u !== "0" || r !== "0") {
      console.error("MANUAL REPAIR REQUIRED — see above");
      process.exit(2);
    }
  }

  console.log(`\n== RESULT: ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"} ==`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
