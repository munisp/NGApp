import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, CreditCard, BarChart3, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

const CreditScoringDashboard = () => {
  const [creditData, setCreditData] = useState({});
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditData();
    const interval = setInterval(fetchCreditData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchCreditData = async () => {
    try {
      // Mock data for demonstration
      setCreditData({
        totalApplications: 1247,
        approvedApplications: 892,
        rejectedApplications: 245,
        pendingApplications: 110,
        averageScore: 685,
        approvalRate: 71.5,
        defaultRate: 3.2,
        portfolioValue: 15750000
      });

      setApplications([
        {
          id: 1,
          customerName: 'John Doe',
          applicationDate: '2024-01-07',
          requestedAmount: 50000,
          creditScore: 720,
          riskLevel: 'Low',
          status: 'Approved',
          decision: 'Auto-approved'
        },
        {
          id: 2,
          customerName: 'Jane Smith',
          applicationDate: '2024-01-07',
          requestedAmount: 25000,
          creditScore: 580,
          riskLevel: 'High',
          status: 'Pending',
          decision: 'Manual review'
        },
        {
          id: 3,
          customerName: 'Bob Johnson',
          applicationDate: '2024-01-06',
          requestedAmount: 75000,
          creditScore: 650,
          riskLevel: 'Medium',
          status: 'Approved',
          decision: 'Conditional approval'
        },
        {
          id: 4,
          customerName: 'Alice Brown',
          applicationDate: '2024-01-06',
          requestedAmount: 30000,
          creditScore: 480,
          riskLevel: 'High',
          status: 'Rejected',
          decision: 'Insufficient credit history'
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching credit data:', error);
      setLoading(false);
    }
  };

  const scoreDistribution = [
    { range: '300-499', count: 45, color: '#ef4444' },
    { range: '500-599', count: 123, color: '#f59e0b' },
    { range: '600-699', count: 287, color: '#eab308' },
    { range: '700-799', count: 456, color: '#22c55e' },
    { range: '800-850', count: 234, color: '#10b981' }
  ];

  const approvalTrends = [
    { month: 'Jan', approved: 156, rejected: 44, pending: 23 },
    { month: 'Feb', approved: 178, rejected: 38, pending: 19 },
    { month: 'Mar', approved: 203, rejected: 52, pending: 31 },
    { month: 'Apr', approved: 189, rejected: 41, pending: 27 },
    { month: 'May', approved: 234, rejected: 48, pending: 35 },
    { month: 'Jun', approved: 267, rejected: 55, pending: 42 }
  ];

  const riskMetrics = [
    { name: 'Low Risk', value: 65, fill: '#22c55e' },
    { name: 'Medium Risk', value: 25, fill: '#eab308' },
    { name: 'High Risk', value: 10, fill: '#ef4444' }
  ];

  const getScoreColor = (score) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 650) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBadgeVariant = (risk) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'secondary';
      case 'medium': return 'default';
      case 'high': return 'destructive';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'secondary';
      case 'pending': return 'default';
      case 'rejected': return 'destructive';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Scoring</h1>
          <p className="text-muted-foreground">Monitor credit applications and scoring models</p>
        </div>
        <Button>
          <BarChart3 className="mr-2 h-4 w-4" />
          Model Performance
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditData.totalApplications}</div>
            <p className="text-xs text-muted-foreground">+15% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditData.approvalRate}%</div>
            <Progress value={creditData.approvalRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditData.averageScore}</div>
            <p className="text-xs text-muted-foreground">+8 points from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(creditData.portfolioValue / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">Total credit portfolio</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="models">Scoring Models</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Credit Applications</CardTitle>
              <CardDescription>Review and manage credit applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{app.customerName}</span>
                        <Badge variant={getStatusBadgeVariant(app.status)}>
                          {app.status}
                        </Badge>
                        <Badge variant={getRiskBadgeVariant(app.riskLevel)}>
                          {app.riskLevel} Risk
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Amount: ${app.requestedAmount.toLocaleString()}</span>
                        <span className={`font-medium ${getScoreColor(app.creditScore)}`}>
                          Score: {app.creditScore}
                        </span>
                        <span>Date: {app.applicationDate}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{app.decision}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      {app.status === 'Pending' && (
                        <Button size="sm">
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Approval Trends</CardTitle>
                <CardDescription>Monthly application outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={approvalTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="approved" fill="#22c55e" name="Approved" />
                    <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                    <Bar dataKey="pending" fill="#eab308" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>Credit score ranges</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Portfolio risk breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskMetrics}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Scoring model accuracy metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Model Accuracy</span>
                    <span className="text-sm text-muted-foreground">94.2%</span>
                  </div>
                  <Progress value={94.2} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Precision</span>
                    <span className="text-sm text-muted-foreground">91.8%</span>
                  </div>
                  <Progress value={91.8} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Recall</span>
                    <span className="text-sm text-muted-foreground">89.5%</span>
                  </div>
                  <Progress value={89.5} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">F1 Score</span>
                    <span className="text-sm text-muted-foreground">90.6%</span>
                  </div>
                  <Progress value={90.6} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Models</CardTitle>
              <CardDescription>Manage and configure credit scoring models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Primary Model</CardTitle>
                      <CardDescription>Main scoring algorithm</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Status</span>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Version</span>
                          <span className="text-sm">v2.1.3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Accuracy</span>
                          <span className="text-sm">94.2%</span>
                        </div>
                        <Button size="sm" className="w-full">Configure</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shadow Model</CardTitle>
                      <CardDescription>Testing new algorithm</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Status</span>
                          <Badge variant="default">Testing</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Version</span>
                          <span className="text-sm">v3.0.0-beta</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Accuracy</span>
                          <span className="text-sm">96.1%</span>
                        </div>
                        <Button size="sm" className="w-full" variant="outline">Monitor</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Fallback Model</CardTitle>
                      <CardDescription>Backup scoring system</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Status</span>
                          <Badge variant="outline">Standby</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Version</span>
                          <span className="text-sm">v1.9.2</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Accuracy</span>
                          <span className="text-sm">91.8%</span>
                        </div>
                        <Button size="sm" className="w-full" variant="outline">View</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CreditScoringDashboard;

