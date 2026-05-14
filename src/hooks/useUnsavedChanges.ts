import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Blocks in-app navigation when `isDirty` is true and warns on browser close/refresh.
 * Returns the blocker object — render <UnsavedChangesGuard> alongside to show a confirmation modal.
 */
export function useUnsavedChanges(isDirty: boolean) {
  // Block react-router navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  // Warn on browser close / hard refresh
  useEffect(() => {
    if (!isDirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  return blocker
}
