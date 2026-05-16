package ml

import (
	"context"
	"math"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/insurance-platform/insurance-radar/internal/features"
	"github.com/insurance-platform/insurance-radar/internal/models"
	"go.uber.org/zap"
)

// DNNModel represents a Deep Neural Network model for fraud detection
// Inspired by Stripe Radar's evolution from Wide & Deep to pure DNN
type DNNModel struct {
	modelID       string
	version       string
	inputSize     int
	hiddenLayers  []int
	outputSize    int
	weights       [][][]float64
	biases        [][]float64
	activations   []string
	threshold     float64
	logger        *zap.Logger
}

// ModelConfig holds DNN model configuration
type ModelConfig struct {
	ModelID      string   `json:"model_id"`
	Version      string   `json:"version"`
	InputSize    int      `json:"input_size"`
	HiddenLayers []int    `json:"hidden_layers"`
	OutputSize   int      `json:"output_size"`
	Activations  []string `json:"activations"`
	Threshold    float64  `json:"threshold"`
}

// NewDNNModel creates a new DNN model with Xavier-initialized weights
func NewDNNModel(config ModelConfig, logger *zap.Logger) *DNNModel {
	m := &DNNModel{
		modelID:      config.ModelID,
		version:      config.Version,
		inputSize:    config.InputSize,
		hiddenLayers: config.HiddenLayers,
		outputSize:   config.OutputSize,
		activations:  config.Activations,
		threshold:    config.Threshold,
		logger:       logger,
	}
	m.initializeWeights()
	return m
}

// initializeWeights initializes network weights using Xavier/Glorot initialization
func (m *DNNModel) initializeWeights() {
	rng := rand.New(rand.NewSource(42)) // Deterministic seed for reproducibility
	layerSizes := append([]int{m.inputSize}, append(m.hiddenLayers, m.outputSize)...)

	m.weights = make([][][]float64, len(layerSizes)-1)
	m.biases = make([][]float64, len(layerSizes)-1)

	for l := 0; l < len(layerSizes)-1; l++ {
		fanIn := layerSizes[l]
		fanOut := layerSizes[l+1]
		// Xavier initialization: std = sqrt(2 / (fan_in + fan_out))
		std := math.Sqrt(2.0 / float64(fanIn+fanOut))

		m.weights[l] = make([][]float64, fanOut)
		m.biases[l] = make([]float64, fanOut)

		for j := 0; j < fanOut; j++ {
			m.weights[l][j] = make([]float64, fanIn)
			for k := 0; k < fanIn; k++ {
				m.weights[l][j][k] = rng.NormFloat64() * std
			}
			m.biases[l][j] = 0.0 // Initialize biases to zero
		}
	}
}

// DefaultModelConfig returns the default model configuration
func DefaultModelConfig() ModelConfig {
	return ModelConfig{
		ModelID:      "insurance-radar-dnn-v1",
		Version:      "1.0.0",
		InputSize:    1024, // 1000+ features
		HiddenLayers: []int{512, 256, 128, 64},
		OutputSize:   1,
		Activations:  []string{"relu", "relu", "relu", "relu", "sigmoid"},
		Threshold:    0.5,
	}
}

// Prediction represents a model prediction
type Prediction struct {
	RequestID      uuid.UUID         `json:"request_id"`
	Score          float64           `json:"score"`
	Confidence     float64           `json:"confidence"`
	RiskLevel      models.RiskLevel  `json:"risk_level"`
	Decision       string            `json:"decision"`
	LayerOutputs   [][]float64       `json:"layer_outputs,omitempty"`
	FeatureImportance map[string]float64 `json:"feature_importance"`
	InferenceTime  int64             `json:"inference_time_ms"`
}

// Predict performs inference on the feature vector
func (m *DNNModel) Predict(ctx context.Context, fv *features.FeatureVector) (*Prediction, error) {
	startTime := time.Now()

	// Convert feature map to ordered vector
	inputVector := m.featureMapToVector(fv.Features)

	// Forward pass through the network
	layerOutputs := m.forwardPass(inputVector)

	// Get final output (fraud probability)
	finalOutput := layerOutputs[len(layerOutputs)-1]
	score := finalOutput[0]

	// Calculate confidence based on distance from threshold
	confidence := m.calculateConfidence(score)

	// Determine risk level
	riskLevel := m.scoreToRiskLevel(score)

	// Determine decision
	decision := m.makeDecision(score, riskLevel)

	// Calculate feature importance using gradient approximation
	featureImportance := m.calculateFeatureImportance(fv.Features, score)

	return &Prediction{
		RequestID:         fv.RequestID,
		Score:             score,
		Confidence:        confidence,
		RiskLevel:         riskLevel,
		Decision:          decision,
		LayerOutputs:      layerOutputs,
		FeatureImportance: featureImportance,
		InferenceTime:     time.Since(startTime).Milliseconds(),
	}, nil
}

// featureMapToVector converts feature map to ordered vector
func (m *DNNModel) featureMapToVector(featureMap map[string]float64) []float64 {
	// In production, this would use a fixed feature ordering
	vector := make([]float64, m.inputSize)
	i := 0
	for _, v := range featureMap {
		if i < m.inputSize {
			vector[i] = v
			i++
		}
	}
	return vector
}

// forwardPass performs forward propagation through the network using real weights
func (m *DNNModel) forwardPass(input []float64) [][]float64 {
	if m.weights == nil || len(m.weights) == 0 {
		m.initializeWeights()
	}

	numLayers := len(m.hiddenLayers) + 1
	layerOutputs := make([][]float64, numLayers)
	current := input

	// Hidden layers
	for i, layerSize := range m.hiddenLayers {
		output := make([]float64, layerSize)
		for j := 0; j < layerSize; j++ {
			sum := m.biases[i][j]
			for k := 0; k < len(current) && k < len(m.weights[i][j]); k++ {
				sum += current[k] * m.weights[i][j][k]
			}
			output[j] = m.activate(sum, m.activations[i])
		}
		layerOutputs[i] = output
		current = output
	}

	// Output layer
	outputLayerIdx := len(m.hiddenLayers)
	outputLayer := make([]float64, m.outputSize)
	for j := 0; j < m.outputSize; j++ {
		sum := m.biases[outputLayerIdx][j]
		for k := 0; k < len(current) && k < len(m.weights[outputLayerIdx][j]); k++ {
			sum += current[k] * m.weights[outputLayerIdx][j][k]
		}
		outputLayer[j] = m.activate(sum, "sigmoid")
	}
	layerOutputs[outputLayerIdx] = outputLayer

	return layerOutputs
}

// activate applies activation function
func (m *DNNModel) activate(x float64, activation string) float64 {
	switch activation {
	case "relu":
		return math.Max(0, x)
	case "sigmoid":
		return 1.0 / (1.0 + math.Exp(-x))
	case "tanh":
		return math.Tanh(x)
	case "leaky_relu":
		if x > 0 {
			return x
		}
		return 0.01 * x
	default:
		return x
	}
}

// calculateConfidence calculates prediction confidence
func (m *DNNModel) calculateConfidence(score float64) float64 {
	// Confidence is higher when score is further from threshold
	distance := math.Abs(score - m.threshold)
	return math.Min(1.0, distance*2+0.5)
}

// scoreToRiskLevel converts score to risk level
func (m *DNNModel) scoreToRiskLevel(score float64) models.RiskLevel {
	switch {
	case score >= 0.9:
		return models.RiskLevelCritical
	case score >= 0.7:
		return models.RiskLevelHigh
	case score >= 0.4:
		return models.RiskLevelMedium
	default:
		return models.RiskLevelLow
	}
}

// makeDecision makes fraud decision based on score and risk level
func (m *DNNModel) makeDecision(score float64, riskLevel models.RiskLevel) string {
	switch riskLevel {
	case models.RiskLevelCritical:
		return "block"
	case models.RiskLevelHigh:
		return "review"
	case models.RiskLevelMedium:
		return "flag"
	default:
		return "allow"
	}
}

// calculateFeatureImportance calculates feature importance using gradient approximation (finite differences)
func (m *DNNModel) calculateFeatureImportance(featureMap map[string]float64, baseScore float64) map[string]float64 {
	importance := make(map[string]float64)
	epsilon := 1e-4

	for name, value := range featureMap {
		// Perturb feature and measure score change (finite difference approximation)
		perturbedMap := make(map[string]float64, len(featureMap))
		for k, v := range featureMap {
			perturbedMap[k] = v
		}
		perturbedMap[name] = value + epsilon

		perturbedVector := m.featureMapToVector(perturbedMap)
		perturbedOutputs := m.forwardPass(perturbedVector)
		perturbedScore := perturbedOutputs[len(perturbedOutputs)-1][0]

		// Gradient approximation: (f(x+eps) - f(x)) / eps
		gradient := (perturbedScore - baseScore) / epsilon
		importance[name] = math.Abs(gradient * value) // Multiply by value for attribution
	}

	return importance
}

// ModelEnsemble represents an ensemble of models
type ModelEnsemble struct {
	models  []*DNNModel
	weights []float64
	logger  *zap.Logger
}

// NewModelEnsemble creates a new model ensemble
func NewModelEnsemble(models []*DNNModel, weights []float64, logger *zap.Logger) *ModelEnsemble {
	return &ModelEnsemble{
		models:  models,
		weights: weights,
		logger:  logger,
	}
}

// PredictEnsemble performs ensemble prediction
func (e *ModelEnsemble) PredictEnsemble(ctx context.Context, fv *features.FeatureVector) (*Prediction, error) {
	startTime := time.Now()

	var weightedScore float64
	var totalWeight float64

	for i, model := range e.models {
		pred, err := model.Predict(ctx, fv)
		if err != nil {
			continue
		}
		weight := e.weights[i]
		weightedScore += pred.Score * weight
		totalWeight += weight
	}

	if totalWeight > 0 {
		weightedScore /= totalWeight
	}

	// Use first model's methods for risk level and decision
	riskLevel := e.models[0].scoreToRiskLevel(weightedScore)
	decision := e.models[0].makeDecision(weightedScore, riskLevel)
	confidence := e.models[0].calculateConfidence(weightedScore)

	return &Prediction{
		RequestID:     fv.RequestID,
		Score:         weightedScore,
		Confidence:    confidence,
		RiskLevel:     riskLevel,
		Decision:      decision,
		InferenceTime: time.Since(startTime).Milliseconds(),
	}, nil
}

// ModelMetrics tracks model performance metrics
type ModelMetrics struct {
	TotalPredictions int64   `json:"total_predictions"`
	AvgInferenceTime float64 `json:"avg_inference_time_ms"`
	TruePositives    int64   `json:"true_positives"`
	FalsePositives   int64   `json:"false_positives"`
	TrueNegatives    int64   `json:"true_negatives"`
	FalseNegatives   int64   `json:"false_negatives"`
	Precision        float64 `json:"precision"`
	Recall           float64 `json:"recall"`
	F1Score          float64 `json:"f1_score"`
	AUC              float64 `json:"auc"`
}

// CalculateMetrics calculates model performance metrics
func CalculateMetrics(tp, fp, tn, fn int64) *ModelMetrics {
	precision := float64(tp) / float64(tp+fp)
	recall := float64(tp) / float64(tp+fn)
	f1 := 2 * precision * recall / (precision + recall)

	if math.IsNaN(precision) {
		precision = 0
	}
	if math.IsNaN(recall) {
		recall = 0
	}
	if math.IsNaN(f1) {
		f1 = 0
	}

	return &ModelMetrics{
		TruePositives:  tp,
		FalsePositives: fp,
		TrueNegatives:  tn,
		FalseNegatives: fn,
		Precision:      precision,
		Recall:         recall,
		F1Score:        f1,
	}
}
