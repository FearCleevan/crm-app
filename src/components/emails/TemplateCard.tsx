// src/components/emails/TemplateCard.tsx
import { Edit2, Copy, Trash2 } from 'lucide-react'
import { formatDate, truncateText } from '@/lib/campaign-utils'
import type { RichTemplate } from '@/constants/mockEmails'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'

interface Props {
  template: RichTemplate
  onEdit: (t: RichTemplate) => void
  onDuplicate: (t: RichTemplate) => void
  onDelete: (id: string) => void
}

export function TemplateCard({ template, onEdit, onDuplicate, onDelete }: Props) {
  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label ?? template.category

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight">{template.name}</p>
        <span className="shrink-0 inline-flex items-center h-5 px-2 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-[10px] font-medium border border-brand-200 dark:border-brand-800/40">
          {categoryLabel}
        </span>
      </div>
      <p className="text-xs text-foreground truncate">{template.subject}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{truncateText(template.body.replace(/\n/g, ' '), 120)}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">Updated {formatDate(template.updatedAt)}</span>
        <div className="flex gap-1">
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
  )
}
