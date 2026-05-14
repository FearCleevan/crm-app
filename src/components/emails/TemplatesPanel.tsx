import { useState } from 'react'
import { Copy, Eye, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { EmailTemplate } from '@/constants/mockEmails'

interface TemplatesPanelProps {
  templates: EmailTemplate[]
  onUse: (tpl: EmailTemplate) => void
  onCreate: () => void
  onEdit: (tpl: EmailTemplate) => void
  onDelete: (id: string) => void
}

export function TemplatesPanel({ templates, onUse, onCreate, onEdit, onDelete }: TemplatesPanelProps) {
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [filter, setFilter] = useState('')

  const categories = Array.from(new Set(templates.map(t => t.category)))
  const filtered = templates.filter(t => filter === '' || t.category === filter)

  function handleCopy(tpl: EmailTemplate) {
    navigator.clipboard.writeText(tpl.body.replace(/<[^>]+>/g, ''))
    toast.success('Template copied to clipboard')
  }

  function handleDelete(id: string) {
    if (selected?.id === id) setSelected(null)
    onDelete(id)
    toast.success('Template deleted')
  }

  return (
    <div className="flex h-full gap-0">
      {/* Template list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Email Templates
            </p>
            <button
              type="button"
              onClick={onCreate}
              aria-label="New template"
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('')}
              className={cn(
                'h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors',
                filter === '' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={cn(
                  'h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors',
                  filter === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground px-4 text-center">
              <p className="text-sm">No templates yet</p>
              <button type="button" onClick={onCreate} className="text-xs text-primary hover:underline">
                Create one
              </button>
            </div>
          )}
          {filtered.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => setSelected(tpl)}
              className={cn(
                'px-4 py-3.5 cursor-pointer transition-colors group',
                selected?.id === tpl.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-muted/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground mt-1">
                    {tpl.category}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{tpl.subject}</p>
                </div>

                {/* Edit / Delete — visible on hover */}
                <div
                  className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Edit template"
                    onClick={() => onEdit(tpl)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete template"
                    onClick={() => handleDelete(tpl.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">{selected.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Subject: {selected.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(selected)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => onUse(selected)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  Use Template
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Preview
                </p>
                <div
                  className="prose prose-sm max-w-none text-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_p]:mb-3"
                  dangerouslySetInnerHTML={{ __html: selected.body }}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Variables in{' '}
                  <span className="font-mono bg-muted px-1 rounded">{'{{double_braces}}'}</span>{' '}
                  are replaced automatically when sending.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Eye className="h-8 w-8 opacity-30" />
            <p className="text-sm">Select a template to preview</p>
          </div>
        )}
      </div>
    </div>
  )
}
