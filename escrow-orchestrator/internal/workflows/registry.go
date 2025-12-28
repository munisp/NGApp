package workflows

import (
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

// RegisterWorkflows registers all workflows with the worker
func RegisterWorkflows(w worker.Worker) {
	w.RegisterWorkflowWithOptions(EscrowHappyPathWorkflow, workflow.RegisterOptions{
		Name: "EscrowHappyPathWorkflow",
	})
	w.RegisterWorkflowWithOptions(DisputeWorkflow, workflow.RegisterOptions{
		Name: "DisputeWorkflow",
	})
	w.RegisterWorkflowWithOptions(RefundWorkflow, workflow.RegisterOptions{
		Name: "RefundWorkflow",
	})
	w.RegisterWorkflowWithOptions(ExpiryCheckWorkflow, workflow.RegisterOptions{
		Name: "ExpiryCheckWorkflow",
	})
	w.RegisterWorkflowWithOptions(PayoutWorkflow, workflow.RegisterOptions{
		Name: "PayoutWorkflow",
	})
	w.RegisterWorkflowWithOptions(AgentCashWorkflow, workflow.RegisterOptions{
		Name: "AgentCashWorkflow",
	})
}
