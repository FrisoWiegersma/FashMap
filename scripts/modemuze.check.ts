// Run with `npm run check`. Throws on the first failing assertion.
import { makerName, parseDating, placeName } from './modemuze.ts'

function check(ok: boolean, msg: string) {
  if (!ok) throw new Error(`check failed: ${msg}`)
}
const date = (s: string) => JSON.stringify(parseDating(s))

check(date('1700-1799') === '{"start":1700,"end":1799,"label":"1700–1799"}', 'plain range')
check(date('ca. 1953') === '{"start":1943,"end":1963,"label":"ca. 1953"}', 'ca. widens by ten')
check(date('Ca.1910') === '{"start":1900,"end":1920,"label":"ca. 1910"}', 'ca. without a space')
check(date('2009') === '{"start":2009,"end":2009,"label":"2009"}', 'one year')
check(date('19de eeuw') === '{"start":1800,"end":1899,"label":"19th century"}', 'century')
check(date('Midden 20ste eeuw') === '{"start":1933,"end":1966,"label":"mid 20th century"}', 'mid century')
check(date('Eerste helft 20e eeuw') === '{"start":1900,"end":1949,"label":"first half of the 20th century"}', 'first half')
check(date('ca. 1680 - ca. 1688') === '{"start":1680,"end":1688,"label":"ca. 1680–1688"}', 'ca. range')
check(date('ca. 1820 / 1824') === '{"start":1820,"end":1824,"label":"ca. 1820–1824"}', 'slash range')
check(date('1766 (vermaakt ca. 1890)') === '{"start":1766,"end":1766,"label":"1766"}', 'note in brackets dropped')
check(date('Ontwerp 1937/1938 (Uitvoering 2003)') === '{"start":1937,"end":1938,"label":"1937–1938"}', 'design date')
check(parseDating('onbekend') === null, 'no date')

check(placeName('Brescia (Italië), Nederland') === 'Brescia', 'first place, country dropped')
check(placeName('Nederland (Arnhem)') === 'Arnhem', 'town inside the country')
check(placeName('Parijs, Frankrijk') === 'Paris', 'translated')
check(placeName('Kutch, Gujarat (India)') === 'Kutch', 'first of a list')

check(makerName(['Herpen, Iris van']) === 'Iris van Herpen', 'surname first flipped')
check(makerName(['Dior (modehuis), John Galliano (ontwerper)']) === 'Dior, John Galliano', 'roles dropped, not flipped')
check(makerName(['J. Campbell, Latham & Co.']) === 'J. Campbell, Latham & Co.', 'firm names kept')
check(makerName(['Anoniem']) === 'Anonymous' && makerName(undefined) === null, 'anonymous and missing')

console.log('modemuze checks passed')
