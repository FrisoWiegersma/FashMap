import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { GridView } from '@/components/GridView'
import { ObjectPanel } from '@/components/ObjectPanel'
import { Timeline } from '@/components/Timeline'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import garmentsData from '@/data/garments.json'
import { groupByPlace, MAX_YEAR, MIN_YEAR, type Garment, type Period } from '@/lib/data'
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
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [garmentId, setGarmentId] = useState<string | null>(null)
  const mapRef = useRef<MapRef>(null)

  // Everything below is derived from the state above, so every view updates in the same render.
  const places = useMemo(() => groupByPlace(garments, period), [period])
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
          <Timeline period={period} onChange={setPeriod} garments={garments} total={garments.length} panelOpen={!!garment} />
        </div>

        <AnimatePresence>
          {view === 'grid' && (
            <motion.div key="grid" className="absolute inset-0 z-[1100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <GridView garments={garments} selectedId={garmentId ?? undefined} onSelect={setGarmentId} panelOpen={!!garment} />
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
