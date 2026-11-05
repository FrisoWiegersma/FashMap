import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GarmentImage } from '@/components/GarmentImage'
import { Live } from '@/components/Media'
import { Details, SourceLink } from '@/components/ObjectPanel'
import { assetUrl, has3d, type Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

const EASE = [0.2, 0.8, 0.2, 1] as const

type Props = { garment: Garment; show3d: boolean; onClose: () => void }

/**
 * Full-screen product page of one garment: its 360° spin or 3D model next to the photo, and every detail beside them.
 * In the grid condition there is no 3D, so it shows the photo large with the text.
 */
export function CompareView({ garment, show3d, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const live = show3d && has3d(garment)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    headingRef.current?.focus({ preventScroll: true })
    // Capture phase, so Esc closes this view before the panel behind it reacts.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
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
          <Pane label={garment.micrio ? '360° view' : '3D model'} delay={0}>
            <Live garment={garment} />
          </Pane>
        )}

        <Pane label="Photo" delay={live ? 0.06 : 0}>
          <div className="absolute inset-0">
            {garment.image ? <ZoomPhoto src={assetUrl(garment.image)} alt={garment.title} /> : <GarmentImage garment={garment} size="full" />}
          </div>
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
          </div>

          <div className="flex-1 px-7 pt-5 pb-7 lg:overflow-y-auto">
            <Details garment={garment} />
            <p className="mt-6 border-t border-border pt-5 text-[15px] leading-relaxed text-foreground/85">{garment.description}</p>
            <SourceLink garment={garment} className="mt-6" />
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

type PaneProps = { label: string; delay: number; children: ReactNode }

function Pane({ label, delay, children }: PaneProps) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className="relative h-[72svh] overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_50%_25%,#FFFFFF_0%,#EFEFF1_100%)] shadow-float ring-1 ring-black/5 lg:h-auto"
    >
      {children}
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
