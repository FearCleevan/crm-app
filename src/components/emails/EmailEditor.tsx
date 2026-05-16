import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import LinkExt from '@tiptap/extension-link'
import ImageExt from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { useState, useCallback, useRef } from 'react'
import {
  Bold, Italic, Underline as UIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Quote as QuoteIcon,
  Link2, Image as ImageIcon, Minus, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { storageService } from '@/services/storage.service'

// Extend Image to support width attribute for resizing
const ResizableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.getAttribute('width') || el.style.width || null,
        renderHTML: attrs => attrs.width
          ? { width: attrs.width, style: `width:${attrs.width};max-width:100%` }
          : {},
      },
    }
  },
})

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#dc2626', '#d97706', '#16a34a', '#2563eb',
  '#7c3aed', '#db2777', '#0891b2', '#ffffff',
]

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa']

interface EmailEditorProps {
  content?: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
}

export function EmailEditor({
  content = '',
  onChange,
  placeholder = 'Write your message…',
  minHeight = '220px',
  className,
}: EmailEditorProps) {
  const [showColors,    setShowColors]    = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const [showLink,      setShowLink]      = useState(false)
  const [linkUrl,       setLinkUrl]       = useState('')
  const [uploading,     setUploading]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      LinkExt.configure({ openOnClick: false }),
      ResizableImage,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content,
    onUpdate({ editor }) { onChange(editor.getHTML()) },
    editorProps: {
      attributes: { style: `min-height:${minHeight};padding:14px 16px` },
      handlePaste(_, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) { insertImage(file); return true }
          }
        }
        return false
      },
      handleDrop(_, event) {
        const file = event.dataTransfer?.files?.[0]
        if (file?.type.startsWith('image/')) { insertImage(file); return true }
        return false
      },
    },
  })

  const insertImage = useCallback(async (file: File) => {
    if (!editor) return
    setUploading(true)
    try {
      const url = await storageService.uploadEmailImage(file)
      editor.chain().focus().setImage({ src: url, width: '100%' } as never).run()
    } catch {
      // Fallback to base64 if storage upload fails
      const reader = new FileReader()
      reader.onload = e => {
        const src = e.target?.result as string
        editor.chain().focus().setImage({ src, width: '100%' } as never).run()
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }, [editor])

  function applyLink() {
    if (!editor) return
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const href = /^https?:\/\//.test(linkUrl) ? linkUrl : `https://${linkUrl}`
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLinkUrl('')
    setShowLink(false)
  }

  if (!editor) return null

  function Btn({
    active, onPress, title, children, disabled,
  }: {
    active?: boolean; onPress: () => void; title: string; children: React.ReactNode; disabled?: boolean
  }) {
    return (
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onPress() }}
        title={title}
        disabled={disabled}
        className={cn(
          'h-7 w-7 rounded flex items-center justify-center transition-colors shrink-0',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          disabled && 'opacity-40 pointer-events-none',
        )}
      >
        {children}
      </button>
    )
  }

  const textTypeValue =
    editor.isActive('heading', { level: 1 }) ? 'h1' :
    editor.isActive('heading', { level: 2 }) ? 'h2' :
    editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'

  return (
    <div className={cn('border border-input rounded-lg overflow-visible bg-background flex flex-col', className)}>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 shrink-0">

        {/* Text type dropdown */}
        <div className="relative flex items-center">
          <select
            value={textTypeValue}
            onChange={e => {
              const v = e.target.value
              if (v === 'p') editor.chain().focus().setParagraph().run()
              else editor.chain().focus().setHeading({ level: +v[1] as 1|2|3 }).run()
            }}
            title="Text style"
            className="h-7 pl-2 pr-6 rounded text-xs border border-input bg-background text-foreground focus:outline-none appearance-none cursor-pointer"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        <Sep />

        {/* Basic formatting */}
        <Btn active={editor.isActive('bold')}      onPress={() => editor.chain().focus().toggleBold().run()}      title="Bold">       <Bold          className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive('italic')}    onPress={() => editor.chain().focus().toggleItalic().run()}    title="Italic">     <Italic        className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive('underline')} onPress={() => editor.chain().focus().toggleUnderline().run()} title="Underline">  <UIcon         className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive('strike')}    onPress={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></Btn>

        <Sep />

        {/* Text color */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setShowColors(v => !v); setShowHighlight(false); setShowLink(false) }}
            title="Text color"
            className="h-7 w-8 rounded flex flex-col items-center justify-center gap-[3px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <span className="text-[11px] font-bold leading-none text-foreground">A</span>
            <span className="h-[3px] w-4 rounded-full" style={{ background: editor.getAttributes('textStyle').color || '#374151' }} />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 z-[60] bg-card border border-border rounded-xl shadow-2xl p-2.5 min-w-[136px]">
              <div className="grid grid-cols-6 gap-1">
                {TEXT_COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColors(false) }}
                    className="h-5 w-5 rounded border border-border/50 hover:scale-125 transition-transform"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColors(false) }}
                className="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground text-center transition-colors">
                Remove color
              </button>
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setShowHighlight(v => !v); setShowColors(false); setShowLink(false) }}
            title="Highlight color"
            className="h-7 w-8 rounded flex flex-col items-center justify-center gap-[3px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <span className="text-[11px] font-bold leading-none text-foreground">H</span>
            <span className="h-[3px] w-4 rounded-full bg-yellow-300" />
          </button>
          {showHighlight && (
            <div className="absolute top-full left-0 mt-1 z-[60] bg-card border border-border rounded-xl shadow-2xl p-2.5">
              <div className="grid grid-cols-3 gap-1">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlight(false) }}
                    className="h-5 w-8 rounded border border-border/50 hover:scale-110 transition-transform"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setShowHighlight(false) }}
                className="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground text-center transition-colors">
                Remove highlight
              </button>
            </div>
          )}
        </div>

        <Sep />

        {/* Alignment */}
        <Btn active={editor.isActive({ textAlign: 'left' })}   onPress={() => editor.chain().focus().setTextAlign('left').run()}   title="Align left">  <AlignLeft    className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onPress={() => editor.chain().focus().setTextAlign('center').run()} title="Align center"><AlignCenter  className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })}  onPress={() => editor.chain().focus().setTextAlign('right').run()}  title="Align right"> <AlignRight   className="h-3.5 w-3.5" /></Btn>

        <Sep />

        {/* Lists + quote */}
        <Btn active={editor.isActive('bulletList')}  onPress={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list">   <List         className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive('orderedList')} onPress={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">  <ListOrdered  className="h-3.5 w-3.5" /></Btn>
        <Btn active={editor.isActive('blockquote')}  onPress={() => editor.chain().focus().toggleBlockquote().run()}  title="Blockquote">     <QuoteIcon    className="h-3.5 w-3.5" /></Btn>

        <Sep />

        {/* Link */}
        <div className="relative">
          <Btn active={editor.isActive('link')} onPress={() => { setShowLink(v => !v); setShowColors(false); setShowHighlight(false); setLinkUrl(editor.getAttributes('link').href || '') }} title="Insert link">
            <Link2 className="h-3.5 w-3.5" />
          </Btn>
          {showLink && (
            <div className="absolute top-full left-0 mt-1 z-[60] bg-card border border-border rounded-xl shadow-2xl p-2 flex gap-1.5" style={{ width: 280 }}>
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }}
                placeholder="https://example.com"
                className="flex-1 h-7 px-2 rounded border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <button type="button" onMouseDown={e => { e.preventDefault(); applyLink() }}
                className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0">
                Set
              </button>
            </div>
          )}
        </div>

        {/* Image upload */}
        <Btn onPress={() => fileRef.current?.click()} title={uploading ? 'Uploading…' : 'Insert image'} disabled={uploading}>
          <ImageIcon className="h-3.5 w-3.5" />
        </Btn>
        <input ref={fileRef} type="file" accept="image/*" aria-label="Upload image" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = '' }}
        />

        {/* Divider line */}
        <Btn onPress={() => editor.chain().focus().setHorizontalRule().run()} title="Insert horizontal line">
          <Minus className="h-3.5 w-3.5" />
        </Btn>

        {/* Image width — shown only when an image is selected */}
        {editor.isActive('image') && (
          <>
            <Sep />
            <span className="text-[10px] text-muted-foreground shrink-0">Width:</span>
            {['25%', '50%', '75%', '100%'].map(w => (
              <button key={w} type="button"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().updateAttributes('image', { width: w }).run() }}
                className="h-7 px-2 rounded text-[10px] font-medium text-foreground hover:bg-accent transition-colors shrink-0">
                {w}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Editor area ──────────────────────────────────────────── */}
      <div className="relative cursor-text flex-1" onClick={() => editor.chain().focus().run()}>
        {editor.isEmpty && (
          <p className="absolute top-[14px] left-4 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
