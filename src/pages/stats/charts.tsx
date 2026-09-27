import { useEffect, useRef, useState, type ReactNode } from 'react'

// Small hand-drawn SVG charts following the club's chart rules: thin bars with rounded data
// ends, hairline grid, text in ink colours (never the series colour), a legend for two or
// more series, a hover/focus tooltip on every mark, and a table view for each chart.

export interface Series {
  name: string
  values: (number | null)[]
  /** 'accent' for the series the chart is about, 'context' for the grey comparison. */
  tone: 'accent' | 'context'
}

const BAR_MAX = 24
const GAP = 2
const RADIUS = 4

/** Width of an element, kept up to date as the screen resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** "Clean" axis ticks: 0, 50, 100… */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!
  const ticks = []
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Math.round(t))
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Column rising from the baseline, rounded only at the data end. */
function columnPath(x: number, y: number, w: number, baseline: number) {
  const h = baseline - y
  if (h <= 0) return ''
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${baseline}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${baseline}Z`
}

/** Bar growing from the left edge, rounded only at the data end. */
function barPath(x0: number, y: number, x1: number, h: number) {
  const w = x1 - x0
  if (w <= 0) return ''
  const r = Math.min(RADIUS, h / 2, w)
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`
}

interface TooltipState {
  x: number
  y: number
  title: string
  rows: { name: string; value: string; tone: Series['tone'] }[]
}

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null
  return (
    <div className="viz-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      <div className="viz-tooltip-title">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.name} className="viz-tooltip-row">
          <span className={`viz-key line ${r.tone}`} aria-hidden="true" />
          <strong>{r.value}</strong>
          <span>{r.name}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ series }: { series: Pick<Series, 'name' | 'tone'>[] }) {
  if (series.length < 2) return null
  return (
    <div className="viz-legend">
      {series.map((s) => (
        <span key={s.name}>
          <span className={`viz-key box ${s.tone}`} aria-hidden="true" />
          {s.name}
        </span>
      ))}
    </div>
  )
}

/** Card holding a chart, with a switch to see the same numbers as a table. */
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string
  subtitle?: string
  table: { head: string[]; rows: (string | number)[][] }
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <figure className="card viz-card">
      <div className="viz-head">
        <div>
          <figcaption className="viz-title">{title}</figcaption>
          {subtitle && <div className="meta">{subtitle}</div>}
        </div>
        <button type="button" className="btn viz-toggle" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <table className="count-table viz-table">
          <thead>
            <tr>
              {table.head.map((h, i) => (
                <th key={h} className={i ? 'num' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, i) => (i ? <td key={i} className="num">{cell}</td> : <th key={i} scope="row">{cell}</th>))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </figure>
  )
}

/** Vertical columns, one group per category (e.g. month), one column per series. */
export function ColumnChart({
  categories,
  series,
  format = (n) => n.toLocaleString('en-NZ'),
  height = 220,
  label,
}: {
  categories: string[]
  series: Series[]
  format?: (n: number) => string
  height?: number
  label: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const pad = { top: 12, right: 4, bottom: 24, left: 40 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const band = plotW / categories.length
  const barW = Math.max(3, Math.min(BAR_MAX, (band * 0.7 - GAP * (series.length - 1)) / series.length))
  const groupW = barW * series.length + GAP * (series.length - 1)
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  const baseline = pad.top + plotH
  // Thin out labels on narrow screens.
  const labelEvery = band < 26 ? 2 : 1

  const show = (i: number) =>
    setTip({
      x: pad.left + band * i + band / 2,
      y: pad.top,
      title: categories[i],
      rows: series.map((s) => ({ name: s.name, value: s.values[i] === null ? '—' : format(s.values[i]!), tone: s.tone })),
    })

  return (
    <div ref={ref} className="viz-plot" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="viz-grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
              <text className="viz-axis-label" x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          <line className="viz-baseline" x1={pad.left} x2={width - pad.right} y1={baseline} y2={baseline} />
          {categories.map((c, i) => {
            const gx = pad.left + band * i + (band - groupW) / 2
            return (
              <g key={c}>
                {series.map((s, j) => {
                  const v = s.values[i]
                  return v ? <path key={s.name} className={`viz-mark ${s.tone}`} d={columnPath(gx + j * (barW + GAP), y(v), barW, baseline)} /> : null
                })}
                {i % labelEvery === 0 && (
                  <text className="viz-axis-label" x={pad.left + band * i + band / 2} y={height - 6} textAnchor="middle">
                    {c}
                  </text>
                )}
                <rect
                  className="viz-hit"
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={plotH}
                  tabIndex={0}
                  aria-label={`${c}: ${series.map((s) => `${s.name} ${s.values[i] === null ? 'none' : format(s.values[i]!)}`).join(', ')}`}
                  onPointerEnter={() => show(i)}
                  onFocus={() => show(i)}
                  onBlur={() => setTip(null)}
                />
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

/** Horizontal bars with the value at each bar's tip; one series. */
export function BarList({ rows, format = (n) => n.toLocaleString('en-NZ'), unit, label }: { rows: { label: string; value: number }[]; format?: (n: number) => string; unit: string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const labelW = Math.min(150, Math.max(...rows.map((r) => r.label.length * 7.5), 30))
  const valueW = 64
  const rowH = 30
  const barH = 16
  const plotW = Math.max(0, width - labelW - valueW - 12)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const height = rows.length * rowH

  const show = (i: number) => setTip({ x: labelW + 12 + (rows[i].value / max) * plotW, y: i * rowH, title: rows[i].label, rows: [{ name: unit, value: format(rows[i].value), tone: 'accent' }] })

  return (
    <div ref={ref} className="viz-plot" onPointerLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <line className="viz-baseline" x1={labelW + 8} x2={labelW + 8} y1={0} y2={height} />
          {rows.map((r, i) => {
            const x1 = labelW + 8 + (r.value / max) * plotW
            const cy = i * rowH + rowH / 2
            return (
              <g key={r.label}>
                <text className="viz-row-label" x={labelW} y={cy} dy="0.32em" textAnchor="end">
                  {r.label}
                </text>
                <path className="viz-mark accent" d={barPath(labelW + 8, cy - barH / 2, x1, barH)} />
                <text className="viz-value" x={x1 + 6} y={cy} dy="0.32em">
                  {format(r.value)}
                </text>
                <rect
                  className="viz-hit"
                  x={0}
                  y={i * rowH}
                  width={width}
                  height={rowH}
                  tabIndex={0}
                  aria-label={`${r.label}: ${format(r.value)} ${unit}`}
                  onPointerEnter={() => show(i)}
                  onFocus={() => show(i)}
                  onBlur={() => setTip(null)}
                />
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

/** Headline number with its change against the comparison period. */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  upIsGood = true,
  note,
}: {
  label: string
  value: string
  delta?: number | null
  deltaLabel?: string
  upIsGood?: boolean
  note?: string
}) {
  const direction = delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  const good = direction === 'flat' ? null : (direction === 'up') === upIsGood
  return (
    <div className="card stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta != null && (
        <div className={`stat-delta ${good === null ? '' : good ? 'good' : 'bad'}`}>
          <span aria-hidden="true">{direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■'}</span> {delta > 0 ? '+' : ''}
          {delta}% <span className="meta">{deltaLabel}</span>
        </div>
      )}
      {note && <div className="meta">{note}</div>}
    </div>
  )
}
