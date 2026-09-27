/** Saves a file to the device's downloads. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

/** Can this device hand a file to other apps (email, messages, Drive…)? */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'test.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

/**
 * Opens the device's share sheet with the file attached, so it can be emailed or messaged.
 * Returns 'unsupported' where sharing files isn't available (most desktop browsers).
 */
export async function shareFile(blob: Blob, filename: string, text: { title: string; body: string }): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type })
  if (!canShareFiles() || !navigator.canShare({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file], title: text.title, text: text.body })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    throw err
  }
}
