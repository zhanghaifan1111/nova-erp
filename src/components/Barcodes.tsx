import React, { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { Spin } from 'antd'

// 一维条码（Code128），渲染到 SVG
export function Barcode({ value, width = 2, height = 40, displayValue = true }: { value: string; width?: number; height?: number; displayValue?: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128', width, height, displayValue,
        fontSize: 12, margin: 0, lineColor: '#000', background: 'transparent',
      })
    } catch { /* 非法字符时留空，不崩溃 */ }
  }, [value, width, height, displayValue])
  return <svg ref={ref} style={{ maxWidth: '100%' }} />
}

// 二维码，渲染到 canvas
export function QrCode({ value, size = 90 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!ref.current || !value) return
    setLoading(true)
    QRCode.toCanvas(ref.current, String(value), { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [value, size])
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={ref} style={loading ? { opacity: 0 } : undefined} />
      {loading && <Spin size="small" style={{ position: 'absolute', left: size / 2 - 8, top: size / 2 - 8 }} />}
    </span>
  )
}
