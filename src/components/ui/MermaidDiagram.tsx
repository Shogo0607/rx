import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'

let mermaidInitialized = false

function initMermaid(): void {
  if (mermaidInitialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  })
  mermaidInitialized = true
}

/**
 * Strip markdown code block fencing and sanitize characters that break Mermaid parsing.
 *
 * Half-width parentheses `()` inside node labels like `[テキスト(補足)]` are interpreted
 * as stadium-shape delimiters, causing parse errors.  We replace them with fullwidth
 * equivalents `（）` inside bracket-delimited labels `[...]`.
 */
function cleanMermaidCode(code: string): string {
  let cleaned = code.trim()
  // Remove opening fence: ```mermaid or ```
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/, '')
  // Remove closing fence
  cleaned = cleaned.replace(/\n?```\s*$/, '')

  // Sanitize half-width parentheses inside node labels.
  // Mermaid node labels are delimited by [...], {...}, ((...)), [[...]], etc.
  // We target the most common bracket forms: [text], {text}, and ((text)).
  cleaned = cleaned.replace(
    /(\w+)\[([^\]]*)\]/g,
    (_match, nodeId: string, label: string) => {
      const safe = label.replace(/\(/g, '（').replace(/\)/g, '）')
      return `${nodeId}[${safe}]`
    }
  )
  // Also handle {text} (rhombus / decision nodes)
  cleaned = cleaned.replace(
    /(\w+)\{([^}]*)\}/g,
    (_match, nodeId: string, label: string) => {
      const safe = label.replace(/\(/g, '（').replace(/\)/g, '）')
      return `${nodeId}{${safe}}`
    }
  )

  return cleaned.trim()
}

interface MermaidDiagramProps {
  code: string
  id?: string
  className?: string
}

export function MermaidDiagram({ code, id, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string>('')

  useEffect(() => {
    if (!code.trim()) {
      setSvgContent('')
      setError(null)
      return
    }

    initMermaid()

    const uniqueId = id || `mermaid-${Math.random().toString(36).slice(2, 9)}`

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(uniqueId, cleanMermaidCode(code))
        setSvgContent(svg)
        setError(null)
      } catch (err) {
        setError(String(err))
        setSvgContent('')
      } finally {
        // Clean up temporary elements that Mermaid creates in the document body
        const stale = document.getElementById(uniqueId)
        if (stale && !containerRef.current?.contains(stale)) {
          stale.remove()
        }
        // Also clean up the wrapper container Mermaid sometimes creates
        const wrapper = document.getElementById(`d${uniqueId}`)
        if (wrapper && !containerRef.current?.contains(wrapper)) {
          wrapper.remove()
        }
      }
    }

    renderDiagram()
  }, [code, id])

  if (error) {
    return (
      <div className={`rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive ${className || ''}`}>
        <p className="font-medium mb-1">Mermaid rendering error</p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground text-sm ${className || ''}`}>
        No diagram
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-auto ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

/**
 * Renders Mermaid code to a PNG data URL (for DOCX/PDF export).
 * Must be called from the renderer process (uses DOM APIs).
 */
export async function mermaidToPng(code: string, width = 800, height = 600): Promise<string> {
  initMermaid()

  const uniqueId = `mermaid-export-${Math.random().toString(36).slice(2, 9)}`
  const { svg } = await mermaid.render(uniqueId, cleanMermaidCode(code))

  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Use the actual SVG dimensions if available, fallback to provided values
      canvas.width = img.naturalWidth || width
      canvas.height = img.naturalHeight || height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to get canvas context'))
        return
      }
      // White background for patent figures
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG image'))
    }

    img.src = url
  })
}
