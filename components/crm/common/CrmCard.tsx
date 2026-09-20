import { ReactNode } from "react";

// Glass card matching the SIM24 CRM palette (rgba(28,57,104,0.2) + blur)
export default function CrmCard({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: "rgba(28,57,104,0.2)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(81,187,254,0.15)",
      }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-white font-bold text-sm">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
