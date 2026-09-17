'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import GlassCard from '@/components/GlassCard'
import FieldSet from '@/components/FieldSet'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

function LoginInner() {
  const r = useRouter()
  const searchParams = useSearchParams()
  const [un, setUn] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectUrl = searchParams.get('redirect') || ''

  const doLogin = async () => {
    if (!un || !pw) {
      setErr('لطفاً نام کاربری و رمز عبور را وارد کنید')
      return
    }
    setErr('')
    setLoading(true)

    try {
      // Try operator auth first (covers admin, operator, agent accounts)
      let res = await fetch('/api/operator/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: un, password: pw }),
        credentials: 'include',
      })

      let data = await res.json()

      // If operator auth fails, try end-user auth (covers user1, user2, etc.)
      if (!res.ok) {
        res = await fetch('/api/auth/enduser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: un, password: pw }),
          credentials: 'include',
        })
        data = await res.json()
      }

      if (!res.ok) {
        setErr(data.error || 'خطا در ورود')
        setLoading(false)
        return
      }

      // Canonical redirect contract: ONLY backend-driven redirectUrl
      if (!data?.redirectUrl) {
        r.replace('/login?error=invalid_department')
        return
      }

      r.replace(data.redirectUrl)
    } catch (e: any) {
      setErr(e.message || 'خطا در ارتباط با سرور')
      setLoading(false)
    }
  }

  return (
    <Layout
      ch={
        <div className="flex flex-col flex-1 justify-center items-center px-8 gap-8 py-10">
          <GlassCard
            cls="w-full p-8 afu d2"
            ch={
              <>
                <div className="relative w-full mb-6" style={{ paddingBottom: '37.5%' }}>
                  <Image src="/logo.png" alt="SIM24" fill style={{ objectFit: 'contain' }} />
                </div>
                <div className="flex flex-col gap-6">
                  <FieldSet
                    label="نام کاربری"
                    type="text"
                    value={un}
                    onChange={(e) => setUn(e.target.value)}
                    trailingIcon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                    }
                  />
                  <FieldSet
                    label="کلمه عبور"
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    trailingIcon={
                      <svg width="18" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    }
                  />
                  {err && <div className="text-red-400 text-xs text-right">{err}</div>}
                  <button className="ba w-full mt-2" onClick={doLogin} disabled={loading}>
                    {loading ? 'در حال ورود...' : 'ورود'}
                  </button>
                </div>
              </>
            }
          />
        </div>
      }
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
