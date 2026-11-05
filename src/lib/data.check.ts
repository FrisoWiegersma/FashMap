// Run with `npm run check`. Throws on the first failing assertion.
import { applyFilters, clusterByPixels, groupByPlace, inPeriod, mercator, options, type Garment } from './data.ts'

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

// Mercator: the null island sits in the middle of the world; north is up (smaller y).
const mid = mercator(0, 0, 0)
check(Math.abs(mid.x - 256) < 1e-9 && Math.abs(mid.y - 256) < 1e-9, 'mercator centre')
check(mercator(0, 52, 3).y < mercator(0, 0, 3).y, 'mercator north is up')

console.log('data checks passed')
