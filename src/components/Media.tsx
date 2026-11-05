import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { GarmentImage } from '@/components/GarmentImage'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import { has3d, type Garment } from '@/lib/data'
import { log } from '@/lib/log'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'micr-io': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

/**
 * The media area of the docked panel: the 360° view or the photo, with a switch when both exist.
 * Fills its parent, which sets the size. Key it per garment so it starts on 3D each time.
 */
export function Media({ garment, show3d }: { garment: Garment; show3d: boolean }) {
  const live = show3d && has3d(garment)
  const [mode, setMode] = useState<'3d' | 'photo'>('3d')
  const show = live && mode === '3d' ? 'live' : 'photo'

  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div key={show} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {show === 'live' ? <Live garment={garment} /> : <GarmentImage garment={garment} size="panel" />}
        </motion.div>
      </AnimatePresence>

      {live && (
        <ContinuousTabs
          label="Show"
          size="sm"
          className="absolute top-3 left-3 z-10"
          tabs={[
            { id: '3d', label: '360°' },
            { id: 'photo', label: 'Photo' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m)
            log('media_switch', { garment: garment.id, to: m })
          }}
        />
      )}
    </>
  )
}

/** The garment's 360° spin (Modemuze objects on Micrio). Fills a positioned parent. */
export function Live({ garment }: { garment: Garment }) {
  return garment.micrio ? <SpinView id={garment.micrio} garment={garment} /> : null
}

function Loading({ label, progress }: { label: string; progress?: number }) {
  return (
    <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="flex w-40 flex-col items-center gap-3">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="relative h-1 w-full overflow-hidden rounded-full bg-black/8" role="progressbar" aria-label={label} aria-valuenow={progress === undefined ? undefined : Math.round(progress * 100)}>
          {progress === undefined ? (
            <span className="absolute inset-y-0 w-1/3 animate-[fm-slide_1.1s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:animate-none" />
          ) : (
            <span className="block h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-out" style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }} />
          )}
        </span>
      </div>
    </motion.div>
  )
}

function Hint({ children }: { children: string }) {
  return (
    <motion.span
      key="hint"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-xs whitespace-nowrap text-muted-foreground shadow-[0_1px_3px_rgb(0_0_0/0.15)] backdrop-blur max-sm:hidden"
    >
      {children}
    </motion.span>
  )
}

/** A Modemuze 360° object: photos taken all around the garment, turned by dragging. The Micrio viewer loads on first open. */
function SpinView({ id, garment }: { id: string; garment: Garment }) {
  const ref = useRef<HTMLElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [touched, setTouched] = useState(false)
  const logged = useRef(false)

  useEffect(() => {
    import('@micrio/client').catch(() => setState('error'))
    const el = ref.current
    if (!el) return
    const onShow = () => setState('ready')
    const onPan = () => {
      setTouched(true)
      if (!logged.current) log('model_interact', { garment: garment.id, kind: '360' })
      logged.current = true
    }
    el.addEventListener('show', onShow)
    el.addEventListener('panstart', onPan)
    el.addEventListener('pinchstart', onPan)
    return () => {
      el.removeEventListener('show', onShow)
      el.removeEventListener('panstart', onPan)
      el.removeEventListener('pinchstart', onPan)
    }
  }, [garment.id])

  if (state === 'error') return <Fallback garment={garment} what="360° view" />

  return (
    <div className="relative size-full">
      <micr-io ref={ref} id={id} data-minimap="false" data-logo="false" style={{ display: 'block', width: '100%', height: '100%', opacity: state === 'ready' ? 1 : 0, transition: 'opacity .5s ease-out' }} />
      <AnimatePresence>{state === 'loading' && <Loading label="Loading 360° view" />}</AnimatePresence>
      <AnimatePresence>{state === 'ready' && !touched && <Hint>Drag to turn</Hint>}</AnimatePresence>
    </div>
  )
}

function Fallback({ garment, what }: { garment: Garment; what: string }) {
  return (
    <div className="relative size-full">
      <GarmentImage garment={garment} size="panel" />
      <p className="absolute inset-x-0 bottom-14 text-center text-xs text-muted-foreground">The {what} could not be loaded. Showing the photo instead.</p>
    </div>
  )
}
