import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

async function copyIfExists(src, dest, label) {
  if (!existsSync(src)) {
    console.log(`⏭  ${label}: source missing`);
    return;
  }
  await cp(src, dest, { recursive: true, force: true });
  console.log(`✅ ${label} copied`);
}

console.log("📦 Copying standalone assets...");
await copyIfExists(join(root, ".next", "static"), join(standalone, ".next", "static"), ".next/static");
await copyIfExists(join(root, "public"), join(standalone, "public"), "public");
console.log("🎉 Done.");