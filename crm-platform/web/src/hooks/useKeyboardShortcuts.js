/**
 * useKeyboardShortcuts — Global keyboard shortcuts for CRM power users.
 */
import { useEffect } from 'react'

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      for (const { key, ctrl, meta, shift, action } of shortcuts) {
        const ctrlMatch = ctrl ? (e.ctrlKey || e.metaKey) : true
        const metaMatch = meta ? e.metaKey : true
        const shiftMatch = shift ? e.shiftKey : !e.shiftKey
        if (e.key === key && ctrlMatch && metaMatch && shiftMatch) {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
          e.preventDefault()
          action()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
