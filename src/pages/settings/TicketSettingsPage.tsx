import { useEffect, useState } from 'react'
import { formatDenomination, formatMoney } from '../../domain/money'
import { DENOMINATIONS, floatTotal, STATION_IDS, STATIONS, type TicketSettings } from '../../domain/tickets'
import { newId } from '../../lib/ids'
import { useRepository } from '../../storage/hooks'
import { ErrorNotice, Field } from '../../ui/components'
import { MoneyInput, WholeInput } from '../../ui/inputs'

export function TicketSettingsPage() {
  const repo = useRepository()
  const [settings, setSettings] = useState<TicketSettings>()
  const [saved, setSaved] = useState<TicketSettings>()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    repo.getTicketSettings().then((s) => {
      setSettings(s)
      setSaved(s)
    }, setError)
  }, [repo])

  if (error && !settings) return <ErrorNotice error={error} />
  if (!settings) return <p className="meta">Loading…</p>

  const changed = JSON.stringify(settings) !== JSON.stringify(saved)
  const problems = [
    ...settings.ticketTypes.filter((t) => !t.name.trim()).map(() => 'Every ticket type needs a name.'),
    ...(new Set(settings.float.map((f) => f.denominationCents)).size < settings.float.length ? ['Each denomination can only be in the float once.'] : []),
  ]
  const setType = (i: number, patch: Partial<TicketSettings['ticketTypes'][number]>) =>
    setSettings({ ...settings, ticketTypes: settings.ticketTypes.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const setFloat = (i: number, patch: Partial<TicketSettings['float'][number]>) =>
    setSettings({ ...settings, float: settings.float.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  async function save() {
    setError(null)
    try {
      await repo.saveTicketSettings(settings!)
      setSaved(settings)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="form">
      <div className="page-head">
        <h1>Tickets and float</h1>
      </div>
      <p className="meta">Changes apply to ticket sheets started from now on. Sheets already started keep the prices they began with.</p>

      <section className="form">
        <h2>Ticket types</h2>
        {settings.ticketTypes.map((t, i) => (
          <div key={t.id} className="card form">
            <div className="form-grid">
              <Field label="Name">
                <input type="text" value={t.name} onChange={(e) => setType(i, { name: e.target.value })} />
              </Field>
              <Field label="Price">
                <MoneyInput value={t.priceCents} onChange={(v) => setType(i, { priceCents: v ?? 0 })} />
              </Field>
              {STATION_IDS.map((station) => (
                <Field key={station} label={`Colour at ${STATIONS[station].name}`}>
                  <input type="text" value={t.colours[station]} onChange={(e) => setType(i, { colours: { ...t.colours, [station]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <Field label="Description">
              <input type="text" value={t.note} onChange={(e) => setType(i, { note: e.target.value })} />
            </Field>
            <div className="actions">
              <button
                type="button"
                className="btn icon"
                aria-label={`Move ${t.name} up`}
                disabled={i === 0}
                onClick={() => {
                  const types = [...settings.ticketTypes]
                  ;[types[i - 1], types[i]] = [types[i], types[i - 1]]
                  setSettings({ ...settings, ticketTypes: types })
                }}
              >
                ↑
              </button>
              <span className="spacer" />
              <button
                type="button"
                className="btn danger"
                onClick={() => setSettings({ ...settings, ticketTypes: settings.ticketTypes.filter((_, j) => j !== i) })}
              >
                Remove ticket type
              </button>
            </div>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setSettings({
                ...settings,
                ticketTypes: [...settings.ticketTypes, { id: newId('ticket'), name: '', priceCents: 0, note: '', colours: { victoria: '', playground: '' } }],
              })
            }
          >
            + Add ticket type
          </button>
        </div>
      </section>

      <section className="form">
        <h2>Float: {formatMoney(floatTotal(settings.float))}</h2>
        <table className="count-table">
          <thead>
            <tr>
              <th>Note / coin</th>
              <th>Per bag</th>
              <th>Bags</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {settings.float.map((f, i) => (
              <tr key={i}>
                <td>
                  <select
                    aria-label="Denomination"
                    value={f.denominationCents}
                    onChange={(e) => setFloat(i, { denominationCents: Number(e.target.value) })}
                  >
                    {DENOMINATIONS.map((d) => (
                      <option key={d.cents} value={d.cents}>
                        {formatDenomination(d.cents)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <WholeInput aria-label="Quantity per bag" value={f.perBag} onChange={(v) => setFloat(i, { perBag: v ?? 0 })} />
                </td>
                <td>
                  <WholeInput aria-label="Number of bags" value={f.bags} onChange={(v) => setFloat(i, { bags: v ?? 0 })} />
                </td>
                <td className="num">{formatMoney(f.denominationCents * f.perBag * f.bags)}</td>
                <td>
                  <button
                    type="button"
                    className="btn icon danger"
                    aria-label={`Remove ${formatDenomination(f.denominationCents)} from float`}
                    onClick={() => setSettings({ ...settings, float: settings.float.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const unused = DENOMINATIONS.find((d) => !settings.float.some((f) => f.denominationCents === d.cents))
              if (unused) setSettings({ ...settings, float: [...settings.float, { denominationCents: unused.cents, perBag: 0, bags: 1 }] })
            }}
          >
            + Add denomination
          </button>
        </div>
      </section>

      {problems.length > 0 && <div className="notice error">{[...new Set(problems)].join(' ')}</div>}
      <ErrorNotice error={error} />
      <div className="actions sticky-actions">
        <button type="button" className="btn primary" disabled={!changed || problems.length > 0} onClick={save}>
          {changed ? 'Save changes' : 'Saved'}
        </button>
        {changed && (
          <button type="button" className="btn" onClick={() => setSettings(saved)}>
            Undo changes
          </button>
        )}
      </div>
    </div>
  )
}
