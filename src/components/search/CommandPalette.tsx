import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, User, Briefcase, FileText, LayoutDashboard, ChevronRight, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { MOCK_PROSPECTS, MOCK_DEALS, MOCK_USERS } from '@/constants/mockData'
import { ROUTES } from '@/constants/routes'

const RECENT_KEY = 'brisk_recent_searches'
const MAX_RECENT = 5

interface SearchResult {
  id: string
  group: 'Prospects' | 'Deals' | 'Users' | 'Pages'
  label: string
  sublabel?: string
  icon: React.ElementType
  iconColor: string
  route: string
}

const PAGES: SearchResult[] = [
  { id: 'p-dashboard',  group: 'Pages', label: 'Dashboard',        icon: LayoutDashboard, iconColor: 'text-brand-500', route: ROUTES.DASHBOARD },
  { id: 'p-prospects',  group: 'Pages', label: 'Prospects',         icon: User,            iconColor: 'text-emerald-500', route: ROUTES.PROSPECTS },
  { id: 'p-deals',      group: 'Pages', label: 'Deals / Pipeline',  icon: Briefcase,       iconColor: 'text-amber-500',   route: ROUTES.DEALS },
  { id: 'p-emails',     group: 'Pages', label: 'Emails',            icon: FileText,        iconColor: 'text-blue-500',    route: ROUTES.EMAILS },
  { id: 'p-reports',    group: 'Pages', label: 'Reports',           icon: FileText,        iconColor: 'text-violet-500',  route: ROUTES.REPORTS },
  { id: 'p-workflows',  group: 'Pages', label: 'Workflows',         icon: FileText,        iconColor: 'text-rose-500',    route: ROUTES.WORKFLOWS },
  { id: 'p-users',      group: 'Pages', label: 'User Management',   icon: User,            iconColor: 'text-slate-500',   route: ROUTES.USERS },
  { id: 'p-settings',   group: 'Pages', label: 'Settings',          icon: FileText,        iconColor: 'text-slate-500',   route: ROUTES.SETTINGS },
]

function search(query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()

  const prospects: SearchResult[] = MOCK_PROSPECTS
    .filter(p => p.fullname.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.company.toLowerCase().includes(q))
    .slice(0, 4)
    .map(p => ({
      id: `prospect-${p.id}`,
      group: 'Prospects' as const,
      label: p.fullname,
      sublabel: `${p.company} · ${p.email}`,
      icon: User,
      iconColor: 'text-emerald-600',
      route: ROUTES.PROSPECTS,
    }))

  const deals: SearchResult[] = MOCK_DEALS
    .filter(d => d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q) || d.stage.toLowerCase().includes(q))
    .slice(0, 4)
    .map(d => ({
      id: `deal-${d.id}`,
      group: 'Deals' as const,
      label: d.name,
      sublabel: `${d.stage} · $${d.value.toLocaleString()}`,
      icon: Briefcase,
      iconColor: 'text-amber-600',
      route: ROUTES.DEALS,
    }))

  const users: SearchResult[] = MOCK_USERS
    .filter(u => `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .slice(0, 3)
    .map(u => ({
      id: `user-${u.id}`,
      group: 'Users' as const,
      label: `${u.first_name} ${u.last_name}`,
      sublabel: `${u.role} · ${u.email}`,
      icon: User,
      iconColor: 'text-violet-600',
      route: ROUTES.USERS,
    }))

  const pages: SearchResult[] = PAGES.filter(p => p.label.toLowerCase().includes(q))

  return [...prospects, ...deals, ...users, ...pages]
}

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecent(query: string) {
  const prev = loadRecent().filter(q => q !== query)
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)))
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type Group = 'Prospects' | 'Deals' | 'Users' | 'Pages'
const GROUP_ORDER: Group[] = ['Prospects', 'Deals', 'Users', 'Pages']

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setCursor(0)
      setRecent(loadRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setResults(search(query))
    setCursor(0)
  }, [query])

  const allResults = results
  const flatList = GROUP_ORDER.flatMap(g => allResults.filter(r => r.group === g))

  const handleSelect = useCallback((result: SearchResult) => {
    if (query.trim()) saveRecent(query.trim())
    setRecent(loadRecent())
    navigate(result.route)
    onClose()
  }, [navigate, onClose, query])

  // In no-query mode the navigable list is the first 5 pages; in query mode it's flatList
  const navList = query.trim() ? flatList : PAGES.slice(0, 5)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, navList.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return }
      if (e.key === 'Enter' && navList[cursor]) { handleSelect(navList[cursor]); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, cursor, navList, handleSelect, onClose])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const groups = GROUP_ORDER.filter(g => allResults.some(r => r.group === g))
  let globalIndex = 0

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search prospects, deals, users, pages…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="text-[10px] border border-border rounded px-1 py-0.5 bg-muted text-muted-foreground">Esc</kbd>
        </div>

        {/* Results / Recent */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {!query.trim() && (
            <>
              {recent.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
                  {recent.map((q, i) => (
                    <button key={i} type="button"
                      onClick={() => setQuery(q)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pages</p>
                {PAGES.slice(0, 5).map((page, i) => {
                  const Icon = page.icon
                  return (
                    <button key={page.id} type="button"
                      onClick={() => handleSelect(page)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        cursor === i ? 'bg-muted/60 text-foreground' : 'text-foreground hover:bg-muted/40',
                      )}>
                      <Icon className={cn('h-4 w-4 shrink-0', page.iconColor)} />
                      <span className="flex-1 text-left">{page.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
              <div className="h-3" />
            </>
          )}

          {query.trim() && flatList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-20" />
              <p className="text-sm">No results for <span className="font-semibold text-foreground">"{query}"</span></p>
            </div>
          )}

          {query.trim() && groups.length > 0 && (
            <div>
              {groups.map(group => {
                const groupResults = allResults.filter(r => r.group === group)
                return (
                  <div key={group}>
                    <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{group}</p>
                    {groupResults.map(result => {
                      const idx = globalIndex++
                      const Icon = result.icon
                      return (
                        <button
                          key={result.id}
                          type="button"
                          data-index={idx}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                            cursor === idx ? 'bg-muted/60' : 'hover:bg-muted/40',
                          )}
                        >
                          <div className={cn('h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0')}>
                            <Icon className={cn('h-3.5 w-3.5', result.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-foreground truncate">{result.label}</p>
                            {result.sublabel && <p className="text-xs text-muted-foreground truncate">{result.sublabel}</p>}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              <div className="h-3" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/20">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="border border-border rounded px-1 bg-card">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="border border-border rounded px-1 bg-card">↵</kbd> open
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="border border-border rounded px-1 bg-card">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
