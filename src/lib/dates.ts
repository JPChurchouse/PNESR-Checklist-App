// Everything shown to people uses ISO 8601 style in the device's local time:
// dates as 2026-09-28, times as 17:48 (24-hour), timestamps as 2026-09-28 17:48.

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date on this device, as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A stored YYYY-MM-DD date, for display. */
export const formatDate = (isoDate: string) => isoDate

/** "17:48" in the device's time zone. */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-09-28 17:48" in the device's time zone. */
export const formatDateTime = (iso: string) => `${localDate(new Date(iso))} ${formatTime(iso)}`
