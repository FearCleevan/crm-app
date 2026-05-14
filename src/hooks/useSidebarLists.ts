import { useState, useCallback } from 'react'

export interface ListItem {
  id: string
  label: string
}

function loadItems(key: string, defaults: ListItem[]): ListItem[] {
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as ListItem[]) : defaults
  } catch {
    return defaults
  }
}

function saveItems(key: string, items: ListItem[]): void {
  localStorage.setItem(key, JSON.stringify(items))
}

function useList(storageKey: string, defaults: ListItem[]) {
  const [items, setItems] = useState<ListItem[]>(() => loadItems(storageKey, defaults))

  const add = useCallback((label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    setItems(prev => {
      const next = [...prev, { id: `${storageKey}-${Date.now()}`, label: trimmed }]
      saveItems(storageKey, next)
      return next
    })
  }, [storageKey])

  const rename = useCallback((id: string, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, label: trimmed } : i)
      saveItems(storageKey, next)
      return next
    })
  }, [storageKey])

  const remove = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id)
      saveItems(storageKey, next)
      return next
    })
  }, [storageKey])

  const clearAll = useCallback(() => {
    setItems([])
    saveItems(storageKey, [])
  }, [storageKey])

  return { items, add, rename, remove, clearAll }
}

export function useSidebarLists() {
  const favorites = useList('brisk_favorites', [
    { id: 'f1', label: 'Hot Leads Q2' },
    { id: 'f2', label: 'Enterprise Pipeline' },
  ])
  const projects = useList('brisk_projects', [
    { id: 'p1', label: 'APAC Expansion' },
    { id: 'p2', label: 'SME Outreach' },
  ])
  return { favorites, projects }
}
