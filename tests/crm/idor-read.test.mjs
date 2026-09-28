// Phase 4.8c read-IDOR fixes — runtime verification for all 6 closed routes.
// Cases: A) crm_operator (no view_all) on ownerless customer → 200
//        B) crm_operator on customer owned by ANOTHER agent → 403/404
//        C) crm_tester (view_all) on the same customer → 200
// Fixture: one customer temporarily set referralAgentId = price_agent2,
// reverted in finally; verified before exit.
// Run: npm run test:crm-idor-read
//      node tests/crm/idor-read.test.mjs

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const OPERATOR = { username: "operator_crm", password: "operator123" }; // crm.read only
const MANAGER = { username: "crm_tester", password: "operator123" }; // view_all
const OTHER_AGENT = "f93980e9-20fb-40b0-bfe1-4418a4b72aa9"; // price_agent2

function psql(sqlText) {
  return execFileSync(
    "docker",
    ["exec", "sim24-db", "psql", "-U", "sim24", "-d", "sim24", "-t", "-A", "-c", sqlText],
    { encoding: "utf8" }
  ).trim();
}
const scalar = (q) => psql(q).split("\n")[0].trim();

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};

(async () => {
  // ── fixtures (must be DISTINCT customers) ──
  // Ownerless customer for case A (any data state is fine — we only assert
  // the status code, and 200 with empty data still proves the guard passed).
  const ownerlessId = scalar(
    `SELECT id FROM crm_customers WHERE "referralAgentId" IS NULL
     ORDER BY (SELECT count(*) FROM crm_communications k WHERE k."customerId" = crm_customers.id) DESC
     LIMIT 1;`
  );
  // A DIFFERENT customer (with task + opp + comm) to flip to foreign-owned:
  const targetId = scalar(
    `SELECT id FROM crm_customers
     WHERE "referralAgentId" IS NULL AND id <> '${ownerlessId}'
       AND EXISTS (SELECT 1 FROM crm_activities a WHERE a."customerId" = crm_customers.id)
       AND EXISTS (SELECT 1 FROM crm_opportunities o WHERE o."customerId" = crm_customers.id)
       AND EXISTS (SELECT 1 FROM crm_communications k WHERE k."customerId" = crm_customers.id)
     LIMIT 1;`
  );
  console.log(`[fixture] ownerless customer with comms: ${ownerlessId}`);
  console.log(`[fixture] target customer (to flip):    ${targetId}`);
  check("fixtures found", !!ownerlessId && !!targetId);
  if (!ownerlessId || !targetId) process.exit(2);

  const taskId = scalar(`SELECT id FROM crm_activities WHERE "customerId" = '${targetId}' LIMIT 1;`);
  const oppId = scalar(`SELECT id FROM crm_opportunities WHERE "customerId" = '${targetId}' LIMIT 1;`);
  const commId = scalar(`SELECT id FROM crm_communications WHERE "customerId" = '${targetId}' LIMIT 1;`);
  const countBefore = scalar(`SELECT count(*) FROM crm_customers WHERE "referralAgentId" IS NOT NULL;`);
  console.log(`[fixture] taskId=${taskId} oppId=${oppId} commId=${commId} ownedCountBefore=${countBefore}`);

  let flipped = false;
  try {
    psql(`UPDATE crm_customers SET "referralAgentId" = '${OTHER_AGENT}' WHERE id = '${targetId}';`);
    flipped = true;
    const now = scalar(`SELECT "referralAgentId" FROM crm_customers WHERE id = '${targetId}';`);
    check("fixture flipped to foreign agent", now === OTHER_AGENT, now);

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

    const op = await mkSession(OPERATOR);
    const mg = await mkSession(MANAGER);

    const get = (page, url) =>
      page.evaluate(async (u) => {
        const r = await fetch(u, { credentials: "include" });
        let j = null; try { j = await r.json(); } catch {}
        return { status: r.status, json: j };
      }, url);

    // ── Case A: operator on ownerless → 200 (run BEFORE the flip; ownerlessId ≠ targetId) ──
    console.log("\n── CASE A: operator_crm (no view_all) on OWNERLESS customer → expect 200 ──");
    const a1 = await get(op, `/api/crm/customers/${ownerlessId}/communications`);
    check(`customers/[id]/communications → ${a1.status}`, a1.status === 200, JSON.stringify(a1.json).slice(0, 200));
    const a2 = await get(op, `/api/crm/customers/${ownerlessId}/interactions`);
    check(`customers/[id]/interactions → ${a2.status}`, a2.status === 200, JSON.stringify(a2.json).slice(0, 200));
    const a3 = await get(op, `/api/crm/customers/${ownerlessId}/notes`);
    check(`customers/[id]/notes → ${a3.status}`, a3.status === 200, JSON.stringify(a3.json).slice(0, 200));

    // ── Case B: operator on foreign-owned → 403 (lists) / 404 (detail) ──
    console.log("\n── CASE B: operator_crm on FOREIGN-OWNED customer → expect 403/404 ──");
    const b1 = await get(op, `/api/crm/customers/${targetId}/communications`);
    check(`customers/[id]/communications → ${b1.status} (expect 403)`, b1.status === 403, JSON.stringify(b1.json).slice(0, 200));
    const b2 = await get(op, `/api/crm/customers/${targetId}/interactions`);
    check(`customers/[id]/interactions → ${b2.status} (expect 403)`, b2.status === 403, JSON.stringify(b2.json).slice(0, 200));
    const b3 = await get(op, `/api/crm/customers/${targetId}/notes`);
    check(`customers/[id]/notes → ${b3.status} (expect 403)`, b3.status === 403, JSON.stringify(b3.json).slice(0, 200));
    const b4 = await get(op, `/api/crm/communications/${commId}`);
    check(`communications/[id] → ${b4.status} (expect 404)`, b4.status === 404, JSON.stringify(b4.json).slice(0, 200));
    const b5 = await get(op, `/api/crm/tasks/${taskId}`);
    check(`tasks/[id] → ${b5.status} (expect 404, not assignee)`, b5.status === 404, JSON.stringify(b5.json).slice(0, 200));
    const b6 = await get(op, `/api/crm/opportunities/${oppId}`);
    check(`opportunities/[id] → ${b6.status} (expect 404, not assignee)`, b6.status === 404, JSON.stringify(b6.json).slice(0, 200));

    // ── Case B2: manager (view_all) on foreign-owned → 200 ──
    console.log("\n── CASE C: crm_tester (view_all) on the SAME foreign-owned customer → expect 200 ──");
    const c1 = await get(mg, `/api/crm/customers/${targetId}/communications`);
    check(`customers/[id]/communications → ${c1.status}`, c1.status === 200, JSON.stringify(c1.json).slice(0, 200));
    const c2 = await get(mg, `/api/crm/customers/${targetId}/interactions`);
    check(`customers/[id]/interactions → ${c2.status}`, c2.status === 200, JSON.stringify(c2.json).slice(0, 200));
    const c3 = await get(mg, `/api/crm/customers/${targetId}/notes`);
    check(`customers/[id]/notes → ${c3.status}`, c3.status === 200, JSON.stringify(c3.json).slice(0, 200));
    const c4 = await get(mg, `/api/crm/communications/${commId}`);
    check(`communications/[id] → ${c4.status}`, c4.status === 200, JSON.stringify(c4.json).slice(0, 200));
    const c5 = await get(mg, `/api/crm/tasks/${taskId}`);
    check(`tasks/[id] → ${c5.status}`, c5.status === 200, JSON.stringify(c5.json).slice(0, 200));
    const c6 = await get(mg, `/api/crm/opportunities/${oppId}`);
    check(`opportunities/[id] → ${c6.status}`, c6.status === 200, JSON.stringify(c6.json).slice(0, 200));

    await browser.close();
  } finally {
    console.log("\n── revert fixture ──");
    if (flipped) {
      psql(`UPDATE crm_customers SET "referralAgentId" = NULL WHERE id = '${targetId}';`);
    }
    const after = scalar(`SELECT "referralAgentId" FROM crm_customers WHERE id = '${targetId}';`);
    const countAfter = scalar(`SELECT count(*) FROM crm_customers WHERE "referralAgentId" IS NOT NULL;`);
    check("fixture reverted to ownerless", after === "NULL" || after === "", `got '${after}'`);
    check(`owned count restored (${countBefore} → ${countAfter})`, countAfter === countBefore);
    if (countAfter !== countBefore) {
      console.error(`MANUAL REPAIR: UPDATE crm_customers SET "referralAgentId" = NULL WHERE id = '${targetId}';`);
      process.exit(2);
    }
  }

  console.log(`\n== RESULT: ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"} ==`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
