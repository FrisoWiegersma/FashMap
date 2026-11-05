// Build src/data/garments.json from the Modemuze 360° objects.
//   node scripts/modemuze.ts <raw.json>
// Step 1 (only when <raw.json> doesn't exist yet): fetch every object page and geocode its place. The raw file holds
// Modemuze's Dutch texts, so keep it out of the repo.
// Step 2: turn the raw objects into records. Facts come from Modemuze; English titles, types and short summaries come
// from scripts/modemuze-en.json, written by hand, so no museum text is copied. Photos and spins stay on Micrio.
// Polite to both sites: one request at a time, and Nominatim at most once a second, as its usage policy asks.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://modemuze.nl'
const UA = 'FashMap course prototype (Leiden University, HCI & IV)'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Geo = { lat: number; lng: number; country: string } | null
type Raw = { slug: string; micrio: string; title: string; text: string; tags: Record<string, string[]>; placeQuery?: string; geo?: Geo }

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function get(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

/** The labelled tag lists in the object sidebar ("Objectnummer", "Materiaal", ...), as label -> values. */
export function parseTags(html: string) {
  const tags: Record<string, string[]> = {}
  for (const block of html.split('<div  class="tags tags--360">').slice(1)) {
    const label = decode(block.match(/tags__title">([\s\S]*?)<\/h3>/)?.[1] ?? '')
    const values = [...block.matchAll(/class="tag tag--360"\s*>([\s\S]*?)<\/(?:span|a)>/g)].map((m) => decode(m[1]))
    const links = [...block.matchAll(/<a\s+href="([^"]+)"[^>]*class="tag tag--360"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
    if (label) tags[label] = label === 'Bekijk in de collectie' ? links : values
  }
  return tags
}

export function parseObject(html: string) {
  const info = html.slice(html.indexOf('three-sixty-sidebar__object_info'))
  return {
    micrio: html.match(/<micr-io id="([^"]+)"/)?.[1] ?? null,
    title: decode(info.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
    text: decode(info.match(/<\/h1>\s*([\s\S]*?)<div\s+class="likes">/)?.[1] ?? ''),
    tags: parseTags(html),
  }
}

/** First named place of a Locatie value: "Brescia (Italië), Nederland" -> "Brescia", "Nederland (Arnhem)" -> "Arnhem". */
const firstPlace = (locatie: string) => {
  const first = locatie.split(/,(?![^(]*\))|\//)[0].trim()
  const m = first.match(/^(.*?)\s*\((.*)\)$/)
  return m ? (/^(Nederland|Friesland)$/.test(m[1]) ? m[2] : m[1]) : first
}

async function geocode(q: string, cache: Record<string, Geo>) {
  if (q in cache) return cache[q]
  await sleep(1100)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`
  const [hit] = JSON.parse(await get(url)) as { lat: string; lon: string; address?: { country_code?: string } }[]
  cache[q] = hit ? { lat: +hit.lat, lng: +hit.lon, country: (hit.address?.country_code ?? '').toUpperCase() } : null
  return cache[q]
}

async function scrape(out: string) {
  const list = await get(`${SITE}/360-collection`)
  const slugs = [...new Set([...list.matchAll(/href="(?:https:\/\/modemuze\.nl)?\/([a-z0-9-]+)"/g)].map((m) => m[1]))]
  const objects: Raw[] = []
  for (const slug of slugs) {
    try {
      const o = parseObject(await get(`${SITE}/${slug}`))
      if (o.micrio) objects.push({ slug, ...o, micrio: o.micrio }) // pages without a spin are menu or blog links
      console.log(`${objects.length} ${slug}`)
    } catch (e) {
      console.warn(`skip ${slug}: ${(e as Error).message}`)
    }
    await sleep(300)
  }
  const cachePath = `${out}.places.json`
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  for (const o of objects) {
    const raw = o.tags['Locatie']?.[0]
    if (!raw) continue
    o.placeQuery = raw.split(/,(?![^(]*\))/)[0].trim().replace(/\s*\(([^)]+)\)/, ', $1')
    o.geo = await geocode(o.placeQuery, cache)
    writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  }
  writeFileSync(out, JSON.stringify(objects, null, 2))
}

// ---- Turning Dutch facts into records ----

const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`

/**
 * Modemuze "Datering" -> years and an English label. "ca." widens one year by ten each way (roadmap rule).
 * Notes in brackets are dropped: "1766 (vermaakt ca. 1890)" is dated 1766.
 */
export function parseDating(raw: string): { start: number; end: number; label: string } | null {
  const s = raw.replace(/\(.*?\)/g, '').trim().toLowerCase()
  const ca = /\b(ca\.?|circa)/.test(s)
  const century = s.match(/(\d{1,2})\s*(?:e|ste|de)\s+eeuw/)
  if (century) {
    const n = +century[1]
    const c = (n - 1) * 100
    const parts: [RegExp, number, number, string][] = [
      [/eerste helft/, 0, 49, 'first half of the '],
      [/tweede helft/, 50, 99, 'second half of the '],
      [/begin|vroeg/, 0, 25, 'early '],
      [/midden/, 33, 66, 'mid '],
      [/eind|laat/, 75, 99, 'late '],
    ]
    const [, from, to, word] = parts.find(([re]) => re.test(s)) ?? [null, 0, 99, '']
    return { start: c + from, end: c + to, label: `${word}${ordinal(n)} century` }
  }
  const years = [...s.matchAll(/\d{4}/g)].map((m) => +m[0])
  if (!years.length) return null
  if (years.length === 1) {
    const [y] = years
    return ca ? { start: y - 10, end: Math.min(y + 10, new Date().getFullYear()), label: `ca. ${y}` } : { start: y, end: y, label: `${y}` }
  }
  const [a, b] = [Math.min(...years), Math.max(...years)]
  return { start: a, end: b, label: `${ca ? 'ca. ' : ''}${a}–${b}` }
}

const EN_PLACE: Record<string, string> = {
  Nederland: 'Netherlands', 'Noord-Holland': 'North Holland', 'Noord-Brabant': 'North Brabant', 'West-Brabant': 'West Brabant',
  Duitsland: 'Germany', Italië: 'Italy', Frankrijk: 'France', Parijs: 'Paris', Londen: 'London', Brussel: 'Brussels',
  'Den Haag': 'The Hague', Genève: 'Geneva', Antwerpen: 'Antwerp', België: 'Belgium', Syrië: 'Syria',
  'Verenigde Staten': 'United States', Atlasgebergte: 'Atlas Mountains', Dehli: 'Delhi', Korea: 'South Korea',
  'Newfoundland en Labrador': 'Newfoundland and Labrador',
}
export const placeName = (locatie: string) => EN_PLACE[firstPlace(locatie)] ?? firstPlace(locatie)

const NL: [string, string, number, number] = ['Netherlands', 'NL', 52.24, 5.63]
const ZAAN: [string, string, number, number] = ['Zaan region', 'NL', 52.46, 4.81]
const PARIS: [string, string, number, number] = ['Paris', 'FR', 48.86, 2.35]
const FRANCE: [string, string, number, number] = ['France', 'FR', 46.6, 2.4]
/**
 * Places Modemuze leaves empty, that geocode wrongly, or where the text names a more exact place: [name, country, lat, lng].
 * "Netherlands" when the text ties the garment to Dutch wearers but names no town.
 */
const PLACES: Record<string, [string, string, number, number]> = {
  keurslijf: FRANCE, // "Frankrijk (toegeschreven)"
  'habit-la-francaise': FRANCE, // "Frankrijk (vermoedelijk)"
  'springpak-striptease-suit': ['United Kingdom', 'GB', 52.5, -1.5], // British SOE
  'rokkendracht-voor-jongen': ['Rouveen', 'NL', 52.62, 6.19],
  'kostuum-van-bas-kosters': ['Amsterdam', 'NL', 52.37, 4.89], // Amsterdam Fashion Week
  'ruitermantel-van-ernst-casimir': ['Roermond', 'NL', 51.19, 5.99], // the siege
  'tuniek-van-paco-rabanne': PARIS,
  'ceintuur-van-meret-oppenheim': PARIS, // Paris surrealists
  'halve-rouw-jurkje-van-prinses-wilhelmina': ['Gonten', 'CH', 47.33, 9.35],
  'oorijzer-uit-west-friesland': ['West Friesland', 'NL', 52.7, 5.0], // geocoded to the province Friesland
  'kostuum-van-een-zoeaaf': ['Rome', 'IT', 41.9, 12.5], // Papal States
  'ottomaanse-bruidsjurk': ['Ottoman Empire', 'TR', 41.01, 28.98], // "Azië"
  'ensemble-brabantse-werkdracht': ['North Brabant', 'NL', 51.6, 5.44], // "Brabant" geocoded to the US
  'duitse-kap': ['Black Forest', 'DE', 48.35, 8.07],
  'beatles-dress': ['Enschede', 'NL', 52.22, 6.89],
  'jumlo-jurk-uit-pakistan': ['Kohistan', 'PK', 35.25, 73.2],
  'maskeradekostuum-van-simon-van-gijn': ['Leiden', 'NL', 52.16, 4.49],
  'halssieraad-van-iradj-moini': ['New York', 'US', 40.71, -74.01],
  'jurk-cirkels-van-stina-randestad': ['Stockholm', 'SE', 59.33, 18.07],
  'mantelpak-met-hoed': ['Zürich', 'CH', 47.37, 8.54], // Seiden Grieder
  'middeleeuwse-trip': ['Dordrecht', 'NL', 51.81, 4.67], // excavation
  'goudgeborduurde-schoenen': ['Friesland', 'NL', 53.09, 5.78],
  'galafhofkostuum-van-de-opperjagermeester': NL,
  'zwarte-avondjurk': NL,
  'theater-jurk-gedragen-door-louisette-0': NL,
  'theater-jurk-gedragen-door-louisette': NL,
  'kostuum-gedragen-door-louisette': NL,
  herenkraammuts: NL,
  'molensteenkraag-der-fliegende-hollander-van-lioba-winterhalder': NL,
  'verkleedjapon-robe-langlaise': NL,
  'sitsen-rok': ZAAN,
  'mitaines-met-jak': ZAAN,
  bootjesketting: ZAAN,
  'roze-sitsen-jak': ZAAN,
}

// No place of origin on Modemuze or in the text, so they can't go on the map. Add them to PLACES once a place is known.
const NO_PLACE = ['wambuis-met-korte-schoot', 'gala-jas-rok', 'robe-la-francaise', 'dienstbodejapon', 'luifelhoed', 'robe-langlaise-retroussee', 'japon-met-kant', 'kaftan-van-yasmina-ajbilou']

const MAKERS: Record<string, string> = {
  'trouw-en-rouwensemble': 'Mme J. de Terlinge, Robes & Costumes Utrecht',
  'silhouet-van-jan-jan-van-essche': 'Jan-Jan Van Essche, Lamine Diouf',
  'koreaanse-bruidegom': 'Lee Young-ju (Greta Lee)',
  'doopjurk-van-parachute': "Mrs 't Jong",
}

/** "Herpen, Iris van" -> "Iris van Herpen"; roles and years in brackets go; Anoniem and onbekend become English. */
export function makerName(values: string[] | undefined) {
  if (!values?.length) return null
  const names = values.map((v) => {
    if (/^anoniem$/i.test(v)) return 'Anonymous'
    if (/^onbekend$/i.test(v)) return 'Unknown'
    const s = v.replace(/\s*[[(][^\])]*[\])]/g, '').trim()
    const m = !/[[(&]/.test(v) && s.match(/^([^,]+), ([^,]+)$/)
    return m ? `${m[2]} ${m[1]}` : s
  })
  return [...new Set(names)].join(', ')
}

const MATERIALS: Record<string, string> = {
  katoen: 'cotton', zijde: 'silk', wol: 'wool', linnen: 'linen', glas: 'glass', metaal: 'metal', leer: 'leather', leder: 'leather',
  tule: 'tulle', tulle: 'tulle', zilver: 'silver', kunststof: 'plastic', plastic: 'plastic', satijn: 'satin', fluweel: 'velvet',
  kant: 'lace', hout: 'wood', gouddraad: 'gold thread', textiel: 'textile', goud: 'gold', polyester: 'polyester',
  pailetten: 'sequins', pailletten: 'sequins', zilverdraad: 'silver thread', papier: 'paper', aluminium: 'aluminium',
  porselein: 'porcelain', verf: 'paint', vilt: 'felt', messing: 'brass', nylon: 'nylon', organza: 'organza',
  parelmoer: 'mother-of-pearl', goudgalon: 'gold braid', acryl: 'acrylic', glaskralen: 'glass beads', kunstzijde: 'rayon',
  stro: 'straw', strass: 'rhinestones', elastiek: 'elastic', mul: 'muslin', ijzer: 'iron', zilverbrokaat: 'silver brocade',
  walvisbalein: 'whalebone', baleinen: 'boning', synthetisch: 'synthetic fabric', koper: 'copper', bergkristal: 'rock crystal',
  'laken (materiaal)': 'broadcloth', 'metaaldraad (textiel) (geheel)': 'metal thread', 'roestvrij staal': 'stainless steel',
  taftzijde: 'silk taffeta', taf: 'taffeta', 'edelmetaal (metaal naar waarde) (geheel)': 'precious metal', edelsteen: 'gemstone',
  granaat: 'garnet', celluloid: 'celluloid', gitten: 'jet', passement: 'passementerie', 'doorgestopte tule': 'darned tulle',
  zink: 'zinc', karton: 'cardboard', verzilverd: 'silver plate', zilvergalon: 'silver braid', struisveer: 'ostrich feather',
  struisvogelveren: 'ostrich feather', hoedenstro: 'hat straw', brocaat: 'brocade', brokaat: 'brocade', kasjmir: 'cashmere',
  borduurwol: 'embroidery wool', 'gaze de soie': 'silk gauze', schapenleer: 'sheepskin', 'biologisch katoen': 'organic cotton',
  imitatieparel: 'imitation pearl', 'imitatie parels': 'imitation pearl', damast: 'damask', lurex: 'lurex', ripszijde: 'silk rep',
  sits: 'chintz', beits: 'wood stain', indigo: 'indigo', changeantzijde: 'shot silk', 'zijden crêpe': 'silk crêpe',
  'machinale kant': 'machine lace', 'versierde tule': 'decorated tulle', stijfsel: 'starch', bladgoud: 'gold leaf',
  wilgenhout: 'willow wood', fluweelband: 'velvet ribbon', borduurgaren: 'embroidery thread', lint: 'ribbon', band: 'ribbon',
  brons: 'bronze', paardenhaar: 'horsehair', swarovsky: 'Swarovski crystal', kralen: 'beads', plexiglas: 'Plexiglas',
  goudborduursel: 'gold embroidery', agaat: 'agate', bieslint: 'piping', folie: 'foil', lamé: 'lamé',
  parachutestof: 'parachute fabric', kristalglas: 'crystal glass', 'gekleurde stenen': 'coloured stones', 'moiré zijde': 'moiré silk',
  gaas: 'gauze', shantung: 'shantung', veren: 'feathers', 'mechelse kant': 'Mechlin lace', sierband: 'trim', lood: 'lead',
  chiffon: 'chiffon', 'crêpe de chine': 'crêpe de chine', touw: 'rope', 'dierlijk materiaal': 'animal material', jute: 'jute',
  pilo: 'pilo cotton', ribfluweel: 'corduroy', voeringzijde: 'lining silk', 'zijden damast': 'silk damask',
}

const TECHNIQUES: Record<string, string> = {
  borduren: 'embroidery', geborduurd: 'embroidery', geweven: 'weaving', geplooid: 'pleating', genaaid: 'sewing', naaien: 'sewing',
  handgenaaid: 'hand sewing', handnaaiwerk: 'hand sewing', 'genaaid (hand-)': 'hand sewing', sits: 'chintz', sitstechniek: 'chintz',
  gegraveerd: 'engraving', patchwork: 'patchwork', gevouwen: 'folding', vouwen: 'folding', applicatie: 'appliqué',
  appliceren: 'appliqué', 'appliqué (techniek)': 'appliqué', applicatieborduurwerk: 'appliqué embroidery', machinaal: 'machine-made',
  satijnsteek: 'satin stitch', stijven: 'starching', gesteven: 'starching', zagen: 'sawing', polijsten: 'polishing',
  bedrukt: 'printing', handgeborduurd: 'hand embroidery', gestikt: 'stitching', jacquardgeweven: 'jacquard weaving',
  filigrein: 'filigree', passement: 'passementerie', handgeweven: 'hand weaving', 'machinaal breiwerk': 'machine knitting',
  gevilt: 'felting', 'zaans stikwerk': 'Zaan quilting', doorstikken: 'quilting', handgebreid: 'hand knitting', breien: 'knitting',
  franje: 'fringing', goudborduurwerk: 'gold embroidery', gekantklost: 'bobbin lace', kloskant: 'bobbin lace', kantklossen: 'bobbin lace',
  getuft: 'tufting', handgeschilderd: 'hand painting', handbeschilderd: 'hand painting', 'geborduurd (steelsteek)': 'stem stitch',
  etsen: 'etching', moiré: 'moiré', lassen: 'welding', anodiseren: 'anodising', recycled: 'recycling', tatreez: 'tatreez',
  kralenborduurwerk: 'bead embroidery', cantille: 'cannetille', buigen: 'bending', satijnbinding: 'satin weave', vormen: 'shaping',
  brokaat: 'brocade', gesmeed: 'forging', gegranuleerd: 'granulation', bakken: 'firing', gebakken: 'firing', gewassen: 'washing',
  gedroogd: 'drying', bloemen: 'flower making', kunstbloemen: 'artificial flowers', draadopnaai: 'couching',
  'scheuren (techniek)': 'tearing', plakken: 'gluing', veiligheidsspeld: 'safety pins', verf: 'painting', geverfd: 'dyeing',
  geknoopt: 'knotting', gedraaid: 'twisting', 'papier-maché': 'papier-mâché', filmdruk: 'screen printing',
  'bedrukking katoen': 'cotton printing', katoendruk: 'cotton printing', gebrocheerd: 'brocading', spannen: 'stretching',
  tricot: 'tricot', gevlochten: 'braiding', rijgen: 'lacing', slijpen: 'grinding', tule: 'tulle', bandstro: 'straw braid',
  'machinaal kant': 'machine lace', geslagen: 'beating', lasersnijden: 'laser cutting', 'valenciennes kant': 'Valenciennes lace',
  handgemaakt: 'handmade', 'ikat (kasuri) cloth': 'ikat (kasuri)', haken: 'crochet', kruissteek: 'cross stitch',
  'machinaal geweven': 'machine weaving', 'ingeweven patroon': 'woven pattern', 'applied mirror (shisha work)': 'shisha mirror work',
  'chain stitch': 'chain stitch', 'interlacing stitch': 'interlacing stitch',
}

const translate = (values: string[] | undefined, dict: Record<string, string>, slug: string) => [
  ...new Set(
    (values ?? []).map((v) => {
      const en = dict[v.toLowerCase()]
      if (!en) console.warn(`${slug}: no English for "${v}"`)
      return en ?? v
    }),
  ),
]

const iiif = (id: string, width: number) => `https://iiif.micr.io/${id}/full/${width},/0/default.jpg`

function build(objects: Raw[], en: Record<string, [type: string, title: string, description: string]>) {
  const records = []
  for (const o of objects) {
    if (NO_PLACE.includes(o.slug)) continue
    const t = o.tags
    const text = en[o.slug]
    if (!text) throw new Error(`${o.slug}: add a title, type and summary to scripts/modemuze-en.json`)
    const date = parseDating(t['Datering']?.[0] ?? '')
    if (!date) throw new Error(`${o.slug}: can't read the date "${t['Datering']?.[0]}"`)
    const place = PLACES[o.slug] ?? (o.geo && t['Locatie']?.[0] ? [placeName(t['Locatie'][0]), o.geo.country, o.geo.lat, o.geo.lng] : null)
    if (!place) throw new Error(`${o.slug}: no place; add it to PLACES or NO_PLACE`)
    const [type, title, description] = text
    records.push({
      id: o.slug,
      title,
      museum: t['Instelling']?.[0] ?? 'Unknown museum',
      type,
      dateLabel: date.label,
      start: date.start,
      end: date.end,
      place: place[0],
      country: place[1],
      lat: +place[2].toFixed(4),
      lng: +place[3].toFixed(4),
      description,
      objectNumber: t['Objectnummer']?.[0] ?? null,
      maker: MAKERS[o.slug] ?? makerName(t['Maker']),
      materials: translate(t['Materiaal'], MATERIALS, o.slug),
      techniques: translate(t['Techniek'], TECHNIQUES, o.slug),
      rights: t['Beeldrecht']?.[0] ? 'In copyright' : null,
      image: iiif(o.micrio, 1200),
      thumbnail: iiif(o.micrio, 480),
      model: null,
      source: `${SITE}/${o.slug}`,
      micrio: o.micrio,
    })
  }
  // One dot per place: every record of a place uses the first one's coordinates.
  const first = new Map<string, { lat: number; lng: number }>()
  for (const r of records) {
    const p = first.get(r.place) ?? { lat: r.lat, lng: r.lng }
    first.set(r.place, p)
    Object.assign(r, p)
  }
  return records
}

async function main() {
  const raw = process.argv[2] ?? 'modemuze-raw.json'
  if (!existsSync(raw)) await scrape(raw)
  const objects = JSON.parse(readFileSync(raw, 'utf8')) as Raw[]
  const en = JSON.parse(readFileSync(new URL('./modemuze-en.json', import.meta.url), 'utf8'))
  const records = build(objects, en)
  writeFileSync(new URL('../src/data/garments.json', import.meta.url), JSON.stringify(records, null, 2) + '\n')
  console.log(`wrote ${records.length} garments (${NO_PLACE.length} left out without a place)`)
}

if (import.meta.main) await main()
