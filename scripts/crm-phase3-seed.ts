/**
 * CRM Phase 3 seed — default pipeline + stages + rejection reasons.
 * Idempotent: safe to run multiple times (upsert by code).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STAGES = [
  { code: "lead", name: "سرنخ", order: 1, color: "#3b82f6", isWon: false, isLost: false },
  { code: "contacted", name: "تماس گرفته", order: 2, color: "#8b5cf6", isWon: false, isLost: false },
  { code: "qualified", name: "واجد شرایط", order: 3, color: "#f59e0b", isWon: false, isLost: false },
  { code: "negotiation", name: "مذاکره", order: 4, color: "#ec4899", isWon: false, isLost: false },
  { code: "won", name: "برنده", order: 5, color: "#51BB70", isWon: true, isLost: false },
  { code: "lost", name: "باخته", order: 6, color: "#ef4444", isWon: false, isLost: true },
];

const REJECTION_REASONS = [
  { code: "price", name: "قیمت نامناسب", category: "pricing" },
  { code: "invalid_phone", name: "شماره نامعتبر", category: "quality" },
  { code: "customer_cancelled", name: "مشتری منصرف شد", category: "customer" },
  { code: "incomplete_info", name: "اطلاعات ناقص", category: "quality" },
  { code: "duplicate", name: "تکراری", category: "quality" },
  { code: "out_of_range", name: "خارج از محدوده", category: "quality" },
  { code: "already_rejected", name: "قبلاً رد شده", category: "customer" },
  { code: "other", name: "سایر", category: "other" },
];

async function main() {
  // 1. Default pipeline (idempotent)
  let pipeline = await prisma.pipeline.findFirst({ where: { name: "default" } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { name: "default", department: null, isDefault: true, isActive: true },
    });
    console.log("✅ created default pipeline:", pipeline.id);
  } else {
    console.log("ℹ️ default pipeline already exists:", pipeline.id);
  }

  // 2. Stages (upsert per pipeline+code)
  for (const s of STAGES) {
    const existing = await prisma.pipelineStage.findUnique({
      where: { pipelineId_code: { pipelineId: pipeline.id, code: s.code } },
    });
    if (!existing) {
      await prisma.pipelineStage.create({
        data: { ...s, pipelineId: pipeline.id },
      });
      console.log(`  ✅ stage created: ${s.code}`);
    } else {
      console.log(`  ℹ️ stage exists: ${s.code}`);
    }
  }

  // 3. Rejection reasons (upsert by code)
  for (const [i, r] of REJECTION_REASONS.entries()) {
    const existing = await prisma.rejectionReason.findUnique({ where: { code: r.code } });
    if (!existing) {
      await prisma.rejectionReason.create({
        data: { ...r, isActive: true, isSystem: true, order: i + 1 },
      });
      console.log(`  ✅ reason created: ${r.code}`);
    } else {
      console.log(`  ℹ️ reason exists: ${r.code}`);
    }
  }

  const counts = {
    pipelines: await prisma.pipeline.count(),
    stages: await prisma.pipelineStage.count({ where: { pipelineId: pipeline.id } }),
    reasons: await prisma.rejectionReason.count(),
  };
  console.log("📊 summary:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error("❌ seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
