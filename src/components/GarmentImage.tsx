import { assetUrl, type Garment } from '@/lib/data'

/** The garment photo, or a woven grey swatch while there is no photo yet. Every size but `thumb` shows the whole photo. */
export function GarmentImage({ garment, size }: { garment: Garment; size: 'thumb' | 'card' | 'panel' | 'full' }) {
  const src = size === 'thumb' || size === 'card' ? (garment.thumbnail ?? garment.image) : garment.image
  if (src && size === 'thumb') {
    // The 48 px map-list thumbnail fills its square; cropping reads fine that small.
    return <img src={assetUrl(src)} alt="" loading="lazy" className="size-full object-cover" />
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
    <div className="fm-weave flex size-full flex-col items-center justify-center gap-1 text-muted-foreground" aria-hidden={size === 'thumb' || size === 'card'}>
      {size !== 'thumb' && <span className="font-heading text-xl italic">{garment.type}</span>}
      {(size === 'panel' || size === 'full') && <span className="text-xs text-muted-foreground">No photo yet</span>}
    </div>
  )
}
