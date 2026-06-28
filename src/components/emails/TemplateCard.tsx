import { Edit2, Copy, Trash2, Mail } from 'lucide-react'
import { formatDate } from '@/lib/campaign-utils'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'

const CATEGORY_CONFIG: Record<string, { bar: string; icon: string; badge: string }> = {
  cold_outreach:    { bar: 'bg-blue-500',    icon: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',    badge: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40'    },
  outdated_website: { bar: 'bg-amber-500',   icon: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40' },
  no_website:       { bar: 'bg-rose-500',    icon: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',     badge: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'       },
  follow_up:        { bar: 'bg-violet-500',  icon: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400', badge: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/40' },
  introduction:     { bar: 'bg-emerald-500', icon: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' },
  proposal:         { bar: 'bg-cyan-500',    icon: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400',     badge: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/40'         },
  closing:          { bar: 'bg-green-500',   icon: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400', badge: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/40'   },
  re_engagement:    { bar: 'bg-orange-500',  icon: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400', badge: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/40' },
  newsletter:       { bar: 'bg-pink-500',    icon: 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400',     badge: 'bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/40'         },
  general:          { bar: 'bg-slate-400',   icon: 'bg-slate-50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400', badge: 'bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/40'   },
}
const DEFAULT_CONFIG = CATEGORY_CONFIG.general

interface Props {
  template: RichTemplateDB
  onEdit: (t: RichTemplateDB) => void
  onDuplicate: (t: RichTemplateDB) => void
  onDelete: (id: string) => void
}

export function TemplateCard({ template, onEdit, onDuplicate, onDelete }: Props) {
  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label ?? template.category
  const config = CATEGORY_CONFIG[template.category] ?? DEFAULT_CONFIG
  const bodyPreview = template.body.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 group flex flex-col">
      {/* Category accent bar */}
      <div className={`h-1 w-full shrink-0 ${config.bar}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.icon}`}>
              <Mail className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{template.name}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium border ${config.badge}`}>
            {categoryLabel}
          </span>
        </div>

        {/* Subject preview */}
        <div className="bg-muted/40 rounded-lg px-3 py-2 border border-border/40">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Subject</p>
          <p className="text-xs text-foreground font-medium truncate">{template.subject}</p>
        </div>

        {/* Body preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">{bodyPreview}</p>

        {/* Variables */}
        {template.variables && template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 3).map(v => (
              <span key={v} className="inline-flex items-center h-4 px-1.5 rounded bg-primary/10 text-primary text-[9px] font-mono font-medium">
                {`{{${v}}}`}
              </span>
            ))}
            {template.variables.length > 3 && (
              <span className="text-[9px] text-muted-foreground self-center">+{template.variables.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground">
            Updated {template.updated_at ? formatDate(template.updated_at) : '—'}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" aria-label="Edit template" onClick={() => onEdit(template)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <Edit2 className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Duplicate template" onClick={() => onDuplicate(template)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="h-3 w-3" />
            </button>
            <button type="button" aria-label="Delete template" onClick={() => onDelete(template.id)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
