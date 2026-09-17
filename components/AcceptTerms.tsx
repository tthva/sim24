'use client'
import Link from 'next/link'
export default function AcceptTerms({ch,onChange,showErr}:{ch:boolean,onChange:(v:boolean)=>void,showErr?:boolean}){
  return(
    <div className="flex flex-col gap-1">
      <div className="flex flex-row-reverse items-center gap-2">
        <button onClick={()=>onChange(!ch)} className="flex-shrink-0">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${ch?'border-[#51BB70]':'border-[#636363]'} ${showErr&&!ch?'!border-red-400':''}`}>
            {ch&&<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#23E250" strokeWidth="2" strokeLinecap="round"/></svg>}
          </div>
        </button>
        <Link href="/terms" className="text-[#51BB70] text-xs font-medium hover:underline">شرایط و قوانین را می‌پذیرم</Link>
      </div>
      {showErr&&!ch&&<div className="text-[#FF6B6B] text-xs text-right" dir="rtl">پذیرش شرایط الزامی است</div>}
    </div>
  )
}
