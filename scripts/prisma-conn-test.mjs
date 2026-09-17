import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("PRISMA_CONN_TEST: starting");
  const start = Date.now();

  try {
    // Works for Postgres/MySQL variants that support SELECT 1
    const rows = await prisma.$queryRaw`SELECT 1 as ok`;
    console.log("PRISMA_CONN_TEST: ok", { rows, ms: Date.now() - start });
    process.exit(0);
  } catch (e) {
    console.error("PRISMA_CONN_TEST: failed", {
      ms: Date.now() - start,
      name: e?.name,
      message: e?.message,
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
