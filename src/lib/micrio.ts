// Stories ("verhalen") on Modemuze 360° objects. They are Micrio markers: a point on the spin with a title, a text and
// sometimes images. Loaded live from Micrio (CORS is open). Modemuze only writes them in Dutch, so
// src/data/stories-en.json holds English translations per Micrio id and marker id. A story without a translation
// (for example one Modemuze adds later) is shown in Dutch.

import { useEffect, useState } from 'react'
import { averageRgb } from '@/lib/data'

export type StoryImage = { src: string; title: string; width: number; height: number }
export type Story = { id: string; title: string; body: string; images: StoryImage[]; author?: string; lang: 'en' | 'nl' }
type Translations = Record<string, Record<string, { title: string; body: string }>>

type RawMarker = { id: string; i18n?: string | Record<string, { title?: string; body?: string }>; images?: string | StoryImage[]; data?: { _meta?: { auteur?: string[] } } }

const parse = <T,>(v: string | T | undefined, fallback: T): T => {
  if (typeof v !== 'string') return v ?? fallback
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

const cache = new Map<string, Promise<Story[]>>()

/** English titles and texts of one object's stories, by marker id. Loaded on first use, so the translations
 * aren't part of the map's start-up bundle. */
export async function loadTranslations(micrioId: string) {
  return ((await import('@/data/stories-en.json')).default as Translations)[micrioId] ?? {}
}

export function loadStories(micrioId: string) {
  if (!cache.has(micrioId)) {
    cache.set(
      micrioId,
      (async () => {
        const info = (await (await fetch(`https://i.micr.io/${micrioId}/info.json`)).json()) as { path?: string }
        const data = (await (await fetch(`${info.path ?? 'https://eu.micr.io/'}${micrioId}/data/pub.json`)).json()) as { markers?: RawMarker[] }
        const english = await loadTranslations(micrioId)
        return (data.markers ?? []).flatMap((m): Story[] => {
          const text = parse<Record<string, { title?: string; body?: string }>>(m.i18n, {})
          const t = text.nl ?? text.en ?? Object.values(text)[0]
          if (!t?.title) return []
          const en = english[m.id]
          const images = parse<StoryImage[]>(m.images, []).filter((i) => /^https:\/\//.test(i.src))
          return [{ id: m.id, title: en?.title ?? t.title, body: en?.body ?? t.body ?? '', images, author: m.data?._meta?.auteur?.[0], lang: en ? 'en' : 'nl' }]
        })
      })().catch((e) => {
        cache.delete(micrioId) // let a later open try again
        throw e
      }),
    )
  }
  return cache.get(micrioId)!
}

/** Stories of a Micrio object, or [] while loading, without a Micrio id, or when the request fails. */
export function useStories(micrioId: string | null) {
  const [stories, setStories] = useState<{ id: string | null; list: Story[] }>({ id: null, list: [] })
  useEffect(() => {
    if (!micrioId) return
    let live = true
    loadStories(micrioId)
      .then((list) => live && setStories({ id: micrioId, list }))
      .catch(() => live && setStories({ id: micrioId, list: [] }))
    return () => {
      live = false
    }
  }, [micrioId])
  return stories.id === micrioId ? stories.list : []
}

/**
 * The average colour of the middle of a garment's photo, where the garment stands rather than the studio backdrop.
 * Micrio's IIIF server crops it and shrinks it to 24 px (CORS is open), and a canvas averages that. Null until it loads.
 */
export function useTone(image: string | null) {
  const [tone, setTone] = useState<{ image: string; rgb: string } | null>(null)
  useEffect(() => {
    const base = image?.match(/^https:\/\/iiif\.micr\.io\/[^/]+/)?.[0]
    if (!base) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      setTone({ image: image!, rgb: averageRgb(ctx.getImageData(0, 0, canvas.width, canvas.height).data) })
    }
    img.src = `${base}/pct:30,20,40,60/24,/0/default.jpg`
    return () => {
      img.onload = null
    }
  }, [image])
  return tone?.image === image ? tone.rgb : null
}
