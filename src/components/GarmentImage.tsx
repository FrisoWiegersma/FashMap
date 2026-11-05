import { assetUrl, type Garment } from '@/lib/data'

/** The garment photo, or a woven grey swatch while there is no photo yet. `full` shows the whole photo, uncropped. */
export function GarmentImage({ garment, size }: { garment: Garment; size: 'thumb' | 'card' | 'panel' | 'full' }) {
  const src = size === 'thumb' || size === 'card' ? (garment.thumbnail ?? garment.image) : garment.image
  if (src) {
    return <img src={assetUrl(src)} alt={size === 'thumb' ? '' : garment.title} loading="lazy" className={size === 'full' ? 'size-full object-contain' : 'size-full object-cover'} />
  }
  return (
    <div className="fm-weave flex size-full flex-col items-center justify-center gap-1 text-muted-foreground" aria-hidden={size === 'thumb' || size === 'card'}>
      {size !== 'thumb' && <span className="font-heading text-xl italic">{garment.type}</span>}
      {(size === 'panel' || size === 'full') && <span className="text-xs text-muted-foreground">No photo yet</span>}
    </div>
  )
}
