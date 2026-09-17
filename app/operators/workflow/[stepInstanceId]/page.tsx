import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/jwt";
import { getStepDetail } from "@/services/workflow.service";

export default async function WorkflowStepPage({
  params,
}: {
  params: Promise<{ stepInstanceId: string }>;
}) {
  const { stepInstanceId } = await params;

  // Read token from cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
  }

  // Verify token
  let userId: string;
  try {
    const payload = await verifyToken(token);
    userId = payload.sub;
  } catch {
    redirect("/login");
  }

  // Fetch step detail (includes IDOR protection)
  const result = await getStepDetail(stepInstanceId, userId);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] flex items-center justify-center">
        <div className="text-center text-white p-6">
          <h1 className="text-2xl font-bold mb-4">
            {result.code === "STEP_NOT_FOUND" ? "مرحله پیدا نشد" : "دسترسی رد شد"}
          </h1>
          <p className="text-white/60 mb-4">{result.error}</p>
          <a
            href="/operators/price-expert"
            className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
          >
            بازگشت به داشبورد
          </a>
        </div>
      </div>
    );
  }

  const stepData = result.data;
  const hasInstanceData =
    stepData.instanceData !== null && stepData.instanceData !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">
            {stepData.step?.title || "Workflow Step"}
          </h1>
          <a
            href="/operators/price-expert"
            className="text-sm text-white/60 hover:text-white transition"
          >
            ← داشبورد
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workflow Info */}
            <div>
              <h2 className="text-lg font-bold mb-3">اطلاعات ورک‌فلو</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-white/60">کد ورک‌فلو: </span>
                  <span className="font-mono">{stepData.workflow?.code}</span>
                </div>
                <div>
                  <span className="text-white/60">عنوان: </span>
                  <span>{stepData.workflow?.title}</span>
                </div>
                <div>
                  <span className="text-white/60">وضعیت مرحله: </span>
                  <span className="capitalize">{stepData.status}</span>
                </div>
              </div>
            </div>

            {/* Step Info */}
            <div>
              <h2 className="text-lg font-bold mb-3">اطلاعات مرحله</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-white/60">نام مرحله: </span>
                  <span>{stepData.step?.title}</span>
                </div>
                <div>
                  <span className="text-white/60">شماره مرحله: </span>
                  <span>{stepData.step?.stepOrder}</span>
                </div>
                <div>
                  <span className="text-white/60">بخش: </span>
                  <span>{stepData.step?.department}</span>
                </div>
                <div>
                  <span className="text-white/60">کد مرحله: </span>
                  <span className="font-mono">{stepData.step?.code}</span>
                </div>
              </div>
            </div>

            {/* Assigned To */}
            <div className="md:col-span-2">
              <h2 className="text-lg font-bold mb-3">کارشناس اختصاصی</h2>
              {stepData.assignedTo ? (
                <div className="bg-white/10 rounded-lg p-4 text-sm">
                  <div className="font-bold">
                    {stepData.assignedTo.name || stepData.assignedTo.id}
                  </div>
                  <div className="text-white/60 text-xs">
                    {stepData.assignedTo.id}
                  </div>
                </div>
              ) : (
                <div className="text-white/40">هنوز اختصاص داده نشده است</div>
              )}
            </div>

            {/* Instance Data */}
            {hasInstanceData && (
              <div className="md:col-span-2">
                <h2 className="text-lg font-bold mb-3">اطلاعات فرم</h2>
                <pre className="bg-white/5 border border-white/10 rounded-lg p-4 text-xs overflow-x-auto">
                  {JSON.stringify(stepData.instanceData as object, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
