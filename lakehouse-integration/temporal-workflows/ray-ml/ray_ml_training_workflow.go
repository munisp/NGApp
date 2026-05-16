package rayml

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// RayMLTrainingWorkflowInput defines input for ML training workflow
type RayMLTrainingWorkflowInput struct {
	ModelName        string            `json:"model_name"`
	ModelType        string            `json:"model_type"` // fraud_detection, risk_scoring, claims_prediction
	DataPath         string            `json:"data_path"`
	OutputPath       string            `json:"output_path"`
	Hyperparameters  map[string]interface{} `json:"hyperparameters"`
	ValidationSplit  float64           `json:"validation_split"`
	TestSplit        float64           `json:"test_split"`
	MaxEpochs        int               `json:"max_epochs"`
	EarlyStoppingPatience int          `json:"early_stopping_patience"`
	RegisterModel    bool              `json:"register_model"`
}

// RayMLTrainingWorkflowOutput defines output from ML training workflow
type RayMLTrainingWorkflowOutput struct {
	ModelID          string             `json:"model_id"`
	ModelVersion     string             `json:"model_version"`
	ModelPath        string             `json:"model_path"`
	Metrics          map[string]float64 `json:"metrics"`
	TrainingDuration string             `json:"training_duration"`
	Status           string             `json:"status"`
	MLflowRunID      string             `json:"mlflow_run_id"`
	DeploymentURL    string             `json:"deployment_url,omitempty"`
}

// DataPreparationResult represents data preparation output
type DataPreparationResult struct {
	TrainPath      string `json:"train_path"`
	ValidationPath string `json:"validation_path"`
	TestPath       string `json:"test_path"`
	TrainSamples   int64  `json:"train_samples"`
	ValSamples     int64  `json:"val_samples"`
	TestSamples    int64  `json:"test_samples"`
	FeatureCount   int    `json:"feature_count"`
}

// ModelEvaluationResult represents model evaluation output
type ModelEvaluationResult struct {
	Accuracy    float64            `json:"accuracy"`
	Precision   float64            `json:"precision"`
	Recall      float64            `json:"recall"`
	F1Score     float64            `json:"f1_score"`
	AUC         float64            `json:"auc"`
	Metrics     map[string]float64 `json:"metrics"`
	Passed      bool               `json:"passed"`
	FailReason  string             `json:"fail_reason,omitempty"`
}

// MLflowRegistrationResult represents MLflow registration output
type MLflowRegistrationResult struct {
	RunID        string `json:"run_id"`
	ModelName    string `json:"model_name"`
	ModelVersion string `json:"model_version"`
	ModelURI     string `json:"model_uri"`
	Stage        string `json:"stage"`
}

// RayMLTrainingWorkflow orchestrates ML model training with Ray
func RayMLTrainingWorkflow(ctx workflow.Context, input RayMLTrainingWorkflowInput) (*RayMLTrainingWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Ray ML Training Workflow", "modelName", input.ModelName, "modelType", input.ModelType)

	startTime := workflow.Now(ctx)

	// Configure activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 4 * time.Hour,
		HeartbeatTimeout:    10 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Minute,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	output := &RayMLTrainingWorkflowOutput{
		Status: "RUNNING",
	}

	// Step 1: Validate and prepare data
	var dataPrep DataPreparationResult
	err := workflow.ExecuteActivity(ctx, PrepareTrainingDataActivity, input).Get(ctx, &dataPrep)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("data preparation failed: %w", err)
	}
	logger.Info("Data preparation completed", "trainSamples", dataPrep.TrainSamples, "features", dataPrep.FeatureCount)

	// Step 2: Start MLflow run
	var mlflowRunID string
	err = workflow.ExecuteActivity(ctx, StartMLflowRunActivity, input).Get(ctx, &mlflowRunID)
	if err != nil {
		logger.Warn("Failed to start MLflow run", "error", err)
		mlflowRunID = fmt.Sprintf("local-%d", workflow.Now(ctx).Unix())
	}
	output.MLflowRunID = mlflowRunID

	// Step 3: Train model with Ray
	var modelPath string
	err = workflow.ExecuteActivity(ctx, TrainModelWithRayActivity, input, dataPrep, mlflowRunID).Get(ctx, &modelPath)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("model training failed: %w", err)
	}
	output.ModelPath = modelPath
	logger.Info("Model training completed", "modelPath", modelPath)

	// Step 4: Evaluate model
	var evalResult ModelEvaluationResult
	err = workflow.ExecuteActivity(ctx, EvaluateModelActivity, modelPath, dataPrep.TestPath, input.ModelType).Get(ctx, &evalResult)
	if err != nil {
		output.Status = "FAILED"
		return output, fmt.Errorf("model evaluation failed: %w", err)
	}
	output.Metrics = evalResult.Metrics
	logger.Info("Model evaluation completed", "auc", evalResult.AUC, "f1", evalResult.F1Score)

	// Check if model meets quality thresholds
	if !evalResult.Passed {
		output.Status = "FAILED_QUALITY_CHECK"
		return output, fmt.Errorf("model failed quality check: %s", evalResult.FailReason)
	}

	// Step 5: Log metrics to MLflow
	err = workflow.ExecuteActivity(ctx, LogMetricsToMLflowActivity, mlflowRunID, evalResult.Metrics).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to log metrics to MLflow", "error", err)
	}

	// Step 6: Register model if requested
	if input.RegisterModel {
		var registration MLflowRegistrationResult
		err = workflow.ExecuteActivity(ctx, RegisterModelToMLflowActivity, input.ModelName, modelPath, mlflowRunID).Get(ctx, &registration)
		if err != nil {
			logger.Warn("Failed to register model to MLflow", "error", err)
		} else {
			output.ModelVersion = registration.ModelVersion
			output.ModelID = fmt.Sprintf("%s/%s", registration.ModelName, registration.ModelVersion)
			logger.Info("Model registered to MLflow", "version", registration.ModelVersion)
		}
	}

	// Step 7: Deploy model to Ray Serve (optional)
	var deploymentURL string
	err = workflow.ExecuteActivity(ctx, DeployModelToRayServeActivity, input.ModelName, modelPath, output.ModelVersion).Get(ctx, &deploymentURL)
	if err != nil {
		logger.Warn("Failed to deploy model to Ray Serve", "error", err)
	} else {
		output.DeploymentURL = deploymentURL
		logger.Info("Model deployed to Ray Serve", "url", deploymentURL)
	}

	// Step 8: Send notification
	err = workflow.ExecuteActivity(ctx, SendTrainingNotificationActivity, output).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to send notification", "error", err)
	}

	output.Status = "COMPLETED"
	output.TrainingDuration = workflow.Now(ctx).Sub(startTime).String()

	logger.Info("Ray ML Training Workflow completed", "modelID", output.ModelID, "duration", output.TrainingDuration)

	return output, nil
}

// ScheduledModelRetrainingWorkflow runs model retraining on a schedule
func ScheduledModelRetrainingWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)

	// Models to retrain
	models := []RayMLTrainingWorkflowInput{
		{
			ModelName:             "fraud-detection",
			ModelType:             "fraud_detection",
			DataPath:              "s3a://lakehouse/silver/payment_events",
			OutputPath:            "s3a://lakehouse/models/fraud_detection",
			ValidationSplit:       0.15,
			TestSplit:             0.15,
			MaxEpochs:             100,
			EarlyStoppingPatience: 10,
			RegisterModel:         true,
			Hyperparameters: map[string]interface{}{
				"learning_rate": 0.01,
				"max_depth":     6,
				"n_estimators":  200,
			},
		},
		{
			ModelName:             "risk-scoring",
			ModelType:             "risk_scoring",
			DataPath:              "s3a://lakehouse/silver/policy_events",
			OutputPath:            "s3a://lakehouse/models/risk_scoring",
			ValidationSplit:       0.15,
			TestSplit:             0.15,
			MaxEpochs:             100,
			EarlyStoppingPatience: 10,
			RegisterModel:         true,
			Hyperparameters: map[string]interface{}{
				"learning_rate": 0.01,
				"max_depth":     8,
				"n_estimators":  150,
			},
		},
		{
			ModelName:             "claims-prediction",
			ModelType:             "claims_prediction",
			DataPath:              "s3a://lakehouse/silver/claim_events",
			OutputPath:            "s3a://lakehouse/models/claims_prediction",
			ValidationSplit:       0.15,
			TestSplit:             0.15,
			MaxEpochs:             100,
			EarlyStoppingPatience: 10,
			RegisterModel:         true,
			Hyperparameters: map[string]interface{}{
				"learning_rate": 0.01,
				"max_depth":     6,
				"n_estimators":  100,
			},
		},
	}

	for {
		for _, model := range models {
			childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
				WorkflowID: fmt.Sprintf("ml-training-%s-%d", model.ModelName, workflow.Now(ctx).Unix()),
			})

			var output RayMLTrainingWorkflowOutput
			err := workflow.ExecuteChildWorkflow(childCtx, RayMLTrainingWorkflow, model).Get(ctx, &output)
			if err != nil {
				logger.Error("Model training failed", "model", model.ModelName, "error", err)
			} else {
				logger.Info("Model training completed", "model", model.ModelName, "version", output.ModelVersion)
			}
		}

		// Sleep until next scheduled run (weekly)
		err := workflow.Sleep(ctx, 7*24*time.Hour)
		if err != nil {
			return err
		}
	}
}

// Activities

// PrepareTrainingDataActivity prepares data for training
func PrepareTrainingDataActivity(ctx context.Context, input RayMLTrainingWorkflowInput) (*DataPreparationResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Preparing training data", "dataPath", input.DataPath)

	activity.RecordHeartbeat(ctx, "Loading data from lakehouse")

	// In production, this would:
	// 1. Read data from S3/Delta Lake
	// 2. Perform feature engineering
	// 3. Split into train/val/test
	// 4. Save splits to S3

	time.Sleep(5 * time.Second) // Simulate data preparation

	return &DataPreparationResult{
		TrainPath:      fmt.Sprintf("%s/train", input.OutputPath),
		ValidationPath: fmt.Sprintf("%s/validation", input.OutputPath),
		TestPath:       fmt.Sprintf("%s/test", input.OutputPath),
		TrainSamples:   100000,
		ValSamples:     15000,
		TestSamples:    15000,
		FeatureCount:   25,
	}, nil
}

// StartMLflowRunActivity starts an MLflow tracking run
func StartMLflowRunActivity(ctx context.Context, input RayMLTrainingWorkflowInput) (string, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Starting MLflow run", "modelName", input.ModelName)

	// In production, this would call MLflow API to start a run
	runID := fmt.Sprintf("mlflow-%s-%d", input.ModelName, time.Now().UnixNano())

	return runID, nil
}

// TrainModelWithRayActivity trains model using Ray
func TrainModelWithRayActivity(ctx context.Context, input RayMLTrainingWorkflowInput, dataPrep DataPreparationResult, mlflowRunID string) (string, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Training model with Ray", "modelName", input.ModelName, "trainSamples", dataPrep.TrainSamples)

	// Simulate training with heartbeats
	for i := 0; i < 20; i++ {
		activity.RecordHeartbeat(ctx, fmt.Sprintf("Training epoch %d/%d", i+1, 20))
		time.Sleep(time.Second)
	}

	modelPath := fmt.Sprintf("%s/model", input.OutputPath)
	return modelPath, nil
}

// EvaluateModelActivity evaluates trained model
func EvaluateModelActivity(ctx context.Context, modelPath, testPath, modelType string) (*ModelEvaluationResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Evaluating model", "modelPath", modelPath, "testPath", testPath)

	activity.RecordHeartbeat(ctx, "Running model evaluation")

	// Simulate evaluation
	time.Sleep(3 * time.Second)

	// Define quality thresholds based on model type
	var minAUC float64
	switch modelType {
	case "fraud_detection":
		minAUC = 0.85
	case "risk_scoring":
		minAUC = 0.80
	case "claims_prediction":
		minAUC = 0.75
	default:
		minAUC = 0.70
	}

	result := &ModelEvaluationResult{
		Accuracy:  0.92,
		Precision: 0.89,
		Recall:    0.87,
		F1Score:   0.88,
		AUC:       0.91,
		Metrics: map[string]float64{
			"accuracy":  0.92,
			"precision": 0.89,
			"recall":    0.87,
			"f1_score":  0.88,
			"auc":       0.91,
		},
		Passed: true,
	}

	if result.AUC < minAUC {
		result.Passed = false
		result.FailReason = fmt.Sprintf("AUC %.2f below threshold %.2f", result.AUC, minAUC)
	}

	return result, nil
}

// LogMetricsToMLflowActivity logs metrics to MLflow
func LogMetricsToMLflowActivity(ctx context.Context, runID string, metrics map[string]float64) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Logging metrics to MLflow", "runID", runID, "metricsCount", len(metrics))

	// In production, this would call MLflow API to log metrics
	return nil
}

// RegisterModelToMLflowActivity registers model to MLflow Model Registry
func RegisterModelToMLflowActivity(ctx context.Context, modelName, modelPath, runID string) (*MLflowRegistrationResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Registering model to MLflow", "modelName", modelName, "runID", runID)

	// In production, this would call MLflow API to register model
	return &MLflowRegistrationResult{
		RunID:        runID,
		ModelName:    modelName,
		ModelVersion: fmt.Sprintf("v%d", time.Now().Unix()%1000),
		ModelURI:     fmt.Sprintf("models:/%s/latest", modelName),
		Stage:        "Staging",
	}, nil
}

// DeployModelToRayServeActivity deploys model to Ray Serve
func DeployModelToRayServeActivity(ctx context.Context, modelName, modelPath, modelVersion string) (string, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Deploying model to Ray Serve", "modelName", modelName, "version", modelVersion)

	activity.RecordHeartbeat(ctx, "Deploying to Ray Serve")

	// In production, this would call Ray Serve API to deploy model
	time.Sleep(5 * time.Second)

	deploymentURL := fmt.Sprintf("http://ray-serve:8000/api/v1/models/%s", modelName)
	return deploymentURL, nil
}

// SendTrainingNotificationActivity sends training completion notification
func SendTrainingNotificationActivity(ctx context.Context, output *RayMLTrainingWorkflowOutput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Sending training notification", "status", output.Status, "modelID", output.ModelID)

	// In production, this would send Slack/email notification
	return nil
}
