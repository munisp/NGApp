import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, AlertTriangle, BarChart3 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function FxRisk() {
  const exposureQuery = trpc.fxRisk.exposure.useQuery({});
  const hedgingQuery = trpc.fxRisk.hedgingPositions.useQuery();
  const limitsQuery = trpc.fxRisk.limits.useQuery();
  const varQuery = trpc.fxRisk.varReport.useQuery({});
  const stressMutation = trpc.fxRisk.stressTest.useMutation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FX Risk Management</h1>
          <p className="text-muted-foreground">Monitor and manage foreign exchange exposure</p>
        </div>
        <Button
          variant="outline"
          onClick={() => stressMutation.mutate({ scenario: 'moderate' })}
          disabled={stressMutation.isPending}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Run Stress Test
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">${(exposureQuery.data as any)?.totalExposureUSD?.toLocaleString() || '0'}</p>
              <p className="text-sm text-muted-foreground">Total Exposure</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{Array.isArray(hedgingQuery.data) ? hedgingQuery.data.length : 0}</p>
              <p className="text-sm text-muted-foreground">Active Hedges</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">${(varQuery.data as any)?.var95 || '0'}</p>
              <p className="text-sm text-muted-foreground">VaR (95%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{(limitsQuery.data as any)?.breaches || 0}</p>
              <p className="text-sm text-muted-foreground">Limit Breaches</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {stressMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>Stress Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
              {JSON.stringify(stressMutation.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Risk Limits</CardTitle>
        </CardHeader>
        <CardContent>
          {limitsQuery.data && typeof limitsQuery.data === 'object' ? (
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
              {JSON.stringify(limitsQuery.data, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">Loading risk limits...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
