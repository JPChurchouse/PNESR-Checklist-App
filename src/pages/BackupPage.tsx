import { useState } from 'react'
import { backupFilename, backupSummary, parseBackup, type Backup } from '../domain/backup'
import { formatDateTime } from '../lib/dates'
import { canShareFiles, downloadBlob, shareFile } from '../lib/files'
import { lastBackupAt, recordBackup } from '../lib/backupReminder'
import { useMode } from '../lib/modeContext'
import { useRepository } from '../storage/hooks'
import { ErrorNotice } from '../ui/components'

export function BackupPage() {
  const repo = useRepository()
  const mode = useMode()
  const [pending, setPending] = useState<Backup>()
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<unknown>(null)
  const [last, setLast] = useState(() => lastBackupAt(mode))
  const [busy, setBusy] = useState(false)

  async function makeBackup(): Promise<{ blob: Blob; backup: Backup }> {
    const backup: Backup = { app: 'pnesr', version: 1, exportedAt: new Date().toISOString(), mode, ...(await repo.exportAll()) }
    return { backup, blob: new Blob([JSON.stringify(backup)], { type: 'application/json' }) }
  }

  async function save(how: 'download' | 'share') {
    setError(null)
    setMessage(undefined)
    setBusy(true)
    try {
      const { backup, blob } = await makeBackup()
      const name = backupFilename(backup)
      if (how === 'share') {
        const result = await shareFile(blob, name, { title: 'Railway app backup', body: `Backup of the railway app, ${formatDateTime(backup.exportedAt)}.` })
        if (result === 'cancelled') return
        if (result === 'unsupported') downloadBlob(blob, name)
      } else downloadBlob(blob, name)
      recordBackup(mode, backup.exportedAt)
      setLast(backup.exportedAt)
      setMessage(`Backup saved: ${backupSummary(backup)}. Keep the file somewhere off this device (email it to yourself, or save it to Google Drive).`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setMessage(undefined)
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setError(err)
    }
  }

  async function restore() {
    setBusy(true)
    try {
      // A copy of what's here now, in case the wrong file was chosen.
      const { backup: current, blob } = await makeBackup()
      downloadBlob(blob, backupFilename(current).replace('.json', '-before-restore.json'))
      const { app: _app, version: _version, exportedAt: _exportedAt, mode: _mode, ...contents } = pending!
      await repo.restoreAll(contents)
      setMessage(`Restored the backup from ${formatDateTime(pending!.exportedAt)}: ${backupSummary(pending!)}.`)
      setPending(undefined)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form">
      <div className="page-head">
        <h1>Backup and restore</h1>
      </div>
      <p>
        Everything in this app is stored on this device only. If it's lost, broken or reset, the records go with it, apart from PDFs
        already sent on. Back up after each running day and keep the file somewhere else.
      </p>
      <p className="meta">Last backup{mode === 'practice' ? ' of practice data' : ''}: {last ? formatDateTime(last) : 'never'}</p>

      <section className="card form">
        <h2>Back up</h2>
        <p className="meta">One file with every safety check, ticket sheet, the fleet, ticket settings and the staff list (including phone numbers).</p>
        <div className="actions">
          {canShareFiles() && (
            <button type="button" className="btn primary" disabled={busy} onClick={() => save('share')}>
              Back up and share…
            </button>
          )}
          <button type="button" className={`btn ${canShareFiles() ? '' : 'primary'}`} disabled={busy} onClick={() => save('download')}>
            Download backup file
          </button>
        </div>
      </section>

      <section className="card form">
        <h2>Restore</h2>
        <p className="meta">Replaces everything on this device with the contents of a backup file, e.g. when setting up a new tablet.</p>
        <div>
          <label className="btn">
            Choose backup file…
            <input type="file" accept=".json,application/json" hidden onChange={(e) => (readFile(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
        </div>
        {pending && (
          <div className="notice warning form">
            <strong>
              Restore the backup from {formatDateTime(pending.exportedAt)}
              {pending.mode === 'practice' ? ' (practice data)' : ''}?
            </strong>
            <span>It contains {backupSummary(pending)}.</span>
            <span>
              Everything currently on this device will be replaced. A copy of it is downloaded first, just in case.
              {pending.mode !== mode && (
                <strong>
                  {' '}
                  This backup is from {pending.mode === 'practice' ? 'practice mode' : 'real records'}, but you're in{' '}
                  {mode === 'practice' ? 'practice mode' : 'live mode'}.
                </strong>
              )}
            </span>
            <div className="actions">
              <button type="button" className="btn primary" disabled={busy} onClick={restore}>
                Replace everything with this backup
              </button>
              <button type="button" className="btn" onClick={() => setPending(undefined)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {message && <div className="notice ok">{message}</div>}
      <ErrorNotice error={error} />
    </div>
  )
}
