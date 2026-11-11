import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui'

export function QrCode({ value, size = 200, filename }: { value: string; size?: number; filename?: string }) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    QRCode.toDataURL(value, { width: 1024, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [value])
  if (!src) return <div style={{ width: size, height: size }} className="rounded-lg bg-slate-100" />
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl bg-paper p-2">
        <img src={src} width={size} height={size} alt={`QR code for ${value}`} />
      </div>
      {filename && (
        <a href={src} download={filename}>
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} type="button">
            Download PNG
          </Button>
        </a>
      )}
    </div>
  )
}
