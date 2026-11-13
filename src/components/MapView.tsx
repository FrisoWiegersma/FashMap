import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import NumberFlow from '@number-flow/react'
import { Info, Maximize, Minus, Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Map, { AttributionControl, Marker, Popup, useMap, type MapRef } from 'react-map-gl/maplibre'
import { DateSpan } from '@/components/DateSpan'
import { GarmentImage } from '@/components/GarmentImage'
import { clusterByPixels, countryName, dotRadius, flag, inPeriod, mercator, type Garment, type Period, type Place } from '@/lib/data'
import garments from '@/data/garments.json'
import { cn, isDesktop, PANEL_SPACE } from '@/lib/utils'

// This module is loaded lazily (MapLibre is ~1 MB), so the header and timeline paint first.
// MapLibre looks for its worker next to its own module, which breaks once Vite bundles it. Point it at the file.
maplibregl.setWorkerUrl(maplibreWorker)

const TIMELINE_SPACE = 230
const HEADER_SPACE = 80

/** How a place dot looks. The map key draws the same classes, so it can't drift from the map. */
const DOT = {
  live: 'bg-primary text-white shadow-[0_0_0_2px_#fff,0_4px_14px_-2px_rgb(45_91_255/0.5)]',
  empty: 'border-[1.5px] border-zinc-400 bg-white/85',
  halo: 'pointer-events-none absolute -inset-[5px] rounded-full border',
  haloLive: 'border-primary/40',
  haloEmpty: 'border-zinc-400/60',
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

// OpenFreeMap: open-source vector tiles from OpenStreetMap data. No API key, no usage limits. Its TileJSON carries the attribution.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const HIDDEN = /^(airport|label_other|highway-name|highway-shield|road_shield|waterway_line_label|water_name)/
const ENGLISH = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]

type StyleJson = { layers: { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }[] }

/** Recolour Positron to the FashMap neutrals and calm the labels, so the cobalt dots are the only colour on the map. */
function recolour(style: StyleJson) {
  const land = '#F4F4F5'
  for (const l of style.layers) {
    const p = (l.paint ??= {})
    const layout = (l.layout ??= {})
    if (HIDDEN.test(l.id)) layout.visibility = 'none'
    else if (l.id.startsWith('label_')) layout['text-field'] = ENGLISH
    if (l.id === 'background') p['background-color'] = land
    else if (l.id === 'water') p['fill-color'] = '#E1E4EA'
    else if (l.id === 'waterway') p['line-color'] = '#E1E4EA'
    else if (['park', 'landuse_residential', 'landcover_wood', 'building'].includes(l.id)) p['fill-color'] = '#EDEDF0'
    else if (l.id.startsWith('boundary')) p['line-color'] = '#CDCDD3'
    else if (l.type === 'symbol' && 'text-color' in p) {
      p['text-color'] = l.id.startsWith('label_country') ? '#71717A' : '#8E8E96'
      p['text-halo-color'] = land
      p['text-halo-width'] = 1.2
    }
  }
  return style as unknown as StyleSpecification
}

type Bounds = [number, number, number, number]
const boundsOf = (ps: { lng: number; lat: number }[]): Bounds => {
  const lngs = ps.map((p) => p.lng)
  const lats = ps.map((p) => p.lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}
const fitPadding = () => ({ top: HEADER_SPACE + 60, left: 60, right: 60, bottom: TIMELINE_SPACE })
// Scales with the screen: on a phone, desktop padding is wider than the map and MapLibre refuses to fit.
// Every garment's place, filtered or not: the first fit and "Show all places" use it. Filters never move the camera, and
// with filters set before this lazy chunk arrived, the filtered set could be narrow or empty (empty bounds crash MapLibre).
const ALL_BOUNDS = boundsOf(garments)

const groupPadding = () => {
  const x = Math.min(140, window.innerWidth * 0.18)
  return { top: Math.min(180, window.innerHeight * 0.2), bottom: Math.min(TIMELINE_SPACE + 40, window.innerHeight * 0.35), left: x, right: x }
}

type Props = {
  places: Place[]
  period: Period
  selectedPlace: string | null
  onSelectPlace: (name: string) => void
  onClosePlace: () => void
  selectedGarment: Garment | null
  onSelectGarment: (id: string) => void
  mapRef: RefObject<MapRef | null>
}

export default function MapView({ places, period, selectedPlace, onSelectPlace, onClosePlace, selectedGarment, onSelectGarment, mapRef }: Props) {
  const [style, setStyle] = useState<StyleSpecification>()
  useEffect(() => {
    // ponytail: no fallback if the style can't load; the map stays grey. Add an OSM raster style as fallback if that bites.
    fetch(STYLE_URL)
      .then((r) => r.json())
      .then((s: StyleJson) => setStyle(recolour(s)))
  }, [])

  const place = places.find((p) => p.name === selectedPlace)

  return (
    <div className="absolute inset-0 bg-[#F4F4F5]">
      {style && (
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={style}
          initialViewState={{ bounds: ALL_BOUNDS, fitBoundsOptions: { padding: fitPadding() } }}
          style={{ position: 'absolute', inset: 0 }}
          minZoom={0.5}
          maxZoom={15}
          dragRotate={false}
          pitchWithRotate={false}
          touchPitch={false}
          attributionControl={false}
          onLoad={(e) => {
            e.target.touchZoomRotate.disableRotation()
            e.target.keyboard.disableRotation()
          }}
          onClick={onClosePlace}
        >
          <AttributionControl position="bottom-right" compact={false} customAttribution='Garments: <a href="https://www.modemuze.nl" target="_blank" rel="noreferrer">Modemuze</a>' />
          <Dots places={places} selectedPlace={selectedPlace} onSelectPlace={onSelectPlace} />
          <KeepInView garment={selectedGarment} />
          {place && (
            <Popup
              key={place.name}
              longitude={place.lng}
              latitude={place.lat}
              anchor="bottom"
              offset={dotRadius(place.inPeriod) + 8}
              closeButton={false}
              closeOnClick={false}
              closeOnMove={false}
              focusAfterOpen={false}
              maxWidth="none"
              className="fm-popup"
            >
              <PlaceList place={place} period={period} selectedId={selectedGarment?.id} onSelect={onSelectGarment} onClose={onClosePlace} />
              <PopupInView panelOpen={!!selectedGarment} />
            </Popup>
          )}
        </Map>
      )}
      <ZoomControls mapRef={mapRef} bounds={ALL_BOUNDS} />
    </div>
  )
}

/** Dots, grouped when they would overlap. Groups are recomputed per half zoom level, so they split while you zoom. */
function Dots({ places, selectedPlace, onSelectPlace }: Pick<Props, 'places' | 'selectedPlace' | 'onSelectPlace'>) {
  const { current: map } = useMap()
  const [zoomStep, setZoomStep] = useState(() => Math.floor((map?.getZoom() ?? 2) * 2) / 2)

  useEffect(() => {
    if (!map) return
    const onZoom = () => setZoomStep(Math.floor(map.getZoom() * 2) / 2)
    map.on('zoom', onZoom)
    return () => {
      map.off('zoom', onZoom)
    }
  }, [map])

  // The grouping depends on where places are and how many garments each holds, never on the period. So the slider and
  // Play (25 changes a second) don't regroup; the groups are only refilled with the current places for their counts.
  const layout = places.map((p) => `${p.name}:${p.garments.length}`).join('|')
  const named = useMemo(
    () => clusterByPixels(places.map((place) => ({ place, count: place.garments.length, ...mercator(place.lng, place.lat, zoomStep) }))).map((g) => g.map((m) => m.place.name)),
    [layout, zoomStep], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const byName = new globalThis.Map(places.map((p) => [p.name, p]))
  const groups = named.map((g) => g.map((name) => byName.get(name)!))

  // Where each place was drawn in the previous grouping, so a dot that splits off a group flies out from the old group dot.
  // Kept in state and updated during render (React's "previous props" pattern), so new dots see it on their first render.
  const [prev, setPrev] = useState({ named, groups, anchors: new globalThis.Map<string, [number, number]>(), first: true })
  if (prev.named !== named) setPrev({ named, groups, anchors: anchorsOf(prev.groups), first: false })

  return groups.map((members, i) => {
    const anchor = members[0]
    const from = prev.anchors.get(anchor.name)
    return (
      <Dot
        key={members.map((p) => p.name).join('|')}
        members={members}
        intro={prev.first ? 0.2 + Math.min(i, 14) * 0.045 : null}
        splitFrom={from && (from[0] !== anchor.lng || from[1] !== anchor.lat) ? from : undefined}
        selected={members.some((p) => p.name === selectedPlace)}
        onActivate={() => {
          if (members.length === 1) return onSelectPlace(anchor.name)
          map?.fitBounds(boundsOf(members), { padding: groupPadding(), maxZoom: 11, duration: 1100, easing: ease, essential: true })
        }}
      />
    )
  })
}

const anchorsOf = (groups: Place[][]) => new globalThis.Map(groups.flatMap((g) => g.map((p) => [p.name, [g[0].lng, g[0].lat] as [number, number]] as const)))

type DotProps = { members: Place[]; intro: number | null; splitFrom?: [number, number]; selected: boolean; onActivate: () => void }

function Dot({ members, intro, splitFrom, selected, onActivate }: DotProps) {
  const { current: map } = useMap()
  const anchor = members[0]
  const total = members.reduce((n, p) => n + p.garments.length, 0)
  const live = members.reduce((n, p) => n + p.inPeriod, 0)
  const size = dotRadius(live) * 2
  const isGroup = members.length > 1
  const names = isGroup
    ? members.length > 3
      ? `${members.slice(0, 2).map((p) => p.name).join(', ')} and ${members.length - 2} more places`
      : `${members.slice(0, -1).map((p) => p.name).join(', ')} and ${members.at(-1)!.name}`
    : anchor.name
  const countText = live === total ? `${total} ${total === 1 ? 'garment' : 'garments'}` : `${live} of ${total} garments in this period`
  // Near the top edge the tooltip opens below the dot, so the header doesn't cover it.
  const [below, setBelow] = useState(false)
  const measure = (e: { currentTarget: Element }) => setBelow(e.currentTarget.getBoundingClientRect().top < HEADER_SPACE + 90)

  // Entrance: the first paint pops the dots in one by one; a dot split off a group springs out from the group's old spot.
  const [initial] = useState(() => {
    if (intro !== null) return { x: 0, y: 0, scale: 0, opacity: 0 }
    if (!splitFrom || !map) return { x: 0, y: 0, scale: 0.6, opacity: 0 }
    const a = map.project([anchor.lng, anchor.lat])
    const b = map.project(splitFrom)
    return { x: b.x - a.x, y: b.y - a.y, scale: 0.7, opacity: 0.5 }
  })

  return (
    <Marker
      longitude={anchor.lng}
      latitude={anchor.lat}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation()
        onActivate()
      }}
    >
      <motion.div
        className="relative"
        initial={initial}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: intro ?? 0 }}
      >
        <motion.button
          type="button"
          aria-label={`${names}, ${countText}${isGroup ? '. Zoom in to see each place.' : ''}`}
          aria-pressed={isGroup ? undefined : selected}
          onPointerEnter={measure}
          onFocus={measure}
          initial={{ width: size, height: size }}
          animate={{ width: size, height: size }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={cn(
            'peer relative grid cursor-pointer place-items-center rounded-full transition-[background-color,border-color,box-shadow,scale] duration-200 ease-out outline-none hover:scale-[1.08] active:scale-95 focus-visible:ring-[3px] focus-visible:ring-foreground',
            live ? DOT.live : DOT.empty,
          )}
        >
          {/* A group gets a thin halo, so "several places" reads by shape as well as by the count. */}
          {isGroup && <span className={cn(DOT.halo, live ? DOT.haloLive : DOT.haloEmpty)} />}
          <span
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-foreground transition-[opacity,scale] duration-200 ease-out',
              isGroup ? '-inset-[9px]' : '-inset-[5px]',
              selected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
            )}
          />
          {live > 1 && (
            <span className="font-heading text-[13px] leading-none font-medium tabular-nums">
              <NumberFlow value={live} />
            </span>
          )}
        </motion.button>
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[10px] bg-foreground px-3 py-2 text-left whitespace-nowrap opacity-0 shadow-float transition-[opacity,translate] duration-150 ease-out peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100',
            below ? 'top-full mt-3 -translate-y-1' : 'bottom-full mb-3 translate-y-1',
          )}
        >
          <span className="block font-heading text-[15px] leading-tight text-white">{names}</span>
          <span className="block text-xs text-white/65">
            {isGroup ? (
              `${countText}. Click to zoom in.`
            ) : (
              <>
                <span aria-hidden>{flag(anchor.country)} </span>
                {countryName(anchor.country)}, {countText}
              </>
            )}
          </span>
        </span>
      </motion.div>
    </Marker>
  )
}

/** Ease the map so the open garment's place isn't hidden behind the panel or the timeline. */
function KeepInView({ garment }: { garment: Garment | null }) {
  const { current: map } = useMap()
  useEffect(() => {
    // Not while the camera moves: panBy would stop a fly-to in progress, such as the panel's Place link.
    if (!garment || !map || !isDesktop() || map.isMoving()) return
    const p = map.project([garment.lng, garment.lat])
    const { width, height } = map.getContainer().getBoundingClientRect()
    const right = width - PANEL_SPACE - 170 // room for the place list (300 px, centred on the dot), so the panel doesn't cover it
    const bottom = height - TIMELINE_SPACE
    const dx = p.x > right ? p.x - right : p.x < 60 ? p.x - 60 : 0
    const dy = p.y > bottom ? p.y - bottom : 0
    if (dx || dy) map.panBy([dx, dy], { duration: 700, easing: ease })
  }, [garment, map])
  return null
}

/** Pan so a freshly opened place list fits on screen, clear of the header, the timeline and the panel. */
function PopupInView({ panelOpen }: { panelOpen: boolean }) {
  const { current: map } = useMap()
  const ref = useRef<HTMLSpanElement>(null)
  // Only on open: following every resize would fight the user's own panning. One frame later, so the popup is in the DOM.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const popup = ref.current?.closest('.maplibregl-popup')
      if (!map || !popup || map.isMoving()) return // the fly-to that opened it already frames it
      const r = popup.getBoundingClientRect()
      const c = map.getContainer().getBoundingClientRect()
      const right = c.right - 16 - (panelOpen && isDesktop() ? PANEL_SPACE : 0)
      const dx = r.left < c.left + 16 ? r.left - c.left - 16 : r.right > right ? r.right - right : 0
      const dy = r.top < c.top + HEADER_SPACE ? r.top - c.top - HEADER_SPACE : 0
      if (dx || dy) map.panBy([dx, dy], { duration: 500, easing: ease })
    })
    return () => cancelAnimationFrame(id)
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} hidden />
}

function ZoomControls({ mapRef, bounds }: { mapRef: RefObject<MapRef | null>; bounds: Bounds }) {
  const [showKey, setShowKey] = useState(false)
  const surface = 'rounded-xl bg-white/90 shadow-float ring-1 ring-black/5 backdrop-blur-md'
  const btn =
    'grid size-10 place-items-center text-foreground transition-colors hover:bg-muted active:bg-zinc-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&_svg]:transition-transform active:[&_svg]:scale-90'
  // ponytail: desktop only, like the zoom buttons. Phones have no room for it and pinch to zoom.
  return (
    <div className="fm-map-controls absolute right-4 bottom-10 z-[1000] hidden flex-col items-end gap-2 md:flex">
      {/* A disclosure, not a popover: it stays open while you read the map, and the button closes it. */}
      <AnimatePresence>
        {showKey && (
          <motion.div
            id="fm-map-key"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className="absolute right-0 bottom-full mb-2 w-[260px] rounded-[18px] bg-white/92 p-4 shadow-float ring-1 ring-black/5 backdrop-blur-md"
          >
            <h2 className="text-[13px] font-medium text-foreground">Map key</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] text-muted-foreground">
              <KeyRow count={1}>1 garment</KeyRow>
              <KeyRow count={3}>3 garments, bigger is more</KeyRow>
              <KeyRow count={0}>None in this period</KeyRow>
              <KeyRow count={1} group>
                Nearby places, click to zoom
              </KeyRow>
            </ul>
            <p className="mt-3.5 border-t border-black/5 pt-3 text-xs leading-relaxed text-muted-foreground">
              Garments from Dutch and Belgian museums, via{' '}
              <a href="https://www.modemuze.nl" target="_blank" rel="noreferrer" className="font-medium text-foreground underline decoration-black/20 underline-offset-2 hover:decoration-primary">
                Modemuze
              </a>
              .
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        className={cn(surface, btn, showKey && 'text-primary')}
        aria-label="Map key"
        title="Map key"
        aria-expanded={showKey}
        aria-controls="fm-map-key"
        onClick={() => setShowKey(!showKey)}
      >
        <Info className="size-4" />
      </button>
      <div className={cn(surface, 'flex flex-col overflow-hidden')}>
        <button type="button" className={btn} aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn({ duration: 400 })}>
          <Plus className="size-4" />
        </button>
        <button type="button" className={cn(btn, 'border-y border-border')} aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut({ duration: 400 })}>
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className={btn}
          aria-label="Show all places"
          title="Show all places"
          onClick={() => mapRef.current?.fitBounds(bounds, { padding: fitPadding(), duration: 1100, easing: ease })}
        >
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** One row of the map key: a dot drawn exactly as the map draws it for `count` garments. */
function KeyRow({ count, group, children }: { count: number; group?: boolean; children: string }) {
  const size = dotRadius(count) * 2
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center">
        <span className={cn('relative grid place-items-center rounded-full', count ? DOT.live : DOT.empty)} style={{ width: size, height: size }}>
          {group && <span className={cn(DOT.halo, DOT.haloLive)} />}
          {count > 1 && <span className="font-heading text-[13px] leading-none font-medium tabular-nums">{count}</span>}
        </span>
      </span>
      {children}
    </li>
  )
}

type PlaceListProps = { place: Place; period: Period; selectedId?: string; onSelect: (id: string) => void; onClose: () => void }

function PlaceList({ place, period, selectedId, onSelect, onClose }: PlaceListProps) {
  const n = place.garments.length
  const first = place.garments[0].start
  const last = Math.max(...place.garments.map((g) => g.end))
  return (
    <div className="w-[300px]">
      <div className="relative border-b border-border px-5 pt-4 pr-12 pb-3">
        <h2 className="font-heading text-[22px] leading-tight text-foreground">{place.name}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          <span aria-hidden>{flag(place.country)} </span>
          {countryName(place.country)}, {n} {n === 1 ? 'garment' : 'garments'}
          {n > 1 && <>, <span className="whitespace-nowrap">{first === last ? first : `${first}–${last}`}</span></>}
          {place.inPeriod < n && `, ${place.inPeriod} in this period`}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${place.name}`}
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="max-h-[336px] overflow-y-auto overscroll-contain p-2">
        {place.garments.map((g, i) => {
          const live = inPeriod(g, period)
          const active = g.id === selectedId
          return (
            <motion.li key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + Math.min(i, 8) * 0.035, duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
              <button
                type="button"
                onClick={() => onSelect(g.id)}
                aria-current={active || undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-[background-color,scale] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.985]',
                  active && 'bg-muted',
                )}
              >
                <span className={cn('h-12 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-black/5 transition-opacity', !live && 'opacity-45')}>
                  <span className="block size-full transition-transform duration-500 ease-out group-hover:scale-110">
                    <GarmentImage garment={g} size="thumb" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-medium text-foreground', !live && 'text-foreground/50')}>{g.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {g.dateLabel}
                      {!live && ', outside period'}
                    </span>
                    <DateSpan garment={g} />
                  </span>
                </span>
                <span className={cn('mr-1 size-1.5 shrink-0 rounded-full bg-primary transition-[opacity,scale] duration-200', active ? 'scale-100 opacity-100' : 'scale-0 opacity-0')} aria-hidden />
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
