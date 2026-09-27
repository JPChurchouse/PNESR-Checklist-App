import { useEffect, useRef } from 'react'

const HEIGHT = 160

/**
 * Finger/mouse signature box. Ink is always dark on white (in both themes) so the saved
 * PNG prints correctly. Calls `onChange` with a PNG data: URL after each stroke, or null when cleared.
 */
export function SignaturePad({ value, onChange, disabled }: { value: string | null; onChange: (png: string | null) => void; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  // Only the starting value is drawn: redrawing on every change would fight the user's pen.
  const initial = useRef(value)

  // Size the canvas to its box at device resolution, and redraw any saved signature.
  useEffect(() => {
    const canvas = canvasRef.current!
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    canvas.width = width * ratio
    canvas.height = HEIGHT * ratio
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
    if (initial.current) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, width, HEIGHT)
      img.src = initial.current
    }
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top] as const
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = e.currentTarget.getContext('2d')!
    const [x, y] = point(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')!
    const [x, y] = point(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    onChange(e.currentTarget.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    onChange(null)
  }

  return (
    <div className="signature">
      <canvas
        ref={canvasRef}
        style={{ height: HEIGHT }}
        aria-label="Signature. Sign with your finger or mouse."
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {!disabled && (
        <div className="actions">
          <span className="meta">Sign above with your finger</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={clear} disabled={!value}>
            Clear signature
          </button>
        </div>
      )}
    </div>
  )
}
