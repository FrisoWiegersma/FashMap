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
export const countryName = (code: string) => regions.of(code) ?? code

/** Resolve a data path (relative to public/) or pass an absolute URL through. */
export const assetUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${import.meta.env.BASE_URL}${path}`)

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
