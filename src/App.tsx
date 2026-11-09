import { AnimatePresence, MotionConfig } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import brandSymbol from '@/assets/brand/fashmap-symbol.png'
import { AdminPage } from '@/components/AdminPage'
import { CompareView } from '@/components/CompareView'
import { ObjectPanel } from '@/components/ObjectPanel'
import { MorphingButton } from '@/components/watermelon/morphing-button'
import garmentsData from '@/data/garments.json'
import { groupByPlace, MAX_YEAR, MIN_YEAR, type Garment, type Period } from '@/lib/data'
import { isAdmin, log } from '@/lib/log'
import { isDesktop, PANEL_SPACE } from '@/lib/utils'

// MapLibre is ~1 MB, so the map loads as its own chunk while the header paints.
const MapView = lazy(() => import('@/components/MapView'))

// ponytail: trimmed demo of 5 garments on the map only. Drop this filter to bring back all 128.
const DEMO = ['hindelooper-bruid', 'kotomisi-ensemble', 'ottomaanse-bruidsjurk', 'akhnif-amazigh-mantel', 'jumlo-jurk-uit-pakistan']
const garments = (garmentsData as Garment[]).filter((g) => DEMO.includes(g.id))
// No timeline in this build, so every garment is always in the period.
const ALL_TIME: Period = [MIN_YEAR, MAX_YEAR]

export default function App() {
  return <MotionConfig reducedMotion="user">{isAdmin ? <AdminPage /> : <Explorer />}</MotionConfig>
}

function Explorer() {
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [garmentId, setGarmentId] = useState<string | null>(null)
  // Full-screen product page of the open garment, optionally opened on one of its stories. `alone`: a phone opened it
  // instead of the panel, so closing it closes the garment too. Decided once, at open, so rotating the phone in
  // between doesn't pop the panel up.
  const [full, setFull] = useState<{ story: string | null; alone: boolean } | null>(null)
  const mapRef = useRef<MapRef>(null)

  const places = useMemo(() => groupByPlace(garments, ALL_TIME), [])
  const garment = garments.find((g) => g.id === garmentId) ?? null

  // Logging (roadmap F10). Event names are fixed once a study starts; add new ones, never rename.
  useEffect(() => log('session_start', { view: 'map', width: window.innerWidth, height: window.innerHeight }), [])

  const openPlace = (name: string) => {
    if (name !== placeName) log('place_open', { place: name })
    setPlaceName(name)
  }
  const openGarment = (id: string) => {
    if (id !== garmentId) log('garment_open', { garment: id, from: 'list' })
    setGarmentId(id)
    // On a phone the panel covers the map and showed what the full page shows, so skip it and open the page.
    if (!isDesktop()) openFull(null, id, true)
  }
  const closeGarment = () => {
    if (garmentId) log('garment_close', { garment: garmentId })
    setGarmentId(null)
  }
  // The full page is a history entry, so the back button or a phone's back swipe closes it instead of leaving the
  // site. Its own close (X, Esc) goes back through history as well, so the entry never lingers; `popstate` closes it.
  const openFull = (story: string | null = null, id = garmentId, alone = false) => {
    log('full_open', { garment: id, story })
    setFull({ story, alone })
    history.pushState({ fashmapFull: true }, '')
  }
  const closeFull = useCallback(() => history.back(), [])
  useEffect(() => {
    const onPop = () => {
      if (!full) return
      log('full_close')
      setFull(null)
      if (full.alone && garmentId) {
        log('garment_close', { garment: garmentId })
        setGarmentId(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  })

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
  const showPlaceFromFull = (g: Garment) => {
    closeFull()
    showPlace(g) // on a phone this also closes the garment
  }

  return (
    <div className="relative h-svh overflow-hidden bg-background">
      <div className="contents" inert={!!full}>
      {/* Floating chrome over a full-bleed map. The right side stays free for the object panel. */}
      <header className="pointer-events-none absolute top-4 left-4 z-[1200] flex items-center gap-1.5 max-sm:right-4 sm:gap-2">
        <div className="pointer-events-auto flex h-12 shrink-0 items-center gap-3 rounded-full bg-white/85 shadow-float ring-1 ring-black/5 backdrop-blur-md lg:pr-4">
          <h1 aria-label="FashMap" className="shrink-0">
            <MorphingButton symbol={brandSymbol} />
          </h1>
          <p className="hidden text-[13px] text-muted-foreground lg:block">Cultural dress across place and time</p>
        </div>
      </header>

      <main className={garment ? 'fm-panel-open' : undefined}>
        <div className="absolute inset-0">
          <Suspense fallback={<div className="absolute inset-0 bg-[#F4F4F5]" />}>
            <MapView
              places={places}
              period={ALL_TIME}
              selectedPlace={placeName}
              onSelectPlace={openPlace}
              onClosePlace={() => setPlaceName(null)}
              selectedGarment={garment}
              onSelectGarment={openGarment}
              mapRef={mapRef}
            />
          </Suspense>
        </div>

        <AnimatePresence>
          {/* Not behind a phone's full page: it would load a second 360° view nobody sees. */}
          {garment && !full?.alone && <ObjectPanel key="panel" garment={garment} show3d onClose={closeGarment} onShowPlace={showPlace} onOpenFull={openFull} />}
        </AnimatePresence>
      </main>
      </div>

      <AnimatePresence>
        {full && garment && <CompareView key="full" garment={garment} show3d initialStory={full.story} onClose={closeFull} onShowPlace={showPlaceFromFull} />}
      </AnimatePresence>
    </div>
  )
}
