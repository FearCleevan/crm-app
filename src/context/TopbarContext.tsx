import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface TopbarContextValue {
  actions: React.ReactNode
  setActions: (node: React.ReactNode) => void
}

const TopbarContext = createContext<TopbarContextValue>({
  actions: null,
  setActions: () => {},
})

export function TopbarProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActionsState] = useState<React.ReactNode>(null)
  const setActions = useCallback((node: React.ReactNode) => setActionsState(node), [])
  return (
    <TopbarContext.Provider value={{ actions, setActions }}>
      {children}
    </TopbarContext.Provider>
  )
}

export function useTopbar() {
  return useContext(TopbarContext)
}

/**
 * Mount inside a page to inject buttons into the Topbar.
 * Clears automatically when the page unmounts.
 */
export function TopbarSlot({ children }: { children: React.ReactNode }) {
  const { setActions } = useTopbar()
  useEffect(() => {
    setActions(children)
    return () => setActions(null)
  }, [setActions, children])
  return null
}
