// crypto.randomUUID() only exists on HTTPS or localhost, and the app may be served over
// plain HTTP from a local server, so build IDs from getRandomValues (available everywhere).
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}
