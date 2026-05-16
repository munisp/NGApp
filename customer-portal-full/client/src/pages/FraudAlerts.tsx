import React, { useState } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEMO_MODE = false;

interface FraudNode {
  id: string;
  label: string;
  type: 'customer' | 'policy' | 'claim' | 'agent';
  riskScore: number;
  connections: string[];
}

interface FraudGraph {
  nodes: FraudNode[];
  edges: { source: string; target: string; type: string }[];
}

const demoFraudGraph: FraudGraph = {
  nodes: [
    { id: 'cust-001', label: 'Aisha Musa', type: 'customer', riskScore: 0.85, connections: ['claim-001', 'policy-001'] },
    { id: 'policy-001', label: 'Auto Policy 123', type: 'policy', riskScore: 0.70, connections: ['cust-001'] },
    { id: 'claim-001', label: 'Claim 456', type: 'claim', riskScore: 0.92, connections: ['cust-001', 'agent-001'] },
    { id: 'agent-001', label: 'Kunle Adebayo', type: 'agent', riskScore: 0.60, connections: ['claim-001'] },
    { id: 'cust-002', label: 'Chinedu Okoro', type: 'customer', riskScore: 0.40, connections: ['policy-002'] },
    { id: 'policy-002', label: 'Life Policy 789', type: 'policy', riskScore: 0.35, connections: ['cust-002'] },
  ],
  edges: [
    { source: 'cust-001', target: 'policy-001', type: 'owns' },
    { source: 'cust-001', target: 'claim-001', type: 'filed' },
    { source: 'claim-001', target: 'agent-001', type: 'handled_by' },
    { source: 'cust-002', target: 'policy-002', type: 'owns' },
  ],
};

const FraudAlerts: React.FC = () => {
  useAuth();
  const utils = trpc.useUtils();

  const [entityId, setEntityId] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const { data: fraudGraph, isLoading: isLoadingGraph, isError: isErrorGraph, error: graphError } = trpc.fraudNetwork.graph.useQuery(undefined, {
    enabled: !DEMO_MODE,
  });

  const { mutate: analyzeFraud, isLoading: isAnalyzing, isError: isErrorAnalyze, error: analyzeError } = trpc.fraudNetwork.analyze.useMutation({
    onSuccess: (data) => {
      toast.success('Fraud analysis initiated successfully!');
      setAnalysisResult(`Analysis for entity ${entityId}: ${data.message}`);
      utils.fraudNetwork.graph.invalidate(); // Invalidate graph to reflect potential changes
    },
    onError: (err) => {
      toast.error(`Failed to analyze fraud: ${err.message}`);
      setAnalysisResult(null);
    },
  });

  if (isErrorGraph) {
    toast.error(`Error loading fraud graph: ${graphError?.message}`);
  }
  if (isErrorAnalyze) {
    toast.error(`Error during fraud analysis: ${analyzeError?.message}`);
  }

  const handleAnalyze = () => {
    if (entityId.trim()) {
      if (DEMO_MODE) {
        toast.info(`Demo: Analyzing entity ${entityId}`);
        setAnalysisResult(`Demo analysis for ${entityId}: No fraud detected.`);
      } else {
        analyzeFraud({ entityId });
      }
    } else {
      toast.warning('Please enter an Entity ID to analyze.');
    }
  };

  const displayGraph = DEMO_MODE ? demoFraudGraph : fraudGraph;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Fraud Alerts & Network Analysis</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fraud Network Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingGraph && !DEMO_MODE ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading fraud network...</span>
            </div>
          ) : (
            <div>
              <p className="mb-4">Visual representation of interconnected entities and their risk scores.</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Connections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayGraph?.nodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">No fraud network data available.</TableCell>
                    </TableRow>
                  )}
                  {displayGraph?.nodes.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell>{node.id}</TableCell>
                      <TableCell>{node.label}</TableCell>
                      <TableCell>{node.type}</TableCell>
                      <TableCell>
                        <Badge variant={node.riskScore > 0.7 ? 'destructive' : node.riskScore > 0.5 ? 'warning' : 'default'}>
                          {(node.riskScore * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{node.connections.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analyze Specific Entity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter Entity ID (e.g., cust-001, claim-001)"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="flex-grow"
            />
            <Button onClick={handleAnalyze} disabled={isAnalyzing || !entityId.trim()}>
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Analyze
            </Button>
          </div>
          {analysisResult && (
            <p className="mt-4 text-sm text-muted-foreground">{analysisResult}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FraudAlerts;