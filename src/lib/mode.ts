// Practice mode keeps a completely separate database, so people can try the app without
// creating real records. The choice is remembered on this device only.

export type AppMode = 'live' | 'practice'

const KEY = 'pnesr-mode'

export function getMode(): AppMode {
  try {
    return localStorage.getItem(KEY) === 'practice' ? 'practice' : 'live'
  } catch {
    return 'live'
  }
}

/** Switches mode and reloads, so every screen starts again on the other database. */
export function switchMode(mode: AppMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Storage blocked: stays in live mode.
  }
  location.reload()
}

export const databaseName = (mode: AppMode) => (mode === 'practice' ? 'pnesr-practice' : 'pnesr')

const RESET_KEY = 'pnesr-reset-practice'

/** Wipes the practice database on the next load (it can't be deleted while this page has it open). */
export function requestPracticeReset() {
  try {
    localStorage.setItem(RESET_KEY, '1')
  } catch {
    return
  }
  location.reload()
}

/** True once, straight after a reset was requested. */
export function takePracticeReset(): boolean {
  try {
    const requested = localStorage.getItem(RESET_KEY) === '1'
    localStorage.removeItem(RESET_KEY)
    return requested
  } catch {
    return false
  }
}
