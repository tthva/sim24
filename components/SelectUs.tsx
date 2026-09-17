'use client'

type CheckboxProps = {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}

export default function SelectUS({
  checked,
  onChange,
  label = 'ثبت جهت ارتباط کارشناس ما با شما',
}: CheckboxProps) {
  return (
    <div className="flex flex-row-reverse items-center gap-2   " dir="ltr">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex-shrink-0"
      >
        <div dir="rtl"
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'border-[#51BB70]' : 'border-[#636363]'
            }`}
        >
          {checked && (
            <svg
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
            >
              <path
                d="M1 5l3.5 3.5L11 1"
                stroke="#23E250"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </button>

      <span
        onClick={() => onChange(!checked)}
        className="text-[#9ca3af] text-[14px] font-bold cursor-pointer select-none hover:underline"
      >
        {label}
      </span>
    </div>
  )
}