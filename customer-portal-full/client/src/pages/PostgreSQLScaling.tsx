import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const demoMetrics = [
  { metric: 'CPU Usage', value: '75%', threshold: '80%' },
  { metric: 'Memory Usage', value: '60%', threshold: '70%' },
  { metric: 'Disk I/O', value: '120 MB/s', threshold: '150 MB/s' },
  { metric: 'Active Connections', value: '500', threshold: '600' },
];

const demoRecommendations = [
  { id: '1', recommendation: 'Optimize frequently run queries', status: 'Pending' },
  { id: '2', recommendation: 'Increase database instance memory', status: 'Applied' },
  { id: '3', recommendation: 'Implement connection pooling', status: 'Pending' },
];

export default function PostgreSQLScaling() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: metrics, isLoading: metricsLoading, isError: metricsError, error: metricsErrorData, refetch: refetchMetrics } = trpc.dbScaling.metrics.useQuery();
  const { data: recommendations, isLoading: recommendationsLoading, isError: recommendationsError, error: recommendationsErrorData, refetch: refetchRecommendations } = trpc.dbScaling.recommendations.useQuery();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg font-semibold text-red-500">
        Access Denied: Please log in to view this page.
      </div>
    );
  }

  if (metricsError) {
    toast.error(`Failed to load metrics: ${metricsErrorData?.message}`);
  }

  if (recommendationsError) {
    toast.error(`Failed to load recommendations: ${recommendationsErrorData?.message}`);
  }

  const currentMetrics = DEMO_MODE ? demoMetrics : metrics;
  const currentRecommendations = DEMO_MODE ? demoRecommendations : recommendations;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>PostgreSQL Scaling & Optimization</CardTitle>
          <CardDescription>Monitor database performance and get scaling recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={() => {
              refetchMetrics();
              refetchRecommendations();
              toast.info('Refreshing data...');
            }}>
              Refresh Data
            </Button>
          </div>

          <h3 className="text-lg font-semibold mb-4">Current Metrics</h3>
          {metricsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMetrics?.map((m, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{m.metric}</TableCell>
                    <TableCell>{m.value}</TableCell>
                    <TableCell>{m.threshold}</TableCell>
                  </TableRow>
                ))}
                {(!currentMetrics || currentMetrics.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No metrics available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <h3 className="text-lg font-semibold mt-8 mb-4">Scaling Recommendations</h3>
          {recommendationsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRecommendations?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.recommendation}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" disabled={r.status === 'Applied'} onClick={() => toast.info(`Applying recommendation: ${r.recommendation}`)}>
                        {r.status === 'Applied' ? 'Applied' : 'Apply'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!currentRecommendations || currentRecommendations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No recommendations available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}