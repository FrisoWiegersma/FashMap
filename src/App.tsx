import { MotionConfig } from 'motion/react'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { Timeline } from '@/components/Timeline'
import garmentsData from '@/data/garments.json'
import { groupByPlace, MAX_YEAR, MIN_YEAR, type Garment, type Period } from '@/lib/data'

// MapLibre is ~1 MB, so the map loads as its own chunk while the header and timeline paint.
const MapView = lazy(() => import('@/components/MapView'))

const garments = garmentsData as Garment[]

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Explorer />
    </MotionConfig>
  )
}

function Explorer() {
  const [period, setPeriod] = useState<Period>([MIN_YEAR, MAX_YEAR])
  const mapRef = useRef<MapRef>(null)

  // Everything below is derived from the state above, so every view updates in the same render.
  const places = useMemo(() => groupByPlace(garments, period), [period])

  return (
    <div className="relative h-svh overflow-hidden bg-background">
      {/* Floating chrome over a full-bleed map. The right side stays free for the object panel. */}
      <header className="pointer-events-none absolute top-4 left-4 z-[1200] flex items-center gap-2">
        <div className="pointer-events-auto flex h-12 items-baseline gap-3 rounded-full bg-white/85 px-5 pt-[11px] shadow-float ring-1 ring-black/5 backdrop-blur-md max-sm:px-4">
          <h1 className="font-heading text-[22px] leading-none font-medium tracking-[-0.02em] text-foreground">FashMap</h1>
          <p className="hidden text-[13px] text-muted-foreground lg:block">Cultural dress across place and time</p>
        </div>
      </header>

      <main>
        <div className="absolute inset-0">
          <Suspense fallback={<div className="absolute inset-0 bg-[#F4F4F5]" />}>
            <MapView places={places} mapRef={mapRef} />
          </Suspense>
          <Timeline period={period} onChange={setPeriod} garments={garments} total={garments.length} />
        </div>
      </main>
    </div>
  )
}
