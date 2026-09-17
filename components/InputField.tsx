'use client'
import { useState } from 'react'
import FieldSet from './FieldSet'

interface P {
  label: string
  type?: string
  ph?: string
  val?: string
  onChange?: (v: string) => void
  icon?: React.ReactNode
  numeric?: boolean
  validate?: (v: string) => boolean | null
  forceError?: boolean
}

const toE = (s: string) => s.replace(/[۰-۹]/g, d => (d.charCodeAt(0) - 1776).toString())
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v))
const isNum = (v: string) => v === '' || /^[\d۰-۹]+$/.test(v)

export default function InputField({ label, type = 'text', ph = '', val, onChange, icon, numeric, validate, forceError }: P) {
  const [touched, setTouched] = useState(false)
  const active = touched || forceError
  let validity: boolean | null = null
  if (active && val !== undefined) {
    if (validate) validity = validate(val)
    else if (type === 'tel') validity = val.length === 0 ? false : isMobile(val)
    else if (numeric) validity = forceError && val.length === 0 ? false : val.length > 0 ? isNum(val) && val.length > 0 : null
    else validity = val.length > 0 ? true : false
  }

  let errMsg: string | null = null
  if (validity === false) {
    if (type === 'tel') errMsg = !val || val.length === 0 ? 'این فیلد اجباری است' : 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود'
    else errMsg = 'این فیلد اجباری است'
  }

  return (
    <div className="w-full">
      <FieldSet
        label={label}
        type={type}
        value={val}
        onChange={e => {
          let v = e.target.value
          if (numeric) v = v.replace(/[^\d۰-۹]/g, '')
          onChange?.(v)
        }}
        error={validity === false}
        helperText={errMsg ?? undefined}
        dir="rtl"
        trailingIcon={icon || false}
      />
    </div>
  )
}
