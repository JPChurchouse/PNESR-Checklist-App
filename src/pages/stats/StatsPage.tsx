import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '../../domain/money'
import type { SafetyCheck } from '../../domain/safetyCheck'
import { change, MONTH_LABELS, seasonStats, WEEKDAY_LABELS, type StatsFilter } from '../../domain/stats'
import { STATION_IDS, STATIONS, type TicketSheet } from '../../domain/tickets'
import { useMode } from '../../lib/modeContext'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { BarList, ChartCard, ColumnChart, Legend, StatTile, type Series } from './charts'

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-NZ')}`

export function StatsPage() {
  const repo = useRepository()
  const mode = useMode()
  const [data, setData] = useState<{ sheets: TicketSheet[]; checks: SafetyCheck[] }>()
  const [error, setError] = useState<unknown>(null)
  const [filter, setFilter] = useState<StatsFilter>({ year: new Date().getFullYear(), station: 'all' })

  useEffect(() => {
    Promise.all([Promise.all(STATION_IDS.map((s) => repo.listTicketSheets(s))).then((lists) => lists.flat()), repo.listSafetyChecks()])
      .then(([sheets, checks]) => setData({ sheets, checks }))
      .catch(setError)
  }, [repo])

  if (error) return <ErrorNotice error={error} />
  if (!data) return <p className="meta">Loading…</p>

  const stats = seasonStats(data.sheets, data.checks, filter)
  const { current: now, previous: before } = stats
  const years = stats.years.includes(filter.year) ? stats.years : [filter.year, ...stats.years]
  const vs = `vs ${filter.year - 1}`
  const perDay = (tickets: number, days: number) => (days ? Math.round(tickets / days) : 0)

  if (!stats.years.length)
    return (
      <div className="form">
        <h1>Season stats</h1>
        <p>No signed-off ticket sheets or safety checks yet. Stats appear here as soon as the first day is signed off.</p>
        {mode === 'live' && (
          <p>
            To see what it will look like, try <Link to="/practice">practice mode</Link> and add a sample season.
          </p>
        )}
      </div>
    )

  const monthly: Series[] = [
    { name: String(filter.year), values: now.ticketsByMonth.map((v) => v || null), tone: 'accent' },
    { name: String(filter.year - 1), values: before.ticketsByMonth.map((v) => v || null), tone: 'context' },
  ]

  return (
    <div className="form stats">
      <div className="page-head">
        <h1>Season stats</h1>
      </div>

      <div className="filter-row">
        <Field label="Year">
          <select value={filter.year} onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Station">
          <select value={filter.station} onChange={(e) => setFilter({ ...filter, station: e.target.value as StatsFilter['station'] })}>
            <option value="all">Both stations</option>
            {STATION_IDS.map((s) => (
              <option key={s} value={s}>
                {STATIONS[s].name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="meta">
        From signed-off records only. {stats.comparedTo ? `${filter.year} so far, compared with ${filter.year - 1} up to ${stats.comparedTo}.` : ''}
      </p>

      <div className="stat-row">
        <StatTile label="Tickets sold" value={now.ticketsSold.toLocaleString('en-NZ')} delta={change(now.ticketsSold, before.ticketsSold)} deltaLabel={vs} />
        <StatTile label="Ticket takings" value={dollars(now.ticketTakings)} delta={change(now.ticketTakings, before.ticketTakings)} deltaLabel={vs} />
        <StatTile label="Running days" value={String(now.runningDays)} delta={change(now.runningDays, before.runningDays)} deltaLabel={vs} />
        <StatTile
          label="Tickets per running day"
          value={String(perDay(now.ticketsSold, now.runningDays))}
          delta={change(perDay(now.ticketsSold, now.runningDays), perDay(before.ticketsSold, before.runningDays))}
          deltaLabel={vs}
        />
        <StatTile label="Donations" value={dollars(now.donations)} delta={change(now.donations, before.donations)} deltaLabel={vs} />
        <StatTile
          label="Sheets that balanced"
          value={`${now.balancedSheets} of ${now.sheets}`}
          note={now.netDifference ? `Net ${now.netDifference > 0 ? 'over' : 'short'} ${formatMoney(Math.abs(now.netDifference))} for the year` : 'No net difference'}
        />
      </div>

      <ChartCard
        title="Tickets sold each month"
        subtitle={`${filter.year} against ${filter.year - 1}${stats.comparedTo ? ` (to ${stats.comparedTo})` : ''}`}
        table={{ head: ['Month', String(filter.year), String(filter.year - 1)], rows: MONTH_LABELS.map((m, i) => [m, now.ticketsByMonth[i], before.ticketsByMonth[i]]) }}
      >
        <Legend series={monthly} />
        <ColumnChart categories={MONTH_LABELS} series={monthly} label={`Tickets sold each month, ${filter.year} against ${filter.year - 1}`} />
      </ChartCard>

      <div className="viz-grid-2">
        <ChartCard title="Tickets by type" subtitle={String(filter.year)} table={{ head: ['Ticket', 'Sold'], rows: now.ticketsByType.map((r) => [r.label, r.value]) }}>
          <BarList rows={now.ticketsByType} unit="tickets" label="Tickets sold by type" />
        </ChartCard>

        {filter.station === 'all' && (
          <ChartCard title="Tickets by station" subtitle={String(filter.year)} table={{ head: ['Station', 'Sold'], rows: now.ticketsByStation.map((r) => [r.label, r.value]) }}>
            <BarList rows={now.ticketsByStation} unit="tickets" label="Tickets sold by station" />
          </ChartCard>
        )}

        <ChartCard
          title="Average tickets by weekday"
          subtitle="Per running day"
          table={{ head: ['Day', 'Average tickets'], rows: WEEKDAY_LABELS.map((d, i) => [d, now.averageByWeekday[i] ?? '—']) }}
        >
          <ColumnChart
            categories={WEEKDAY_LABELS}
            series={[{ name: 'Average tickets', values: now.averageByWeekday, tone: 'accent' }]}
            height={180}
            label="Average tickets per running day by weekday"
          />
        </ChartCard>

        <ChartCard
          title="Busiest days"
          subtitle={String(filter.year)}
          table={{ head: ['Date', 'Tickets', 'Takings'], rows: now.busiestDays.map((d) => [d.date, d.tickets, formatMoney(d.takings)]) }}
        >
          <table className="count-table">
            <tbody>
              {now.busiestDays.map((d, i) => (
                <tr key={d.date}>
                  <th scope="row">{i + 1}</th>
                  <td>{d.date}</td>
                  <td className="num">{d.tickets.toLocaleString('en-NZ')} tickets</td>
                  <td className="num">{formatMoney(d.takings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard title="Locomotive running days" subtitle={String(filter.year)} table={{ head: ['Loco', 'Days'], rows: now.locoDays.map((r) => [r.label, r.value]) }}>
          <BarList rows={now.locoDays} unit="days" label="Days each locomotive ran" />
        </ChartCard>

        <ChartCard title="Carriage running days" subtitle={String(filter.year)} table={{ head: ['Carriage', 'Days'], rows: now.carriageDays.map((r) => [r.label, r.value]) }}>
          <BarList rows={now.carriageDays} unit="days" label="Days each carriage ran" />
        </ChartCard>
      </div>

      {now.cancelledDays.length > 0 && (
        <section className="card form">
          <h2>Days not operating ({now.cancelledDays.length})</h2>
          <ul className="plain-list">
            {now.cancelledDays.map((d) => (
              <li key={d.date}>
                <strong>{d.date}</strong>: {d.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
