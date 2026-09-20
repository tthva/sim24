// Colored segment/tag badge — CRM palette
const COLORS: Record<string, { bg: string; text: string }> = {
  vip: { bg: "rgba(81,187,112,0.18)", text: "#51BB70" },
  hot: { bg: "rgba(255,140,80,0.18)", text: "#ff8c50" },
  regular: { bg: "rgba(81,187,254,0.15)", text: "#51BBFE" },
  cold: { bg: "rgba(160,170,190,0.18)", text: "#a0aabe" },
  active: { bg: "rgba(81,187,112,0.18)", text: "#51BB70" },
  inactive: { bg: "rgba(92,50,50,0.3)", text: "#ff7a7a" },
};

export default function CrmBadge({ label, tone }: { label: string; tone?: string }) {
  const key = (tone || label || "").toLowerCase();
  const c = COLORS[key] || { bg: "rgba(81,187,254,0.15)", text: "#51BBFE" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {label}
    </span>
  );
}
