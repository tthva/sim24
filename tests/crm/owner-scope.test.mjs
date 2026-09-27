// CRM owner-scope regression test (Phase 4.8c hardening, decisions D1 + D-IDOR)
//
// Guards the rule that a user without crm.view_all may read:
//   • ownerless customers  (referralAgentId IS NULL)
//   • customers they own   (referralAgentId === their Agent.id)
// ...and nothing else, across BOTH the customer list, the single-fetch route
// and the customer timeline feed, and that the search filter cannot widen the
// scope.
//
// Requires: the app running on BASE (default http://localhost:3000) and the
// sim24-db container reachable via `docker exec`.
//
// Run: npm run test:crm-owner-scope
//      node tests/crm/owner-scope.test.mjs
//
// T5/T6 mutate ONE customer's referralAgentId and restore it in a finally
// block. A pg_dump of crm_customers is taken first as a safety net.

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CRM_TEST_BASE || "http://localhost:3000";
const TARGET_CODE = process.env.CRM_TEST_CUSTOMER || "C-000064";
const MANAGER = { username: "crm_tester", password: "operator123" };
const OPERATOR = { username: "operator_crm", password: "operator123" };
const ARTIFACTS = path.resolve("artifacts");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const results = [];
let failures = 0;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}\n        ${detail}`);
  }
}

// ─── DB helpers (no shell — avoids Windows quoting/path mangling) ───
function psql(sqlText) {
  return execFileSync(
    "docker",
    ["exec", "sim24-db", "psql", "-U", "sim24", "-d", "sim24", "-t", "-A", "-c", sqlText],
    { encoding: "utf8" }
  ).trim();
}
function psqlScalar(sqlText) {
  return psql(sqlText).split("\n")[0].trim();
}

function backupCustomersTable() {
  try {
    execFileSync(
      "docker",
      ["exec", "sim24-db", "pg_dump", "-U", "sim24", "-d", "sim24", "-t", "crm_customers", "-F", "c", "-f", "/tmp/owner-scope-fixture.dump"],
      { encoding: "utf8" }
    );
    mkdirSync(ARTIFACTS, { recursive: true });
    console.log("  [backup] sim24-db:/tmp/owner-scope-fixture.dump (inside container)");
  } catch (e) {
    console.log(`  [backup] WARNING: pg_dump failed: ${e.message}`);
  }
}

// ─── Browser helpers ───
async function loginAndGetFetch(browser, { username, password }) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const boxes = page.getByRole("textbox");
  await boxes.nth(0).fill(username);
  await boxes.nth(1).fill(password);
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const fetchJson = (url) =>
    page.evaluate(async (u) => {
      const r = await fetch(u, { credentials: "include" });
      let j = null;
      try {
        j = await r.json();
      } catch {}
      return { status: r.status, json: j };
    }, url);

  return { ctx, page, fetchJson, finalUrl: page.url() };
}

const listUrl = (qs = "") => `/api/crm/customers${qs}`;
const singleUrl = (id) => `/api/crm/customers/${id}`;
const timelineUrl = (id) => `/api/crm/customers/${id}/timeline`;

// ─── main ───
(async () => {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) {
    console.error(`No Chrome binary found. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
    process.exit(2);
  }

  const customerId = psqlScalar(
    `SELECT id FROM crm_customers WHERE "customerCode" = '${TARGET_CODE}' LIMIT 1;`
  );
  if (!customerId) {
    console.error(`No customer with customerCode='${TARGET_CODE}'. Seed one or set CRM_TEST_CUSTOMER.`);
    process.exit(2);
  }
  const operatorAgentId = psqlScalar(
    `SELECT a.id FROM agents a JOIN users u ON u.id = a."userId" WHERE u.username = '${OPERATOR.username}';`
  );
  const foreignAgentId = psqlScalar(
    `SELECT id FROM agents WHERE id <> '${operatorAgentId}' ORDER BY id LIMIT 1;`
  );
  const originalOwner = psqlScalar(
    `SELECT COALESCE("referralAgentId"::text, '') FROM crm_customers WHERE id = '${customerId}';`
  );
  const originalOwnerSql = originalOwner === "" ? "NULL" : `'${originalOwner}'`;

  console.log(`BASE=${BASE}`);
  console.log(`target customer: ${TARGET_CODE} = ${customerId}`);
  console.log(`operator agent:  ${operatorAgentId}`);
  console.log(`foreign agent:   ${foreignAgentId}`);
  console.log(`original referralAgentId: ${originalOwner === "" ? "(NULL)" : originalOwner}`);
  console.log(`chrome: ${chrome}\n`);

  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });

  const manager = await loginAndGetFetch(browser, MANAGER);
  const operator = await loginAndGetFetch(browser, OPERATOR);
  console.log(`manager  landed at: ${manager.finalUrl}`);
  console.log(`operator landed at: ${operator.finalUrl}\n`);

  // ─────────────────────────── T1 ───────────────────────────
  console.log("T1 — crm_manager sees the customer list");
  {
    const r = await manager.fetchJson(listUrl("?limit=5"));
    const total = r.json?.data?.total;
    check("T1 list 200 with >=100 customers for crm_manager", r.status === 200 && total >= 100, `HTTP ${r.status} total=${total}`);
  }

  // ─────────────────────────── T2 ───────────────────────────
  console.log("T2 — crm_operator sees the customer list");
  {
    const r = await operator.fetchJson(listUrl("?limit=5"));
    const total = r.json?.data?.total;
    check("T2 list 200 with >=100 customers for crm_operator", r.status === 200 && total >= 100, `HTTP ${r.status} total=${total}`);
  }

  // ─────────────────────────── T3 ───────────────────────────
  console.log("T3 — crm_operator opens an OWNERLESS customer");
  {
    const r = await operator.fetchJson(singleUrl(customerId));
    check("T3 single-fetch 200 for ownerless customer", r.status === 200, `HTTP ${r.status} code=${r.json?.error?.code ?? "-"}`);
  }

  // ─────────────────────────── T4 ───────────────────────────
  console.log("T4 — crm_operator reads the timeline of an OWNERLESS customer");
  {
    const r = await operator.fetchJson(timelineUrl(customerId));
    const entries = r.json?.data?.total ?? r.json?.data?.entries?.length ?? 0;
    check("T4 timeline 200 with entries > 0", r.status === 200 && entries > 0, `HTTP ${r.status} entries=${entries}`);
  }

  // ────────────── T5/T6 — fail-closed under a temporary fixture ──────────────
  backupCustomersTable();
  let restored = false;
  try {
    console.log(`\n[fixture] ${TARGET_CODE}.referralAgentId := ${foreignAgentId} (a foreign agent)`);
    psql(`UPDATE crm_customers SET "referralAgentId" = '${foreignAgentId}' WHERE id = '${customerId}';`);
    const applied = psqlScalar(`SELECT "referralAgentId"::text FROM crm_customers WHERE id = '${customerId}';`);
    console.log(`[fixture] applied = ${applied}`);
    if (applied !== foreignAgentId) {
      check("T5 fixture applied", false, `expected ${foreignAgentId}, DB reads ${applied}`);
    }

    console.log("T5 — customer owned by ANOTHER agent must be 403 for crm_operator");
    {
      const s = await operator.fetchJson(singleUrl(customerId));
      const t = await operator.fetchJson(timelineUrl(customerId));
      check("T5a single-fetch 403 when owned by another agent", s.status === 403, `HTTP ${s.status} code=${s.json?.error?.code ?? "-"}`);
      check("T5b timeline 403 when owned by another agent", t.status === 403, `HTTP ${t.status} code=${t.json?.error?.code ?? "-"}`);

      const m = await manager.fetchJson(singleUrl(customerId));
      check("T5c crm.view_all still 200 (bypass intact)", m.status === 200, `HTTP ${m.status}`);
    }

    console.log("T6 — the search filter must NOT widen the scope");
    {
      const byCode = await operator.fetchJson(listUrl(`?search=${TARGET_CODE}&limit=100`));
      const codes = (byCode.json?.data?.customers ?? []).map((c) => c.customerCode);
      check(
        `T6 search "${TARGET_CODE}" does not leak the out-of-scope customer`,
        byCode.status === 200 && !codes.includes(TARGET_CODE),
        `HTTP ${byCode.status} total=${byCode.json?.data?.total} contains=${codes.includes(TARGET_CODE)}`
      );

      const empty = await operator.fetchJson(listUrl("?search=&limit=5"));
      const total = empty.json?.data?.total;
      check("T6b empty search keeps the full ownerless scope", empty.status === 200 && total >= 100, `HTTP ${empty.status} total=${total}`);
    }
  } finally {
    console.log(`\n[fixture] restoring ${TARGET_CODE}.referralAgentId := ${originalOwnerSql}`);
    try {
      psql(`UPDATE crm_customers SET "referralAgentId" = ${originalOwnerSql} WHERE id = '${customerId}';`);
      const after = psqlScalar(`SELECT COALESCE("referralAgentId"::text, '') FROM crm_customers WHERE id = '${customerId}';`);
      restored = after === originalOwner;
      console.log(`[fixture] after restore = ${after === "" ? "(NULL)" : after}`);
    } catch (e) {
      console.error(`\n!!!! FIXTURE RESTORE FAILED: ${e.message}`);
      console.error(`!!!! Manual repair: UPDATE crm_customers SET "referralAgentId" = ${originalOwnerSql} WHERE id = '${customerId}';`);
    }
  }

  check("cleanup: fixture reverted to the original owner", restored, "referralAgentId not restored");
  if (!restored) {
    console.error("\nRestore did not verify — refusing to report success.");
    await browser.close();
    process.exit(2);
  }
  console.log("T7 — after revert, the customer is readable again");
  {
    const s = await operator.fetchJson(singleUrl(customerId));
    const r = await operator.fetchJson(listUrl(`?search=${TARGET_CODE}&limit=100`));
    const codes = (r.json?.data?.customers ?? []).map((c) => c.customerCode);
    check("T7a single-fetch 200 again for crm_operator", s.status === 200, `HTTP ${s.status}`);
    check("T7b search finds it again after revert", r.status === 200 && codes.includes(TARGET_CODE), `HTTP ${r.status} contains=${codes.includes(TARGET_CODE)}`);
  }

  await browser.close();

  console.log(`\n=== ${results.length - failures}/${results.length} checks passed ===`);
  if (failures > 0) {
    console.log("FAILED:");
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
