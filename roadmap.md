# FashMap roadmap

FashMap shows cultural dress on a map with a timeline and 3D object views.
Research question: does a map with a timeline filter and 3D views help students understand where and when garments come from better than a standard image grid (Modemuze-style)?

Team 7 (HCI & IV): Narek Sergeyan, Friso Wiegersma.

## Status

F1–F13 are built (F9 in its light version). After the HCI/IV review, the map condition gained a map key and data-source credit, the open garment's band on the timeline, a date-precision bar and Play (in F2, F3, F5). Next up: Eval 1 (23–29 Nov).

## Milestones

| Milestone | Week | Deadline | Scope |
|---|---|---|---|
| M0 | 45 (2–8 Nov) | | Project setup, placeholder data, map + place dots (F1, F2), timeline (F5) |
| M1 | 46 (9–15 Nov) | 13 Nov design document | Place list (F3), object panel with 3D (F4) |
| M2 | 47 (16–22 Nov) | Prototype ready 23 Nov | Grid view (F6), Map/Grid toggle (F8), real data |
| Eval 1 | 48 (23–29 Nov) | | Think-aloud usability test, 5 students |
| M3 | 49 (30 Nov–6 Dec) | 4 Dec report 1 | Eval-1 fixes, filters (F7), logging (F10), eval mode (F11) |
| Eval 2 | 50 (7–13 Dec) | | Map vs. grid, 10–12 students, counterbalanced |
| M4 | 51–53 | 16 Dec report 2, 18 Dec concept paper, 2 Jan final | Stretch: histogram (F12), polish |
| Demo | 1 (4–8 Jan 2027) | | Final presentation |

## Stack

Vite + React + TypeScript, Tailwind v4, shadcn/ui. Components come from the Watermelon UI (`@watermelon`) and Kokonut UI (`@kokonutui`) registries. Map: `react-map-gl` (MapLibre) on OpenFreeMap vector tiles (open source, no API key). 360° views: `@micrio/client`. 3D: `@google/model-viewer`. Data: one static JSON file. Hosting: GitHub Pages or a Docker image served by Nginx.

Install feature dependencies when the feature is built, not before.

## Data

### Garment record (`src/data/garments.json`)

128 garments from the Modemuze 360° collection (https://modemuze.nl/360-collection), built by `scripts/modemuze.ts`.

```json
{
  "id": "volendamse-hul",
  "title": "Volendam cap (hul)",
  "museum": "Zuiderzeemuseum Enkhuizen",
  "type": "headwear",
  "dateLabel": "ca. 1960",
  "start": 1950,
  "end": 1970,
  "place": "Volendam",
  "country": "NL",
  "lat": 52.495,
  "lng": 5.071,
  "description": "…",
  "objectNumber": "020986",
  "maker": "Anonymous",
  "materials": ["lace", "cotton"],
  "techniques": ["starching", "pleating"],
  "rights": "In copyright",
  "image": "https://iiif.micr.io/<micrio>/full/1200,/0/default.jpg",
  "thumbnail": "https://iiif.micr.io/<micrio>/full/480,/0/default.jpg",
  "model": null,
  "source": "https://modemuze.nl/volendamse-hul",
  "micrio": "<micrio id>"
}
```

- `id` is the Modemuze slug. `dateLabel` is the English form of the museum's date, and the UI shows it; `start` and `end` are for filtering.
- `micrio` is the Micrio id of the 360° photo spin. The spin, its points ("stories") and the photos load live from Micrio. English story translations live in `src/data/stories-en.json`, keyed by Micrio and marker id, and load only when a garment is opened. Stories without translations fall back to Dutch.
- `model` is a path to our own `.glb` scan in `public/models/` (see the README there), or `null`. A garment shows its spin when it has one, otherwise its model, otherwise its photo.
- `type` is one of: dress, outfit, coat, top, skirt, headwear, footwear, jewellery, accessory, armour.
- `objectNumber`, `maker` and `rights` are `null` when unknown. Unknown makers are "Anonymous" (Modemuze "Anoniem") or "Unknown" ("onbekend").
- Places are not stored separately. The app groups garments by `place` at runtime. The importer gives every record of a place the same coordinates.

### Data import (`node scripts/modemuze.ts <raw.json>`)

1. If `<raw.json>` doesn't exist, the script fetches every object page and geocodes its first place with Nominatim (once a second). The raw file holds Modemuze's Dutch texts, so keep it out of the repo.
2. It then writes `garments.json`:
   - **Facts** (museum, object number, maker, materials, techniques, date, place) come from the page's tags, translated to English with the dictionaries in the script. Unknown words are printed as warnings.
   - **Title, type and description** come from `scripts/modemuze-en.json`, written by hand: an English title and a short summary in our own words. Museum texts are not copied (copyright); "View on Modemuze" links to them.
   - **Dates:** `ca. 1900` → 1890–1910 (±10), `1850-1875` → 1850–1875, `19de eeuw` → 1800–1899, `Eerste helft 20e eeuw` → 1900–1949, `Midden 20ste eeuw` → 1933–1966. Notes in brackets are dropped.
   - **Places:** the first named place, in English. `PLACES` in the script fixes the empty and wrongly geocoded ones, and places the text names more exactly ("Zaan region").
   - **Left out:** 8 objects with no place of origin on Modemuze or in their text (`NO_PLACE`). They come back once a place is known.
3. `npm run check` runs asserts for the date, place and maker parsers.

## Shared state

One `useState` set in `App`, with no state library:

| State | Type | Default |
|---|---|---|
| `period` | `[from, to]` | `[1500, currentYear]` |
| `filters` | `{ types: string[], museums: string[] }` | empty (everything visible) |
| `selectedPlace` | `string \| null` | `null` |
| `selectedGarment` | `string \| null` | `null` |
| `view` | `'map' \| 'grid'` | `'map'`, or the value of `?c=` |

Derived with `useMemo`:
- `filtered`: garments that pass the type and museum filters.
- `places`: `filtered` grouped by place, each with `count`, `inPeriodCount` and `lat`/`lng`.

A garment is in the period when `start <= to && end >= from`. Every view reads this derived data, so moving the slider or changing a filter updates the map, list, panel and grid in the same render.

## Features

Each feature lists what it does, which components it uses, the details, and when it counts as done.

### F1. App shell (M0)

- **What:** one full-screen page with a header (name, filters, Map/Grid toggle), the map in the middle, the object panel docked on the right, and the timeline at the bottom.
- **Components:** a custom CSS grid (`grid-template-rows: auto 1fr auto`). No registry block fits a full-screen map app: the Watermelon dashboards are admin shells.
- **Details:**
  - The panel takes space next to the map instead of covering it, so the map stays visible.
  - Narrow screens can stack the panel under the map. Participants use laptops, so this isn't needed for the evaluations.
- **Done when:** the map, timeline and header are visible at 1280×800, and opening the panel doesn't hide the selected dot.

### F2. Map with place dots (M0)

- **What:** one circle per place. A bigger circle means more garments. Places with no garments in the selected period fade out.
- **Components:** `react-leaflet` with `MapContainer` and `CircleMarker`. Base map: OpenFreeMap Positron vector tiles (open source, no key, no limits), recoloured to neutral greys in `MapView.tsx` and loaded lazily through `@maplibre/maplibre-gl-leaflet`. Keep the attribution. CARTO needs an API key now, so it is no longer used. Checked Watermelon `view-on-map`: it is a static location card and doesn't fit.
- **Details:**
  - The radius uses `√count`, so area grows with count, clamped to 6–30 px.
  - Places with `inPeriodCount = 0` get opacity 0.15 and stay clickable. The radius follows `inPeriodCount`.
  - Dots are the only colour on the map: cobalt `#2D5BFF` with a white stroke. The dot tooltip and the place list name the country with its flag emoji. Places outside the period become a hollow grey ring, so shape carries the change as well as colour. The selected place gets a black ring.
  - Dots with more than one garment show the count inside.
  - The selected place gets a thicker dark stroke.
  - The initial view fits all places. On a small screen, zoom to Europe and Africa.
  - The dots are SVG, so they can be focused with the keyboard and animate. Switch to canvas only if there are more than ~1000 places.
- **Accessibility:** markers can be reached with the keyboard (Enter opens them), and each has an aria label such as "Volendam, 12 garments".
- **Done when:** moving the slider fades dots without lag, and dot size matches the counts in the data.

### F3. Place list (M1)

- **What:** clicking a dot opens a small list of that place's garments, each with a thumbnail, title and `dateLabel`.
- **Components:** react-leaflet `<Popup>` with React children, with the rows styled in Tailwind. Alternative if the popup feels cramped: Kokonut **Stack Panel** (`@kokonutui/stack-panel`), which drills from place to garment inside the side panel.
- **Details:**
  - Garments outside the period stay in the list but are dimmed, with a label such as "outside period".
  - The list is sorted by `start`.
  - The list scrolls after about 6 rows. Thumbnails are 48 px with `loading="lazy"`.
  - The header shows the place and country, and the count, for example "12 garments".
  - Clicking a row sets `selectedGarment` and opens F4. The popup stays open, and the map keeps the dot 170 px clear of the panel so the list isn't covered.
  - A place with more than one garment adds its span to the header ("Japan, 3 garments, 1920–1989"). A per-place time strip was tried and dropped: next to each row's date and precision bar it said the same thing twice.
  - **Date precision:** each row's `dateLabel` gets a `DateSpan`: a 40 px track with a cobalt segment as wide as the date range (1 year to 100+ years). Narrow means exact, wide means vague; its label reads "Exact year" or "Dated to a 21-year range". The timeline view (F13) uses it too; the grid baseline doesn't.
- **Open decision:** a list after the click (recommended) or opening the first garment directly. Confirm with the paper prototype.
- **Done when:** a place with 10 or more garments shows a scrollable list, and picking a row opens the panel.

### F4. Object panel (M1)

- **What:** the panel next to the map for the selected garment: a 3D view (or the photo), then the title, `dateLabel`, place, museum, type, description and a link to the source.
- **Components:**
  - A custom non-modal `<aside>`. shadcn/Watermelon `sheet` is a modal dialog that blocks the map.
  - `@google/model-viewer` with `camera-controls`, `touch-action="pan-y"`, and `poster` set to the thumbnail.
  - Kokonut **Loader** while the model loads.
  - A Watermelon `badge-<n>` for the type.
  - Slide-in via `motion`, which the registry components already pull in.
- **Details:**
  - Lazy 3D: run `import('@google/model-viewer')` the first time the panel opens with a model, so the map bundle stays small.
  - Use Draco-compressed `.glb` files, under ~5 MB each.
  - If there is no model, show `image` at full panel width.
  - Clicking the place name flies the map to that place (`map.flyTo`).
  - Close with the X button and with Esc. Focus returns to the list row that opened the panel.
  - "Open full page" shows the 360° view, the photos and the stories at full size. From 1024 px they are three columns. Below that, one media area stays at the top, with a 360°/Photos switch and the close button on it, and only the text underneath scrolls. That way a point on the spin and its story are on screen together, and opening a story switches back to the 360° view.
  - On phones (under 768 px) a tap opens the full page directly and skips the panel. There the panel covered the map and showed the same things. Closing the page closes the garment, and its place link goes back to the map.
  - The full page is a browser history entry (`pushState`), so Back or a phone's back swipe closes it instead of leaving the site. Its X and Esc also go back through history, so no stale entry is left.
  - Photos and the 360° view sit on a blurred copy of the garment photo (Narek's `card` technique), so the pane takes the photo's own backdrop colour instead of framing it like a picture in a box. On phones the full-page photo uses the pane's full height, with the controls on top as on the 360° view. An expanded story also shows its images inline below its text on narrow screens; tapping one opens that image in the existing photo pane, where it can be enlarged and zoomed.
  - **Country colours (12 Nov):** the panel and the full page take the garment's country flag colours: a short stripe rule above the title, then the country and place in text (no emoji; the rule is the flag) (`CountryLine` in `ObjectPanel.tsx`). Colours live in `FLAG_COLOURS` in `data.ts`; `data.check.ts` checks every country in the data has a row. A new country without a row shows no rule. Points, dots and links stay cobalt: recolouring them per flag was tried and rejected. It shows in both study conditions, since the grid baseline opens the same panel, so the only differences between conditions stay map, timeline and 3D. A Modemuze-style theme (pink, Raleway) was tried the same day and rejected.
  - **Garment tone (12 Nov):** each garment page takes a pale wash of the garment's own colour, like a museum room painted for one object: the full page's background (oklch lightness 0.94, chroma ≤ 0.03) and the side panel's text area (0.982, ≤ 0.012, so muted text keeps AA). `useTone` in `micrio.ts` asks Micrio's IIIF server for the photo's centre at 24 px and averages it, weighted by colourfulness (`averageRgb` in `data.ts`) so the grey backdrop and mannequin barely count. It carries no where or when, so it shows in both study conditions. Dates under the title are set in Newsreader italic, like a museum label.
  - Every 360° view calls Micrio's `destroy()` when it closes. Otherwise its WebGL context stays alive until garbage collection, and after about eight garments Chrome drops the oldest context, which is the map's (it shows a sad face).
- **Done when:** a garment with a model can be rotated and zoomed, one without a model shows its photo, and the map stays usable while the panel is open.

### F5. Timeline (M0)

- **What:** a slider from 1500 to the current year, at the bottom. Moving it updates the map right away.
- **Components:** the shadcn/Radix `slider` with two thumbs (keyboard accessible, with arrow and Page keys built in). Alternative: Watermelon `range-selection-slider`, after checking that it supports two thumbs. D3 isn't needed.
- **Details:**
  - Each thumb shows its year. There are tick labels every century.
  - Update on `onValueChange` (live), not on release.
  - The step is 5 years, and the default is the full range.
  - A "Reset" link appears once the range has changed.
  - **Open garment:** with a garment open, a cobalt band spans its years behind the bars and the slider, with its `yearRange` in a pill, so you see where it sits in the period.
  - **Play:** a round cobalt Play/Pause button on the slider's line, like a media player. It glides the window forward at 25 years a second (1500 to now in about 19 s), one year per tick with the position taken from the clock, and stops at the end. It keeps a narrowed window's width and position, or starts at 1500 with 50 years. Dragging a thumb or Reset stops it. The numerals don't roll while it plays. The rule is `shiftWindow` in `data.ts`, with asserts in `data.check.ts`.
  - **Map key and source:** an Info button above the zoom buttons opens a map key, drawn with the map's own dot classes and sizes (`DOT` and `dotRadius`): 1 garment, 3 garments, none in this period, nearby places merged. It stays open until the button closes it, so you can read the map with it. Its footer and the map attribution ("Garments: Modemuze") credit the source. Desktop only, like the zoom buttons; a row of it in the timeline card was too busy.
- **Open decision:** a period range (recommended, because garments are dated as ranges) or a single year with a ±25-year window. Confirm with the paper prototype.
- **Done when:** dragging a thumb updates the dots with no visible lag, and the slider works with only the keyboard.

### F6. Grid view, the baseline condition (M2)

- **What:** the same garments as a grid of photos, like Modemuze. It is the comparison condition in Eval 2.
- **Components:** a Watermelon `card-<n>` (pick a plain variant) in a CSS grid (`grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`).
- **Details:**
  - Each card shows the photo, title, `dateLabel` and place as text.
  - The grid uses the same filters as the map (F7).
  - It has no timeline and no map: in Modemuze, period and place only appear as text.
  - Clicking a card opens a detail view with the photo and the same metadata.
  - In the eval grid condition (`?c=grid`) there is no 3D, so it stays a fair stand-in for a standard collection site. The 3D view is part of what is being tested.
  - Outside eval mode the grid is just another way to browse, so its panel and full page show the 360° view and stories too.
- **Open decision:** grid parity (period filter yes or no, 3D yes or no in the eval condition). Confirm with the assistant before Eval 2.
- **Done when:** all garments that pass the filters appear, and a card opens its details.

### F7. Filters (M3)

- **What:** multi-select filters for garment type and museum, in the header.
- **Components:** Watermelon `filter-disclosure`, or `combobox-<n>` / `dropdown-menu-<n>` with checkboxes. A Watermelon `badge-<n>` shows the number of active filters, and there is a "Clear all" button.
- **Details:**
  - Options come from the data, with a count per option.
  - Filters apply to the map, the list and the grid at once.
  - An empty selection means everything is shown.
- **Done when:** filtering on one type removes the dots and grid cards of other types, and "Clear all" restores everything.

### F8. Map/Grid toggle (M2)

- **What:** a switch between the map view and the grid view.
- **Components:** Watermelon `continuous-tabs` (two options with a sliding pill).
- **Details:**
  - Filters and the selected garment stay the same when switching.
  - In eval mode the toggle is hidden (F11).
- **Done when:** switching keeps the filter state.

### F9. Grouping when zoomed out (built early, light version)

- **What:** places that overlap when zoomed out merge into one circle. Volendam and Marken are about 5 km apart.
- **Components:** no dependency. `clusterByPixels` in `src/lib/data.ts` merges dots that would overlap at the current zoom, and the biggest place anchors each group. It was built early because the world overview was unreadable without it. Switch to `supercluster` if there are more than ~1000 places.
- **Details:**
  - The cluster icon is sized by the total garment count, not by the number of places, and uses the same colour as the dots.
  - Clicking a cluster zooms in.
  - The fade-out rule (F2) applies to clusters too: a cluster fades when none of its garments are in the period.
- **Done when:** at country zoom, the dots in North Holland form one cluster whose size reflects the total.

### F10. Evaluation logging (M3)

- **What:** record clicks and time for the evaluation.
- **Components:** none. A `log(event, data)` function that appends `{t, event, ...data}` to an array in localStorage.
- **Details:**
  - The URL sets the participant and condition: `?p=P07&c=map`. The storage key is `fashmap-log-P07-map`.
  - Events:
    - `session_start`
    - `view_change`
    - `place_open`
    - `garment_open`
    - `garment_close`
    - `period_change`, debounced to 500 ms
    - `filter_change`
    - `model_interact`, the first rotate or zoom per garment
    - Added with F13 (new values, nothing renamed): `view_change` with `to: 'timeline'`, and `garment_open` with `from: 'timeline'`. They only occur in free sessions (`?p=` without `c`).
    - `period_play` (new): `{ playing, from, to }` on Play and on Pause or the end. `period_change` still fires once the steps stop.
  - The page `?admin=1` lists the stored logs, offers a JSON download, and can clear them.
  - There is no backend, which fits GitHub Pages. Tasks, answers and the SUS questionnaire go in a Google Form. Time per task comes from the timestamps.
  - Don't rename events once a study has started.
- **Done when:** a test session can be downloaded as JSON with all the events above.

### F11. Eval mode (M3)

- **What:** lock the condition for a participant.
- **Components:** none. Read `URLSearchParams`.
- **Details:**
  - `?c=map` or `?c=grid` fixes the view and hides the toggle.
  - Without `c`, the normal app shows the toggle.
  - The order alternates between participants. The facilitator opens the right URL.
- **Done when:** `?c=grid` shows only the grid, with no way to switch.

### F12. Histogram above the slider (stretch, M4)

- **What:** small bars above the timeline showing how many garments there are per period.
- **Components:** plain SVG, one `<rect>` per 25-year bin, with no chart library. Kokonut Pro "Price Range" fits but is paid.
- **Details:**
  - It counts `filtered` garments, so it follows the filters.
  - Bins inside the selected period are full colour; bins outside are greyed.
  - A garment is counted in every bin it overlaps.
- **Done when:** the bars line up with the slider's years, and changing a filter updates them.

### F13. Timeline view (outside eval mode)

- **What:** a third view next to Map and Grid: every garment that passes the filters, oldest first, in a carousel of museum date groups. It answers "when" the way the map answers "where". Suggested by a test user (Friso's mother).
- **Components:** Kokonut Momentum Rail (`carousel-cards`), installed with the shadcn CLI and adapted in place. Its mouse flick, spring snapping, native touch scrolling and keyboard navigation are retained; travel examples, favourites and cover-flow effects are removed. The shared SVG date junctions use the installed Motion library. The third tab uses the existing Watermelon `continuous-tabs`. `byDate` and `byCentury` in `src/lib/data.ts` supply the groups and century shortcuts.
- **Details:**
  - Ordered, not to scale: most garments date from after 1850, so a true axis would be mostly empty space with a pile-up at the end.
  - Garments with the same start and end years share one date label and SVG junction, branching to their photos. Possible overlaps between different museum date ranges are not grouped. The centred date group has a cobalt junction; the selected garment has a cobalt photo ring. Each photo keeps its title and place.
  - The carousel works horizontally on phones too, with the whole date group fitting the available width. There are no sticky century headings over scrolling photos. Tapping a garment opens its existing full page.
  - Century chips with counts jump to the first date in that century; the active century follows the centred group. Previous/Next controls and an announced date counter supplement swipe, wheel, drag, Arrow keys, Home and End. Reduced motion makes the spring and SVG response immediate.
  - It follows the type and museum filters, not the period slider, because the rail is itself the time axis.
  - The open garment's card scrolls clear of the panel. "Place" in the panel switches to the map and flies there.
  - Hidden in eval mode: `?c=map|grid` hides the toggle, so the study conditions don't change.
- **Done when:** the rail scrolls by wheel, trackpad and touch, a chip jumps to its century, a filter removes cards, and a card opens the panel without being hidden by it.

## Cross-cutting requirements

- **Brand:** the user's supplied dress-in-a-map-pin artwork, recoloured to cobalt without redrawing, paired with the Newsreader wordmark. The full name shows from 640 px; on smaller screens Watermelon's Morphing Button reveals it on tap and closes on a second tap, an outside tap or Escape. Header controls wrap when needed. A Watermelon Button 21 links to GitHub; it's hidden below 640 px so the header (with three view tabs) stays on one row on a phone. The symbol supplies the favicon and touch icons; the original reference and transparent PNG master live in `docs/brand/`. These are raster assets, not vectors.
- **Overview first, details on demand:** the map shows only dots until the user clicks.
- **Linked views:** one state, so a change shows up everywhere in the same render.
- **No instructions needed:** visible labels, obvious controls, an empty state ("No garments in this period"), a map key for the dots on desktop and a source credit in the map attribution (F5).
- **Colour-blind safe:** one accent hue (cobalt) on neutral greys (a garment page adds only a small flag stripe rule, always above the country name), and information is never carried by colour alone: size, count labels and the hollow-ring shape carry it too. Check with Chrome DevTools > Rendering > Emulate vision deficiencies.
- **Accessibility:** keyboard access to every control, visible focus, WCAG AA contrast, `prefers-reduced-motion` respected (the `motion` components support it).
- **Performance:**
  - Lazy 3D (F4), a lazy vector base map (MapLibre), and lazy thumbnails. The app bundle is about 190 kB gzipped.
  - Target: the map can be used within 2 s on university Wi-Fi.
- **Deploy:**
  - GitHub Pages through a GitHub Actions workflow (`npm ci && npm run build`, then `actions/deploy-pages`).
  - Vite `base: '/FashMap/'` for GitHub Pages.
  - Docker: a Node.js 24 build stage builds with `--base=/`, then Nginx serves the static files with `nginx.conf`, which makes browsers revalidate `index.html` (`no-cache`) so a redeploy never leaves a stale page pointing at removed hashed files. The image patches nginx's MIME types so the map's `.mjs` worker is served as JavaScript, and the build fails if that patch stops matching. `docker compose up -d --build` binds to localhost on `${FASHMAP_PORT:-8080}`. The homelab runs from `/home/frisowiegersma/fashmap` as `frisowiegersma`, with `FASHMAP_PORT=8081` in its untracked `.env`. The existing Cloudflare tunnel routes `https://fashmap.frisowiegersma.com` to `http://localhost:8081`; no Tailscale Serve changes are needed. Study URLs use `/` and logs remain in each browser's local storage. On deployment failure, stop only the FashMap service.

## Open decisions

| Decision | Recommendation | Decide by |
|---|---|---|
| Period slider or single year | Period (two thumbs) | Paper prototype |
| List after click or open first garment | List | Paper prototype |
| Grid parity: period filter and 3D in the grid? | No: keep it Modemuze-like | Meeting with assistant before Eval 2 |
| Data source | Modemuze/Europeana photos + the 3D artist's models | Already due 30 Oct, so confirm now |
