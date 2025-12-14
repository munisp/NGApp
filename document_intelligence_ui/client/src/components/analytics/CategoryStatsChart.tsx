import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface CategoryStat {
  category: string;
  total_documents: number;
  successful: number;
  failed: number;
  avg_processing_time_ms: number;
  avg_confidence: number;
}

interface CategoryStatsChartProps {
  data: CategoryStat[];
  isLoading: boolean;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function CategoryStatsChart({ data, isLoading }: CategoryStatsChartProps) {
  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading category statistics...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No category data available</p>
        </div>
      </div>
    );
  }

  // Format data for charts
  const volumeData = data.map((item) => ({
    category: item.category,
    total: item.total_documents,
    successful: item.successful,
    failed: item.failed,
  }));

  const performanceData = data.map((item) => ({
    category: item.category,
    avgTime: Math.round(item.avg_processing_time_ms),
    confidence: Math.round(item.avg_confidence * 100),
    successRate: item.total_documents > 0 
      ? Math.round((item.successful / item.total_documents) * 100) 
      : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Document Volume by Category */}
      <div>
        <h3 className="text-sm font-medium mb-4">Document Volume by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="category" 
              stroke="#6b7280"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
            />
            <Legend />
            <Bar dataKey="successful" name="Successful" stackId="a" fill="#10b981" />
            <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Success Rate by Category */}
      <div>
        <h3 className="text-sm font-medium mb-4">Success Rate by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="category" 
              stroke="#6b7280"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              domain={[0, 100]}
              label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
              formatter={(value: number) => `${value}%`}
            />
            <Bar dataKey="successRate" name="Success Rate" fill="#3b82f6">
              {performanceData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Metrics Table */}
      <div>
        <h3 className="text-sm font-medium mb-4">Performance Metrics by Category</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Category</th>
                <th className="text-right p-3 text-sm font-medium">Total Docs</th>
                <th className="text-right p-3 text-sm font-medium">Success Rate</th>
                <th className="text-right p-3 text-sm font-medium">Avg Time</th>
                <th className="text-right p-3 text-sm font-medium">Avg Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const successRate = item.total_documents > 0 
                  ? ((item.successful / item.total_documents) * 100).toFixed(1)
                  : '0.0';
                
                return (
                  <tr key={index} className="border-t hover:bg-muted/50">
                    <td className="p-3 text-sm font-medium">{item.category}</td>
                    <td className="p-3 text-sm text-right">{item.total_documents.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right">
                      <span className={`font-medium ${
                        parseFloat(successRate) >= 90 ? 'text-green-600' :
                        parseFloat(successRate) >= 75 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {successRate}%
                      </span>
                    </td>
                    <td className="p-3 text-sm text-right">
                      {Math.round(item.avg_processing_time_ms)}ms
                    </td>
                    <td className="p-3 text-sm text-right">
                      {(item.avg_confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
