import { assetUrl, type Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * The garment photo, or a woven grey swatch while there is no photo yet. Every size but `thumb` shows the whole photo.
 * `fit` is the photo at its own shape, capped by its parent's size, with `className` for its frame: in a small box the
 * blurred fill of `card` reads as a smudge, so small phone rows use this instead.
 */
export function GarmentImage({ garment, size, className }: { garment: Garment; size: 'thumb' | 'card' | 'fit' | 'panel' | 'full'; className?: string }) {
  const src = size === 'thumb' || size === 'card' || size === 'fit' ? (garment.thumbnail ?? garment.image) : garment.image
  if (src && size === 'thumb') {
    // The 48 px map-list thumbnail fills its square; cropping reads fine that small.
    return <img src={assetUrl(src)} alt="" loading="lazy" className="size-full object-cover" />
  }
  if (src && size === 'fit') {
    return <img src={assetUrl(src)} alt={garment.title} loading="lazy" className={cn('block h-auto max-h-full w-auto max-w-full', className)} />
  }
  if (src && size === 'full') {
    return <img src={assetUrl(src)} alt={garment.title} loading="lazy" className="size-full object-contain" />
  }
  if (src) {
    // Modemuze photos range from twice as wide as tall to twice as tall as wide, so filling the box (object-cover)
    // cut off heads and feet. Show the whole photo instead, over a blurred copy of itself so the leftover space
    // takes the photo's own background colour. Same file, so the browser downloads it once.
    return (
      <div className="relative size-full overflow-hidden">
        <img src={assetUrl(src)} alt="" aria-hidden loading="lazy" className="absolute inset-0 size-full scale-110 object-cover blur-2xl" />
        <img src={assetUrl(src)} alt={garment.title} loading="lazy" className="relative size-full object-contain" />
      </div>
    )
  }
  return (
    <div className={cn('fm-weave flex size-full flex-col items-center justify-center gap-1 text-muted-foreground', size === 'fit' && className)} aria-hidden={size === 'thumb' || size === 'card' || size === 'fit'}>
      {size !== 'thumb' && <span className="font-heading text-xl italic">{garment.type}</span>}
      {(size === 'panel' || size === 'full') && <span className="text-xs text-muted-foreground">No photo yet</span>}
    </div>
  )
}
