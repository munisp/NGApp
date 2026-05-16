package middleware

import (
	"context"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/workflow"
)

type TemporalClient struct {
	client    client.Client
	namespace string
}

const (
	DocumentProcessingTaskQueue = "document-processing-queue"
	OCRProcessingTaskQueue      = "ocr-processing-queue"
)

type DocumentProcessingInput struct {
	DocumentID   string                 `json:"document_id"`
	FileName     string                 `json:"file_name"`
	FilePath     string                 `json:"file_path"`
	MimeType     string                 `json:"mime_type"`
	DocumentType string                 `json:"document_type"`
	UploadedBy   string                 `json:"uploaded_by"`
	Options      map[string]interface{} `json:"options,omitempty"`
}

type DocumentProcessingOutput struct {
	DocumentID      string                 `json:"document_id"`
	Status          string                 `json:"status"`
	OCRText         string                 `json:"ocr_text,omitempty"`
	OCRConfidence   float64                `json:"ocr_confidence,omitempty"`
	ExtractedFields map[string]interface{} `json:"extracted_fields,omitempty"`
	Classification  string                 `json:"classification,omitempty"`
	ThumbnailPath   string                 `json:"thumbnail_path,omitempty"`
	ProcessedAt     time.Time              `json:"processed_at"`
	ErrorMessage    string                 `json:"error_message,omitempty"`
}

type OCRActivityInput struct {
	DocumentID   string `json:"document_id"`
	FilePath     string `json:"file_path"`
	DocumentType string `json:"document_type"`
	Provider     string `json:"provider"`
}

type OCRActivityOutput struct {
	Text            string                 `json:"text"`
	Confidence      float64                `json:"confidence"`
	ExtractedFields map[string]interface{} `json:"extracted_fields"`
	Provider        string                 `json:"provider"`
}

type ClassificationActivityInput struct {
	DocumentID string `json:"document_id"`
	FilePath   string `json:"file_path"`
	OCRText    string `json:"ocr_text"`
}

type ClassificationActivityOutput struct {
	Classification string  `json:"classification"`
	Confidence     float64 `json:"confidence"`
	SubType        string  `json:"sub_type,omitempty"`
}

type ThumbnailActivityInput struct {
	DocumentID string `json:"document_id"`
	FilePath   string `json:"file_path"`
	MimeType   string `json:"mime_type"`
}

type ThumbnailActivityOutput struct {
	ThumbnailPath string `json:"thumbnail_path"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
}

func NewTemporalClient(hostPort, namespace string) (*TemporalClient, error) {
	c, err := client.Dial(client.Options{
		HostPort:  hostPort,
		Namespace: namespace,
	})
	if err != nil {
		return nil, err
	}

	return &TemporalClient{
		client:    c,
		namespace: namespace,
	}, nil
}

func (t *TemporalClient) StartDocumentProcessingWorkflow(ctx context.Context, input *DocumentProcessingInput) (string, error) {
	options := client.StartWorkflowOptions{
		ID:        "doc-processing-" + input.DocumentID,
		TaskQueue: DocumentProcessingTaskQueue,
	}

	we, err := t.client.ExecuteWorkflow(ctx, options, DocumentProcessingWorkflow, input)
	if err != nil {
		return "", err
	}

	return we.GetID(), nil
}

func (t *TemporalClient) StartBatchOCRWorkflow(ctx context.Context, documentIDs []string) (string, error) {
	options := client.StartWorkflowOptions{
		ID:        "batch-ocr-" + time.Now().Format("20060102150405"),
		TaskQueue: OCRProcessingTaskQueue,
	}

	we, err := t.client.ExecuteWorkflow(ctx, options, BatchOCRWorkflow, documentIDs)
	if err != nil {
		return "", err
	}

	return we.GetID(), nil
}

func (t *TemporalClient) GetWorkflowStatus(ctx context.Context, workflowID string) (string, error) {
	desc, err := t.client.DescribeWorkflowExecution(ctx, workflowID, "")
	if err != nil {
		return "", err
	}

	return desc.WorkflowExecutionInfo.Status.String(), nil
}

func (t *TemporalClient) CancelWorkflow(ctx context.Context, workflowID string) error {
	return t.client.CancelWorkflow(ctx, workflowID, "")
}

func (t *TemporalClient) Close() error {
	t.client.Close()
	return nil
}

func DocumentProcessingWorkflow(ctx workflow.Context, input *DocumentProcessingInput) (*DocumentProcessingOutput, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	output := &DocumentProcessingOutput{
		DocumentID: input.DocumentID,
		Status:     "PROCESSING",
	}

	var ocrOutput OCRActivityOutput
	err := workflow.ExecuteActivity(ctx, "PerformOCR", &OCRActivityInput{
		DocumentID:   input.DocumentID,
		FilePath:     input.FilePath,
		DocumentType: input.DocumentType,
	}).Get(ctx, &ocrOutput)
	if err != nil {
		output.Status = "OCR_FAILED"
		output.ErrorMessage = err.Error()
		return output, nil
	}

	output.OCRText = ocrOutput.Text
	output.OCRConfidence = ocrOutput.Confidence
	output.ExtractedFields = ocrOutput.ExtractedFields

	var classOutput ClassificationActivityOutput
	err = workflow.ExecuteActivity(ctx, "ClassifyDocument", &ClassificationActivityInput{
		DocumentID: input.DocumentID,
		FilePath:   input.FilePath,
		OCRText:    ocrOutput.Text,
	}).Get(ctx, &classOutput)
	if err == nil {
		output.Classification = classOutput.Classification
	}

	var thumbOutput ThumbnailActivityOutput
	err = workflow.ExecuteActivity(ctx, "GenerateThumbnail", &ThumbnailActivityInput{
		DocumentID: input.DocumentID,
		FilePath:   input.FilePath,
		MimeType:   input.MimeType,
	}).Get(ctx, &thumbOutput)
	if err == nil {
		output.ThumbnailPath = thumbOutput.ThumbnailPath
	}

	output.Status = "COMPLETED"
	output.ProcessedAt = workflow.Now(ctx)

	return output, nil
}

func BatchOCRWorkflow(ctx workflow.Context, documentIDs []string) (map[string]*OCRActivityOutput, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	results := make(map[string]*OCRActivityOutput)
	
	for _, docID := range documentIDs {
		var ocrOutput OCRActivityOutput
		err := workflow.ExecuteActivity(ctx, "PerformOCR", &OCRActivityInput{
			DocumentID: docID,
		}).Get(ctx, &ocrOutput)
		if err == nil {
			results[docID] = &ocrOutput
		}
	}

	return results, nil
}
