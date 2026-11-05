# FashMap brand assets

The final symbol is the exact dress-in-a-map-pin artwork supplied by the user, recoloured from red to cobalt `#2D5BFF`. Its original geometry is preserved; the white background and dress become transparent. It was not redrawn. The header pairs it with live Newsreader text so the name stays sharp at every screen density.

## Files

- `fashmap-symbol-reference.png`: supplied artwork, unchanged (1536 × 1024).
- `fashmap-symbol-master.png`: transparent cobalt master on the same canvas.
- `../../src/assets/brand/fashmap-symbol.png`: 96 × 96 header icon.
- `../../public/brand/`: transparent 16, 32 and 48 pixel favicon PNGs, and 192 and 512 pixel square icons.
- `../../public/favicon.ico`: 16, 32 and 48 pixel frames.
- `../../public/apple-touch-icon.png`: 180 × 180 with a white background for the home screen.

These are raster assets, not vectors. Keep the artwork on light neutral surfaces and preserve its aspect ratio.

## Header

Desktop shows the symbol and name. Below 640 pixels, Watermelon's Morphing Button starts with the symbol alone. Tap or press Enter/Space to reveal the name; tap again, click outside, or press Escape to collapse it. The control exposes its expanded state, retains keyboard focus on Escape, and respects reduced motion. The header wraps its controls when space is limited.

The GitHub link is adapted from Watermelon Button 21 and opens the project repository in a new tab.

## Exporting again

ImageMagick is an export tool, not an application dependency. The green channel of this specific red-on-white source supplies the opacity mask; near-white background noise is removed without redrawing the contours. From the repository root:

```sh
magick docs/brand/fashmap-symbol-reference.png -alpha off -channel G -separate +channel -negate -fx 'u < 0.02 ? 0 : (u > 0.98 ? 1 : u)' /tmp/fashmap-reference-alpha.png
magick -size 1536x1024 xc:'#2D5BFF' /tmp/fashmap-reference-alpha.png -alpha off -compose CopyOpacity -composite -strip docs/brand/fashmap-symbol-master.png
magick docs/brand/fashmap-symbol-master.png -trim +repage -resize 896x896 -gravity center -background none -extent 1024x1024 -strip /tmp/fashmap-icon-master.png
magick /tmp/fashmap-icon-master.png -resize 96x96 -strip src/assets/brand/fashmap-symbol.png
magick /tmp/fashmap-icon-master.png -resize 16x16 -strip public/brand/favicon-16.png
magick /tmp/fashmap-icon-master.png -resize 32x32 -strip public/brand/favicon-32.png
magick /tmp/fashmap-icon-master.png -resize 48x48 -strip public/brand/favicon-48.png
magick public/brand/favicon-16.png public/brand/favicon-32.png public/brand/favicon-48.png public/favicon.ico
magick /tmp/fashmap-icon-master.png -resize 180x180 -background white -alpha remove -alpha off -strip public/apple-touch-icon.png
magick /tmp/fashmap-icon-master.png -resize 192x192 -strip public/brand/icon-192.png
magick /tmp/fashmap-icon-master.png -resize 512x512 -strip public/brand/icon-512.png
```
