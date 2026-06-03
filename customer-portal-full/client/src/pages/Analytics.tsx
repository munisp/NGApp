import React, { useState } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AnalyticsDashboardProps {}

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const Analytics: React.FC<AnalyticsDashboardProps> = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const { data, isLoading, isError, error } = trpc.analytics.dashboard.useQuery({ period }, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full text-lg font-semibold text-red-500">
        Please log in to view analytics.
      </div>
    );
  }

  if (isError && !DEMO_MODE) {
    toast.error(`Error loading analytics: ${error?.message}`);
    return (
      <div className="flex items-center justify-center h-full text-lg font-semibold text-red-500">
        Failed to load analytics data. Please try again later.
      </div>
    );
  }

  const demoData = {
    totalPolicies: 15000,
    totalClaims: 3500,
    premiumCollected: '₦150,000,000',
    payouts: '₦75,000,000',
    newCustomers: 1200,
    topAgents: [
      { id: '1', name: 'Aisha Bello', policies: 320, premium: '₦12,000,000' },
      { id: '2', name: 'Chinedu Okoro', policies: 280, premium: '₦10,500,000' },
      { id: '3', name: 'Fatima Musa', policies: 250, premium: '₦9,800,000' },
    ],
    charts: {
      premiums: [10, 20, 30, 25, 35, 40, 45],
      claims: [5, 8, 12, 10, 15, 18, 20],
    },
  };

  const displayData = DEMO_MODE ? demoData : data;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      <div className="flex justify-end items-center space-x-2">
        <Select value={period} onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => toast.info("Refreshing data...")}>Refresh</Button>
      </div>

      {isLoading && !DEMO_MODE ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayData?.totalPolicies?.toLocaleString() || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayData?.totalClaims?.toLocaleString() || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayData?.premiumCollected || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayData?.payouts || 'N/A'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Premium & Claims Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {/* Placeholder for chart - In a real app, integrate a charting library like Recharts or Chart.js */}
            <div className="h-[200px] bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
              <p className="text-gray-500">Chart Placeholder (Premiums: {displayData?.charts?.premiums?.join(', ')}, Claims: {displayData?.charts?.claims?.join(', ')})</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayData?.topAgents?.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium leading-none">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.policies} policies</p>
                  </div>
                  <div className="ml-auto font-medium">{agent.premium}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;