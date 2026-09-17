'use client'
import {ReactNode} from 'react'
export default function Layout({ch,cls='',wide=false}:{ch:ReactNode,cls?:string,wide?:boolean}){
  return(
    <div className={`pb font-vazir ${cls}`} style={{fontFamily:'Vazirmatn,sans-serif',minHeight:'100dvh'}}>
      <div style={{
        maxWidth: wide ? 1200 : 440,
        margin:'0 auto',
        minHeight:'100dvh',
        display:'flex',
        flexDirection:'column',
        boxShadow: wide ? '0 0 30px rgba(0,0,0,.5)' : '0 0 60px rgba(0,0,0,.5)',
        position:'relative',
        background: 'linear-gradient(180deg, #203253 0%, #11223d 100%)'
      }}>
        {ch}
      </div>
    </div>
  )
}