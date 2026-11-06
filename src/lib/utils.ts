export { cn } from "cn"

/** Object panel width plus its gutter. The map keeps this strip clear on desktop. Same value as `--panel-space` in index.css. */
export const PANEL_SPACE = 470

/** From 768 px the object panel docks next to the map; below it a garment opens the full page. */
export const isDesktop = () => window.innerWidth >= 768
