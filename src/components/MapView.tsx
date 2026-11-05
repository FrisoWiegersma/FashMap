import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import NumberFlow from '@number-flow/react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type RefObject } from 'react'
import Map, { AttributionControl, Marker, type MapRef } from 'react-map-gl/maplibre'
import { dotRadius, type Place } from '@/lib/data'
import { cn } from '@/lib/utils'

// This module is loaded lazily (MapLibre is ~1 MB), so the header and timeline paint first.
// MapLibre looks for its worker next to its own module, which breaks once Vite bundles it. Point it at the file.
maplibregl.setWorkerUrl(maplibreWorker)

const TIMELINE_SPACE = 230
const HEADER_SPACE = 80
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

type Props = {
  places: Place[]
  mapRef: RefObject<MapRef | null>
}

export default function MapView({ places, mapRef }: Props) {
  const [style, setStyle] = useState<StyleSpecification>()
  useEffect(() => {
    // ponytail: no fallback if the style can't load; the map stays grey. Add an OSM raster style as fallback if that bites.
    fetch(STYLE_URL)
      .then((r) => r.json())
      .then((s: StyleJson) => setStyle(recolour(s)))
  }, [])

  // Fit to all places once, at load.
  const [allBounds] = useState(() => boundsOf(places))

  return (
    <div className="absolute inset-0 bg-[#F4F4F5]">
      {style && (
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={style}
          initialViewState={{ bounds: allBounds, fitBoundsOptions: { padding: fitPadding() } }}
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
        >
          <AttributionControl position="bottom-right" compact={false} />
          <Dots places={places} />
        </Map>
      )}
      <ZoomControls mapRef={mapRef} bounds={allBounds} />
    </div>
  )
}

/** One dot per place. The first paint pops them in one by one. */
function Dots({ places }: Pick<Props, 'places'>) {
  return places.map((place, i) => <Dot key={place.name} place={place} intro={0.2 + Math.min(i, 14) * 0.045} />)
}

type DotProps = { place: Place; intro: number }

function Dot({ place, intro }: DotProps) {
  const total = place.garments.length
  const live = place.inPeriod
  const size = dotRadius(live) * 2
  const countText = live === total ? `${total} ${total === 1 ? 'garment' : 'garments'}` : `${live} of ${total} garments in this period`
  // Near the top edge the tooltip opens below the dot, so the header doesn't cover it.
  const [below, setBelow] = useState(false)
  const measure = (e: { currentTarget: Element }) => setBelow(e.currentTarget.getBoundingClientRect().top < HEADER_SPACE + 90)

  return (
    <Marker longitude={place.lng} latitude={place.lat} anchor="center">
      <motion.div
        className="relative"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: intro }}
      >
        <motion.button
          type="button"
          aria-label={`${place.name}, ${countText}`}
          onPointerEnter={measure}
          onFocus={measure}
          initial={{ width: size, height: size }}
          animate={{ width: size, height: size }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={cn(
            'peer relative grid cursor-pointer place-items-center rounded-full transition-[background-color,border-color,box-shadow,scale] duration-200 ease-out outline-none hover:scale-[1.08] active:scale-95 focus-visible:ring-[3px] focus-visible:ring-foreground',
            live ? 'bg-primary text-white shadow-[0_0_0_2px_#fff,0_4px_14px_-2px_rgb(45_91_255/0.5)]' : 'border-[1.5px] border-zinc-400 bg-white/85',
          )}
        >
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
          <span className="block font-heading text-[15px] leading-tight text-white">{place.name}</span>
          <span className="block text-xs text-white/65">{countText}</span>
        </span>
      </motion.div>
    </Marker>
  )
}

function ZoomControls({ mapRef, bounds }: { mapRef: RefObject<MapRef | null>; bounds: Bounds }) {
  const btn =
    'grid size-10 place-items-center text-foreground transition-colors hover:bg-muted active:bg-zinc-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&_svg]:transition-transform active:[&_svg]:scale-90'
  return (
    <div className="fm-map-controls absolute right-4 bottom-10 z-[1000] hidden flex-col overflow-hidden rounded-xl bg-white/90 shadow-float ring-1 ring-black/5 backdrop-blur-md md:flex">
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
  )
}
