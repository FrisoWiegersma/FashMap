// Stories ("verhalen") on Modemuze 360° objects. They are Micrio markers: a point on the spin with a title, a text and
// sometimes images. Loaded live from Micrio (CORS is open), so the text stays Modemuze's and isn't copied into the repo.
// Only Dutch exists for now; the UI says so.

import { useEffect, useState } from 'react'

export type StoryImage = { src: string; title: string; width: number; height: number }
export type Story = { id: string; title: string; body: string; images: StoryImage[]; author?: string }

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

export function loadStories(micrioId: string) {
  if (!cache.has(micrioId)) {
    cache.set(
      micrioId,
      (async () => {
        const info = (await (await fetch(`https://i.micr.io/${micrioId}/info.json`)).json()) as { path?: string }
        const data = (await (await fetch(`${info.path ?? 'https://eu.micr.io/'}${micrioId}/data/pub.json`)).json()) as { markers?: RawMarker[] }
        return (data.markers ?? []).flatMap((m) => {
          const text = parse<Record<string, { title?: string; body?: string }>>(m.i18n, {})
          const t = text.nl ?? text.en ?? Object.values(text)[0]
          if (!t?.title) return []
          return [{ id: m.id, title: t.title, body: t.body ?? '', images: parse<StoryImage[]>(m.images, []).filter((i) => /^https:\/\//.test(i.src)), author: m.data?._meta?.auteur?.[0] }]
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
