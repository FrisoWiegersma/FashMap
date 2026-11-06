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

type Props = { garment: Garment; show3d: boolean; initialStory?: string | null; onClose: () => void; onShowPlace?: (g: Garment) => void }

/**
 * Full-screen product page of one garment: its 360° spin or 3D model next to the photos, and every detail beside them.
 * Points on the spin open stories, and a story opened from the list turns the spin to its point.
 * In the grid condition there is no 3D, so it shows the photos large with the text.
 */
export function CompareView({ garment, show3d, initialStory = null, onClose, onShowPlace }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const live = show3d && has3d(garment)
  const stories = useStories(live ? garment.micrio : null)
  const [story, setStory] = useState<string | null>(initialStory)
  const [tab, setTab] = useState<'object' | 'stories'>(initialStory ? 'stories' : 'object')
  // Without stories (none, or they failed to load) the switch is hidden, so show the details rather than an empty list.
  const shownTab = stories.length ? tab : 'object'
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
  // A phone has room for one pane at a time; this picks it. Wider screens show both side by side.
  const [onPhone, setOnPhone] = useState<'live' | 'photo'>(live ? 'live' : 'photo')

  const openStory = (id: string | null) => {
    setStory(id)
    if (!id) return
    setTab('stories')
    setOnPhone('live') // keep the story's point in sight above its text
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
      className="fixed inset-0 z-[1400] flex flex-col overflow-hidden bg-background"
    >
      {/* Phone: the media sit on top and never scroll away, and only the text below scrolls, so a point on the spin
          and its story are on screen together. From 1024 px the panes and the text are three columns. */}
      <div className={cn('flex min-h-0 flex-1 flex-col gap-3 p-3 lg:grid lg:gap-4 lg:p-5', live ? 'lg:grid-cols-[1.1fr_1fr_400px]' : 'lg:grid-cols-[1fr_420px]')}>
        <div className="relative h-[46svh] shrink-0 lg:contents">
          {live && (
            <Pane label={garment.micrio ? '360° view' : '3D model'} delay={0} big={big === 'live'} onBig={(on) => setBig(on ? 'live' : null)} labelOnPhone={false} hiddenOnPhone={onPhone !== 'live'}>
              <Live garment={garment} story={story} onStory={openStory} />
            </Pane>
          )}

          <Pane
            label={photos.length > 1 ? `Photo ${Math.min(photo, photos.length - 1) + 1} of ${photos.length}` : 'Photo'}
            delay={live ? 0.06 : 0}
            big={big === 'photo'}
            onBig={(on) => setBig(on ? 'photo' : null)}
            labelOnPhone={!live}
            hiddenOnPhone={onPhone !== 'photo'}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div key={shown?.src ?? 'none'} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {shown ? <ZoomPhoto src={shown.src} alt={shown.title} strip={photos.length > 1} /> : <GarmentImage garment={garment} size="full" />}
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

          {/* Phone only: the switch between the panes, and a close button that is always in reach. */}
          {live && (
            <ContinuousTabs
              label="Show"
              size="sm"
              className="absolute top-3 left-3 z-10 lg:hidden"
              tabs={[
                { id: 'live', label: garment.micrio ? '360°' : '3D' },
                { id: 'photo', label: photos.length > 1 ? `Photos ${photos.length}` : 'Photo' },
              ]}
              value={onPhone}
              onChange={setOnPhone}
            />
          )}
          <CloseButton onClose={onClose} className="absolute top-3 right-3 z-10 lg:hidden" />
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.12 }}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[22px] bg-card shadow-float ring-1 ring-black/5 lg:overflow-visible"
        >
          <div className="px-5 pt-5 lg:px-7 lg:pt-6">
            <h2 id="full-title" ref={headingRef} tabIndex={-1} className="font-heading text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground outline-none lg:pr-12 lg:text-[30px]">
              {garment.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {garment.place}, {garment.dateLabel}
            </p>
            {stories.length > 0 && (
              <ContinuousTabs
                label="Show"
                size="sm"
                className="mt-4 w-fit bg-muted shadow-none ring-0 lg:mt-5"
                tabs={[
                  { id: 'object', label: 'Object' },
                  { id: 'stories', label: `Stories ${stories.length}` },
                ]}
                value={shownTab}
                onChange={setTab}
              />
            )}
          </div>

          <div className="flex-1 px-5 pt-4 pb-6 lg:overflow-y-auto lg:px-7 lg:pt-5 lg:pb-7">
            <AnimatePresence initial={false} mode="wait">
              {shownTab === 'object' ? (
                <motion.div key="object" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Details garment={garment} onShowPlace={onShowPlace} />
                  <p className="mt-6 border-t border-border pt-5 text-[15px] leading-relaxed text-foreground/85">{garment.description}</p>
                  <SourceLink garment={garment} className="mt-6" />
                </motion.div>
              ) : (
                <motion.div key="stories" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <p className="text-[13px] text-muted-foreground">Stories from Modemuze, translated from Dutch. Each one belongs to a point on the 360° view.</p>
                  <ul className="mt-3 -mx-2">
                    {stories.map((s) => (
                      <StoryItem
                        key={s.id}
                        story={s}
                        open={s.id === active?.id}
                        onToggle={() => openStory(s.id === active?.id ? null : s.id)}
                        onImage={(src) => {
                          const index = photos.findIndex((p) => p.src === src)
                          if (index < 0) return
                          setPhoto(index)
                          setOnPhone('photo')
                          log('photo_switch', { garment: garment.id, photo: index })
                        }}
                      />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CloseButton onClose={onClose} className="absolute top-4 right-4 max-lg:hidden" />
        </motion.aside>
      </div>
    </motion.div>
  )
}

function CloseButton({ onClose, className }: { onClose: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close full size view"
      className={cn(
        'grid size-10 place-items-center rounded-full bg-white text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-black/5 transition-[background-color,scale] hover:bg-muted active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <X className="size-4" />
    </button>
  )
}

function StoryItem({ story, open, onToggle, onImage }: { story: Story; open: boolean; onToggle: () => void; onImage: (src: string) => void }) {
  const ref = useRef<HTMLLIElement>(null)
  // A point tapped on the spin opens its story here; bring it into view.
  // On a phone the text area is short, so put the story's title at its top and let the text unfold below.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: window.matchMedia('(min-width: 1024px)').matches ? 'nearest' : 'start', behavior: 'smooth' })
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
              {story.images.length > 0 && (
                <div className="mt-4 space-y-4 lg:hidden">
                  {story.images.map((image) => (
                    <figure key={image.src}>
                      <button type="button" onClick={() => onImage(image.src)} aria-label={`View story photo: ${image.title || story.title}`} className="block w-full overflow-hidden rounded-xl bg-white ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <img src={image.src} alt={image.title || story.title} loading="lazy" className="max-h-[36svh] w-full object-contain" />
                      </button>
                      {image.title && <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">{image.title}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
              {story.author && <p className="mt-3 text-xs text-muted-foreground">By {story.author}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

type PaneProps = { label: string; delay: number; big: boolean; onBig: (on: boolean) => void; labelOnPhone: boolean; hiddenOnPhone: boolean; children: ReactNode }

function Pane({ label, delay, big, onBig, labelOnPhone, hiddenOnPhone, children }: PaneProps) {
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
        // Phone: both panes fill the same box, and the one not picked is hidden (still sized, so the spin keeps its place).
        big ? 'fixed inset-0 z-20' : 'rounded-[22px] shadow-float ring-1 ring-black/5 max-lg:absolute max-lg:inset-0 lg:relative',
        hiddenOnPhone && !big && 'max-lg:invisible',
      )}
    >
      {children}
      <button
        type="button"
        onClick={() => onBig(!big)}
        aria-label={big ? 'Exit full screen' : `Show the ${label.toLowerCase().replace(/ \d+ of \d+$/, 's')} full screen`}
        title={big ? 'Exit full screen (Esc)' : 'Full screen'}
        // On a phone the close button takes the corner, so this one sits below it.
        className={cn(big ? 'top-3' : 'top-15 lg:top-3', 'absolute right-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-black/5 backdrop-blur transition-[background-color,scale] hover:bg-white active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary')}
      >
        <Icon className="size-4" />
      </button>
      <span
        className={cn(
          'pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[13px] font-medium text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)] ring-1 ring-black/5 backdrop-blur',
          !labelOnPhone && 'max-lg:hidden', // the phone's pane switch takes this corner
        )}
      >
        {label}
      </span>
    </motion.section>
  )
}

/**
 * A photo, uncropped. Click to zoom in on the spot under the pointer, click again to zoom out.
 * `strip`: the thumbnail strip sits at the bottom, so leave room for it; without one the photo grows into that space.
 */
function ZoomPhoto({ src, alt, strip }: { src: string; alt: string; strip: boolean }) {
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
      // Phones: the photo uses the pane's full height, under the controls like the 360° view; only the thumbnail strip gets its own room.
      className={cn('relative block size-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset lg:px-6 lg:pt-14', strip ? 'pb-16 lg:pb-20' : 'lg:pb-6', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
    >
      {/* A blurred copy fills the pane with the photo's own backdrop colour, so the photo reads edge to edge, not as a picture in a box. */}
      <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-2xl" />
      <span className="relative block size-full transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: zoom ? 'scale(2.4)' : 'none', transformOrigin: origin }}>
        <img src={src} alt={alt} className="size-full object-contain" />
      </span>
    </button>
  )
}
