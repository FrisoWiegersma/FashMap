// Run with `npm run check`. Throws on the first failing assertion.
import { groupByPlace, inPeriod, type Garment } from './data.ts'

function check(ok: boolean, msg: string) {
  if (!ok) throw new Error(`check failed: ${msg}`)
}

const g = (place: string, start: number, end: number, type = 'skirt', museum = 'M1') =>
  ({ place, start, end, type, museum, country: 'NL', lat: 0, lng: 0, model: null }) as Garment

// Period overlap: a garment counts when its range touches the period at all.
check(inPeriod(g('A', 1890, 1910), [1900, 1950]), 'overlap at start')
check(inPeriod(g('A', 1890, 1910), [1800, 1890]), 'touches at edge')
check(!inPeriod(g('A', 1890, 1910), [1911, 2000]), 'after the range')
check(!inPeriod(g('A', 1890, 1910), [1500, 1889]), 'before the range')
check(inPeriod(g('A', 1800, 1899), [1850, 1850]), 'single year inside a century')

// Grouping: one place per name, sorted by size, garments sorted by start, inPeriod counted.
const places = groupByPlace([g('A', 1900, 1910), g('B', 1700, 1799), g('A', 1600, 1699)], [1650, 1750])
check(places.length === 2 && places[0].name === 'A', 'grouped and sorted by size')
check(places[0].garments[0].start === 1600, 'garments sorted by start')
check(places[0].inPeriod === 1 && places[1].inPeriod === 1, 'inPeriod counted')

console.log('data checks passed')
