import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { Filters } from '@/components/Filters'
import { GridView } from '@/components/GridView'
import { ObjectPanel } from '@/components/ObjectPanel'
import { Timeline } from '@/components/Timeline'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import garmentsData from '@/data/garments.json'
import { applyFilters, groupByPlace, MAX_YEAR, MIN_YEAR, NO_FILTERS, type Filters as FilterState, type Garment, type Period } from '@/lib/data'
import { PANEL_SPACE } from '@/lib/utils'

// MapLibre is ~1 MB, so the map loads as its own chunk while the header and timeline paint.
const MapView = lazy(() => import('@/components/MapView'))

const garments = garmentsData as Garment[]
type View = 'map' | 'grid'

const isDesktop = () => window.innerWidth >= 768

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Explorer />
    </MotionConfig>
  )
}

function Explorer() {
  const [view, setView] = useState<View>('map')
  const [period, setPeriod] = useState<Period>([MIN_YEAR, MAX_YEAR])
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [garmentId, setGarmentId] = useState<string | null>(null)
  const mapRef = useRef<MapRef>(null)

  // Everything below is derived from the state above, so every view updates in the same render.
  const filtered = useMemo(() => applyFilters(garments, filters), [filters])
  const places = useMemo(() => groupByPlace(filtered, period), [filtered, period])
  const garment = garments.find((g) => g.id === garmentId) ?? null

  const closeGarment = () => setGarmentId(null)

  // Esc closes the innermost thing first: the panel, then the place list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (garmentId) closeGarment()
      else if (placeName) setPlaceName(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const showPlace = (g: Garment) => {
    setPlaceName(g.place)
    // On a phone the panel covers the map, so step back to the map.
    if (!isDesktop()) closeGarment()
    const map = mapRef.current
    map?.flyTo({ center: [g.lng, g.lat], zoom: Math.max(map.getZoom(), 10), offset: [isDesktop() ? -PANEL_SPACE / 2 : 0, 60], duration: 1400, essential: true })
  }

  return (
    <div className="relative h-svh overflow-hidden bg-background">
      {/* Floating chrome over a full-bleed map. The right side stays free for the object panel. */}
      <header className="pointer-events-none absolute top-4 left-4 z-[1200] flex items-center gap-2">
        <div className="pointer-events-auto flex h-12 items-baseline gap-3 rounded-full bg-white/85 px-5 pt-[11px] shadow-float ring-1 ring-black/5 backdrop-blur-md max-sm:px-4">
          <h1 className="font-heading text-[22px] leading-none font-medium tracking-[-0.02em] text-foreground">FashMap</h1>
          <p className="hidden text-[13px] text-muted-foreground lg:block">Cultural dress across place and time</p>
        </div>
        <div className="pointer-events-auto">
          <ContinuousTabs
            label="View"
            tabs={[
              { id: 'map', label: 'Map' },
              { id: 'grid', label: 'Grid' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <div className="pointer-events-auto">
          <Filters garments={garments} value={filters} onChange={setFilters} shown={filtered.length} />
        </div>
      </header>

      <main className={garment ? 'fm-panel-open' : undefined}>
        {/* The map stays mounted under the grid, so switching back keeps zoom and position. */}
        <div className="absolute inset-0" inert={view === 'grid'}>
          <Suspense fallback={<div className="absolute inset-0 bg-[#F4F4F5]" />}>
            <MapView
              places={places}
              period={period}
              selectedPlace={placeName}
              onSelectPlace={setPlaceName}
              onClosePlace={() => setPlaceName(null)}
              selectedGarment={view === 'map' ? garment : null}
              onSelectGarment={setGarmentId}
              mapRef={mapRef}
            />
          </Suspense>
          <AnimatePresence>
            {places.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="absolute top-1/3 left-1/2 z-[1000] w-[min(340px,calc(100%-2rem))] -translate-x-1/2 rounded-[18px] bg-white/90 px-6 py-5 text-center shadow-float ring-1 ring-black/5 backdrop-blur-md"
              >
                <p className="font-heading text-xl text-foreground">No garments match</p>
                <p className="mt-1 text-sm text-muted-foreground">Remove a filter to put the dots back.</p>
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-[scale,background-color] hover:bg-zinc-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <Timeline period={period} onChange={setPeriod} garments={filtered} total={garments.length} panelOpen={!!garment} />
        </div>

        <AnimatePresence>
          {view === 'grid' && (
            <motion.div key="grid" className="absolute inset-0 z-[1100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <GridView garments={filtered} selectedId={garmentId ?? undefined} onSelect={setGarmentId} panelOpen={!!garment} onClearFilters={() => setFilters(NO_FILTERS)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {garment && <ObjectPanel key="panel" garment={garment} onClose={closeGarment} onShowPlace={view === 'map' ? showPlace : undefined} />}
        </AnimatePresence>
      </main>
    </div>
  )
}
