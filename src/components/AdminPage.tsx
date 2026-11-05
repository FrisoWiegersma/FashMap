import { Download, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearSessions, sessions } from '@/lib/log'
import { cn } from '@/lib/utils'

const time = (t?: number) => (t ? new Date(t).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '–')
const minutes = (a?: number, b?: number) => (a && b ? `${Math.max(1, Math.round((b - a) / 60000))} min` : '–')

/** Facilitator page at ?admin=1: the logged sessions on this device, as a table and a JSON download. */
export function AdminPage() {
  const [list, setList] = useState(sessions)
  const [arming, setArming] = useState(false)

  // The delete button needs a second click within 4 s; no browser dialog, so a study laptop never gets stuck on one.
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 4000)
    return () => clearTimeout(t)
  }, [arming])

  const download = () => {
    const blob = new Blob([JSON.stringify(Object.fromEntries(list.map((s) => [s.key, s.events])), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fashmap-sessions-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main className="min-h-svh bg-background px-4 py-10 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-[34px] leading-tight text-foreground">FashMap sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logged on this device. Start a session with <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">?p=P07&amp;c=map</code> or{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">c=grid</code>.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!list.length}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-white transition-[background-color,scale] hover:bg-zinc-800 active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Download className="size-4" /> Download JSON
          </button>
          <button
            type="button"
            disabled={!list.length}
            onClick={() => {
              if (!arming) return setArming(true)
              clearSessions()
              setList(sessions())
              setArming(false)
            }}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 transition-[background-color,color,scale] active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              arming ? 'bg-destructive text-white ring-destructive' : 'bg-white text-foreground ring-border hover:bg-muted',
            )}
          >
            <Trash2 className="size-4" /> {arming ? `Click again to delete ${list.length} sessions` : 'Delete all'}
          </button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-float ring-1 ring-black/5">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[13px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-normal">Participant</th>
                <th className="px-4 py-3 font-normal">Condition</th>
                <th className="px-4 py-3 font-normal">Started</th>
                <th className="px-4 py-3 font-normal">Length</th>
                <th className="px-4 py-3 text-right font-normal">Events</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const [p, c] = [s.key.slice(0, s.key.lastIndexOf('-')), s.key.slice(s.key.lastIndexOf('-') + 1)]
                return (
                  <tr key={s.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{p}</td>
                    <td className="px-4 py-3 text-foreground">{c}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{time(s.events[0]?.t)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{minutes(s.events[0]?.t, s.events.at(-1)?.t)}</td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">{s.events.length}</td>
                  </tr>
                )
              })}
              {!list.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No sessions yet. Open the app with a participant code to start one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
