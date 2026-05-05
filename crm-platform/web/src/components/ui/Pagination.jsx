import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export const Pagination = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  if (total === 0) return null

  const getVisiblePages = () => {
    const pages = []
    const range = 2
    for (let i = Math.max(1, page - range); i <= Math.min(totalPages, page + range); i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 dark:border-gray-700" role="navigation" aria-label="Pagination">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span>Showing {start}-{end} of {total.toLocaleString()}</span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ml-2 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
            aria-label="Items per page"
          >
            {[10, 25, 50, 100].map(size => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="First page">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getVisiblePages().map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded text-sm ${p === page
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined}>
            {p}
          </button>
        ))}

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Last page">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
