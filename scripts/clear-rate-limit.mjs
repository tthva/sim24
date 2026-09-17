import { createConnection } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocal = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const urlLine = envLocal.split("\n").find((l) => l.trim().startsWith("REDIS_URL="));
if (!urlLine) {
  console.error("REDIS_URL not found in .env.local");
  process.exit(1);
}
const url = urlLine.trim().slice("REDIS_URL=".length);
// redis://localhost:6379
const match = url.match(/redis:\/\/([^:]+):(\d+)/);
if (!match) {
  console.error("Cannot parse REDIS_URL:", url);
  process.exit(1);
}
const host = match[1];
const port = parseInt(match[2], 10);

// Raw RESP protocol client (works with old Redis servers)
function sendCommand(socket, ...args) {
  return new Promise((resolve, reject) => {
    let cmd = `*${args.length}\r\n`;
    for (const arg of args) {
      const buf = Buffer.from(String(arg));
      cmd += `$${buf.length}\r\n${buf.toString()}\r\n`;
    }
    const onData = (data) => {
      socket.removeListener("data", onData);
      resolve(data.toString());
    };
    socket.once("data", onData);
    socket.write(cmd);
  });
}

const socket = createConnection({ host, port });
socket.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

await new Promise((resolve) => socket.once("connect", resolve));

// SCAN for rate limit keys
const scanRes = await sendCommand(socket, "SCAN", "0", "MATCH", "rl:operator-login:*", "COUNT", "100");
console.log("SCAN result:", scanRes);

// Parse RESP array
const lines = scanRes.split("\r\n").filter((l) => l.length > 0 && !l.startsWith("*") && !l.startsWith("$"));
const keys = lines.filter((l) => l.startsWith("rl:operator-login:"));
console.log("Found rate-limit keys:", keys);

for (const key of keys) {
  const delRes = await sendCommand(socket, "DEL", key);
  console.log(`DEL ${key}:`, delRes.trim());
}

socket.end();
console.log("Done.");