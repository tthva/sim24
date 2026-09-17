"use client";
import { useState, useRef, useEffect } from "react";

const ops = ["10 روز", "20 روز", "30 روز"];

export default function TimeLine({
  val,
  onChange,
  forceError,
}: {
  val: string;
  onChange: (v: string) => void;
  forceError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hasErr = forceError && !val;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="flex flex-col gap-3 z-30" ref={wrapRef}>
      <div className="relative w-full z-50 overflow-visible z-30">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          dir="rtl"
          style={{
            width: "100%",
            background: "transparent",
            boxShadow: "inset 0 0 15px rgba(217, 217, 217, 0.25)",
            border: hasErr ? "1.5px solid #ef4444" : "1px solid #88FFA4",
            borderRadius: 8,
            height: 48,
            color: val ? "#fff" : "#aaa",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            fontFamily: "Vazirmatn, sans-serif",
            fontSize: 14,
            cursor: "pointer",
            textAlign: "right",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? "#88FFA4" : "#aaa"}
            strokeWidth="2"
            style={{
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span style={{ flex: 1, textAlign: "right" }}>
            {val || "مدت زمان مورد توافق"}
          </span>
        </button>

        {open && (
          <div
            dir="rtl"
            style={{
              position: "absolute",
              bottom: "100%",
              right: 0,
              left: 0,
              zIndex: 200,
              background: "linear-gradient(180deg,#1c3968 0%,#11223d 100%)",
              border: "1.5px solid rgba(136,255,164,0.4)",
              borderRadius: 12,
              marginBottom: 6,
              overflow: "hidden",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
              fontFamily: "Vazirmatn, sans-serif",
            }}
          >
            {ops.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 16px",
                  textAlign: "right",
                  color: val === o ? "#51BB70" : "#fff",
                  background:
                    val === o ? "rgba(81,187,112,0.12)" : "transparent",
                  border: "none",
                  borderBottom:
                    i < ops.length - 1
                      ? "1px solid rgba(255,255,255,0.07)"
                      : "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "Vazirmatn, sans-serif",
                  fontWeight: val === o ? 700 : 400,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (val !== o)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (val !== o)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                }}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {hasErr && (
          <div
            className="text-[#FF6B6B] text-xs text-right mt-1"
            dir="rtl"
            style={{ fontFamily: "Vazirmatn, sans-serif" }}
          >
            این فیلد اجباری است
          </div>
        )}
      </div>
    </div>
  );
}

