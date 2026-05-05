import { Loader2 } from 'lucide-react'

export const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8" role="status" aria-live="polite">
      <Loader2 className={`${sizes[size]} text-blue-600 animate-spin`} aria-hidden="true" />
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  )
}

export const InlineSpinner = ({ size = 'sm' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5' }
  return <Loader2 className={`${sizes[size]} animate-spin inline`} aria-hidden="true" />
}

export const SkeletonRow = ({ cols = 4 }) => (
  <tr className="animate-pulse" aria-hidden="true">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
)

export const SkeletonCard = () => (
  <div className="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6" aria-hidden="true">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
  </div>
)

export default LoadingSpinner
