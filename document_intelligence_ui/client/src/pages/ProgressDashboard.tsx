import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface JobStatus {
  job_id: string;
  document_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface QueueStats {
  queue_name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
}

interface WorkerStatus {
  worker_id: string;
  status: "online" | "offline";
  current_task?: string;
  tasks_completed: number;
  uptime: number;
}

export default function ProgressDashboard() {
  const [activeJobs, setActiveJobs] = useState<JobStatus[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);

  // Fetch orchestration stats
  const { data: stats, isLoading } = trpc.orchestration.getStats.useQuery(undefined, {
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  useEffect(() => {
    if (stats) {
      setActiveJobs(stats.activeJobs || []);
      setQueueStats(stats.queueStats || []);
      setWorkers(stats.workers || []);
    }
  }, [stats]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      failed: "destructive",
      processing: "secondary",
      pending: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Real-Time Progress Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor active OCR jobs, queue status, and worker health in real-time
        </p>
      </div>

      {/* Queue Statistics */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {queueStats.map((queue) => (
          <Card key={queue.queue_name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {queue.queue_name.replace("_queue", "").toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{queue.pending}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{queue.active}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{queue.completed}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{queue.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Jobs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Active OCR Jobs</CardTitle>
          <CardDescription>
            Currently processing documents ({activeJobs.length} active)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active jobs at the moment
            </div>
          ) : (
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.job_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">Document: {job.document_id}</span>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  
                  {job.status === "processing" && (
                    <div className="space-y-2">
                      <Progress value={job.progress} className="h-2" />
                      <div className="text-sm text-muted-foreground">
                        {job.progress}% complete
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      {job.error}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-muted-foreground">
                    Job ID: {job.job_id}
                    {job.started_at && ` • Started: ${new Date(job.started_at).toLocaleTimeString()}`}
                    {job.completed_at && ` • Completed: ${new Date(job.completed_at).toLocaleTimeString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worker Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Celery Workers
          </CardTitle>
          <CardDescription>
            Worker health and current tasks ({workers.filter(w => w.status === "online").length}/{workers.length} online)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workers.map((worker) => (
              <div key={worker.worker_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{worker.worker_id}</span>
                  <Badge variant={worker.status === "online" ? "default" : "secondary"}>
                    {worker.status}
                  </Badge>
                </div>
                
                {worker.current_task && (
                  <div className="text-sm text-muted-foreground mb-2">
                    Processing: {worker.current_task}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium">{worker.tasks_completed}</div>
                    <div className="text-muted-foreground">Tasks Done</div>
                  </div>
                  <div>
                    <div className="font-medium">{Math.floor(worker.uptime / 60)}m</div>
                    <div className="text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
