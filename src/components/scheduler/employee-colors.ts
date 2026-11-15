// Choose perceptually separated colors across the available hue/lightness range.
// Every swatch supports white assignment text; colors are never shared by two IDs.
function linear(value: number) {
  const s = value / 255
  return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4
}
function channels(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }
function readable(hex: string) {
  const [r, g, b] = channels(hex).map(linear)
  return 1.05 / (.2126 * r + .7152 * g + .0722 * b + .05) >= 5.5
}
function hsl(hue: number, saturation: number, lightness: number) {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const h = hue / 60, x = c * (1 - Math.abs(h % 2 - 1)), m = lightness - c / 2
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}
function lab(hex: string) {
  const [r, g, b] = channels(hex).map(linear)
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b)
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b)
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
  return [.2104542553 * l + .793617785 * m - .0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .808675766 * s]
}
function makePalette() {
  const pool = new Set<string>()
  for (let hue = 0; hue < 360; hue += 12) {
    for (const saturation of [.45, .7, .95]) {
      for (const lightness of [.24, .32, .4, .48]) {
        const color = hsl(hue, saturation, lightness)
        if (readable(color)) pool.add(color)
      }
    }
  }
  pool.delete('#2457c5')
  const remaining = [...pool].map(color => ({ color, lab: lab(color), distance: Infinity }))
  const palette = ['#2457c5']
  while (remaining.length) {
    const last = lab(palette[palette.length - 1])
    for (const candidate of remaining) {
      candidate.distance = Math.min(candidate.distance, candidate.lab.reduce((sum, v, i) => sum + (v - last[i]) ** 2, 0))
    }
    let farthest = 0
    for (let i = 1; i < remaining.length; i++) if (remaining[i].distance > remaining[farthest].distance) farthest = i
    palette.push(remaining.splice(farthest, 1)[0].color)
  }
  return palette
}

export const EMPLOYEE_PALETTE: readonly string[] = makePalette()

/** Retain issued colors across moves, filters, staff changes and week navigation. */
export function employeeColorsFor(ids: string[], previous: ReadonlyMap<string, string> = new Map()): Map<string, string> {
  const colors = new Map(previous), used = new Set(previous.values())
  let next = 0, extra = 0
  for (const id of [...new Set(ids)].sort()) {
    if (colors.has(id)) continue
    while (next < EMPLOYEE_PALETTE.length && used.has(EMPLOYEE_PALETTE[next])) next++
    let color = EMPLOYEE_PALETTE[next++]
    // Extra identities beyond the base palette still receive an unused color.
    if (!color) do {
      color = hsl((extra * 137.508) % 360, .55 + (extra % 3) * .15, .25 + (Math.floor(extra++ / 3) % 20) * .01)
    } while (used.has(color) || !readable(color))
    colors.set(id, color); used.add(color)
  }
  return colors
}
