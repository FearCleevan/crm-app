import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Handshake, StickyNote, Mail, BarChart3,
  Zap, Settings, HelpCircle, ChevronLeft, ChevronRight,
  Star, FolderOpen, Plus, MoreHorizontal, Users,
  Pencil, Trash2, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavItem } from './NavItem'
import { StorageBar } from './StorageBar'
import { UserBadge } from './UserBadge'
import { ROUTES } from '@/constants/routes'
import { useSidebarLists, type ListItem } from '@/hooks/useSidebarLists'

const SIDEBAR_STORAGE_KEY = 'crm-sidebar-collapsed'

const mainNav = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: ROUTES.DEALS,     icon: Handshake,       label: 'Deals'     },
  { to: ROUTES.NOTES ?? '/notes', icon: StickyNote, label: 'Notes'  },
  { to: ROUTES.EMAILS,    icon: Mail,            label: 'Emails'    },
  { to: ROUTES.REPORTS,   icon: BarChart3,       label: 'Reports'   },
  { to: ROUTES.WORKFLOWS, icon: Zap,             label: 'Workflows' },
]

// ── Small dropdown for per-item actions ────────────────────────────────────
interface ItemMenuProps {
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

function ItemMenu({ onRename, onDelete, onClose }: ItemMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-1 top-full z-50 mt-0.5 w-36 bg-popover border border-border rounded-lg shadow-lg py-1 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => { onRename(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors text-left"
      >
        <Pencil className="h-3 w-3 shrink-0" /> Rename
      </button>
      <button
        type="button"
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
      >
        <Trash2 className="h-3 w-3 shrink-0" /> Delete
      </button>
    </div>
  )
}

// ── Small dropdown for section-level actions ───────────────────────────────
interface SectionMenuProps {
  onClearAll: () => void
  onClose: () => void
}

function SectionMenu({ onClearAll, onClose }: SectionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-0.5 w-36 bg-popover border border-border rounded-lg shadow-lg py-1 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => { onClearAll(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
      >
        <Trash2 className="h-3 w-3 shrink-0" /> Clear all
      </button>
    </div>
  )
}

// ── Reusable interactive section ───────────────────────────────────────────
interface SidebarSectionProps {
  title: string
  items: ListItem[]
  icon: LucideIcon
  iconClass: string
  navigateTo: string
  onAdd: (label: string) => void
  onRename: (id: string, label: string) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

function SidebarSection({
  title, items, icon: Icon, iconClass, navigateTo,
  onAdd, onRename, onRemove, onClearAll,
}: SidebarSectionProps) {
  const navigate = useNavigate()
  const [open, setOpen]         = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [renamingId, setRenamingId]   = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuItemId, setMenuItemId]   = useState<string | null>(null)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)

  const addInputRef    = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const sectionBtnRef  = useRef<HTMLDivElement>(null)

  // Auto-focus inputs
  useEffect(() => {
    if (isAdding) setTimeout(() => addInputRef.current?.focus(), 30)
  }, [isAdding])

  useEffect(() => {
    if (renamingId) setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select() }, 30)
  }, [renamingId])

  const confirmAdd = useCallback(() => {
    if (addValue.trim()) onAdd(addValue)
    setIsAdding(false)
    setAddValue('')
  }, [addValue, onAdd])

  const confirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue)
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, onRename])

  function startRename(item: ListItem) {
    setRenamingId(item.id)
    setRenameValue(item.label)
    setMenuItemId(null)
  }

  function startAdding() {
    setOpen(true)
    setIsAdding(true)
    setAddValue('')
  }

  return (
    <div className="pt-3">
      {/* Section header */}
      <div className="flex items-center w-full px-1">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          className="flex-1 flex items-center gap-1 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-sidebar-foreground transition-colors text-left pl-2"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform duration-150 shrink-0', !open && '-rotate-90')} />
          {title}
        </button>

        {/* Section 3-dot */}
        <div ref={sectionBtnRef} className="relative shrink-0">
          <button
            type="button"
            aria-label={`${title} options`}
            onClick={e => { e.stopPropagation(); setSectionMenuOpen(p => !p) }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {sectionMenuOpen && (
            <SectionMenu onClearAll={onClearAll} onClose={() => setSectionMenuOpen(false)} />
          )}
        </div>

        {/* Plus — add new */}
        <button
          type="button"
          aria-label={`Add ${title.toLowerCase()} item`}
          onClick={e => { e.stopPropagation(); startAdding() }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors ml-0.5"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Items list */}
      {open && (
        <div className="mt-1 space-y-0.5">
          {items.map(item => (
            <div key={item.id} className="relative group flex items-center rounded-lg hover:bg-sidebar-accent transition-colors">
              {renamingId === item.id ? (
                // Rename inline input
                <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5 min-w-0">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
                  <input
                    ref={renameInputRef}
                    aria-label="Rename item"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmRename() }
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                    }}
                    onBlur={confirmRename}
                    className="flex-1 min-w-0 text-sm bg-transparent text-sidebar-foreground focus:outline-none border-b border-border"
                  />
                </div>
              ) : (
                // Normal clickable row
                <button
                  type="button"
                  onClick={() => navigate(navigateTo)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-sidebar-foreground transition-colors text-left min-w-0"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
                  <span className="truncate">{item.label}</span>
                </button>
              )}

              {/* Per-item 3-dot — shown on hover */}
              {renamingId !== item.id && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label={`Options for ${item.label}`}
                    onClick={e => { e.stopPropagation(); setMenuItemId(prev => prev === item.id ? null : item.id) }}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded mr-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                  {menuItemId === item.id && (
                    <ItemMenu
                      onRename={() => startRename(item)}
                      onDelete={() => onRemove(item.id)}
                      onClose={() => setMenuItemId(null)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* New item input row */}
          {isAdding && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-sidebar-accent/60">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass)} />
              <input
                ref={addInputRef}
                value={addValue}
                onChange={e => setAddValue(e.target.value)}
                placeholder="Name…"
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmAdd() }
                  if (e.key === 'Escape') { setIsAdding(false); setAddValue('') }
                }}
                onBlur={confirmAdd}
                className="flex-1 min-w-0 text-sm bg-transparent text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {items.length === 0 && !isAdding && (
            <p className="px-3 py-1 text-xs text-muted-foreground italic">No items yet</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────
interface SidebarProps {
  user?: {
    name: string
    email: string
    role: string
    avatarUrl?: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  const navigate = useNavigate()
  const { favorites, projects } = useSidebarLists()

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      {/* ── Logo ── */}
      <div className={cn('flex items-center h-14 px-4 border-b border-sidebar-border gap-2.5', collapsed && 'justify-center px-2')}>
        <div className="h-7 w-7 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">B</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-tight">Brisk</p>
            <p className="text-[10px] text-muted-foreground leading-tight">CR Management</p>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        type="button"
        onClick={toggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[52px] z-10 h-6 w-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
          : <ChevronLeft  className="h-3 w-3 text-muted-foreground" />
        }
      </button>

      {/* ── Workspace picker ── */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors">
            <span className="text-sm font-medium text-sidebar-foreground">Mesh</span>
            <div className="flex gap-0.5 text-muted-foreground">
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
              <ChevronRight className="h-3.5 w-3.5 -rotate-90 -ml-2" />
            </div>
          </div>
        </div>
      )}

      {/* ── Scrollable nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {mainNav.map(item => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            end={item.end}
            collapsed={collapsed}
          />
        ))}

        <NavItem
          to={ROUTES.PROSPECTS}
          icon={Users}
          label="Prospects"
          collapsed={collapsed}
        />

        {/* ── Favorites & Projects — hidden when collapsed ── */}
        {!collapsed && (
          <>
            <SidebarSection
              title="Favorites"
              items={favorites.items}
              icon={Star}
              iconClass="text-amber-400 fill-amber-400"
              navigateTo={ROUTES.PROSPECTS}
              onAdd={favorites.add}
              onRename={favorites.rename}
              onRemove={favorites.remove}
              onClearAll={favorites.clearAll}
            />

            <SidebarSection
              title="Projects"
              items={projects.items}
              icon={FolderOpen}
              iconClass="text-brand-400"
              navigateTo={ROUTES.DEALS}
              onAdd={projects.add}
              onRename={projects.rename}
              onRemove={projects.remove}
              onClearAll={projects.clearAll}
            />
          </>
        )}
      </nav>

      {/* ── Bottom section ── */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-0.5">
        <NavItem to={ROUTES.SETTINGS} icon={Settings}   label="Settings"    collapsed={collapsed} />
        <NavItem to="/help"           icon={HelpCircle} label="Help Center" collapsed={collapsed} />

        {!collapsed && (
          <div className="mt-3 px-1">
            <StorageBar used={1.8} total={2} unit="GB" />
          </div>
        )}

        {/* User — navigates to Settings > Profile */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Go to profile settings"
          onClick={() => navigate(ROUTES.SETTINGS)}
          onKeyDown={e => e.key === 'Enter' && navigate(ROUTES.SETTINGS)}
          className={cn(
            'mt-3 px-1 py-1 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors',
            collapsed && 'px-0 flex justify-center',
          )}
        >
          <UserBadge
            name={user?.name ?? 'Janson Williams'}
            email={user?.email ?? 'williams@mesh.com'}
            role={user?.role ?? 'Super Admin'}
            avatarUrl={user?.avatarUrl}
            collapsed={collapsed}
          />
        </div>
      </div>
    </aside>
  )
}
