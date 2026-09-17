'use client'
import {useState} from 'react'
import Layout from '@/components/Layout'
import Navbar from '@/components/Navbar'
import BottomLogo from '@/components/BottomLogo'
import GlassCard from '@/components/GlassCard'
import {logout} from '@/lib/auth'

const toP=(s:string)=>s.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[+d])

function SettingsPage(){
  const [nm,setNm]=useState('کاربر')
  const [ph,setPh]=useState('۰۹۱۲۰۰۰۰۰۰۰')
  const [notif,setNotif]=useState(true)
  const [dark,setDark]=useState(true)
  const [lang,setLang]=useState('fa')
  const [saved,setSaved]=useState(false)

  const save=()=>{setSaved(true);setTimeout(()=>setSaved(false),2000)}
  const handleLogout=async ()=>{await logout()}

  const Toggle=({on,onToggle}:{on:boolean,onToggle:()=>void})=>(
    <button onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-all relative ${on?'bg-[#51BB70]':'bg-[#636363]'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on?'right-1':'left-1'}`}/>
    </button>
  )

  return(
    <Layout ch={
      <>
        <Navbar/>
        <div className="px-6 pt-4 flex-1 flex flex-col gap-5">
          <h1 className="text-white text-center text-2xl font-bold afu">تنظیمات</h1>

          <GlassCard cls="p-5 afu d1" ch={
            <>
              <div className="text-white font-bold text-base text-right mb-4" dir="rtl">اطلاعات حساب</div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-white text-sm font-medium mb-1 block text-right" dir="rtl">نام کاربری</label>
                  <input className="inf" type="text" value={nm} onChange={e=>setNm(e.target.value)} dir="rtl"/>
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-1 block text-right" dir="rtl">شماره موبایل</label>
                  <input className="inf" type="tel" value={ph}
                    onChange={e=>setPh(toP(e.target.value.replace(/[^\d۰-۹]/g,'').slice(0,11)))}
                    dir="rtl" style={{textAlign:'right'}}/>
                </div>
              </div>
            </>
          }/>

          <GlassCard cls="p-5 afu d2" ch={
            <>
              <div className="text-white font-bold text-base text-right mb-4" dir="rtl">تنظیمات برنامه</div>
              <div className="flex flex-col gap-4">
                {[
                  {l:'اعلان‌ها',v:notif,f:()=>setNotif(!notif)},
                  {l:'حالت تاریک',v:dark,f:()=>setDark(!dark)},
                ].map(s=>(
                  <div key={s.l} className="flex flex-row-reverse items-center justify-between">
                    <span className="text-white text-sm">{s.l}</span>
                    <Toggle on={s.v} onToggle={s.f}/>
                  </div>
                ))}
                <div className="flex flex-row-reverse items-center justify-between">
                  <span className="text-white text-sm">زبان</span>
                  <select className="bg-[#636363] text-white text-sm px-3 py-1 rounded-lg border border-white/20 outline-none"
                    value={lang} onChange={e=>setLang(e.target.value)} dir="rtl">
                    <option value="fa">فارسی</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </>
          }/>

          <GlassCard cls="p-5 afu d3" ch={
            <>
              <div className="text-white font-bold text-base text-right mb-3" dir="rtl">درباره برنامه</div>
              <div className="flex flex-col gap-2 text-white/60 text-sm text-right" dir="rtl">
                <div>نسخه: ۱.۰.۰</div>
                <div>سیم‌کارت ۲۴ آنلاین</div>
                <div>۱۰ نمایندگی فعال | بیش از ۲۰۰۰ مشتری</div>
              </div>
            </>
          }/>

          <div className="flex flex-col gap-3 pb-6 afu d4">
            <button className="ba w-full" onClick={save}>
              {saved?'✓ ذخیره شد':'ذخیره تغییرات'}
            </button>
            <button onClick={handleLogout}
              className="w-full py-3 rounded-xl border border-red-400/60 text-red-400 text-sm font-medium hover:bg-red-400/10 transition-colors">
              خروج از حساب
            </button>
          </div>
        </div>
        <BottomLogo/>
      </>
    }/>
  )
}

export default SettingsPage
