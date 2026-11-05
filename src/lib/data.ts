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
