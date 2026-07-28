import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

// Demo mode data
const DEMO_MODE = true;
const DEMO_CLAIMS = [
  { id: 1, claimNumber: "CLM-2026-001", policyId: 1, amount: "45000", status: "Under Review", incidentDate: new Date("2026-01-10"), description: "Medical expenses for hospital visit and prescribed medications following an accident.", createdAt: new Date("2026-01-12"), updatedAt: new Date() },
  { id: 2, claimNumber: "CLM-2025-002", policyId: 2, amount: "120000", status: "Approved", incidentDate: new Date("2025-11-20"), description: "Vehicle repair costs after minor collision at intersection.", createdAt: new Date("2025-11-22"), updatedAt: new Date() },
  { id: 3, claimNumber: "CLM-2025-003", policyId: 1, amount: "25000", status: "Paid", incidentDate: new Date("2025-09-15"), description: "Dental procedure covered under health plan.", createdAt: new Date("2025-09-17"), updatedAt: new Date() },
];
const DEMO_POLICIES = [
  { id: 1, policyNumber: "POL-2026-001", name: "Comprehensive Health Plan", type: "Health" },
  { id: 2, policyNumber: "POL-2026-002", name: "Auto Protection Plus", type: "Auto" },
  { id: 3, policyNumber: "POL-2025-003", name: "Home Shield", type: "Property" },
];

export default function Claims() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [demoMode] = useState(DEMO_MODE);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    policyId: "",
    amount: "",
    incidentDate: "",
    description: "",
  });

  const { data: realClaims, isLoading } = trpc.claims.list.useQuery(undefined, {
    enabled: isAuthenticated && !demoMode,
  });

  const { data: realPolicies } = trpc.policies.list.useQuery(undefined, {
    enabled: isAuthenticated && !demoMode,
  });

  const claims = demoMode ? DEMO_CLAIMS : realClaims;
  const policies = demoMode ? DEMO_POLICIES : realPolicies;

  const createClaimMutation = trpc.claims.create.useMutation({
    onSuccess: () => {
      toast.success("Claim Submitted", {
        description: "Your claim has been successfully submitted and is under review.",
      });
      setShowForm(false);
      setFormData({ policyId: "", amount: "", incidentDate: "", description: "" });
      trpc.useUtils().claims.list.invalidate();
    },
    onError: (error) => {
      toast.error("Submission Failed", {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (!demoMode && !authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated, demoMode]);

  if (!demoMode && (authLoading || !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.policyId || !formData.amount || !formData.incidentDate || !formData.description) {
      toast.error("Missing Information", {
        description: "Please fill in all required fields.",
      });
      return;
    }

    createClaimMutation.mutate({
      policyId: parseInt(formData.policyId),
      amount: formData.amount,
      incidentDate: new Date(formData.incidentDate),
      description: formData.description,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-green-100 text-green-800";
      case "Rejected": return "bg-red-100 text-red-800";
      case "Paid": return "bg-blue-100 text-blue-800";
      case "Under Review": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <nav className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard"><Button variant="ghost">← Back to Dashboard</Button></Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">My Claims</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <FileText className="h-4 w-4 mr-2" />
            File New Claim
          </Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>File New Claim</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Policy *</Label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={formData.policyId}
                    onChange={(e) => setFormData({ ...formData, policyId: e.target.value })}
                    required
                  >
                    <option value="">Select a policy</option>
                    {policies?.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name} ({policy.policyNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Claim Amount (₦) *</Label>
                  <Input 
                    type="number" 
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Incident Date *</Label>
                  <Input 
                    type="date" 
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea 
                    placeholder="Describe the incident..." 
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Upload Documents (Optional)</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={createClaimMutation.isPending}>
                    {createClaimMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Submit Claim
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowForm(false)}
                    disabled={createClaimMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : claims && claims.length > 0 ? (
          <div className="grid gap-6">
            {claims.map((claim) => (
              <Card key={claim.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Claim {claim.claimNumber}</CardTitle>
                      <p className="text-muted-foreground mt-1">Policy ID: {claim.policyId}</p>
                    </div>
                    <Badge className={getStatusColor(claim.status)}>{claim.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Claim Amount</p>
                      <p className="font-semibold text-lg">₦{parseFloat(claim.amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Submitted</p>
                      <p className="font-semibold">
                        {new Date(claim.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Incident Date</p>
                      <p className="font-semibold">
                        {new Date(claim.incidentDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{claim.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">No Claims Found</p>
              <p className="text-muted-foreground mb-4">You haven't filed any claims yet.</p>
              <Button onClick={() => setShowForm(true)}>
                <FileText className="h-4 w-4 mr-2" />
                File Your First Claim
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
