// src/components/emails/TemplateManager.tsx
import { useState } from 'react'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import { TemplateCard } from './TemplateCard'
import { TemplateListRow } from './TemplateListRow'
import { TemplateModal } from './TemplateModal'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'
import type { TemplateFormData } from './TemplateModal'

interface Props {
  templates: RichTemplateDB[]
  onAdd: (data: TemplateFormData) => void
  onUpdate: (id: string, data: TemplateFormData) => void
  onDelete: (id: string) => void
  onDuplicate: (t: RichTemplateDB) => void
}

export function TemplateManager({ templates, onAdd, onUpdate, onDelete, onDuplicate }: Props) {
  const [gridView,   setGridView]   = useState(true)
  const [search,     setSearch]     = useState('')
  const [category,   setCategory]   = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<RichTemplateDB | null>(null)

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !category || t.category === category
    return matchSearch && matchCat
  })

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(t: RichTemplateDB) { setEditing(t); setModalOpen(true) }
  function handleSave(data: TemplateFormData) {
    if (editing) onUpdate(editing.id, data); else onAdd(data)
    setModalOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="w-full h-8 pl-8 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="h-8 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Categories</option>
          {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button type="button" aria-label="Grid view" onClick={() => setGridView(true)}
            className={`h-8 w-8 flex items-center justify-center transition-colors ${gridView ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="List view" onClick={() => setGridView(false)}
            className={`h-8 w-8 flex items-center justify-center transition-colors ${!gridView ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
        <button type="button" onClick={openCreate}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Template
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-sm font-medium text-foreground">No templates found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search or create a new template</p>
          </div>
        ) : gridView ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => <TemplateCard key={t.id} template={t} onEdit={openEdit} onDuplicate={onDuplicate} onDelete={onDelete} />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(t => (
              <TemplateListRow
                key={t.id}
                template={t}
                onEdit={openEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateModal
        open={modalOpen}
        initial={editing}
        existingNames={templates.map(t => t.name)}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
