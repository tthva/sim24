"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import OutlinedTextField from "./FieldSet";

interface Option {
  id: number | string;
  name: string;
}

interface AutocompleteFieldProps {
  label: string;
  options: Option[];
  value: number | string | "";
  onChange: (id: number | string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  dir?: "rtl" | "ltr";
  className?: string;
  placeholder?: string;
  openOnFocus?: boolean;
}

const AutocompleteField: React.FC<AutocompleteFieldProps> = ({
  label,
  options,
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  dir = "rtl",
  className = "",
  placeholder = "",
  openOnFocus = true,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // نام تصادفی فقط سمت کلاینت و بعد از mount ست می‌شود تا SSR/hydration
  // mismatch (به‌خاطر Math.random) رخ ندهد:
  const [randomName, setRandomName] = useState<string | undefined>(undefined);
  useEffect(() => {
    setRandomName(Math.random().toString(36).substring(7));
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // مختصات دراپ‌داون با position:fixed — از آنجا که هر ردیف فرم (.afu) به‌خاطر
  // animation fill-mode:both یک stacking context دائمی دارد، دراپ‌داون داخل خود ردیف
  // هیچ‌گاه نمی‌تواند روی ردیف‌های بعدی بیاید؛ پس به document.body پرتال می‌شود.
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // محاسبه مختصات در «هر بار» باز شدن از getBoundingClientRect اینپوت:
  const updateCoords = useCallback(() => {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  // هنگام باز بودن، با اسکرول (هر عمقی) و تغییر اندازه، موقعیت به‌روز می‌ماند:
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, updateCoords]);

  // Sync input with selected value
  useEffect(() => {
    if (!value || value === "") {
      setInputValue("");
      return;
    }
    const selected = options.find((opt) => String(opt.id) === String(value));
    setInputValue(selected ? selected.name : "");
  }, [value, options]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const selectOption = useCallback(
    (option: Option) => {
      setInputValue(option.name);
      onChange(option.id);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newText = e.target.value;
    setInputValue(newText);
    updateCoords();
    setIsOpen(true);
    setHighlightedIndex(-1);

    // If text is cleared, clear the selected value
    if (newText === "") {
      onChange("" as any);
      return;
    }

    // If the typed text exactly matches a valid option, select it
    const exactMatch = options.find(
      (opt) => opt.name.toLowerCase() === newText.toLowerCase(),
    );
    if (exactMatch) {
      onChange(exactMatch.id);
    } else {
      // Text doesn't match any option — don't commit as a valid value
      // Keep the previous value but show filtered options
      // The parent will still have the old value until a valid option is selected
    }
  };

  // On blur, if the input text doesn't match a valid option, revert to the selected value
  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement) && !listRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setHighlightedIndex(-1);

        // Revert to the valid selected value if text doesn't match
        if (value && value !== "") {
          const selected = options.find((opt) => String(opt.id) === String(value));
          if (selected) {
            setInputValue(selected.name);
          }
        } else {
          setInputValue("");
        }
      }
    }, 200);
  };

  // دراپ‌داون داخل خود wrapper رندر می‌شود (absolute + top-full):
  // همین باعث می‌شود همیشه دقیقاً زیر اینپوت بچسبد و از موقعیت محاسبه‌شده
  // (که با اسکرول یا transform والد منحرف می‌شد) خبری نباشد.
  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      style={{ direction: dir }}
    >
      <OutlinedTextField
        label={label}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={(
          e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          if (!disabled) {
            updateCoords();
            setIsOpen(openOnFocus);
          }
        }}
        onBlur={handleBlur}
        error={error}
        helperText={helperText}
        disabled={disabled}
        dir={dir}
        placeholder={placeholder}
        // غیرفعال‌سازی autocomplete بومی مرورگر تا پیشنهادهای سیستمی
        // روی دراپ‌داون سفارشی نیایند و انتخاب گزینه را نپوشانند:
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        // نام تصادفی در هر مOUNT: مرورگر نمی‌تواند این فیلد را با فرم‌های
        // قبلی (پر کردن خودکار پروفایل/فرم) تطبیق دهد و پیشنهاد ندهد.
        name={randomName}
      />

      {isOpen &&
        filteredOptions.length > 0 &&
        createPortal(
          <ul
            ref={listRef}
            dir="rtl"
            /* عیناً همان استایل HowKnow: گرادیان مات، حاشیه سبز، اسکرول‌بار سبز.
               موقعیت fixed از مختصات اینپوت محاسبه می‌شود (پورتال به body →
               خارج از stacking context ردیف‌های .afu) */
            className="fixed z-[9999] rounded-xl border-[1.5px] border-[#88FFA4]/40 bg-gradient-to-b from-[#1c3968] to-[#11223d] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[50vh]
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-track]:rounded-lg
              [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-[#51BB70] [&::-webkit-scrollbar-thumb]:to-[#88FFA4] [&::-webkit-scrollbar-thumb]:rounded-lg
            "
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredOptions.map((option, index) => (
              <li
                key={option.id}
                onMouseDown={() => selectOption(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block py-3 px-4 text-right cursor-pointer text-sm transition-colors duration-150 select-none
                  ${
                    index === highlightedIndex
                      ? "text-[#51BB70] bg-[#51BB70]/10 font-bold"
                      : "text-white hover:bg-white/5 font-normal"
                  }
                  ${index < filteredOptions.length - 1 ? "border-b border-white/[0.07]" : ""}
                `}
              >
                {option.name}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default AutocompleteField;