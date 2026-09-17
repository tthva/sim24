# TODO — Workflow Operator Assignment Hardening

## اهداف
1. انتخاب اپراتور امن با RBAC واقعی (role=operator) + قفل advisory برای همزمانی
2. رفع باگ Search route (ذخیره workflowCode و workflowStarted واقعی)
3. یکپارچهسازی مسیرهای UI جزئیات workflow به /operators/workflow/[id]
4. تأیید IDOR/ownership در صفحه جزئیات

## مراحل

- [ ] گام ۱: `repositories/workflow.repository.ts`
  - [ ] افزودن نگاشت department→int و helper قفل advisory
  - [ ] بازنویسی `findLeastBusyAgentByWorkload` → `findLeastBusyOperatorByWorkload(tx, department)` با RBAC + tx + قفل + workload + tie-break
  - [ ] حذف `findLeastBusyAgent` (unused)

- [ ] گام ۲: `services/workflow.service.ts`
  - [ ] `startWorkflow`: انتقال به transaction + استفاده از `findLeastBusyOperatorByWorkload(tx, ...)`
  - [ ] `completeStep`: ۳ مکان (خطوط ۲۰۹، ۲۳۵، ۲۶۰) → استفاده از `findLeastBusyOperatorByWorkload(tx, ...)`
  - [ ] رفتار نبود اپراتور: throw خطای domain + rollback (نساختن StepInstance ناقص)

- [ ] گام ۳: `app/(api)/forms/search/route.ts`
  - [ ] ذخیره ستونهای واقعی `workflowCode` و `workflowStarted: true` بعد از startWorkflow موفق (الگوی buy)

- [ ] گام ۴: مسیرها
  - [ ] ایجاد صفحه canonical: `app/(atumation)/operators/workflow/[stepInstanceId]/page.tsx`
  - [ ] آپدیت `DepartmentDashboard.tsx` لینک → `/operators/workflow/[id]`
  - [ ] آپدیت `lib/auth-routing.ts` → اجازه `/operators/workflow/`
  - [ ] `app/operator/workflow/[stepInstanceId]/page.tsx` → redirect به canonical

- [ ] گام ۵: تستها
  - [ ] `npx tsc --noEmit`
  - [ ] `npm run lint`
  - [ ] `npm run build`
  - [ ] تست runtime + همزمانی + IDOR + گزارش شواهد DB
