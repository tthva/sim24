import type { Metadata } from "next";
import CrmLayout from "@/components/crm/Layout/CrmLayout";

export const metadata: Metadata = { title: "CRM | SIM24" };

export default function CrmRootLayout({ children }: { children: React.ReactNode }) {
  return <CrmLayout>{children}</CrmLayout>;
}
