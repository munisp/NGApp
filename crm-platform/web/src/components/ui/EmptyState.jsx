import { Inbox, Plus, Search, FileX } from 'lucide-react'

const icons = { inbox: Inbox, plus: Plus, search: Search, file: FileX }

export const EmptyState = ({
  icon = 'inbox',
  title = 'No data found',
  description = 'There are no items to display.',
  actionLabel,
  onAction,
}) => {
  const Icon = icons[icon] || Inbox

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center" role="status">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState
