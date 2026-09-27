// All money is held as whole cents, so totals never pick up floating-point rounding errors.

export type Cents = number

/** "$1,234.50", or "-$3.00" for negatives. */
export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Short form for denominations: "10c", "$2", "$100". */
export function formatDenomination(cents: Cents): string {
  return cents < 100 ? `${cents}c` : `$${cents / 100}`
}

/**
 * Parses what someone types into a money box: "12", "12.5", "$12.50", "1,200".
 * Returns null for blank input and NaN for anything that isn't a valid amount.
 */
export function parseMoney(text: string): Cents | null {
  const cleaned = text.replace(/[\s$,]/g, '')
  if (!cleaned) return null
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === '.') return NaN
  const [dollars, fraction = ''] = cleaned.split('.')
  return Number(dollars || 0) * 100 + Number(fraction.padEnd(2, '0'))
}

/** For showing a stored amount back in an input box: "12.50", or "" when empty. */
export const moneyInputValue = (cents: Cents | null) => (cents === null ? '' : (cents / 100).toFixed(2))

/** Parses a whole-number count or serial number; null for blank, NaN for invalid. */
export function parseWhole(text: string): number | null {
  const cleaned = text.trim()
  if (!cleaned) return null
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN
}
