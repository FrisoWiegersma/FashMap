import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import brandSymbol from '@/assets/brand/fashmap-symbol.png'
import { AdminPage } from '@/components/AdminPage'
import { CompareView } from '@/components/CompareView'
import { Filters } from '@/components/Filters'
import { GridView } from '@/components/GridView'
import { ObjectPanel } from '@/components/ObjectPanel'
import { Timeline } from '@/components/Timeline'
import { TimelineView } from '@/components/TimelineView'
import Button21 from '@/components/watermelon/button-21'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import { MorphingButton } from '@/components/watermelon/morphing-button'
import garmentsData from '@/data/garments.json'
import { applyFilters, groupByPlace, MAX_YEAR, MIN_YEAR, NO_FILTERS, type Filters as FilterState, type Garment, type Period } from '@/lib/data'
import { isAdmin, lockedView, log } from '@/lib/log'
import { PANEL_SPACE } from '@/lib/utils'

// MapLibre is ~1 MB, so the map loads as its own chunk while the header and timeline paint.
const MapView = lazy(() => import('@/components/MapView'))

const garments = garmentsData as Garment[]
type View = 'map' | 'grid' | 'timeline'

// 3D shows in both views, except in the eval grid condition (?c=grid): that one stays a photo + text baseline.
const show3d = lockedView !== 'grid'
const isDesktop = () => window.innerWidth >= 768

export default function App() {
  return <MotionConfig reducedMotion="user">{isAdmin ? <AdminPage /> : <Explorer />}</MotionConfig>
}

function Explorer() {
  const [view, setView] = useState<View>(lockedView ?? 'map')
  const [period, setPeriod] = useState<Period>([MIN_YEAR, MAX_YEAR])
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [garmentId, setGarmentId] = useState<string | null>(null)
  // Full-screen product page of the open garment, optionally opened on one of its stories.
  const [full, setFull] = useState<{ story: string | null } | null>(null)
  const mapRef = useRef<MapRef>(null)

  // Everything below is derived from the state above, so every view updates in the same render.
  const filtered = useMemo(() => applyFilters(garments, filters), [filters])
  const places = useMemo(() => groupByPlace(filtered, period), [filtered, period])
  const garment = garments.find((g) => g.id === garmentId) ?? null

  // Logging (roadmap F10). Event names are fixed once a study starts; add new ones, never rename.
  useEffect(() => log('session_start', { view, width: window.innerWidth, height: window.innerHeight }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const firstPeriod = useRef(true)
  useEffect(() => {
    if (firstPeriod.current) return void (firstPeriod.current = false)
    // The slider fires on every step; log where the drag settles.
    const t = setTimeout(() => log('period_change', { from: period[0], to: period[1] }), 500)
    return () => clearTimeout(t)
  }, [period])

  const changeView = (v: View) => {
    setView(v)
    log('view_change', { to: v })
  }
  const openPlace = (name: string) => {
    if (name !== placeName) log('place_open', { place: name })
    setPlaceName(name)
  }
  const openGarment = (id: string) => {
    if (id !== garmentId) log('garment_open', { garment: id, from: view === 'map' ? 'list' : view })
    setGarmentId(id)
    // On a phone the panel covers the map and showed what the full page shows, so skip it and open the page.
    if (!isDesktop()) openFull(null, id)
  }
  const closeGarment = () => {
    if (garmentId) log('garment_close', { garment: garmentId })
    setGarmentId(null)
  }
  // The full page is a history entry, so the back button or a phone's back swipe closes it instead of leaving the
  // site. Its own close (X, Esc) goes back through history as well, so the entry never lingers; `popstate` closes it.
  const openFull = (story: string | null = null, id = garmentId) => {
    log('full_open', { garment: id, story })
    setFull({ story })
    history.pushState({ fashmapFull: true }, '')
  }
  const closeFull = useCallback(() => history.back(), [])
  useEffect(() => {
    const onPop = () => {
      if (!full) return
      log('full_close')
      setFull(null)
      // A phone opened the page instead of the panel, so closing it closes the garment as well.
      if (!isDesktop() && garmentId) {
        log('garment_close', { garment: garmentId })
        setGarmentId(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  })
  const changeFilters = (f: FilterState) => {
    setFilters(f)
    log('filter_change', f)
  }

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
    openPlace(g.place)
    // On a phone the panel covers the map, so step back to the map.
    if (!isDesktop()) closeGarment()
    const map = mapRef.current
    map?.flyTo({ center: [g.lng, g.lat], zoom: Math.max(map.getZoom(), 10), offset: [isDesktop() ? -PANEL_SPACE / 2 : 0, 60], duration: 1400, essential: true })
  }
  // The grid stays text-only about place; the map and the timeline link a garment's place to the map.
  const onShowPlace =
    view === 'grid'
      ? undefined
      : (g: Garment) => {
          if (view === 'timeline') changeView('map')
          showPlace(g)
        }
  const showPlaceFromFull = (g: Garment) => {
    closeFull()
    onShowPlace?.(g) // on a phone this also closes the garment
  }

  return (
    <div className="relative h-svh overflow-hidden bg-background">
      <div className="contents" inert={!!full}>
      {/* Floating chrome over a full-bleed map. The right side stays free for the object panel. */}
      <header className="pointer-events-none absolute top-4 left-4 z-[1200] flex items-center gap-1.5 max-sm:right-4 max-sm:flex-wrap sm:gap-2">
        <div className="pointer-events-auto flex h-12 shrink-0 items-center gap-3 rounded-full bg-white/85 shadow-float ring-1 ring-black/5 backdrop-blur-md lg:pr-4">
          <h1 aria-label="FashMap" className="shrink-0">
            <MorphingButton symbol={brandSymbol} />
          </h1>
          <p className="hidden text-[13px] text-muted-foreground lg:block">Cultural dress across place and time</p>
        </div>
        {/* Eval mode (?c=map|grid) locks the view, so the toggle goes. */}
        {!lockedView && (
          <div className="pointer-events-auto">
            <ContinuousTabs
              label="View"
              tabs={[
                { id: 'map', label: 'Map' },
                { id: 'grid', label: 'Grid' },
                { id: 'timeline', label: 'Timeline' },
              ]}
              value={view}
              onChange={changeView}
            />
          </div>
        )}
        <div className="pointer-events-auto">
          <Filters garments={garments} value={filters} onChange={changeFilters} shown={filtered.length} />
        </div>
        <Button21 />
      </header>

      <main className={garment ? 'fm-panel-open' : undefined}>
        {/* The map stays mounted under the grid, so switching back keeps zoom and position. */}
        <div className="absolute inset-0" inert={view !== 'map'}>
          <Suspense fallback={<div className="absolute inset-0 bg-[#F4F4F5]" />}>
            <MapView
              places={places}
              period={period}
              selectedPlace={placeName}
              onSelectPlace={openPlace}
              onClosePlace={() => setPlaceName(null)}
              selectedGarment={view === 'map' ? garment : null}
              onSelectGarment={openGarment}
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
                  onClick={() => changeFilters(NO_FILTERS)}
                  className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-[scale,background-color] hover:bg-zinc-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <Timeline period={period} onChange={setPeriod} garments={filtered} total={garments.length} panelOpen={!!garment} garment={garment} />
        </div>

        <AnimatePresence>
          {view === 'grid' && (
            <motion.div key="grid" className="absolute inset-0 z-[1100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <GridView garments={filtered} selectedId={garmentId ?? undefined} onSelect={openGarment} panelOpen={!!garment} onClearFilters={() => changeFilters(NO_FILTERS)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'timeline' && (
            <motion.div key="timeline" className="absolute inset-0 z-[1100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <TimelineView garments={filtered} selectedId={garmentId ?? undefined} onSelect={openGarment} panelOpen={!!garment} onClearFilters={() => changeFilters(NO_FILTERS)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {/* Not behind a phone's full page: it would load a second 360° view nobody sees. */}
          {garment && !(full && !isDesktop()) && (
            <ObjectPanel key="panel" garment={garment} show3d={show3d} onClose={closeGarment} onShowPlace={onShowPlace} onOpenFull={openFull} />
          )}
        </AnimatePresence>
      </main>
      </div>

      <AnimatePresence>
        {full && garment && (
          <CompareView
            key="full"
            garment={garment}
            show3d={show3d}
            initialStory={full.story}
            onClose={closeFull}
            onShowPlace={view === 'grid' ? undefined : showPlaceFromFull}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
