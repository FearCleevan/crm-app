// src/components/emails/TemplateListRow.tsx
import { Edit2, Copy, Trash2 } from 'lucide-react'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'

const CATEGORY_DOT: Record<string, string> = {
  cold_outreach:    'bg-blue-500',
  outdated_website: 'bg-amber-500',
  no_website:       'bg-rose-500',
  follow_up:        'bg-violet-500',
  introduction:     'bg-emerald-500',
  proposal:         'bg-cyan-500',
  closing:          'bg-green-500',
  re_engagement:    'bg-orange-500',
  newsletter:       'bg-pink-500',
  general:          'bg-slate-400',
}

interface Props {
  template: RichTemplateDB
  onEdit: (t: RichTemplateDB) => void
  onDuplicate: (t: RichTemplateDB) => void
  onDelete: (id: string) => void
}

export function TemplateListRow({ template, onEdit, onDuplicate, onDelete }: Props) {
  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label ?? template.category
  const dot = CATEGORY_DOT[template.category] ?? 'bg-slate-400'

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow group">
      <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />

      <div className="w-48 shrink-0 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
        <p className="text-[10px] text-muted-foreground">{categoryLabel}</p>
      </div>

      <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{template.subject}</p>

      {template.variables && template.variables.length > 0 && (
        <span className="shrink-0 text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
          {template.variables.length} vars
        </span>
      )}

      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" aria-label="Edit" onClick={() => onEdit(template)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Duplicate" onClick={() => onDuplicate(template)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Delete" onClick={() => onDelete(template.id)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
