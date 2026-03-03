export function toId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function parsePrice(price: string | null): number | null {
  if (!price) return null
  const num = parseFloat(price.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

export const LOCATION_CONFIG: Record<string, { display: string; code: string }> = {
  'w-military': { display: 'W Military Dr', code: 'CR3' },
  'sw-military': { display: 'SW Military Dr', code: 'CR2' },
}
