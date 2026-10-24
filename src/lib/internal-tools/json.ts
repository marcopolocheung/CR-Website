/** Canonical JSON makes object-key order irrelevant and rejects lossy JSON coercion. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>()
  function encode(input: unknown): string {
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return JSON.stringify(input)
    if (typeof input === 'number' && Number.isFinite(input)) return JSON.stringify(input)
    if (!input || typeof input !== 'object' || seen.has(input)) throw new Error('invalid_json')
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw new Error('invalid_json')
    seen.add(input)
    try {
      if (Array.isArray(input)) {
        // Sparse arrays and undefined must not turn into apparently measured nulls.
        return '[' + Array.from({ length: input.length }, (_, index) => encode(input[index])).join(',') + ']'
      }
      return '{' + Object.keys(input).sort().map(key => JSON.stringify(key) + ':' + encode((input as Record<string, unknown>)[key])).join(',') + '}'
    } finally { seen.delete(input) }
  }
  return encode(value)
}
