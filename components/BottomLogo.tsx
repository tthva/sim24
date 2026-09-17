import Image from 'next/image'
export default function BottomLogo() {
  return (
    <div className="nb w-full py-3 mt-auto flex items-center justify-center">
      <Image src="/logo.png" alt="SIM24" width={0} height={0} sizes="100vw"
        style={{ width: 'auto', height: '56px', objectFit: 'contain' }} />
    </div>
  )
}