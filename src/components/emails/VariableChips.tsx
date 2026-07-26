import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { MERGE_FIELDS } from '@/lib/mergeFields'

export const TEMPLATE_VARIABLES = MERGE_FIELDS.map(f => ({ label: f.label, variable: `{{${f.key}}}` }))

interface Props { onInsert: (variable: string) => void }

export function VariableChips({ onInsert }: Props) {
  const chipsRef = useRef<HTMLButtonElement[]>([])

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight') { e.preventDefault(); chipsRef.current[idx + 1]?.focus() }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); chipsRef.current[idx - 1]?.focus() }
    if (e.key === 'Enter')      { e.preventDefault(); onInsert(TEMPLATE_VARIABLES[idx].variable) }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {TEMPLATE_VARIABLES.map((v, idx) => (
        <button
          key={v.variable}
          type="button"
          ref={el => { if (el) chipsRef.current[idx] = el }}
          aria-label={`Insert ${v.label}`}
          onClick={() => onInsert(v.variable)}
          onKeyDown={e => handleKeyDown(e, idx)}
          className="flex items-center gap-1 h-6 px-2 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-medium border border-brand-200 dark:border-brand-800/40 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
        >
          <Plus className="h-3 w-3" /> {v.label}
        </button>
      ))}
    </div>
  )
}
