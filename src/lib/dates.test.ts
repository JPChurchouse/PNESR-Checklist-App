import { describe, expect, it } from 'vitest'
import { formatDateTime, formatTime, localDate } from './dates'

describe('dates', () => {
  it('uses ISO 8601 style in local time', () => {
    const d = new Date(2026, 8, 7, 9, 5)
    expect(localDate(d)).toBe('2026-09-07')
    expect(formatTime(d.toISOString())).toBe('09:05')
    expect(formatDateTime(d.toISOString())).toBe('2026-09-07 09:05')
  })
})
