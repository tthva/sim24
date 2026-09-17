import {ReactNode} from 'react'
export default function GlassCard({ch,cls='',sm=false}:{ch:ReactNode,cls?:string,sm?:boolean}){
  return <div className={`${sm?'gcs':'gc'} ${cls}`}>{ch}</div>
}
