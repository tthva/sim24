/**
 * Installment calculation shared between the customer form (components/installment.tsx)
 * and the operator pages (e.g. sell-manager/prepay «مبلغ هر قسط»).
 * MUST stay in sync with what the customer sees at checkout.
 */

export function getInstallmentInterestRate(installmentCount: number): number {
  return installmentCount < 4 ? 0.09 : 0.065;
}

export function applyInstallmentInterest(
  remainingAmount: number,
  installmentCount: number,
): number {
  const safeBase = Number(remainingAmount);
  const safeCount = Number(installmentCount);

  if (!Number.isFinite(safeBase)) return 0;
  if (!Number.isFinite(safeCount) || safeCount <= 0)
    return Math.round(safeBase);

  const rate = getInstallmentInterestRate(safeCount);
  const baseInstallmentAmount = safeBase / safeCount;

  // Compound interest per month: month i gets compounded (1 + rate)^i
  let totalWithInterest = 0;
  for (let i = 1; i <= safeCount; i++) {
    totalWithInterest += baseInstallmentAmount * Math.pow(1 + rate, i);
  }

  const average = totalWithInterest / safeCount;
  return Number.isFinite(average)
    ? Math.round(average)
    : Math.round(baseInstallmentAmount);
}

/**
 * Customer-side inputs for one installment plan:
 *   total  = قیمت سیم‌کارت (sp)
 *   prepay = پیش‌پرداخت (dp)
 *   months = مدت اقساط (mo)
 * Returns the per-installment amount exactly as shown to the customer.
 */
export function computeEachInstallment(
  total: number,
  prepay: number,
  months: number,
): number {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safePrepay = Number.isFinite(prepay) ? prepay : 0;
  const effectiveDownPayment = Math.min(Math.max(safePrepay, 0), safeTotal);
  const remainingAmount = Math.max(safeTotal - effectiveDownPayment, 0);
  return applyInstallmentInterest(remainingAmount, months);
}