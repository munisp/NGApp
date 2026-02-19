import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, TrendingUp, Eye, Activity, Clock, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const FraudDetectionDashboard = () => {
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [fraudMetrics, setFraudMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFraudData();
    const interval = setInterval(fetchFraudData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchFraudData = async () => {
    try {
      // Mock data for demonstration
      setFraudAlerts([
        {
          id: 1,
          type: 'High Risk Transaction',
          severity: 'high',
          description: 'Large cash withdrawal detected',
          amount: 50000,
          customer: 'John Doe',
          timestamp: new Date().toISOString(),
          status: 'pending'
        },
        {
          id: 2,
          type: 'Suspicious Pattern',
          severity: 'medium',
          description: 'Multiple small transactions',
          amount: 5000,
          customer: 'Jane Smith',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'investigating'
        },
        {
          id: 3,
          type: 'Velocity Check',
          severity: 'low',
          description: 'Rapid transaction sequence',
          amount: 15000,
          customer: 'Bob Johnson',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          status: 'resolved'
        }
      ]);

      setFraudMetrics({
        totalAlerts: 156,
        highRiskAlerts: 23,
        resolvedToday: 45,
        falsePositiveRate: 12.5,
        averageResponseTime: 8.5,
        blockedAmount: 2500000
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching fraud data:', error);
      setLoading(false);
    }
  };

  const fraudTrendData = [
    { date: '2024-01-01', alerts: 45, blocked: 125000 },
    { date: '2024-01-02', alerts: 52, blocked: 180000 },
    { date: '2024-01-03', alerts: 38, blocked: 95000 },
    { date: '2024-01-04', alerts: 61, blocked: 220000 },
    { date: '2024-01-05', alerts: 43, blocked: 160000 },
    { date: '2024-01-06', alerts: 55, blocked: 190000 },
    { date: '2024-01-07', alerts: 49, blocked: 175000 }
  ];

  const riskDistribution = [
    { name: 'High Risk', value: 23, color: '#ef4444' },
    { name: 'Medium Risk', value: 67, color: '#f59e0b' },
    { name: 'Low Risk', value: 66, color: '#10b981' }
  ];

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'investigating': return 'default';
      case 'resolved': return 'secondary';
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
          <h1 className="text-3xl font-bold tracking-tight">Fraud Detection</h1>
          <p className="text-muted-foreground">Monitor and manage fraud detection alerts</p>
        </div>
        <Button>
          <Shield className="mr-2 h-4 w-4" />
          Configure Rules
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fraudMetrics.totalAlerts}</div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Alerts</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{fraudMetrics.highRiskAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${fraudMetrics.blockedAmount?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Prevented losses today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fraudMetrics.averageResponseTime}m</div>
            <p className="text-xs text-muted-foreground">Average response time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="rules">Detection Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Fraud Alerts</CardTitle>
              <CardDescription>Monitor and investigate suspicious activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fraudAlerts.map((alert) => (
                  <Alert key={alert.id} className="border-l-4 border-l-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.type}</span>
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge variant={getStatusColor(alert.status)}>
                              {alert.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Customer: {alert.customer}</span>
                            <span>Amount: ${alert.amount.toLocaleString()}</span>
                            <span>Time: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-2 h-3 w-3" />
                            Investigate
                          </Button>
                          <Button size="sm">
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fraud Trends</CardTitle>
                <CardDescription>Daily fraud alerts and blocked amounts</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={fraudTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="alerts" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Alert distribution by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Blocked Amounts</CardTitle>
              <CardDescription>Daily prevented losses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fraudTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="blocked" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detection Rules</CardTitle>
              <CardDescription>Configure fraud detection rules and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Rule configuration interface would be implemented here with forms for:
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li>Transaction amount thresholds</li>
                      <li>Velocity checks</li>
                      <li>Geographic restrictions</li>
                      <li>Time-based rules</li>
                      <li>Pattern detection algorithms</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FraudDetectionDashboard;

