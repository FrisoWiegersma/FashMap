# 3D models

Put garment scans here. They load only when a garment is opened, so they don't slow the map down.

1. Export as **`.glb`** (binary glTF) with textures embedded.
2. Compress with Draco and keep each file under ~5 MB:
   `npx gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`
3. Name the file after the garment id: `volendamse-hul.glb`.
4. In `src/data/garments.json`, set that garment's `model` to `"models/volendamse-hul.glb"`.

A garment with `"model": null` shows its Modemuze 360° view, or its photo if it has none. Check a model at https://modelviewer.dev/editor/ before adding it.
