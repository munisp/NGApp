/**
 * useToast — Simple toast notification system.
 * Components call toast.success('Saved'), toast.error('Failed'), etc.
 */
import { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message }])
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg, 6000),
    warning: (msg) => addToast('warning', msg),
    info: (msg) => addToast('info', msg),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
    info: 'bg-blue-600',
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id}
          className={`${colors[t.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-[400px] animate-in slide-in-from-right`}>
          <span className="flex-1 text-sm">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-white/80 hover:text-white" aria-label="Dismiss">
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
