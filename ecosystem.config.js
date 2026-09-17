// ============================
// SIM24 — PM2 Production Config (standalone)
// Runs .next/standalone/server.js (Next.js output:standalone) in cluster mode.
// The standalone server reads HOSTNAME/PORT from env and does NOT auto-load
// .env (that's a `next start` CLI feature) — so we parse .env here and inject
// it into every worker.
// ============================
// Start:  pm2 start ecosystem.config.js          (after: npm run build)
// Reload: pm2 reload sim24   (zero-downtime)
// Logs:   pm2 logs sim24
// ============================

const fs = require("fs");

/** Minimal .env parser (KEY=VALUE, # comments, quote-stripping). */
function loadEnvFile(envPath = ".env") {
  const env = {};
  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let value = t.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    }
  } catch {
    /* .env missing — rely on process env */
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "sim24",
      // Standalone server — the only thing needed for a Next standalone deploy.
      // Requires .next/standalone to be freshly built (npm run build).
      script: ".next/standalone/server.js",
      instances: 1, // cluster mode — matches 4-core box with DB/Redis headroom
      exec_mode: "cluster",
      max_memory_restart: "400M",
      // graceful shutdown for in-flight API requests
      kill_timeout: 8000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0", // standalone server binds HOSTNAME (not -H flag)
        PORT: "3000",
        // .env values (DB, JWT, Redis, MinIO…) — standalone won't read .env itself
        ...loadEnvFile(),
      },
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
