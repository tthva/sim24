"use client";

export function RadioButtons<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-6 items-center">
      <label className="text-white text-sm font-medium ml-auto" dir="rtl">
        {label}
      </label>
      {options.map(([id, lb]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex items-center gap-2"
        >
          <span
            className={`text-sm font-medium transition-colors ${value === id ? "text-[#23E250]" : "text-white"}`}
          >
            {lb}
          </span>
          <div
            style={
              value === id
                ? {
                    width: 24,
                    height: 24,
                    border: "2px solid #51BB70",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    filter: "drop-shadow(0 0 4px #23E250)",
                  }
                : {
                    width: 24,
                    height: 24,
                    border: "2px solid white",
                    borderRadius: "50%",
                  }
            }
          >
            {value === id && (
              <div
                style={{
                  width: 14,
                  height: 14,
                  background: "#51BB70",
                  borderRadius: "50%",
                }}
              />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
