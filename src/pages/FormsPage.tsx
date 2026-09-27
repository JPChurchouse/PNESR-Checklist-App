import { STATION_IDS, STATIONS, type SheetKind, type StationId } from '../domain/tickets'
import { useMode } from '../lib/modeContext'
import { useRepository } from '../storage/hooks'
import { PdfActions, type MadePdf } from '../ui/PdfActions'

export function FormsPage() {
  const repo = useRepository()
  const practice = useMode() === 'practice'

  async function safetyCheck(): Promise<MadePdf> {
    const { buildBlankSafetyCheckPdf } = await import('../pdf/blankForms')
    return { blob: buildBlankSafetyCheckPdf({ practice }).output('blob'), filename: 'blank-safety-check.pdf', subject: 'Blank safety check form' }
  }

  async function ticketSheet(station: StationId, kind: SheetKind): Promise<MadePdf> {
    const { buildBlankTicketSheetPdf } = await import('../pdf/blankForms')
    const settings = await repo.getTicketSettings()
    const what = `${STATIONS[station].name}${kind === 'event' ? ' special event' : ''} ticket sheet`
    return {
      blob: buildBlankTicketSheetPdf(settings, station, kind, { practice }).output('blob'),
      filename: `blank-tickets-${station}${kind === 'event' ? '-event' : ''}.pdf`,
      subject: `Blank ${what} form`,
    }
  }

  const forms: [title: string, description: string, make: () => Promise<MadePdf>][] = [
    ['Pre-operation safety check', 'Track checks, then a tick grid for each of up to three trains, and sign-off.', safetyCheck],
    ...STATION_IDS.map((s): [string, string, () => Promise<MadePdf>] => [
      `${STATIONS[s].name} ticket sheet`,
      'Ticket numbers, float ticks, cash count, EFTPOS, reconciliation and sign-off, with this station’s ticket colours.',
      () => ticketSheet(s, 'regular'),
    ]),
    ...STATION_IDS.map((s): [string, string, () => Promise<MadePdf>] => [
      `${STATIONS[s].name} special event sheet`,
      'The same, for special runs using event tickets only.',
      () => ticketSheet(s, 'event'),
    ]),
  ]

  return (
    <div className="form">
      <h1>Printable forms</h1>
      <p>
        Blank paper versions of the forms, for when a device is flat, lost or broken. They follow the same checklist, ticket prices,
        colours and float as the app, so they stay in step when settings change. Print a few to keep in the ticket office.
      </p>
      <div className="grid">
        {forms.map(([title, description, make]) => (
          <div key={title} className="card form">
            <div>
              <h2>{title}</h2>
              <p className="meta">{description}</p>
            </div>
            <PdfActions make={make} primary={false} />
          </div>
        ))}
      </div>
    </div>
  )
}
