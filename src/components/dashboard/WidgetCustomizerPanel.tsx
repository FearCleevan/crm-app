import { X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WidgetConfig {
  id: string
  label: string
  description: string
  visible: boolean
}

interface Props {
  open: boolean
  widgets: WidgetConfig[]
  onToggle: (id: string) => void
  onClose: () => void
}

export function WidgetCustomizerPanel({ open, widgets, onToggle, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Customize Widgets"
        aria-modal="true"
        className={cn(
          'fixed top-0 right-0 h-full w-80 z-50 bg-card border-l border-border shadow-2xl flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">Customize Widgets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Show or hide dashboard cards</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto py-3">
          {widgets.map(widget => (
            <div
              key={widget.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{widget.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{widget.description}</p>
              </div>
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={widget.visible}
                aria-label={`Toggle ${widget.label}`}
                onClick={() => onToggle(widget.id)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                  'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  widget.visible ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
                    'transform transition-transform duration-200 ease-in-out',
                    widget.visible ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <p className="text-[11px] text-muted-foreground text-center">
            Changes are saved automatically
          </p>
        </div>
      </div>
    </>
  )
}
