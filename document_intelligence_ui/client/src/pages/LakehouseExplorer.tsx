import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Table as TableIcon, 
  Search,
  Download,
  RefreshCw,
  ChevronRight,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

export default function LakehouseExplorer() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch lakehouse tables
  const { data: tablesData, isLoading: tablesLoading, refetch: refetchTables } = 
    trpc.lakehouse.listTables.useQuery();

  // Fetch table schema when a table is selected
  const { data: schemaData, isLoading: schemaLoading } = 
    trpc.lakehouse.getTableSchema.useQuery(
      { tableName: selectedTable! },
      { enabled: !!selectedTable }
    );

  // Fetch table data when a table is selected
  const queryTableMutation = trpc.lakehouse.queryTable.useMutation();
  
  // Trigger query when table, page, or search changes
  const [tableData, setTableData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);
  
  useEffect(() => {
    if (!selectedTable) return;
    
    setDataLoading(true);
    queryTableMutation.mutate(
      { 
        tableName: selectedTable,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        filters: searchQuery ? { search: searchQuery } : undefined
      },
      {
        onSuccess: (data) => {
          setTableData(data);
          setDataLoading(false);
        },
        onError: () => {
          setDataLoading(false);
        }
      }
    );
  }, [selectedTable, page, searchQuery]);

  const handleExportData = () => {
    if (!tableData?.rows) return;

    // Convert to CSV
    const headers = Object.keys(tableData.rows[0] || {});
    const csv = [
      headers.join(','),
      ...tableData.rows.map((row: any) => 
        headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
      )
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Data exported successfully');
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'bronze':
        return 'bg-amber-600';
      case 'silver':
        return 'bg-gray-400';
      case 'gold':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Lakehouse Explorer</h1>
            <p className="text-muted-foreground">
              Browse and query Delta Lake tables across Bronze, Silver, and Gold layers
            </p>
          </div>
          <Button onClick={() => refetchTables()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Tables
              </CardTitle>
              <CardDescription>
                {tablesData?.tables.length || 0} tables available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tablesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading tables...</p>
                </div>
              ) : !tablesData?.tables || tablesData.tables.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No tables found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tablesData.tables.map((table: any) => (
                    <button
                      key={table.name}
                      onClick={() => {
                        setSelectedTable(table.name);
                        setPage(1);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedTable === table.name
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TableIcon className="w-4 h-4" />
                          <span className="font-medium text-sm">{table.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`${getLevelBadgeColor(table.level)} text-white text-xs`}>
                          {table.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {table.row_count?.toLocaleString() || 0} rows
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table Details and Data */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedTable ? (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center">
                    <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Table Selected</h3>
                    <p className="text-sm text-muted-foreground">
                      Select a table from the list to view its schema and data
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Table Schema */}
                <Card>
                  <CardHeader>
                    <CardTitle>Schema: {selectedTable}</CardTitle>
                    <CardDescription>
                      Column definitions and data types
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {schemaLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium">Column Name</th>
                              <th className="text-left p-3 text-sm font-medium">Data Type</th>
                              <th className="text-left p-3 text-sm font-medium">Nullable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schemaData?.schema.map((col: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="p-3 text-sm font-mono">{col.name}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant="outline">{col.type}</Badge>
                                </td>
                                <td className="p-3 text-sm">
                                  {col.nullable ? (
                                    <span className="text-muted-foreground">Yes</span>
                                  ) : (
                                    <span className="font-medium">No</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Table Data */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Data Preview</CardTitle>
                        <CardDescription>
                          {tableData?.total_rows.toLocaleString() || 0} total rows
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleExportData} 
                          variant="outline"
                          size="sm"
                          disabled={!tableData?.rows || tableData.rows.length === 0}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export CSV
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search in table data..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        className="max-w-sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {dataLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading data...</p>
                      </div>
                    ) : !tableData?.rows || tableData.rows.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No data found</p>
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-lg overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                {Object.keys(tableData.rows[0] || {}).map((key) => (
                                  <th key={key} className="text-left p-3 text-sm font-medium whitespace-nowrap">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.rows.map((row: any, index: number) => (
                                <tr key={index} className="border-t hover:bg-muted/50">
                                  {Object.values(row).map((value: any, i: number) => (
                                    <td key={i} className="p-3 text-sm whitespace-nowrap">
                                      {value === null || value === undefined ? (
                                        <span className="text-muted-foreground italic">null</span>
                                      ) : typeof value === 'object' ? (
                                        <span className="font-mono text-xs">
                                          {JSON.stringify(value)}
                                        </span>
                                      ) : (
                                        String(value)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {tableData.total_rows > pageSize && (
                          <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-muted-foreground">
                              Showing {(page - 1) * pageSize + 1} to{' '}
                              {Math.min(page * pageSize, tableData.total_rows)} of{' '}
                              {tableData.total_rows.toLocaleString()} rows
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * pageSize >= tableData.total_rows}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
