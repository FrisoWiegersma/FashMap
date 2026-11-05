import { createElement, type ReactNode } from 'react'

const KEEP = new Set(['p', 'strong', 'b', 'em', 'i', 'br', 'ul', 'ol', 'li'])

/**
 * Story text from Micrio is HTML from a third party. Rebuild it as React elements from a short allow-list instead of
 * injecting it, so no script, style or event handler can come along. Links keep only http(s) targets.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node, key: number): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    if (!(node instanceof Element)) return null
    const tag = node.tagName.toLowerCase()
    const children = [...node.childNodes].map(walk)
    if (tag === 'a') {
      const href = node.getAttribute('href') ?? ''
      return /^https?:\/\//.test(href)
        ? createElement('a', { key, href, target: '_blank', rel: 'noreferrer', className: 'text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary' }, children)
        : createElement('span', { key }, children)
    }
    return KEEP.has(tag) ? createElement(tag, { key }, tag === 'br' ? undefined : children) : createElement('span', { key }, children)
  }
  return <div className={className}>{[...doc.body.childNodes].map(walk)}</div>
}
