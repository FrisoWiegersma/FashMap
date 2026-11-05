// Evaluation logging (roadmap F10) and eval mode (F11). Everything is set by the URL:
//   ?p=P07&c=map   participant P07, map condition: logs events and locks the view
//   ?admin=1       list, download and clear the stored sessions
// Without ?p nothing is logged, so normal use and development leave no traces.
// Don't rename events once a study has started; only add new ones.

const params = new URLSearchParams(window.location.search)
const c = params.get('c')

export const participant = params.get('p')
export const lockedView: 'map' | 'grid' | null = c === 'map' || c === 'grid' ? c : null
export const isAdmin = params.has('admin')

const PREFIX = 'fashmap-log-'
const key = participant ? `${PREFIX}${participant}-${lockedView ?? 'free'}` : null

export type LogEvent = { t: number; event: string } & Record<string, unknown>

// ponytail: rewrites the whole session array per event, fine for a few thousand events per session.
export function log(event: string, data: Record<string, unknown> = {}) {
  if (!key) return
  try {
    const events: LogEvent[] = JSON.parse(localStorage.getItem(key) ?? '[]')
    events.push({ t: Date.now(), event, ...data })
    localStorage.setItem(key, JSON.stringify(events))
  } catch {
    // Storage full or blocked: the study runs on, and the facilitator sees a short log in ?admin=1.
  }
}

export function sessions() {
  const out: { key: string; events: LogEvent[] }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX)) out.push({ key: k.slice(PREFIX.length), events: JSON.parse(localStorage.getItem(k) ?? '[]') })
  }
  return out.sort((a, b) => (a.events[0]?.t ?? 0) - (b.events[0]?.t ?? 0))
}

export function clearSessions() {
  for (const s of sessions()) localStorage.removeItem(PREFIX + s.key)
}
