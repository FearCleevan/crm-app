import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { favoritesService } from '@/services/favorites.service'
import { projectsService } from '@/services/projects.service'

export interface ListItem {
  id: string
  label: string
}

const LS_FAV  = 'brisk_favorites'
const LS_PROJ = 'brisk_projects'

function drainLocalStorage(key: string): ListItem[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const items = JSON.parse(raw) as ListItem[]
    localStorage.removeItem(key)
    return Array.isArray(items) ? items : []
  } catch {
    localStorage.removeItem(key)
    return []
  }
}

export function useSidebarLists() {
  const { user } = useAuth()
  const userId = user?.id

  const [favItems,  setFavItems]  = useState<ListItem[]>([])
  const [projItems, setProjItems] = useState<ListItem[]>([])

  // Load from Supabase on mount; migrate localStorage items if DB is empty
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function init() {
      try {
        const [favs, projs] = await Promise.all([
          favoritesService.getAll(userId!),
          projectsService.getAll(userId!),
        ])

        if (cancelled) return

        // Migrate localStorage → DB if the user has no DB rows yet
        if (favs.length === 0) {
          const legacy = drainLocalStorage(LS_FAV)
          if (legacy.length > 0) {
            await Promise.all(legacy.map(i => favoritesService.create(userId!, i.label)))
            const migrated = await favoritesService.getAll(userId!)
            if (!cancelled) setFavItems(migrated)
          } else {
            if (!cancelled) setFavItems([])
          }
        } else {
          localStorage.removeItem(LS_FAV)
          if (!cancelled) setFavItems(favs)
        }

        if (projs.length === 0) {
          const legacy = drainLocalStorage(LS_PROJ)
          if (legacy.length > 0) {
            await Promise.all(legacy.map(i => projectsService.create(userId!, i.label)))
            const migrated = await projectsService.getAll(userId!)
            if (!cancelled) setProjItems(migrated)
          } else {
            if (!cancelled) setProjItems([])
          }
        } else {
          localStorage.removeItem(LS_PROJ)
          if (!cancelled) setProjItems(projs)
        }
      } catch {
        // Silently fall through — sidebar will just show empty lists
      }
    }

    init()
    return () => { cancelled = true }
  }, [userId])

  // ── Favorites mutations ──────────────────────────────────────
  const addFavorite = useCallback(async (label: string) => {
    if (!userId || !label.trim()) return
    try {
      const item = await favoritesService.create(userId, label.trim())
      setFavItems(prev => [...prev, item])
    } catch {
      toast.error('Could not save favorite')
    }
  }, [userId])

  const renameFavorite = useCallback(async (id: string, label: string) => {
    if (!label.trim()) return
    setFavItems(prev => prev.map(i => i.id === id ? { ...i, label: label.trim() } : i))
    try {
      await favoritesService.rename(id, label.trim())
    } catch {
      toast.error('Could not rename favorite')
    }
  }, [])

  const removeFavorite = useCallback(async (id: string) => {
    setFavItems(prev => prev.filter(i => i.id !== id))
    try {
      await favoritesService.remove(id)
    } catch {
      toast.error('Could not remove favorite')
    }
  }, [])

  const clearAllFavorites = useCallback(async () => {
    const snapshot = favItems
    setFavItems([])
    try {
      await Promise.all(snapshot.map(i => favoritesService.remove(i.id)))
    } catch {
      toast.error('Could not clear favorites')
    }
  }, [favItems])

  // ── Projects mutations ───────────────────────────────────────
  const addProject = useCallback(async (label: string) => {
    if (!userId || !label.trim()) return
    try {
      const item = await projectsService.create(userId, label.trim())
      setProjItems(prev => [...prev, item])
    } catch {
      toast.error('Could not save project')
    }
  }, [userId])

  const renameProject = useCallback(async (id: string, label: string) => {
    if (!label.trim()) return
    setProjItems(prev => prev.map(i => i.id === id ? { ...i, label: label.trim() } : i))
    try {
      await projectsService.rename(id, label.trim())
    } catch {
      toast.error('Could not rename project')
    }
  }, [])

  const removeProject = useCallback(async (id: string) => {
    setProjItems(prev => prev.filter(i => i.id !== id))
    try {
      await projectsService.remove(id)
    } catch {
      toast.error('Could not remove project')
    }
  }, [])

  const clearAllProjects = useCallback(async () => {
    const snapshot = projItems
    setProjItems([])
    try {
      await Promise.all(snapshot.map(i => projectsService.remove(i.id)))
    } catch {
      toast.error('Could not clear projects')
    }
  }, [projItems])

  return {
    favorites: {
      items:    favItems,
      add:      addFavorite,
      rename:   renameFavorite,
      remove:   removeFavorite,
      clearAll: clearAllFavorites,
    },
    projects: {
      items:    projItems,
      add:      addProject,
      rename:   renameProject,
      remove:   removeProject,
      clearAll: clearAllProjects,
    },
  }
}
