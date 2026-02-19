import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Wifi, AlertTriangle, CheckCircle, Clock, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SystemMonitoringDashboard = () => {
  const [systemMetrics, setSystemMetrics] = useState({});
  const [services, setServices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemData = async () => {
    try {
      // Mock data for demonstration
      setSystemMetrics({
        overallHealth: 98.5,
        cpuUsage: 45.2,
        memoryUsage: 67.8,
        diskUsage: 34.1,
        networkLatency: 12.5,
        uptime: '15d 8h 23m',
        activeConnections: 1247,
        requestsPerSecond: 156
      });

      setServices([
        { name: 'API Gateway', status: 'healthy', uptime: '99.9%', responseTime: '45ms', instances: 3 },
        { name: 'Auth Service', status: 'healthy', uptime: '99.8%', responseTime: '23ms', instances: 2 },
        { name: 'Transaction Service', status: 'warning', uptime: '98.5%', responseTime: '89ms', instances: 4 },
        { name: 'KYC Service', status: 'healthy', uptime: '99.7%', responseTime: '67ms', instances: 2 },
        { name: 'Fraud Detection', status: 'healthy', uptime: '99.9%', responseTime: '34ms', instances: 3 },
        { name: 'Database Cluster', status: 'healthy', uptime: '99.9%', responseTime: '12ms', instances: 5 },
        { name: 'Message Queue', status: 'critical', uptime: '95.2%', responseTime: '156ms', instances: 2 },
        { name: 'Cache Layer', status: 'healthy', uptime: '99.6%', responseTime: '8ms', instances: 3 }
      ]);

      setAlerts([
        {
          id: 1,
          severity: 'critical',
          service: 'Message Queue',
          message: 'High memory usage detected',
          timestamp: new Date().toISOString(),
          status: 'active'
        },
        {
          id: 2,
          severity: 'warning',
          service: 'Transaction Service',
          message: 'Response time above threshold',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'active'
        },
        {
          id: 3,
          severity: 'info',
          service: 'API Gateway',
          message: 'Scheduled maintenance completed',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'resolved'
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching system data:', error);
      setLoading(false);
    }
  };

  const performanceData = [
    { time: '00:00', cpu: 35, memory: 60, network: 15 },
    { time: '04:00', cpu: 28, memory: 58, network: 12 },
    { time: '08:00', cpu: 52, memory: 72, network: 18 },
    { time: '12:00', cpu: 45, memory: 68, network: 16 },
    { time: '16:00', cpu: 38, memory: 65, network: 14 },
    { time: '20:00', cpu: 42, memory: 70, network: 17 },
    { time: '24:00', cpu: 45, memory: 68, network: 13 }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'secondary';
      case 'warning': return 'default';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'secondary';
      default: return 'outline';
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
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">Monitor system health and performance</p>
        </div>
        <Button>
          <Activity className="mr-2 h-4 w-4" />
          View Logs
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{systemMetrics.overallHealth}%</div>
            <Progress value={systemMetrics.overallHealth} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.cpuUsage}%</div>
            <Progress value={systemMetrics.cpuUsage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.memoryUsage}%</div>
            <Progress value={systemMetrics.memoryUsage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.diskUsage}%</div>
            <Progress value={systemMetrics.diskUsage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>Monitor the health of all microservices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(service.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{service.name}</span>
                          <Badge variant={getStatusColor(service.status)}>
                            {service.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Uptime: {service.uptime}</span>
                          <span>Response: {service.responseTime}</span>
                          <span>Instances: {service.instances}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Logs
                      </Button>
                      <Button size="sm" variant="outline">
                        Metrics
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Performance</CardTitle>
              <CardDescription>Real-time performance metrics over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke="#8884d8" fill="#8884d8" name="CPU %" />
                  <Area type="monotone" dataKey="memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Memory %" />
                  <Area type="monotone" dataKey="network" stackId="1" stroke="#ffc658" fill="#ffc658" name="Network Latency (ms)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Network Performance</CardTitle>
                <CardDescription>Network latency and throughput</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Average Latency</span>
                    <span className="text-sm text-muted-foreground">{systemMetrics.networkLatency}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Requests/sec</span>
                    <span className="text-sm text-muted-foreground">{systemMetrics.requestsPerSecond}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Active Connections</span>
                    <span className="text-sm text-muted-foreground">{systemMetrics.activeConnections}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">System Uptime</span>
                    <span className="text-sm text-muted-foreground">{systemMetrics.uptime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>Current resource usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">CPU</span>
                      <span className="text-sm text-muted-foreground">{systemMetrics.cpuUsage}%</span>
                    </div>
                    <Progress value={systemMetrics.cpuUsage} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Memory</span>
                      <span className="text-sm text-muted-foreground">{systemMetrics.memoryUsage}%</span>
                    </div>
                    <Progress value={systemMetrics.memoryUsage} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Disk</span>
                      <span className="text-sm text-muted-foreground">{systemMetrics.diskUsage}%</span>
                    </div>
                    <Progress value={systemMetrics.diskUsage} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Monitor and manage system alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <Alert key={alert.id} className="border-l-4 border-l-red-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.service}</span>
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge variant={alert.status === 'active' ? 'destructive' : 'secondary'}>
                              {alert.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {alert.status === 'active' && (
                            <>
                              <Button size="sm" variant="outline">
                                Investigate
                              </Button>
                              <Button size="sm">
                                Acknowledge
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Compute Nodes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Nodes</span>
                    <span className="text-sm font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active</span>
                    <span className="text-sm font-medium text-green-600">11</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Maintenance</span>
                    <span className="text-sm font-medium text-yellow-600">1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Failed</span>
                    <span className="text-sm font-medium text-red-600">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Cluster
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Primary</span>
                    <Badge variant="secondary">Healthy</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Replicas</span>
                    <span className="text-sm font-medium">4/4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Replication Lag</span>
                    <span className="text-sm font-medium">2ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Storage Used</span>
                    <span className="text-sm font-medium">2.1TB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Bandwidth</span>
                    <span className="text-sm font-medium">10 Gbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Utilization</span>
                    <span className="text-sm font-medium">34%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Packet Loss</span>
                    <span className="text-sm font-medium">0.01%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Latency</span>
                    <span className="text-sm font-medium">12ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemMonitoringDashboard;

