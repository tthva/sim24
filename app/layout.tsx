import CsrfInit from "@/components/CsrfInit";
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'سیم۲۴ | بازار سیم کارت',
  description: 'خرید، فروش و استعلام سیم کارت',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <CsrfInit />{children}</body>
    </html>
  )
}
