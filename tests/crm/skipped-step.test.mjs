// CRM SKIPPED-step fixture test (Phase 4.8c hardening, decision D-B)
//
// Verifies that a WorkflowStepInstance with status='SKIPPED' produces a
// step_skipped timeline entry rendered with the Persian label «پرش‌شده» /
// title «پرش مرحله …». There are no natural SKIPPED rows in the dev DB, so
// the test temporarily flips ONE eligible step to SKIPPED via SQL and
// reverts it in a finally block (same self-reverting pattern as T5 in
// owner-scope.test.mjs).
//
// Safety rails:
//   • Only steps in status ASSIGNED (never COMPLETED/REJECTED history) are
//     eligible, and the step chosen must be attached to a customer-form
//     owned by a REAL customer so the timeline is reachable via the UI.
//   • The original status is captured first and asserted restored after.
//   • A pg_dump of workflow_step_instances is taken into the container
//     before mutating (note: this table is small — 422 rows).
//   • Exit 0 on pass; exit 2 if anything — including the revert — fails.
//
// Requires: app on BASE (default http://localhost:3000), sim24-db container.
// Run: npm run test:crm-skipped
//      node tests/crm/skipped-step.test.mjs

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CRM_TEST_BASE || "http://localhost:3000";
const USER = { username: "crm_tester", password: "operator123" };
const ARTIFACTS = path.resolve("artifacts");
const SHOT = path.join(ARTIFACTS, "crm-4.8c-skipped-fixture.png");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}\n        ${detail}`);
  }
}

// ─── DB helpers (execFileSync — no shell quoting issues) ───
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

function backupStepsTable() {
  try {
    execFileSync(
      "docker",
      ["exec", "sim24-db", "pg_dump", "-U", "sim24", "-d", "sim24", "-t", "workflow_step_instances", "-F", "c", "-f", "/tmp/skipped-fixture.dump"],
      { encoding: "utf8" }
    );
    console.log("  [backup] sim24-db:/tmp/skipped-fixture.dump");
  } catch (e) {
    console.log(`  [backup] WARNING: pg_dump failed: ${e.message}`);
  }
}

// ─── main ───
(async () => {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) {
    console.error(`No Chrome binary found. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
    process.exit(2);
  }
  mkdirSync(ARTIFACTS, { recursive: true });

  console.log("== 1. Find an eligible ASSIGNED step attached to a real customer ==");
  // Eligibility: status ASSIGNED, workflow instance reachable from a
  // customer form which belongs to a real customer (phone join).
  const eligible = psql(
    `SELECT ws.id, ws.status, c.id AS customer_id, c."customerCode"
     FROM workflow_step_instances ws
     JOIN workflow_instances wi ON wi.id = ws."instanceId"
     JOIN customer_forms cf ON cf.id = wi."customerFormId"
     JOIN crm_customers c ON c."primaryPhone" = cf.phone
     WHERE ws.status = 'ASSIGNED'
     ORDER BY ws."createdAt" DESC
     LIMIT 5;`
  );
  console.log("  eligible rows:\n" + eligible.split("\n").map((l) => "    " + l).join("\n"));
  const first = eligible.split("\n")[0]?.split("|") ?? [];
  const stepId = first[0];
  const customerId = first[2];
  const customerCode = first[3];
  if (!stepId || !customerId) {
    console.error("No eligible ASSIGNED step attached to a real customer — cannot run fixture. STOP.");
    process.exit(2);
  }
  const originalStatus = psqlScalar(
    `SELECT status FROM workflow_step_instances WHERE id = '${stepId}';`
  );
  console.log(`  chosen step=${stepId} customer=${customerCode} (${customerId}) originalStatus=${originalStatus}`);
  // STOP on any unexpected count / unexpected state (rule 8)
  if (originalStatus !== "ASSIGNED") {
    console.error(`Unexpected original status '${originalStatus}' — expected ASSIGNED. STOP.`);
    process.exit(2);
  }

  console.log("\n== 2. Backup + mutate step to SKIPPED ==");
  backupStepsTable();
  psql(`UPDATE workflow_step_instances SET status = 'SKIPPED' WHERE id = '${stepId}';`);
  const mutated = psqlScalar(`SELECT status FROM workflow_step_instances WHERE id = '${stepId}';`);
  check("step status flipped to SKIPPED", mutated === "SKIPPED", `got '${mutated}'`);

  let browser;
  try {
    console.log("\n== 3. Login + open timeline as crm_tester ==");
    browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const boxes = page.getByRole("textbox");
    await boxes.nth(0).fill(USER.username);
    await boxes.nth(1).fill(USER.password);
    await page.getByRole("button", { name: "ورود" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    console.log(`  [login] FINAL URL: ${page.url()}`);

    // API assertion
    const api = await page.evaluate(async (id) => {
      const r = await fetch(`/api/crm/customers/${id}/timeline`, { credentials: "include" });
      return { status: r.status, json: await r.json().catch(() => null) };
    }, customerId);
    check("timeline API 200", api.status === 200, `got ${api.status}`);
    const skippedEntries = (api.json?.data?.entries ?? []).filter((e) => e.type === "step_skipped");
    check(
      "step_skipped entry present in API response",
      skippedEntries.length === 1,
      `expected 1, got ${skippedEntries.length}: ${JSON.stringify(skippedEntries)}`
    );
    if (skippedEntries.length === 1) {
      check(
        "entry carries status SKIPPED + skip title",
        skippedEntries[0].status === "SKIPPED" && String(skippedEntries[0].title || "").includes("پرش مرحله"),
        JSON.stringify(skippedEntries[0])
      );
    }

    // UI assertion + screenshot
    await page
      .goto(`${BASE}/crm/customers/${customerId}`, { waitUntil: "networkidle", timeout: 30000 })
      .catch(() => {});
    await page.getByTestId("crm-tab-timeline").click();
    await page.waitForTimeout(1500);

    const domText = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('[data-testid="timeline-entry"]'));
      const n = nodes.find((x) => x.getAttribute("data-type") === "step_skipped");
      return n ? (n.innerText || "").trim() : null;
    });
    check("step_skipped entry rendered in DOM", domText !== null, "no [data-type=step_skipped] node");
    check(
      "Persian skip label rendered",
      !!domText && (domText.includes("پرش مرحله") || domText.includes("پرش‌شده")),
      `dom=${JSON.stringify(domText)}`
    );
    console.log(`  [ui] url=${page.url()}`);
    if (domText) console.log(`  [ui] DOM: ${JSON.stringify(domText)}`);

    await page.screenshot({ path: SHOT, fullPage: true });
    const size = statSync(SHOT).size;
    check("screenshot saved non-zero", size > 0, `${size} bytes`);
    console.log(`  📸 ${SHOT} (${size} bytes)`);

    await browser.close();
    browser = null;
  } finally {
    console.log("\n== 4. Revert ==");
    try {
      psql(`UPDATE workflow_step_instances SET status = '${originalStatus}' WHERE id = '${stepId}';`);
    } catch (e) {
      console.error(`  REVERT ERROR: ${e.message}`);
      process.exit(2);
    }
    const restored = psqlScalar(`SELECT status FROM workflow_step_instances WHERE id = '${stepId}';`);
    if (restored !== originalStatus) {
      console.error(
        `  REVERT FAILED: step ${stepId} is '${restored}', expected '${originalStatus}'.\n` +
        `  Manual repair: UPDATE workflow_step_instances SET status = '${originalStatus}' WHERE id = '${stepId}';\n` +
        `  Or restore the table dump inside the container: pg_restore -U sim24 -d sim24 -t workflow_step_instances /tmp/skipped-fixture.dump`
      );
      process.exit(2);
    }
    console.log(`  step ${stepId} restored to '${restored}'`);
  }

  console.log(`\n== RESULT: ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"} ==`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
