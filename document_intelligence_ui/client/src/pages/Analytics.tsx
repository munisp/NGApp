import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { ProcessingTrendsChart } from '@/components/analytics/ProcessingTrendsChart';
import { CategoryStatsChart } from '@/components/analytics/CategoryStatsChart';
import { ErrorPatternsTable } from '@/components/analytics/ErrorPatternsTable';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { analyticsTourSteps } from '@/config/analyticsTour';
import { HelpCircle } from 'lucide-react';

export default function Analytics() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day');
  
  // Guided tour
  const { run, stepIndex, startTour, handleJoyrideCallback } = useGuidedTour({
    tourKey: 'analytics',
    steps: analyticsTourSteps,
  });

  // Fetch analytics data
  const { data: trendsData, isLoading: trendsLoading, refetch: refetchTrends } = 
    trpc.analytics.getProcessingTrends.useQuery({ period, granularity });
  
  const { data: categoryData, isLoading: categoryLoading, refetch: refetchCategory } = 
    trpc.analytics.getCategoryStats.useQuery();
  
  const { data: errorData, isLoading: errorLoading, refetch: refetchErrors } = 
    trpc.analytics.getErrorPatterns.useQuery({ period: '7d' });

  // Calculate KPIs from trends data
  const kpis = trendsData?.trends ? (() => {
    const trends = trendsData.trends;
    const totalDocs = trends.reduce((sum: number, t: any) => sum + t.total_documents, 0);
    const totalSuccessful = trends.reduce((sum: number, t: any) => sum + t.successful, 0);
    const totalFailed = trends.reduce((sum: number, t: any) => sum + t.failed, 0);
    const avgTime = trends.reduce((sum: number, t: any) => sum + t.avg_processing_time_ms, 0) / trends.length;
    const avgConfidence = trends.reduce((sum: number, t: any) => sum + t.avg_confidence, 0) / trends.length;
    
    return {
      totalDocuments: totalDocs,
      successRate: totalDocs > 0 ? (totalSuccessful / totalDocs) * 100 : 0,
      avgProcessingTime: avgTime,
      avgConfidence: avgConfidence * 100,
      totalFailed: totalFailed,
    };
  })() : null;

  const handleRefreshAll = () => {
    refetchTrends();
    refetchCategory();
    refetchErrors();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor OCR processing performance and trends
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={startTour} variant="outline">
              <HelpCircle className="w-4 h-4 mr-2" />
              Start Tour
            </Button>
            <Button onClick={handleRefreshAll} variant="outline" data-tour="refresh-button">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-tour="kpi-cards">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trendsLoading ? '...' : kpis?.totalDocuments.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trendsLoading ? '...' : `${kpis?.successRate.toFixed(1)}%` || '0%'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis?.totalFailed || 0} failed documents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trendsLoading ? '...' : `${kpis?.avgProcessingTime.toFixed(0)}ms` || '0ms'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per document
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trendsLoading ? '...' : `${kpis?.avgConfidence.toFixed(1)}%` || '0%'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                OCR accuracy score
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Tables */}
        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList>
            <TabsTrigger value="trends">
              <TrendingUp className="w-4 h-4 mr-2" />
              Processing Trends
            </TabsTrigger>
            <TabsTrigger value="categories">
              <BarChart3 className="w-4 h-4 mr-2" />
              Category Stats
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle className="w-4 h-4 mr-2" />
              Error Patterns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card data-tour="trends-chart">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processing Trends Over Time</CardTitle>
                    <CardDescription>
                      Document processing volume and performance metrics
                    </CardDescription>
                  </div>
                  <div className="flex gap-2" data-tour="period-selector">
                    <Button
                      variant={period === '7d' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPeriod('7d')}
                    >
                      7 Days
                    </Button>
                    <Button
                      variant={period === '30d' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPeriod('30d')}
                    >
                      30 Days
                    </Button>
                    <Button
                      variant={period === '90d' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPeriod('90d')}
                    >
                      90 Days
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ProcessingTrendsChart 
                  data={trendsData?.trends || []} 
                  isLoading={trendsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card data-tour="category-stats">
              <CardHeader>
                <CardTitle>Statistics by Document Category</CardTitle>
                <CardDescription>
                  Success rates and performance metrics for each document type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryStatsChart 
                  data={categoryData?.categories || []} 
                  isLoading={categoryLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card data-tour="error-patterns">
              <CardHeader>
                <CardTitle>Error Patterns Analysis</CardTitle>
                <CardDescription>
                  Common errors and affected document categories (Last 7 days)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorPatternsTable 
                  data={errorData?.errors || []} 
                  isLoading={errorLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Guided Tour */}
      <Joyride
        steps={analyticsTourSteps}
        run={run}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        styles={{
          options: {
            primaryColor: '#3b82f6',
            zIndex: 10000,
          },
        }}
      />
    </div>
  );
}
