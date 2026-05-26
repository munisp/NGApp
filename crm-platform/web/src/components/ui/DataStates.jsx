/**
 * Shared data-state components: Loading, Error, Empty, Skeleton, Pagination
 * Used across all CRM pages for consistent UX.
 */
import { AlertTriangle, RefreshCw, Inbox, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export function LoadingState({ message = 'Loading...', rows = 5 }) {
  return (
    <div className="animate-pulse space-y-3 p-4" role="status" aria-label={message}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex space-x-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/5"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
        </div>
      ))}
      <span className="sr-only">{message}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8" role="alert">
      <AlertTriangle className="w-10 h-10 text-red-500 mb-3" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Failed to load data</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
        {error?.message || 'An unexpected error occurred'}
      </p>
      {onRetry && (
        <button onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Retry loading">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title = 'No data', description = 'Nothing to display yet.', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <Icon className="w-10 h-10 text-gray-400 mb-3" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  )
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <nav className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700" aria-label="Pagination">
      <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
          aria-label="Next page">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  )
}

export function ExportButton({ data, filename = 'export.csv', label = 'Export CSV' }) {
  const handleExport = () => {
    if (!data || data.length === 0) return
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      aria-label={label}>
      <Download className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  )
}

export function FallbackBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full" title="Using seed data — backend API not connected">
      Seed Data
    </span>
  )
}
