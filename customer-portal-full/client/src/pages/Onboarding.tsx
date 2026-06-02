import React, { useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const DEMO_MODE = process.env.DEMO_MODE === 'true';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const DEMO_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'profile', title: 'Complete Your Profile', description: 'Fill in your personal and contact details.', completed: false },
  { id: 'kyc', title: 'Submit KYC Documents', description: 'Upload required identification documents for verification.', completed: false },
  { id: 'bank', title: 'Link Bank Account', description: 'Connect your bank account for seamless payments.', completed: false },
  { id: 'policy', title: 'Explore Insurance Policies', description: 'Browse and understand available insurance products.', completed: false },
  { id: 'first_application', title: 'Submit First Application', description: 'Apply for your first insurance policy.', completed: false },
];

const Onboarding: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: onboardingStatus, isLoading: statusLoading, error: statusError } = trpc.onboarding.status.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const completeStepMutation = trpc.onboarding.complete.useMutation({
    onSuccess: () => {
      toast.success("Onboarding step completed successfully!");
      utils.onboarding.status.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to complete step: ${err.message}`);
    },
  });

  const [demoSteps, setDemoSteps] = useState<OnboardingStep[]>(DEMO_ONBOARDING_STEPS);

  useEffect(() => {
    if (statusError) {
      toast.error(`Error fetching onboarding status: ${statusError.message}`);
    }
  }, [statusError]);

  if (authLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading onboarding status...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Please log in to view your onboarding progress.
      </div>
    );
  }

  const currentSteps = DEMO_MODE ? demoSteps : (onboardingStatus?.steps || []);
  const nextStep = currentSteps.find(step => !step.completed);
  const allStepsCompleted = currentSteps.every(step => step.completed);

  const handleCompleteStep = async (stepId: string) => {
    if (DEMO_MODE) {
      setDemoSteps(prevSteps =>
        prevSteps.map(step =>
          step.id === stepId ? { ...step, completed: true } : step
        )
      );
      toast.success(`Demo step '${stepId}' completed!`);
    } else {
      await completeStepMutation.mutateAsync({ step: stepId });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Welcome to Onboarding!</h1>
      <p className="text-lg text-gray-600 mb-8">
        Let's get you set up to experience the best of Nigerian insurance.
      </p>

      {allStepsCompleted && (
        <Card className="mb-6 border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700">Onboarding Complete!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">Congratulations! You have successfully completed all onboarding steps. You are now ready to explore our platform.</p>
            <Button className="mt-4">Go to Dashboard</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {currentSteps.map((step) => (
          <Card key={step.id} className={step.completed ? "border-green-400" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">{step.title}</CardTitle>
              <Badge variant={step.completed ? "default" : "secondary"}>
                {step.completed ? "Completed" : "Pending"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">{step.description}</p>
              {!step.completed && nextStep?.id === step.id && (
                <Button
                  onClick={() => handleCompleteStep(step.id)}
                  disabled={completeStepMutation.isPending}
                >
                  {completeStepMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark as Complete
                </Button>
              )}
              {!step.completed && nextStep?.id !== step.id && (
                <Button disabled>Complete Previous Step</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Onboarding;