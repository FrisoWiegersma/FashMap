import { ChevronDown, Maximize2, Minimize2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GarmentImage } from '@/components/GarmentImage'
import { Live } from '@/components/Media'
import { Details, SourceLink } from '@/components/ObjectPanel'
import { RichText } from '@/components/RichText'
import { ContinuousTabs } from '@/components/watermelon/continuous-tabs'
import { assetUrl, has3d, type Garment } from '@/lib/data'
import { log } from '@/lib/log'
import { useStories, type Story } from '@/lib/micrio'
import { cn } from '@/lib/utils'

const EASE = [0.2, 0.8, 0.2, 1] as const

type Props = { garment: Garment; show3d: boolean; initialStory?: string | null; onClose: () => void }

/**
 * Full-screen product page of one garment: its 360° spin or 3D model next to the photos, and every detail beside them.
 * Points on the spin open stories, and a story opened from the list turns the spin to its point.
 * In the grid condition there is no 3D, so it shows the photos large with the text.
 */
export function CompareView({ garment, show3d, initialStory = null, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const live = show3d && has3d(garment)
  const stories = useStories(live ? garment.micrio : null)
  const [story, setStory] = useState<string | null>(initialStory)
  const [tab, setTab] = useState<'object' | 'stories'>(initialStory ? 'stories' : 'object')
  const active = stories.find((s) => s.id === story)
  // One pane can fill the screen: the spin or the photos.
  const [big, setBig] = useState<'live' | 'photo' | null>(null)
  const bigRef = useRef(big)
  useEffect(() => {
    bigRef.current = big
  })

  // Photos: the museum photo, then the images that come with the stories.
  const photos = [
    ...(garment.image ? [{ src: assetUrl(garment.image), title: garment.title, story: null as string | null }] : []),
    ...stories.flatMap((s) => s.images.map((i) => ({ src: i.src, title: i.title, story: s.id as string | null }))),
  ]
  const [photo, setPhoto] = useState(0)
  const shown = photos[Math.min(photo, photos.length - 1)]

  const openStory = (id: string | null) => {
    setStory(id)
    if (!id) return
    setTab('stories')
    const first = photos.findIndex((p) => p.story === id)
    if (first >= 0) setPhoto(first)
  }

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    headingRef.current?.focus({ preventScroll: true })
    // Capture phase, so Esc closes this view before the panel behind it reacts. A full-screen pane closes first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (bigRef.current) setBig(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-title"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="fixed inset-0 z-[1400] flex flex-col overflow-y-auto bg-background lg:overflow-hidden"
    >
      <div className={cn('grid flex-1 gap-4 p-4 lg:min-h-0 lg:p-5', live ? 'lg:grid-cols-[1.1fr_1fr_400px]' : 'lg:grid-cols-[1fr_420px]')}>
        {live && (
          <Pane label={garment.micrio ? '360° view' : '3D model'} delay={0} big={big === 'live'} onBig={(on) => setBig(on ? 'live' : null)}>
            <Live garment={garment} story={story} onStory={openStory} />
          </Pane>
        )}

        <Pane label={photos.length > 1 ? `Photo ${Math.min(photo, photos.length - 1) + 1} of ${photos.length}` : 'Photo'} delay={live ? 0.06 : 0} big={big === 'photo'} onBig={(on) => setBig(on ? 'photo' : null)}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div key={shown?.src ?? 'none'} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {shown ? <ZoomPhoto src={shown.src} alt={shown.title} /> : <GarmentImage garment={garment} size="full" />}
            </motion.div>
          </AnimatePresence>
          {photos.length > 1 && (
            <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
              <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-2xl bg-white/85 p-1.5 shadow-float ring-1 ring-black/5 backdrop-blur-md">
                {photos.map((p, i) => (
                  <button
                    key={p.src}
                    type="button"
                    onClick={() => {
                      setPhoto(i)
                      log('photo_switch', { garment: garment.id, photo: i })
                    }}
                    aria-label={`Show photo ${i + 1}: ${p.title}`}
                    aria-current={i === photo || undefined}
                    className={cn(
                      'size-12 shrink-0 overflow-hidden rounded-[9px] ring-2 transition-[box-shadow,opacity,scale] duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                      i === photo ? 'ring-primary' : 'opacity-70 ring-transparent hover:opacity-100',
                    )}
                  >
                    <img src={p.src} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Pane>

        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.12 }}
          className="relative flex flex-col rounded-[22px] bg-card shadow-float ring-1 ring-black/5 lg:min-h-0"
        >
          <div className="px-7 pt-6">
            <h2 id="full-title" ref={headingRef} tabIndex={-1} className="pr-12 font-heading text-[30px] leading-[1.1] tracking-[-0.01em] text-foreground outline-none">
              {garment.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {garment.place}, {garment.dateLabel}
            </p>
            {stories.length > 0 && (
              <ContinuousTabs
                label="Show"
                size="sm"
                className="mt-5 w-fit bg-muted shadow-none ring-0"
                tabs={[
                  { id: 'object', label: 'Object' },
                  { id: 'stories', label: `Stories ${stories.length}` },
                ]}
                value={tab}
                onChange={setTab}
              />
            )}
          </div>

          <div className="flex-1 px-7 pt-5 pb-7 lg:overflow-y-auto">
            <AnimatePresence initial={false} mode="wait">
              {tab === 'object' ? (
                <motion.div key="object" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Details garment={garment} />
                  <p className="mt-6 border-t border-border pt-5 text-[15px] leading-relaxed text-foreground/85">{garment.description}</p>
                  <SourceLink garment={garment} className="mt-6" />
                </motion.div>
              ) : (
                <motion.div key="stories" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <p className="text-[13px] text-muted-foreground">Stories from Modemuze, translated from Dutch. Each one belongs to a point on the 360° view.</p>
                  <ul className="mt-3 -mx-2">
                    {stories.map((s) => (
                      <StoryItem key={s.id} story={s} open={s.id === active?.id} onToggle={() => openStory(s.id === active?.id ? null : s.id)} />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close full size view"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-black/5 transition-[background-color,scale] hover:bg-muted active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-4" />
          </button>
        </motion.aside>
      </div>
    </motion.div>
  )
}

function StoryItem({ story, open, onToggle }: { story: Story; open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  // A point tapped on the spin opens its story here; bring it into view.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  return (
    <li ref={ref} className={cn('rounded-xl transition-colors', open && 'bg-muted/70')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-white transition-colors', open ? 'bg-foreground' : 'bg-primary')} aria-hidden />
        <span className="flex-1 font-heading text-[18px] leading-snug text-foreground">{story.title}</span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
            <div lang={story.lang} className="px-2 pb-4 pl-[30px]">
              <RichText html={story.body} className="space-y-3 text-[15px] leading-relaxed text-foreground/85 [&_strong]:font-medium [&_strong]:text-foreground" />
              {story.author && <p className="mt-3 text-xs text-muted-foreground">By {story.author}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

type PaneProps = { label: string; delay: number; big: boolean; onBig: (on: boolean) => void; children: ReactNode }

function Pane({ label, delay, big, onBig, children }: PaneProps) {
  const Icon = big ? Minimize2 : Maximize2
  return (
    <motion.section
      layout
      aria-label={label}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay, layout: { duration: 0.35, ease: EASE } }}
      className={cn(
        'overflow-hidden bg-[radial-gradient(120%_90%_at_50%_25%,#FFFFFF_0%,#EFEFF1_100%)]',
        big ? 'fixed inset-0 z-20' : 'relative h-[72svh] rounded-[22px] shadow-float ring-1 ring-black/5 lg:h-auto',
      )}
    >
      {children}
      <button
        type="button"
        onClick={() => onBig(!big)}
        aria-label={big ? 'Exit full screen' : `Show the ${label.toLowerCase().replace(/ \d+ of \d+$/, 's')} full screen`}
        title={big ? 'Exit full screen (Esc)' : 'Full screen'}
        className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-black/5 backdrop-blur transition-[background-color,scale] hover:bg-white active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon className="size-4" />
      </button>
      <span className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[13px] font-medium text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)] ring-1 ring-black/5 backdrop-blur">
        {label}
      </span>
    </motion.section>
  )
}

/** A photo, uncropped. Click to zoom in on the spot under the pointer, click again to zoom out. */
function ZoomPhoto({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const aim = (e: { currentTarget: Element; clientX: number; clientY: number }) => {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <button
      type="button"
      aria-label={zoom ? 'Zoom out of the photo' : 'Zoom in on the photo'}
      aria-pressed={zoom}
      onClick={(e) => {
        aim(e)
        setZoom(!zoom)
      }}
      onPointerMove={(e) => zoom && aim(e)}
      className={cn('block size-full overflow-hidden px-6 pt-14 pb-20 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
    >
      <span className="block size-full transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: zoom ? 'scale(2.4)' : 'none', transformOrigin: origin }}>
        <img src={src} alt={alt} className="size-full object-contain" />
      </span>
    </button>
  )
}
