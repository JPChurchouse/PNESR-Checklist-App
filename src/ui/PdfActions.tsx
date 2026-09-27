import { useState } from 'react'
import { downloadBlob, shareFile } from '../lib/files'
import { ErrorNotice } from './components'

export interface MadePdf {
  blob: Blob
  filename: string
  /** Subject line when shared or emailed, e.g. "Safety check 2026-09-28". */
  subject: string
}

/**
 * Download and Share buttons for a finished record. Sharing opens the device's share sheet
 * (email, messages, Drive…) with the PDF attached. Where that isn't available, the PDF is
 * downloaded and an email is started so it can be attached.
 */
export function PdfActions({ make, primary = true }: { make: () => Promise<MadePdf>; primary?: boolean }) {
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: (pdf: MadePdf) => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(undefined)
    try {
      await action(await make())
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const share = (pdf: MadePdf) =>
    shareFile(pdf.blob, pdf.filename, { title: pdf.subject, body: `${pdf.subject} (PDF attached).` }).then((result) => {
      if (result !== 'unsupported') return
      downloadBlob(pdf.blob, pdf.filename)
      location.href = `mailto:?subject=${encodeURIComponent(pdf.subject)}&body=${encodeURIComponent(`${pdf.subject} is attached.`)}`
      setMessage(`This device can't attach files to email directly, so ${pdf.filename} was downloaded. Attach it to the email that just opened.`)
    })

  return (
    <span className="pdf-actions">
      <span className="actions">
        <button type="button" className={`btn ${primary ? 'primary' : ''}`} disabled={busy} onClick={() => run(async (pdf) => downloadBlob(pdf.blob, pdf.filename))}>
          Download PDF
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => run(share)}>
          Share / email…
        </button>
      </span>
      {message && <span className="meta">{message}</span>}
      <ErrorNotice error={error} />
    </span>
  )
}
