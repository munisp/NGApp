import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ReviewQueue() {
  const { user, loading: authLoading } = useAuth();
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<string>("");
  
  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery();
  
  const submitReview = trpc.orchestration.submitReview.useMutation({
    onSuccess: () => {
      toast.success("Review submitted successfully");
      setSelectedDoc(null);
      setCorrections("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to submit review: ${error.message}`);
    },
  });
  
  // Filter documents that need review (confidence < 90%)
  const reviewDocs = documents?.filter(
    (doc: any) => doc.confidence && doc.confidence < 90
  ) || [];
  
  const handleApprove = (docId: string) => {
    submitReview.mutate({
      documentId: docId,
      reviewerId: user?.id.toString() || "",
      corrections: corrections ? JSON.parse(corrections) : {},
      approved: true,
    });
  };
  
  const handleReject = (docId: string) => {
    submitReview.mutate({
      documentId: docId,
      reviewerId: user?.id.toString() || "",
      corrections: corrections ? JSON.parse(corrections) : {},
      approved: false,
    });
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Clock className="animate-spin h-8 w-8" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Review Queue</h1>
            <p className="text-muted-foreground mt-1">
              Documents requiring human review (confidence &lt; 90%)
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {reviewDocs.length} pending
          </Badge>
        </div>

        {reviewDocs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">
                No documents require review at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reviewDocs.map((doc: any) => (
              <Card key={doc.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {doc.filename}
                        <Badge
                          variant={
                            doc.confidence && doc.confidence < 70
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {doc.confidence?.toFixed(1)}% confidence
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Extracted Text:</h4>
                      <div className="bg-muted p-4 rounded-md max-h-40 overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap">
                          {doc.extractedText || "No text extracted"}
                        </pre>
                      </div>
                    </div>

                    {selectedDoc === doc.id.toString() && (
                      <div>
                        <h4 className="font-semibold mb-2">
                          Corrections (JSON format):
                        </h4>
                        <Textarea
                          value={corrections}
                          onChange={(e) => setCorrections(e.target.value)}
                          placeholder='{"field": "corrected_value"}'
                          className="font-mono text-sm"
                          rows={4}
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      {selectedDoc === doc.id.toString() ? (
                        <>
                          <Button
                            onClick={() => handleApprove(doc.id.toString())}
                            disabled={submitReview.isPending}
                            className="flex-1"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleReject(doc.id.toString())}
                            disabled={submitReview.isPending}
                            variant="destructive"
                            className="flex-1"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedDoc(null);
                              setCorrections("");
                            }}
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setSelectedDoc(doc.id.toString())}
                          className="w-full"
                        >
                          Start Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
