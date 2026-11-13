// Pure data helpers. No imports from the app, so `npm run check` can run this file directly with node.

export type Garment = {
  id: string
  title: string
  museum: string
  type: string
  dateLabel: string
  start: number
  end: number
  place: string
  country: string
  lat: number
  lng: number
  description: string
  objectNumber: string | null
  maker: string | null
  materials: string[]
  techniques: string[]
  rights: string | null
  image: string | null
  thumbnail: string | null
  model: string | null
  source: string | null
  micrio: string | null // Micrio id of a 360° photo spin (Modemuze objects), shown instead of a 3D model
}

export type Period = [from: number, to: number]

export type Filters = { types: string[]; museums: string[] }
export const NO_FILTERS: Filters = { types: [], museums: [] }

export type Place = {
  name: string
  country: string
  lat: number
  lng: number
  garments: Garment[] // sorted by start year
  inPeriod: number
}

export const MIN_YEAR = 1500
export const MAX_YEAR = new Date().getFullYear()

export const inPeriod = (g: Garment, [from, to]: Period) => g.start <= to && g.end >= from

/** Where a year sits on the 1500–now axis, in percent. The slider, its bars, the open-garment band and the place strips share it. */
export const yearPct = (year: number) => ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100

/**
 * The slider steps 5 years from 1500, so its last step is 2025, not the current year: without this the right thumb could
 * never return to "now", Reset stayed up over the full range, and Play stopped at once. A year in the last step is now.
 */
export const snapToEnd = (year: number, step: number, max = MAX_YEAR) => (year > max - step ? max : year)

/** "Play through time": the window `start` moved `years` later, in whole years, stopping when it reaches `max`. */
export function shiftWindow([from, to]: Period, years: number, max = MAX_YEAR): Period {
  const shift = Math.min(Math.floor(years), max - to)
  return [from + shift, to + shift]
}

/** An empty list means "everything" for that filter. */
export const applyFilters = (garments: Garment[], f: Filters) =>
  garments.filter((g) => (!f.types.length || f.types.includes(g.type)) && (!f.museums.length || f.museums.includes(g.museum)))

export const filterCount = (f: Filters) => f.types.length + f.museums.length

/** Distinct values of a field with their counts, sorted by name. */
export function options(garments: Garment[], key: 'type' | 'museum') {
  const counts = new Map<string, number>()
  for (const g of garments) counts.set(g[key], (counts.get(g[key]) ?? 0) + 1)
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, count }))
}

/** Garments per bin of `size` years. A garment counts in every bin its range overlaps. */
export function histogram(garments: Garment[], size = 25, min = MIN_YEAR, max = MAX_YEAR) {
  const bins: { from: number; to: number; count: number }[] = []
  for (let from = min; from <= max; from += size) bins.push({ from, to: Math.min(from + size - 1, max), count: 0 })
  for (const g of garments) for (const b of bins) if (inPeriod(g, [b.from, b.to])) b.count++
  return bins
}

/** Garments sorted by start year, grouped by the century they start in (1899 is in the 1800s). */
export function byCentury(garments: Garment[]) {
  const groups: { century: number; garments: Garment[] }[] = []
  for (const g of [...garments].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const century = Math.floor(g.start / 100) * 100
    if (groups.at(-1)?.century !== century) groups.push({ century, garments: [] })
    groups.at(-1)!.garments.push(g)
  }
  return groups
}

/** A shared timeline junction means the same museum date range, rather than a possible overlap. */
export function byDate(garments: Garment[]) {
  const groups: { start: number; end: number; garments: Garment[] }[] = []
  for (const g of [...garments].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = groups.at(-1)
    if (last?.start === g.start && last.end === g.end) last.garments.push(g)
    else groups.push({ start: g.start, end: g.end, garments: [g] })
  }
  return groups
}

export function groupByPlace(garments: Garment[], period: Period): Place[] {
  const byName = new Map<string, Place>()
  for (const g of garments) {
    let p = byName.get(g.place)
    if (!p) {
      p = { name: g.place, country: g.country, lat: g.lat, lng: g.lng, garments: [], inPeriod: 0 }
      byName.set(g.place, p)
    }
    p.garments.push(g)
    if (inPeriod(g, period)) p.inPeriod++
  }
  for (const p of byName.values()) p.garments.sort((a, b) => a.start - b.start)
  return [...byName.values()].sort((a, b) => b.garments.length - a.garments.length)
}

/** Dot radius in px. Area grows with the count. */
export const dotRadius = (count: number) => (count === 0 ? 6 : Math.min(34, 5 + 4 * Math.sqrt(count)))

/** Web Mercator world pixels at a zoom level (512 px tiles, as MapLibre uses). Pure, so clustering doesn't need the map. */
export function mercator(lng: number, lat: number, zoom: number) {
  const size = 512 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size }
}

/**
 * Greedy clustering in screen pixels: a place joins the first group whose dot it would overlap.
 * Input is sorted by size, so the biggest place anchors each group.
 */
// ponytail: O(n²) scan, fine below ~1000 places; switch to supercluster if the data grows past that.
export function clusterByPixels<T extends { x: number; y: number; count: number }>(items: T[], gap = 6): T[][] {
  const groups: { x: number; y: number; count: number; members: T[] }[] = []
  for (const item of [...items].sort((a, b) => b.count - a.count)) {
    const hit = groups.find(
      (g) => Math.hypot(g.x - item.x, g.y - item.y) < dotRadius(g.count) + dotRadius(item.count) + gap,
    )
    if (hit) {
      hit.members.push(item)
      hit.count += item.count
    } else {
      groups.push({ x: item.x, y: item.y, count: item.count, members: [item] })
    }
  }
  return groups.map((g) => g.members)
}

const regions = new Intl.DisplayNames(['en'], { type: 'region' })
export const countryName = (code: string) => {
  try {
    return regions.of(code) ?? code
  } catch {
    return code // Intl throws on an empty or malformed code
  }
}

// ponytail: a flag emoji from two regional-indicator letters. Windows has no flag glyphs and shows "NL" instead; use flag-icons SVGs if that matters.
export const flag = (code: string) => (/^[a-z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '')

// ponytail: hand-picked from each flag's spec for the 22 countries in the data. A new country gets no rule; add a row.
// The flag's colours in order, for the stripe rule on a garment page.
const FLAG_COLOURS: Record<string, string[]> = {
  AF: ['#000000', '#D32011', '#007A36'],
  BE: ['#000000', '#FDDA24', '#EF3340'],
  CA: ['#D80621', '#FFFFFF', '#D80621'],
  CH: ['#DA291C', '#FFFFFF'],
  DE: ['#000000', '#DD0000', '#FFCE00'],
  FR: ['#0055A4', '#FFFFFF', '#EF4135'],
  GB: ['#012169', '#FFFFFF', '#C8102E'],
  ID: ['#CE1126', '#FFFFFF'],
  IN: ['#FF9933', '#FFFFFF', '#138808'],
  IT: ['#009246', '#FFFFFF', '#CE2B37'],
  JP: ['#FFFFFF', '#BC002D', '#FFFFFF'],
  KR: ['#CD2E3A', '#FFFFFF', '#0047A0'],
  MA: ['#C1272D', '#006233', '#C1272D'],
  NL: ['#AE1C28', '#FFFFFF', '#21468B'],
  NO: ['#BA0C2F', '#FFFFFF', '#00205B'],
  PK: ['#FFFFFF', '#01411C', '#01411C'],
  SE: ['#006AA7', '#FECC00', '#006AA7'],
  SR: ['#377E3F', '#FFFFFF', '#B40A2D', '#FFFFFF', '#377E3F'],
  SY: ['#007A3D', '#FFFFFF', '#000000'],
  TR: ['#E30A17', '#FFFFFF', '#E30A17'],
  US: ['#B22234', '#FFFFFF', '#3C3B6E'],
  ZA: ['#E03C31', '#007749', '#001489'],
}
export const flagColours = (code: string) => FLAG_COLOURS[code.toUpperCase()] ?? null

/** Resolve a data path (relative to public/) or pass an absolute URL through. */
export const assetUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${import.meta.env.BASE_URL}${path}`)

/** Whether the garment has something to turn: a Modemuze 360° spin or its own 3D model. */
export const has3d = (g: Garment) => !!(g.micrio || g.model)

export const yearRange = (g: Garment) => (g.start === g.end ? `${g.start}` : `${g.start}–${g.end}`)

/** The detail rows of a garment, in the order the panel and the compare view show them. Unknown values are null. */
export function garmentFields(g: Garment): [label: string, value: string | null][] {
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : null)
  return [
    ['Date', g.dateLabel === yearRange(g) ? g.dateLabel : `${g.dateLabel} (${yearRange(g)})`],
    ['Place', g.place === countryName(g.country) ? g.place : `${g.place}, ${countryName(g.country)}`],
    ['Museum', g.museum],
    ['Object number', g.objectNumber],
    ['Type', g.type[0].toUpperCase() + g.type.slice(1)],
    ['Maker', g.maker],
    ['Material', list(g.materials)],
    ['Technique', list(g.techniques)],
    ['Rights', g.rights],
  ]
}
