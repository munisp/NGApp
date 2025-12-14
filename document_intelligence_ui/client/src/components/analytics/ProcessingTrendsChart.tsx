import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface TrendData {
  period: string;
  total_documents: number;
  successful: number;
  failed: number;
  avg_processing_time_ms: number;
  avg_confidence: number;
}

interface ProcessingTrendsChartProps {
  data: TrendData[];
  isLoading: boolean;
}

export function ProcessingTrendsChart({ data, isLoading }: ProcessingTrendsChartProps) {
  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading trends data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((item) => ({
    date: format(parseISO(item.period), 'MMM dd'),
    total: item.total_documents,
    successful: item.successful,
    failed: item.failed,
    avgTime: Math.round(item.avg_processing_time_ms),
    confidence: Math.round(item.avg_confidence * 100),
  }));

  return (
    <div className="space-y-8">
      {/* Document Volume Chart */}
      <div>
        <h3 className="text-sm font-medium mb-4">Document Volume</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSuccessful" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
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
            <Area
              type="monotone"
              dataKey="total"
              name="Total Documents"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorTotal)"
            />
            <Area
              type="monotone"
              dataKey="successful"
              name="Successful"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorSuccessful)"
            />
            <Area
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorFailed)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Metrics Chart */}
      <div>
        <h3 className="text-sm font-medium mb-4">Performance Metrics</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              label={{ value: 'Confidence (%)', angle: 90, position: 'insideRight' }}
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
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avgTime"
              name="Avg Processing Time (ms)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="confidence"
              name="Avg Confidence (%)"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
