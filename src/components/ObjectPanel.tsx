import { ExternalLink, Maximize2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Media } from '@/components/Media'
import { countryName, flagColours, garmentFields, tint, type Garment } from '@/lib/data'
import { useTone } from '@/lib/micrio'
import { cn } from '@/lib/utils'

type Props = {
  garment: Garment
  show3d: boolean
  onClose: () => void
  onShowPlace?: (g: Garment) => void
  onOpenFull: (story?: string | null) => void
}

export function ObjectPanel({ garment, show3d, onClose, onShowPlace, onOpenFull }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const tone = useTone(garment.image)

  // Move focus into the panel on open, and give it back to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [garment.id])

  return (
    <motion.aside
      aria-labelledby="garment-title"
      initial={{ opacity: 0, x: 32, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute top-4 right-4 bottom-4 z-[1300] flex w-[430px] max-w-[calc(100%-2rem)] origin-right flex-col overflow-hidden rounded-[22px] bg-card shadow-float ring-1 ring-black/5"
    >
      <div className="relative h-[48%] min-h-64 shrink-0 bg-[radial-gradient(120%_90%_at_50%_25%,#FFFFFF_0%,#EFEFF1_100%)]">
        {/* A point tapped on the small spin opens the full page on its story, where there is room to read it. */}
        <Media key={garment.id} garment={garment} show3d={show3d} onStory={(id) => id && onOpenFull(id)} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] backdrop-blur transition-[background-color,scale] hover:bg-white active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      <motion.div
        key={garment.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        style={tone ? { backgroundColor: tint(tone, 0.982, 0.012) } : undefined}
        className="flex-1 overflow-y-auto px-7 pt-6 pb-7"
      >
        <CountryLine garment={garment} className="mb-3" />
        <h2 id="garment-title" ref={headingRef} tabIndex={-1} className="font-heading text-[28px] leading-[1.12] tracking-[-0.01em] text-foreground outline-none">
          {garment.title}
        </h2>
        <p className="mt-1.5 font-heading text-[17px] text-muted-foreground italic">{garment.dateLabel}</p>

        <motion.button
          type="button"
          onClick={() => onOpenFull()}
          whileTap={{ scale: 0.96 }}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Maximize2 className="size-3.5" />
          Open full page
        </motion.button>

        <Details garment={garment} onShowPlace={onShowPlace} className="mt-5" />

        <p className="mt-6 max-w-prose border-t border-border pt-5 text-[15px] leading-relaxed text-foreground/85">{garment.description}</p>

        <SourceLink garment={garment} className="mt-6" />
      </motion.div>
    </motion.aside>
  )
}

/** Label and value rows. Unknown values are left out. */
export function Details({ garment, onShowPlace, className }: { garment: Garment; onShowPlace?: (g: Garment) => void; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[112px_1fr] gap-x-4 gap-y-2.5 text-sm', className)}>
      {garmentFields(garment)
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground">
              {label === 'Place' && onShowPlace ? (
                <button
                  type="button"
                  onClick={() => onShowPlace(garment)}
                  className="text-left underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {value}
                </button>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
    </dl>
  )
}

/** A short rule in the flag's colours, then the country and place. Colour is never alone: the name sits right below. */
export function CountryLine({ garment, className }: { garment: Garment; className?: string }) {
  const c = flagColours(garment.country)
  const country = countryName(garment.country)
  return (
    <div className={className}>
      {c && (
        <span aria-hidden className="mb-2.5 flex h-1 w-12 overflow-hidden rounded-full ring-1 ring-black/10">
          {c.map((colour, i) => (
            <span key={i} className="flex-1" style={{ background: colour }} />
          ))}
        </span>
      )}
      <p className="text-[13px] text-muted-foreground">
        {garment.place === country ? country : `${country} · ${garment.place}`}
      </p>
    </div>
  )
}

export function SourceLink({ garment, className }: { garment: Garment; className?: string }) {
  if (!garment.source) return null
  const site = new URL(garment.source).hostname.replace(/^www\./, '')
  return (
    <a
      href={garment.source}
      target="_blank"
      rel="noreferrer"
      className={cn('group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary', className)}
    >
      View on {site === 'modemuze.nl' ? 'Modemuze' : site}
      <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
    </a>
  )
}
