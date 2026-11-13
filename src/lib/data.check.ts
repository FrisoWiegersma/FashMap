// Run with `npm run check`. Throws on the first failing assertion.
import { applyFilters, byCentury, byDate, clusterByPixels, groupByPlace, histogram, inPeriod, countryName, flag, flagColours, mercator, options, shiftWindow, snapToEnd, type Garment } from './data.ts'
import garmentsData from '../data/garments.json' with { type: 'json' }

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

// Clustering: close dots merge, far dots stay apart, biggest anchors the group.
const groups = clusterByPixels([
  { id: 'small', x: 105, y: 100, count: 1 },
  { id: 'big', x: 100, y: 100, count: 9 },
  { id: 'far', x: 400, y: 400, count: 2 },
])
check(groups.length === 2, 'two groups')
check(groups[0][0].id === 'big' && groups[0][1].id === 'small', 'big anchors, small joins')

// Filters: empty list means all; lists combine with AND across fields, OR within a field.
const pool = [g('A', 1900, 1910, 'skirt', 'M1'), g('A', 1900, 1910, 'bodice', 'M2'), g('B', 1900, 1910, 'skirt', 'M2')]
check(applyFilters(pool, { types: [], museums: [] }).length === 3, 'no filters keeps all')
check(applyFilters(pool, { types: ['skirt'], museums: [] }).length === 2, 'type filter')
check(applyFilters(pool, { types: ['skirt', 'bodice'], museums: ['M2'] }).length === 2, 'OR within, AND across')
check(JSON.stringify(options(pool, 'type')) === '[{"value":"bodice","count":1},{"value":"skirt","count":2}]', 'options sorted with counts')

// Histogram: a range counts in every bin it overlaps.
const bins = histogram([g('A', 1890, 1910)], 25, 1850, 1949)
check(bins.length === 4 && bins.map((b) => b.count).join() === '0,1,1,0', 'histogram overlap')

// Centuries: sorted by start, grouped by the century a garment starts in.
const cs = byCentury([g('A', 1950, 1960), g('B', 1899, 1910), g('C', 1800, 1850)])
check(cs.map((c) => `${c.century}:${c.garments.length}`).join() === '1800:2,1900:1', 'century groups')
check(cs[0].garments[0].start === 1800, 'sorted by start')

// Timeline junctions join matching dates; overlapping ranges and different end years remain separate.
const dates = byDate([g('A', 1967, 1967), g('B', 1950, 1970), g('C', 1967, 1967), g('D', 1950, 1960)])
check(dates.map((d) => `${d.start}:${d.end}:${d.garments.length}`).join() === '1950:1960:1,1950:1970:1,1967:1967:2', 'shared date junctions, sorted by start and end')
check(byDate([]).length === 0 && dates.reduce((n, d) => n + d.garments.length, 0) === 4, 'date groups keep every garment and handle an empty collection')

// Play through time: the window keeps its width, moves in whole years and stops exactly at the end.
check(shiftWindow([1500, 1550], 12.7, 2026).join() === '1512,1562', 'play moves whole years')
check(shiftWindow([1970, 2020], 40, 2026).join() === '1976,2026', 'play stops at the end')

// The slider's last 5-year step (2025 when it's 2026) means now; earlier steps stay as they are.
check(snapToEnd(2025, 5, 2026) === 2026 && snapToEnd(2020, 5, 2026) === 2020 && snapToEnd(2030, 5, 2030) === 2030, 'slider reaches now')
check(countryName('NL') === 'Netherlands' && countryName('') === '', 'country names, no throw on an empty code')

// Mercator: the null island sits in the middle of the world; north is up (smaller y).
const mid = mercator(0, 0, 0)
check(Math.abs(mid.x - 256) < 1e-9 && Math.abs(mid.y - 256) < 1e-9, 'mercator centre')
check(mercator(0, 52, 3).y < mercator(0, 0, 3).y, 'mercator north is up')

check(flag('NL') === '🇳🇱' && flag('gb') === '🇬🇧' && flag('') === '', 'flag emoji from a country code')

// Every country in the data has flag colours for its garment page.
for (const code of new Set((garmentsData as Garment[]).map((x) => x.country))) check(!!flagColours(code), `flag colours for ${code}`)

console.log('data checks passed')
