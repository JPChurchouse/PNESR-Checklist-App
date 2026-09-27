import type { AppMode } from './mode'

// When this device last made a backup, so the home screen can nudge people to do it.

const key = (mode: AppMode) => `pnesr-last-backup-${mode}`

export function lastBackupAt(mode: AppMode): string | null {
  try {
    return localStorage.getItem(key(mode))
  } catch {
    return null
  }
}

export function recordBackup(mode: AppMode, at: string) {
  try {
    localStorage.setItem(key(mode), at)
  } catch {
    // Storage blocked: the reminder just keeps showing.
  }
}

export const BACKUP_REMINDER_DAYS = 7

export function backupOverdue(mode: AppMode, now = new Date()): boolean {
  const last = lastBackupAt(mode)
  return !last || now.getTime() - new Date(last).getTime() > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
