"use client";
import React, {
  useId,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";

interface OutlinedTextFieldProps {
  label: string;
  value?: string;
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  id?: string;
  name?: string;
  type?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  leadingIcon?: React.ReactNode | false;
  trailingIcon?: React.ReactNode | false;
  className?: string;
  dir?: "ltr" | "rtl";
  labelFloatOffsetX?: number;
  labelFloatOffsetY?: number;
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  gap?: number;
  labelClassName?: string;
  helperTextClassName?: string;
  placeholder?: string;
  onFocus?: (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onBlur?: (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
}

const OutlinedTextField: React.FC<OutlinedTextFieldProps> = ({
  label,
  value = "",
  onChange,
  onFocus,
  onBlur,
  id: externalId,
  name,
  type = "text",
  error = false,
  helperText,
  disabled = false,
  leadingIcon = false,
  trailingIcon = false,
  className = "",
  dir = "rtl",
  labelFloatOffsetX = 0,
  labelFloatOffsetY = -28,
  multiline = false,
  rows,
  gap = 6,
  labelClassName = "",
  helperTextClassName = "",
  placeholder = "",
  autoComplete,
  autoCorrect,
  autoCapitalize,
  spellCheck,
}) => {
  const internalId = useId();
  const inputId = externalId || internalId;

  const [focused, setFocused] = useState(false);
  const [labelWidth, setLabelWidth] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const labelRef = useRef<HTMLLabelElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFloating =
    focused ||
    (value !== undefined && value !== null && value.toString().length > 0);

  const updateMeasurements = useCallback(() => {
    if (containerRef.current && labelRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
      setLabelWidth(labelRef.current.offsetWidth);
    }
  }, []);

  useLayoutEffect(() => {
    updateMeasurements();
    const timer = setTimeout(updateMeasurements, 30); // اطمینان از رندر نهایی
    window.addEventListener("resize", updateMeasurements);
    return () => {
      window.removeEventListener("resize", updateMeasurements);
      clearTimeout(timer);
    };
  }, [updateMeasurements, isFloating, label]);

  const strokeWidth = focused ? 2 : 1.5;
  const offset = strokeWidth / 2;
  const hasValue =
    value !== undefined && value !== null && value.toString().length > 0;
  // ترتیب اولویت رنگ خط دور: خطا (قرمز) > غیرفعال (خاکستری) >
  // پر شده (سبز #51BB70 — فیلد پُر حتی بعد از خروج فوکوس سبز می‌ماند) >
  // فوکوس (سبز روشن) > حالت عادی
      const strokeColor = error
    ? "#ef4444"
    : disabled
      ? "#3f3f3f"
      : hasValue
        ? "#51BB70"
        : focused
          ? "#88ffa4"
          : "#4b5563";

  const pathD = (() => {
    const { width: w, height: h } = dimensions;
    if (w === 0 || h === 0) return "";

    const r = 12;
    const rAdj = Math.max(0, r - offset);
    const xMin = offset;
    const xMax = w - offset;
    const yMin = offset;
    const yMax = h - offset;

    if (!isFloating) {
      return `M ${r},${yMin} H ${xMax - rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMax},${r} V ${yMax - rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMax - rAdj},${yMax} H ${xMin + rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMin},${yMax - rAdj} V ${yMin + rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMin + rAdj},${yMin} Z`;
    }

    const scale = 0.85;
    const scaledLabelWidth = labelWidth * scale;

    const paddingSide = 16;

    let notchStart, notchEnd;

    if (dir === "rtl") {
      notchEnd = xMax - paddingSide + gap;
      notchStart = notchEnd - scaledLabelWidth - gap * 2;
    } else {
      notchStart = xMin + paddingSide - gap;
      notchEnd = notchStart + scaledLabelWidth + gap * 2;
    }

    // جلوگیری از تداخل بریدگی با شعاع گوشه‌ها
    const safeStart = Math.max(r, notchStart);
    const safeEnd = Math.min(w - r, notchEnd);

    return `M ${r},${yMin} H ${safeStart} M ${safeEnd},${yMin} H ${xMax - rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMax},${r} V ${yMax - rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMax - rAdj},${yMax} H ${xMin + rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMin},${yMax - rAdj} V ${yMin + rAdj} A ${rAdj},${rAdj} 0 0 1 ${xMin + rAdj},${yMin} H ${r} A ${rAdj},${rAdj} 0 0 1 ${xMin + rAdj},${yMin}`;
  })();

  return (
    <div className={`relative flex flex-col w-full ${className}`} dir={dir}>
      <div
        ref={containerRef}
        className="relative flex items-center min-h-[56px] bg-transparent"
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          fill="none"
        >
          <path
            d={pathD}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-200"
          />
        </svg>

        <div className="relative flex-1 flex items-center h-full px-4">
          <label
            ref={labelRef}
            htmlFor={inputId}
            style={{
              // در حالت multiline ارتفاع کانتینر بلندتر از فیلدهای تک‌خطی است؛
              // لیبل باید دقیقاً مثل بقیه فیلدها در ناحیه خط اول (28px = نصف 56px) قرار گیرد
              // تا با سایر فیلدهای فرم هم‌راستا باشد.
              top: multiline ? "28px" : "50%",
              transform: isFloating
                ? `translate(${dir === "rtl" ? labelFloatOffsetX : -labelFloatOffsetX}px, ${labelFloatOffsetY}px) translateY(-50%) scale(0.85)`
                : "translate(0, -50%) scale(1)",
              transformOrigin: dir === "rtl" ? "right center" : "left center",
              color: error ? "#ef4444" : focused ? "#88ffa4" : "#9ca3af",
            }}
            className={`absolute pointer-events-none transition-all duration-200 ease-out z-30 select-none whitespace-nowrap 
              ${dir === "rtl" ? "right-4" : "left-4"}`}
          >
            {label}
          </label>

          {multiline ? (
            <textarea
              id={inputId}
              value={value}
              onChange={onChange}
              rows={rows}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              className="w-full bg-transparent border-none outline-none py-4 text-white resize-none z-10"
              style={{
                WebkitBoxShadow: "0 0 0px 1000px transparent inset",
                WebkitTextFillColor: "white",
                transition: "background-color 5000s ease-in-out 0s",
                caretColor: "white",
              }}
            />
          ) : (
            <input
              id={inputId}
              name={name}
              type={type}
              value={value}
              onChange={onChange}
              {...(autoComplete !== undefined ? { autoComplete } : {})}
              {...(autoCorrect !== undefined ? { autoCorrect } : {})}
              {...(autoCapitalize !== undefined ? { autoCapitalize } : {})}
              {...(spellCheck !== undefined ? { spellCheck } : {})}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              className="w-full h-full bg-transparent border-none outline-none py-4 text-white z-10"
              style={{
                WebkitBoxShadow: "0 0 0px 1000px transparent inset",
                WebkitTextFillColor: "white",
                transition: "background-color 5000s ease-in-out 0s",
                caretColor: "white",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OutlinedTextField;
