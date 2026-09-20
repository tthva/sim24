import { ReactNode } from "react";

// Simple RTL table shell — children compose <thead>/<tbody>
export default function CrmTable({
  head,
  children,
  empty,
}: {
  head: ReactNode;
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="text-white/50 text-xs border-b border-white/10">{head}</tr>
        </thead>
        <tbody className="text-white/80">{children}</tbody>
      </table>
      {empty && <div className="text-white/40 text-sm text-center py-10">{empty}</div>}
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`py-3 px-3 border-b border-white/5 ${className}`}>{children}</td>;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`py-3 px-3 text-right font-medium ${className}`}>{children}</th>;
}
