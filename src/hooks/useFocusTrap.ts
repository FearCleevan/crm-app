import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps keyboard focus inside the returned ref's element while `active` is true.
 * Focuses the first focusable element on activation and restores focus on deactivation.
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    const el = containerRef.current
    if (!el) return

    previousFocusRef.current = document.activeElement as HTMLElement

    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter(node => !node.closest('[hidden]'))

    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    // Focus first element after a paint so the element is visible
    const raf = requestAnimationFrame(() => first?.focus())

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (focusable.length === 0) { e.preventDefault(); return }
      const activeEl = containerRef.current
      if (!activeEl) return

      if (e.shiftKey) {
        if (document.activeElement === first || !activeEl.contains(document.activeElement)) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last || !activeEl.contains(document.activeElement)) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    el.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [active])

  return containerRef
}
