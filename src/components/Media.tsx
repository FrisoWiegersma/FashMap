import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GarmentImage } from '@/components/GarmentImage'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import { assetUrl, has3d, type Garment } from '@/lib/data'
import { log } from '@/lib/log'
import { loadTranslations } from '@/lib/micrio'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { src?: string; alt?: string; poster?: string; exposure?: string }
      'micr-io': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

const coarse = () => window.matchMedia('(pointer: coarse)').matches

/**
 * The media area of the docked panel: the 3D view or the photo, with a switch when both exist.
 * Fills its parent, which sets the size. Key it per garment so it starts on 3D each time.
 */
export function Media({ garment, show3d, onStory }: { garment: Garment; show3d: boolean } & Pick<StoryProps, 'onStory'>) {
  const live = show3d && has3d(garment)
  const [mode, setMode] = useState<'3d' | 'photo'>('3d')
  const show = live && mode === '3d' ? 'live' : 'photo'

  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div key={show} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {show === 'live' ? <Live garment={garment} onStory={onStory} /> : <GarmentImage garment={garment} size="panel" />}
        </motion.div>
      </AnimatePresence>

      {live && (
        <ContinuousTabs
          label="Show"
          size="sm"
          className="absolute top-3 left-3 z-10"
          tabs={[
            { id: '3d', label: garment.micrio ? '360°' : '3D' },
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

type StoryProps = { story?: string | null; onStory?: (id: string | null) => void }

/** The garment's 360° spin (Modemuze objects on Micrio) or its 3D model. Fills a positioned parent. */
export function Live({ garment, story, onStory }: { garment: Garment } & StoryProps) {
  if (garment.micrio) return <SpinView id={garment.micrio} garment={garment} story={story} onStory={onStory} />
  return garment.model ? <ModelView src={garment.model} garment={garment} /> : null
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

type MicrioElement = HTMLElement & { $current?: { state: { marker: { set: (m?: string) => void }; $marker?: { id: string } } }; destroy?: () => void }

/**
 * A Modemuze 360° object: photos taken all around the garment, turned by dragging. The Micrio viewer loads on first
 * open. Its points open stories; Micrio's own popup is hidden and `onStory` lets FashMap show the story instead.
 * `story` opens a point from outside (the story list), so the camera flies to it.
 */
function SpinView({ id, garment, story, onStory }: { id: string; garment: Garment } & StoryProps) {
  const ref = useRef<MicrioElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [touched, setTouched] = useState(false)
  const logged = useRef(false)
  const onStoryRef = useRef(onStory)
  useEffect(() => {
    onStoryRef.current = onStory
  })

  // Micrio keeps its WebGL context after its element leaves the page, until garbage collection. Chrome drops the
  // page's oldest context once there are too many, and that is the map's: after about eight garments it turned into a
  // sad face. So free it when the view closes. The timeout skips StrictMode's practice unmount, where the element stays.
  useEffect(() => {
    const el = ref.current
    return () => {
      setTimeout(() => {
        if (el && !el.isConnected) {
          try {
            el.destroy?.() // not in Micrio's types, but it is what releases the context
          } catch {
            // already torn down
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    if (state !== 'ready') return
    const image = ref.current?.$current
    if (image && image.state.$marker?.id !== (story ?? undefined)) image.state.marker.set(story ?? undefined)
  }, [story, state])

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
    const onOpen = (e: Event) => {
      const markerId = (e as CustomEvent<{ id: string }>).detail.id
      log('story_open', { garment: garment.id, story: markerId })
      onStoryRef.current?.(markerId)
    }
    const onClosed = () => onStoryRef.current?.(null)
    el.addEventListener('show', onShow)
    el.addEventListener('panstart', onPan)
    el.addEventListener('pinchstart', onPan)
    el.addEventListener('marker-open', onOpen)
    el.addEventListener('marker-closed', onClosed)
    return () => {
      el.removeEventListener('show', onShow)
      el.removeEventListener('panstart', onPan)
      el.removeEventListener('pinchstart', onPan)
      el.removeEventListener('marker-open', onOpen)
      el.removeEventListener('marker-closed', onClosed)
    }
  }, [garment.id])

  // Micrio draws a tooltip and a hover label with each point's title, in Dutch. Swap them for the English
  // title, and again whenever Micrio redraws its points.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = new AbortController() // aborted when the garment changes or the view closes
    let english: Record<string, { title: string }> = {}
    const translate = () => {
      for (const point of el.querySelectorAll<HTMLButtonElement>('button.micrio-marker[id]')) {
        const title = english[point.id]?.title
        if (!title) continue
        if (point.title !== title) point.title = title
        const label = point.querySelector('label')
        if (label && label.textContent !== title) label.textContent = title
      }
    }
    const observer = new MutationObserver(translate)
    loadTranslations(id)
      .then((t) => {
        if (stop.signal.aborted) return
        english = t
        translate()
        observer.observe(el, { childList: true, subtree: true, characterData: true })
      })
      .catch(() => {}) // without translations the Dutch titles stay
    return () => {
      stop.abort()
      observer.disconnect()
    }
  }, [id])

  if (state === 'error') return <Fallback garment={garment} what="360° view" />

  return (
    <div className="relative size-full overflow-hidden">
      {/* Micrio's canvas is transparent around the spin, so the same blurred photo backdrop as the photo pane shows through. */}
      {garment.image && <img src={assetUrl(garment.image)} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-2xl" />}
      {/* lang="nl": Micrio loads no points for a language without data, and Modemuze writes them in Dutch only.
          Visitors never see this text: Micrio's popup is hidden and FashMap shows the English translation instead. */}
      <micr-io ref={ref} id={id} lang="nl" data-minimap="false" data-logo="false" style={{ display: 'block', position: 'relative', width: '100%', height: '100%', opacity: state === 'ready' ? 1 : 0, transition: 'opacity .5s ease-out' }} />
      <AnimatePresence>{state === 'loading' && <Loading label="Loading 360° view" />}</AnimatePresence>
      <AnimatePresence>{state === 'ready' && !touched && <Hint>Drag to turn, tap a point for its story</Hint>}</AnimatePresence>
    </div>
  )
}

/** 3D view. model-viewer (and three.js) is imported the first time a model is opened, so the map stays light. */
function ModelView({ src, garment }: { src: string; garment: Garment }) {
  const ref = useRef<HTMLElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [touched, setTouched] = useState(false)
  const logged = useRef(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    import('@google/model-viewer').catch(() => setState('error'))
    const el = ref.current
    if (!el) return
    const onLoad = () => setState('ready')
    const onError = () => setState('error')
    const onProgress = (e: Event) => setProgress((e as CustomEvent<{ totalProgress: number }>).detail.totalProgress)
    const onCamera = (e: Event) => {
      if ((e as CustomEvent<{ source: string }>).detail.source !== 'user-interaction') return
      setTouched(true)
      if (!logged.current) log('model_interact', { garment: garment.id })
      logged.current = true
    }
    el.addEventListener('load', onLoad)
    el.addEventListener('error', onError)
    el.addEventListener('progress', onProgress)
    el.addEventListener('camera-change', onCamera)
    return () => {
      el.removeEventListener('load', onLoad)
      el.removeEventListener('error', onError)
      el.removeEventListener('progress', onProgress)
      el.removeEventListener('camera-change', onCamera)
    }
  }, [garment.id])

  if (state === 'error') return <Fallback garment={garment} what="3D model" />

  return (
    <div className="relative size-full">
      <model-viewer
        ref={ref}
        src={assetUrl(src)}
        alt={`3D model of ${garment.title}`}
        camera-controls
        touch-action="pan-y"
        interaction-prompt="none"
        {...(reduced ? {} : { 'auto-rotate': '', 'auto-rotate-delay': '1200', 'rotation-per-second': '14deg' })}
        shadow-intensity="0.7"
        shadow-softness="1"
        exposure="1.05"
        style={{ width: '100%', height: '100%', '--poster-color': 'transparent', opacity: state === 'ready' ? 1 : 0, transition: 'opacity .5s ease-out' } as CSSProperties}
      />
      <AnimatePresence>{state === 'loading' && <Loading label="Loading 3D model" progress={progress} />}</AnimatePresence>
      <AnimatePresence>{state === 'ready' && !touched && <Hint>{coarse() ? 'Drag to turn, pinch to zoom' : 'Drag to turn, scroll to zoom'}</Hint>}</AnimatePresence>
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
