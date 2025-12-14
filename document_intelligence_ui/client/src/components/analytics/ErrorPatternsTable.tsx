import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPattern {
  error_type: string;
  error_message: string;
  count: number;
  affected_categories: string[];
  first_seen: string;
  last_seen: string;
}

interface ErrorPatternsTableProps {
  data: ErrorPattern[];
  isLoading: boolean;
}

type SortField = 'count' | 'error_type' | 'last_seen';
type SortOrder = 'asc' | 'desc';

export function ErrorPatternsTable({ data, isLoading }: ErrorPatternsTableProps) {
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading error patterns...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-600 mb-2">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <p className="font-medium">No errors detected!</p>
          <p className="text-sm text-muted-foreground mt-1">
            All documents processed successfully
          </p>
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortField) {
      case 'count':
        aVal = a.count;
        bVal = b.count;
        break;
      case 'error_type':
        aVal = a.error_type;
        bVal = b.error_type;
        break;
      case 'last_seen':
        aVal = new Date(a.last_seen).getTime();
        bVal = new Date(b.last_seen).getTime();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="w-10"></th>
            <th 
              className="text-left p-3 text-sm font-medium cursor-pointer hover:bg-muted/80"
              onClick={() => handleSort('error_type')}
            >
              Error Type <SortIcon field="error_type" />
            </th>
            <th 
              className="text-right p-3 text-sm font-medium cursor-pointer hover:bg-muted/80"
              onClick={() => handleSort('count')}
            >
              Count <SortIcon field="count" />
            </th>
            <th className="text-left p-3 text-sm font-medium">
              Affected Categories
            </th>
            <th 
              className="text-right p-3 text-sm font-medium cursor-pointer hover:bg-muted/80"
              onClick={() => handleSort('last_seen')}
            >
              Last Seen <SortIcon field="last_seen" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((error, index) => {
            const isExpanded = expandedRows.has(index);
            const lastSeenDate = new Date(error.last_seen);
            const relativeTime = getRelativeTime(lastSeenDate);

            return (
              <>
                <tr 
                  key={index} 
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleRow(index)}
                >
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </td>
                  <td className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="font-medium">{error.error_type}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-right font-medium">
                    {error.count}
                  </td>
                  <td className="p-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {error.affected_categories.slice(0, 3).map((cat, i) => (
                        <span 
                          key={i}
                          className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                        >
                          {cat}
                        </span>
                      ))}
                      {error.affected_categories.length > 3 && (
                        <span className="inline-block px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                          +{error.affected_categories.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-right text-muted-foreground">
                    {relativeTime}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-t bg-muted/30">
                    <td colSpan={5} className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Error Message:</h4>
                          <p className="text-sm text-muted-foreground font-mono bg-background p-2 rounded border">
                            {error.error_message}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">First Seen:</span>{' '}
                            <span className="text-muted-foreground">
                              {new Date(error.first_seen).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Last Seen:</span>{' '}
                            <span className="text-muted-foreground">
                              {new Date(error.last_seen).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-sm">All Affected Categories:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {error.affected_categories.map((cat, i) => (
                              <span 
                                key={i}
                                className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
