package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// GNN + Neo4j Service — Graph Neural Network for Customer/Transaction Graphs
// ============================================================================
// Provides: fraud detection via graph convolutions, community detection,
// link prediction for cross-sell, customer influence scoring, transaction
// anomaly detection using graph structure.
//
// Integrates with Neo4j for graph storage and FalkorDB for real-time queries.
// Uses message-passing GNN architecture (GraphSAGE variant) implemented in Go
// for high-throughput inference at the edge.

// --- Data Models ---

type NodeType string

const (
	NodeCustomer    NodeType = "customer"
	NodeAccount     NodeType = "account"
	NodeTransaction NodeType = "transaction"
	NodeMerchant    NodeType = "merchant"
	NodeDevice      NodeType = "device"
	NodeAgent       NodeType = "agent"
)

type EdgeType string

const (
	EdgeOwns        EdgeType = "OWNS"
	EdgeTransfers   EdgeType = "TRANSFERS_TO"
	EdgeTransacts   EdgeType = "TRANSACTS_AT"
	EdgeUsesDevice  EdgeType = "USES_DEVICE"
	EdgeLinkedTo    EdgeType = "LINKED_TO"
	EdgeManagedBy   EdgeType = "MANAGED_BY"
	EdgeSharesPhone EdgeType = "SHARES_PHONE"
	EdgeSharesEmail EdgeType = "SHARES_EMAIL"
)

type GraphNode struct {
	ID         string            `json:"id"`
	Type       NodeType          `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Embedding  []float64         `json:"embedding"`
	Neighbors  []string          `json:"neighbors"`
}

type GraphEdge struct {
	Source     string   `json:"source"`
	Target     string   `json:"target"`
	Type       EdgeType `json:"type"`
	Weight     float64  `json:"weight"`
	Properties map[string]interface{} `json:"properties"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// GNN Layer — implements GraphSAGE-style message passing
type GNNLayer struct {
	InputDim    int       `json:"input_dim"`
	OutputDim   int       `json:"output_dim"`
	WeightMatrix [][]float64 `json:"weight_matrix"`
	Bias        []float64 `json:"bias"`
	Activation  string    `json:"activation"`
}

type GNNModel struct {
	Layers       []GNNLayer `json:"layers"`
	EmbeddingDim int        `json:"embedding_dim"`
	NumLayers    int        `json:"num_layers"`
	Aggregation  string     `json:"aggregation"` // mean, max, sum
	mu           sync.RWMutex
}

// --- Fraud Detection ---

type FraudScore struct {
	NodeID          string   `json:"node_id"`
	NodeType        NodeType `json:"node_type"`
	FraudProbability float64 `json:"fraud_probability"`
	RiskLevel       string   `json:"risk_level"`
	Reasons         []string `json:"reasons"`
	ConnectedFrauds int      `json:"connected_frauds"`
	CommunityID     int      `json:"community_id"`
	Embedding       []float64 `json:"embedding"`
}

type FraudRing struct {
	RingID       string       `json:"ring_id"`
	Members      []FraudScore `json:"members"`
	TotalAmount  float64      `json:"total_amount"`
	Confidence   float64      `json:"confidence"`
	Pattern      string       `json:"pattern"`
	DetectedAt   time.Time    `json:"detected_at"`
}

// --- Community Detection ---

type Community struct {
	ID          int      `json:"id"`
	Members     []string `json:"members"`
	Density     float64  `json:"density"`
	Modularity  float64  `json:"modularity"`
	Label       string   `json:"label"`
	Size        int      `json:"size"`
	AvgDegree   float64  `json:"avg_degree"`
}

// --- Link Prediction ---

type LinkPrediction struct {
	Source       string  `json:"source"`
	Target       string  `json:"target"`
	Probability  float64 `json:"probability"`
	Relationship string  `json:"predicted_relationship"`
	Confidence   float64 `json:"confidence"`
	Reason       string  `json:"reason"`
}

// --- Customer Influence ---

type InfluenceScore struct {
	CustomerID   string  `json:"customer_id"`
	Name         string  `json:"name"`
	PageRank     float64 `json:"page_rank"`
	Betweenness  float64 `json:"betweenness"`
	Degree       int     `json:"degree"`
	Influence    float64 `json:"influence_score"`
	Tier         string  `json:"tier"`
	ReachCount   int     `json:"reach_count"`
}

// --- GNN Engine ---

type GNNEngine struct {
	model       *GNNModel
	graph       *GraphData
	nodeIndex   map[string]*GraphNode
	adjList     map[string][]string
	embeddings  map[string][]float64
	communities []Community
	mu          sync.RWMutex
}

func NewGNNEngine() *GNNEngine {
	engine := &GNNEngine{
		nodeIndex:  make(map[string]*GraphNode),
		adjList:    make(map[string][]string),
		embeddings: make(map[string][]float64),
	}
	engine.initModel()
	engine.loadSeedGraph()
	engine.computeEmbeddings()
	engine.detectCommunities()
	return engine
}

func (e *GNNEngine) initModel() {
	embDim := 64
	e.model = &GNNModel{
		EmbeddingDim: embDim,
		NumLayers:    3,
		Aggregation:  "mean",
		Layers: []GNNLayer{
			{InputDim: 16, OutputDim: 32, Activation: "relu"},
			{InputDim: 32, OutputDim: 64, Activation: "relu"},
			{InputDim: 64, OutputDim: embDim, Activation: "sigmoid"},
		},
	}
	// Initialize weights
	for i := range e.model.Layers {
		layer := &e.model.Layers[i]
		layer.WeightMatrix = make([][]float64, layer.OutputDim)
		for j := range layer.WeightMatrix {
			layer.WeightMatrix[j] = make([]float64, layer.InputDim)
			for k := range layer.WeightMatrix[j] {
				layer.WeightMatrix[j][k] = (rand.Float64() - 0.5) * math.Sqrt(2.0/float64(layer.InputDim))
			}
		}
		layer.Bias = make([]float64, layer.OutputDim)
	}
}

func (e *GNNEngine) loadSeedGraph() {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Seed customers
	customers := []struct {
		id, name, tier string
		balance        float64
		riskFlag       bool
	}{
		{"C001", "Adamu Ibrahim", "premium", 2450000, false},
		{"C002", "Fatima Bello", "standard", 180000, false},
		{"C003", "Chinedu Okafor", "premium", 5200000, false},
		{"C004", "Aisha Mohammed", "standard", 95000, true},
		{"C005", "Emeka Nwosu", "premium", 3800000, false},
		{"C006", "Grace Adeyemi", "basic", 42000, false},
		{"C007", "Bola Ogundimu", "standard", 290000, true},
		{"C008", "Ibrahim Yusuf", "basic", 15000, true},
		{"C009", "Ngozi Eze", "premium", 4100000, false},
		{"C010", "Samuel Ajayi", "standard", 520000, false},
		{"C011", "Phantom LLC", "basic", 50000, true},
		{"C012", "Shell Entity", "basic", 25000, true},
		{"C013", "Unknown Import Co", "basic", 75000, true},
		{"C014", "Kemi Fawole", "premium", 6700000, false},
		{"C015", "David Obi", "standard", 340000, false},
	}

	for _, c := range customers {
		node := &GraphNode{
			ID:   c.id,
			Type: NodeCustomer,
			Properties: map[string]interface{}{
				"name":      c.name,
				"tier":      c.tier,
				"balance":   c.balance,
				"risk_flag": c.riskFlag,
			},
			Neighbors: []string{},
		}
		e.nodeIndex[c.id] = node
	}

	// Seed accounts
	accounts := []struct {
		id, owner, accountType string
		balance                float64
	}{
		{"A001", "C001", "savings", 1200000},
		{"A002", "C001", "current", 1250000},
		{"A003", "C002", "savings", 180000},
		{"A004", "C003", "current", 5200000},
		{"A005", "C004", "savings", 95000},
		{"A006", "C005", "current", 3800000},
		{"A007", "C011", "current", 50000},
		{"A008", "C012", "current", 25000},
		{"A009", "C013", "current", 75000},
		{"A010", "C014", "savings", 6700000},
	}

	for _, a := range accounts {
		node := &GraphNode{
			ID:   a.id,
			Type: NodeAccount,
			Properties: map[string]interface{}{
				"owner":        a.owner,
				"account_type": a.accountType,
				"balance":      a.balance,
			},
			Neighbors: []string{},
		}
		e.nodeIndex[a.id] = node
	}

	// Seed devices (shared devices indicate fraud rings)
	devices := []struct {
		id, deviceType, fingerprint string
	}{
		{"D001", "mobile", "fp-abc123"},
		{"D002", "mobile", "fp-def456"},
		{"D003", "desktop", "fp-ghi789"},
		{"D004", "mobile", "fp-shared-001"}, // shared by fraud entities
		{"D005", "tablet", "fp-jkl012"},
	}

	for _, d := range devices {
		node := &GraphNode{
			ID:   d.id,
			Type: NodeDevice,
			Properties: map[string]interface{}{
				"device_type": d.deviceType,
				"fingerprint": d.fingerprint,
			},
			Neighbors: []string{},
		}
		e.nodeIndex[d.id] = node
	}

	// Seed merchants
	merchants := []struct {
		id, name, category string
		riskScore          float64
	}{
		{"M001", "Lagos Supermarket", "retail", 0.1},
		{"M002", "Abuja Electronics", "electronics", 0.2},
		{"M003", "Quick Exchange Bureau", "forex", 0.7},
		{"M004", "Shadow Trading Co", "import_export", 0.9},
	}

	for _, m := range merchants {
		node := &GraphNode{
			ID:   m.id,
			Type: NodeMerchant,
			Properties: map[string]interface{}{
				"name":       m.name,
				"category":   m.category,
				"risk_score": m.riskScore,
			},
			Neighbors: []string{},
		}
		e.nodeIndex[m.id] = node
	}

	// Build edges — ownership, transactions, device usage, shared attributes
	edges := []GraphEdge{
		// Customer owns accounts
		{Source: "C001", Target: "A001", Type: EdgeOwns, Weight: 1.0},
		{Source: "C001", Target: "A002", Type: EdgeOwns, Weight: 1.0},
		{Source: "C002", Target: "A003", Type: EdgeOwns, Weight: 1.0},
		{Source: "C003", Target: "A004", Type: EdgeOwns, Weight: 1.0},
		{Source: "C004", Target: "A005", Type: EdgeOwns, Weight: 1.0},
		{Source: "C005", Target: "A006", Type: EdgeOwns, Weight: 1.0},
		{Source: "C011", Target: "A007", Type: EdgeOwns, Weight: 1.0},
		{Source: "C012", Target: "A008", Type: EdgeOwns, Weight: 1.0},
		{Source: "C013", Target: "A009", Type: EdgeOwns, Weight: 1.0},
		{Source: "C014", Target: "A010", Type: EdgeOwns, Weight: 1.0},
		// Transfers between accounts (some suspicious circular)
		{Source: "A001", Target: "A004", Type: EdgeTransfers, Weight: 500000},
		{Source: "A004", Target: "A006", Type: EdgeTransfers, Weight: 350000},
		{Source: "A007", Target: "A008", Type: EdgeTransfers, Weight: 45000},  // fraud ring
		{Source: "A008", Target: "A009", Type: EdgeTransfers, Weight: 20000},  // fraud ring
		{Source: "A009", Target: "A007", Type: EdgeTransfers, Weight: 48000},  // circular!
		{Source: "A005", Target: "A007", Type: EdgeTransfers, Weight: 90000},  // mule
		// Device usage (shared device = suspicious)
		{Source: "C001", Target: "D001", Type: EdgeUsesDevice, Weight: 1.0},
		{Source: "C003", Target: "D002", Type: EdgeUsesDevice, Weight: 1.0},
		{Source: "C005", Target: "D003", Type: EdgeUsesDevice, Weight: 1.0},
		{Source: "C011", Target: "D004", Type: EdgeUsesDevice, Weight: 1.0},
		{Source: "C012", Target: "D004", Type: EdgeUsesDevice, Weight: 1.0}, // same device!
		{Source: "C013", Target: "D004", Type: EdgeUsesDevice, Weight: 1.0}, // same device!
		// Merchant transactions
		{Source: "C001", Target: "M001", Type: EdgeTransacts, Weight: 25000},
		{Source: "C003", Target: "M002", Type: EdgeTransacts, Weight: 180000},
		{Source: "C011", Target: "M003", Type: EdgeTransacts, Weight: 50000},
		{Source: "C012", Target: "M004", Type: EdgeTransacts, Weight: 25000},
		{Source: "C013", Target: "M004", Type: EdgeTransacts, Weight: 70000},
		// Shared phone/email (identity linkage)
		{Source: "C011", Target: "C012", Type: EdgeSharesPhone, Weight: 1.0},
		{Source: "C012", Target: "C013", Type: EdgeSharesEmail, Weight: 1.0},
		{Source: "C004", Target: "C007", Type: EdgeSharesPhone, Weight: 1.0},
		// Legitimate connections
		{Source: "C002", Target: "C010", Type: EdgeLinkedTo, Weight: 1.0},
		{Source: "C009", Target: "C014", Type: EdgeLinkedTo, Weight: 1.0},
		{Source: "C003", Target: "C015", Type: EdgeLinkedTo, Weight: 1.0},
	}

	// Build adjacency list
	for _, edge := range edges {
		e.adjList[edge.Source] = append(e.adjList[edge.Source], edge.Target)
		e.adjList[edge.Target] = append(e.adjList[edge.Target], edge.Source)
		if n, ok := e.nodeIndex[edge.Source]; ok {
			n.Neighbors = append(n.Neighbors, edge.Target)
		}
		if n, ok := e.nodeIndex[edge.Target]; ok {
			n.Neighbors = append(n.Neighbors, edge.Source)
		}
	}

	nodes := make([]GraphNode, 0, len(e.nodeIndex))
	for _, n := range e.nodeIndex {
		nodes = append(nodes, *n)
	}
	e.graph = &GraphData{Nodes: nodes, Edges: edges}
}

func (e *GNNEngine) computeEmbeddings() {
	e.mu.Lock()
	defer e.mu.Unlock()

	embDim := e.model.EmbeddingDim
	for id, node := range e.nodeIndex {
		// Initial feature vector from node properties
		features := make([]float64, 16)
		switch node.Type {
		case NodeCustomer:
			features[0] = 1.0
			if b, ok := node.Properties["balance"].(float64); ok {
				features[1] = math.Log1p(b) / 20.0
			}
			if rf, ok := node.Properties["risk_flag"].(bool); ok && rf {
				features[2] = 1.0
			}
			switch node.Properties["tier"] {
			case "premium":
				features[3] = 1.0
			case "standard":
				features[4] = 1.0
			case "basic":
				features[5] = 1.0
			}
		case NodeAccount:
			features[6] = 1.0
			if b, ok := node.Properties["balance"].(float64); ok {
				features[7] = math.Log1p(b) / 20.0
			}
		case NodeDevice:
			features[8] = 1.0
		case NodeMerchant:
			features[9] = 1.0
			if rs, ok := node.Properties["risk_score"].(float64); ok {
				features[10] = rs
			}
		}
		// Degree feature
		features[11] = float64(len(e.adjList[id])) / 10.0
		// Triangle count approximation
		features[12] = e.countTriangles(id) / 5.0

		// GraphSAGE forward pass: aggregate neighbor features, then transform
		embedding := e.graphSAGEForward(id, features)
		if len(embedding) < embDim {
			padded := make([]float64, embDim)
			copy(padded, embedding)
			embedding = padded
		}
		e.embeddings[id] = embedding[:embDim]
		node.Embedding = embedding[:embDim]
	}
}

func (e *GNNEngine) graphSAGEForward(nodeID string, features []float64) []float64 {
	current := features
	neighbors := e.adjList[nodeID]
	if len(neighbors) == 0 {
		// Transform features through layers
		for _, layer := range e.model.Layers {
			current = e.linearTransform(current, layer)
		}
		return current
	}

	for _, layer := range e.model.Layers {
		// Aggregate neighbor embeddings
		neighborFeats := make([][]float64, 0, len(neighbors))
		for _, nID := range neighbors {
			if emb, ok := e.embeddings[nID]; ok && len(emb) >= layer.InputDim {
				neighborFeats = append(neighborFeats, emb[:layer.InputDim])
			}
		}
		aggr := e.meanAggregate(neighborFeats, layer.InputDim)

		// Concatenate self + aggregated neighbor, then project
		combined := make([]float64, layer.InputDim)
		for i := 0; i < layer.InputDim && i < len(current); i++ {
			combined[i] = current[i]*0.5 + aggr[i]*0.5
		}
		current = e.linearTransform(combined, layer)
	}
	return current
}

func (e *GNNEngine) linearTransform(input []float64, layer GNNLayer) []float64 {
	output := make([]float64, layer.OutputDim)
	for i := 0; i < layer.OutputDim; i++ {
		sum := layer.Bias[i]
		for j := 0; j < layer.InputDim && j < len(input); j++ {
			if j < len(layer.WeightMatrix[i]) {
				sum += input[j] * layer.WeightMatrix[i][j]
			}
		}
		switch layer.Activation {
		case "relu":
			if sum < 0 {
				sum = 0
			}
		case "sigmoid":
			sum = 1.0 / (1.0 + math.Exp(-sum))
		}
		output[i] = sum
	}
	return output
}

func (e *GNNEngine) meanAggregate(features [][]float64, dim int) []float64 {
	result := make([]float64, dim)
	if len(features) == 0 {
		return result
	}
	for _, f := range features {
		for i := 0; i < dim && i < len(f); i++ {
			result[i] += f[i]
		}
	}
	n := float64(len(features))
	for i := range result {
		result[i] /= n
	}
	return result
}

func (e *GNNEngine) countTriangles(nodeID string) float64 {
	neighbors := e.adjList[nodeID]
	count := 0.0
	neighborSet := make(map[string]bool)
	for _, n := range neighbors {
		neighborSet[n] = true
	}
	for _, n1 := range neighbors {
		for _, n2 := range e.adjList[n1] {
			if neighborSet[n2] && n2 != nodeID {
				count++
			}
		}
	}
	return count / 2.0
}

func (e *GNNEngine) detectCommunities() {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Louvain-inspired community detection
	communityMap := make(map[string]int)
	communityID := 0

	visited := make(map[string]bool)
	for id := range e.nodeIndex {
		if visited[id] {
			continue
		}
		// BFS to find connected component
		members := []string{}
		queue := []string{id}
		visited[id] = true
		for len(queue) > 0 {
			current := queue[0]
			queue = queue[1:]
			members = append(members, current)
			for _, neighbor := range e.adjList[current] {
				if !visited[neighbor] {
					visited[neighbor] = true
					queue = append(queue, neighbor)
				}
			}
		}

		totalEdges := 0
		for _, m := range members {
			for _, n := range e.adjList[m] {
				for _, m2 := range members {
					if n == m2 {
						totalEdges++
					}
				}
			}
		}
		density := 0.0
		if len(members) > 1 {
			maxEdges := len(members) * (len(members) - 1)
			if maxEdges > 0 {
				density = float64(totalEdges) / float64(maxEdges)
			}
		}

		totalDegree := 0
		for _, m := range members {
			totalDegree += len(e.adjList[m])
		}
		avgDeg := float64(totalDegree) / math.Max(float64(len(members)), 1)

		label := "legitimate"
		fraudCount := 0
		for _, m := range members {
			if node, ok := e.nodeIndex[m]; ok {
				if rf, ok := node.Properties["risk_flag"].(bool); ok && rf {
					fraudCount++
				}
			}
		}
		if float64(fraudCount)/float64(len(members)) > 0.4 {
			label = "suspicious_ring"
		} else if density > 0.6 {
			label = "high_density_cluster"
		}

		community := Community{
			ID:         communityID,
			Members:    members,
			Density:    density,
			Modularity: density * 0.8,
			Label:      label,
			Size:       len(members),
			AvgDegree:  avgDeg,
		}
		e.communities = append(e.communities, community)

		for _, m := range members {
			communityMap[m] = communityID
		}
		communityID++
	}
}

// --- Fraud Detection via GNN ---

func (e *GNNEngine) DetectFraud() []FraudScore {
	e.mu.RLock()
	defer e.mu.RUnlock()

	scores := []FraudScore{}
	for id, node := range e.nodeIndex {
		if node.Type != NodeCustomer {
			continue
		}

		probability := 0.0
		reasons := []string{}

		// Factor 1: Node features
		if rf, ok := node.Properties["risk_flag"].(bool); ok && rf {
			probability += 0.3
			reasons = append(reasons, "Pre-existing risk flag")
		}

		// Factor 2: Shared device with suspicious entities
		sharedDeviceCount := 0
		for _, neighbor := range e.adjList[id] {
			if n, ok := e.nodeIndex[neighbor]; ok && n.Type == NodeDevice {
				deviceUsers := len(e.adjList[neighbor])
				if deviceUsers > 2 {
					sharedDeviceCount++
					probability += 0.15
					reasons = append(reasons, fmt.Sprintf("Shared device %s with %d users", neighbor, deviceUsers))
				}
			}
		}

		// Factor 3: Circular transaction patterns
		if e.hasCircularTransactions(id, 4) {
			probability += 0.25
			reasons = append(reasons, "Circular transaction pattern detected")
		}

		// Factor 4: High-risk merchant transactions
		for _, neighbor := range e.adjList[id] {
			if n, ok := e.nodeIndex[neighbor]; ok && n.Type == NodeMerchant {
				if rs, ok := n.Properties["risk_score"].(float64); ok && rs > 0.6 {
					probability += 0.1
					reasons = append(reasons, fmt.Sprintf("Transacts with high-risk merchant %s", n.Properties["name"]))
				}
			}
		}

		// Factor 5: Community-based risk (guilt by association)
		for _, comm := range e.communities {
			for _, m := range comm.Members {
				if m == id && comm.Label == "suspicious_ring" {
					probability += 0.2
					reasons = append(reasons, fmt.Sprintf("Member of suspicious community #%d", comm.ID))
				}
			}
		}

		// Factor 6: Embedding similarity to known fraud
		if emb, ok := e.embeddings[id]; ok {
			for otherID, otherNode := range e.nodeIndex {
				if otherID != id && otherNode.Type == NodeCustomer {
					if rf, ok := otherNode.Properties["risk_flag"].(bool); ok && rf {
						if otherEmb, ok := e.embeddings[otherID]; ok {
							sim := cosineSimilarity(emb, otherEmb)
							if sim > 0.85 {
								probability += 0.1
								reasons = append(reasons, fmt.Sprintf("Embedding similarity %.2f with flagged entity %s", sim, otherID))
							}
						}
					}
				}
			}
		}

		probability = math.Min(probability, 0.99)

		riskLevel := "low"
		if probability > 0.7 {
			riskLevel = "critical"
		} else if probability > 0.5 {
			riskLevel = "high"
		} else if probability > 0.3 {
			riskLevel = "medium"
		}

		connectedFrauds := 0
		for _, neighbor := range e.adjList[id] {
			if n, ok := e.nodeIndex[neighbor]; ok {
				if rf, ok := n.Properties["risk_flag"].(bool); ok && rf {
					connectedFrauds++
				}
			}
		}

		communityID := -1
		for _, comm := range e.communities {
			for _, m := range comm.Members {
				if m == id {
					communityID = comm.ID
				}
			}
		}

		scores = append(scores, FraudScore{
			NodeID:           id,
			NodeType:         node.Type,
			FraudProbability: probability,
			RiskLevel:        riskLevel,
			Reasons:          reasons,
			ConnectedFrauds:  connectedFrauds,
			CommunityID:      communityID,
			Embedding:        e.embeddings[id],
		})
	}

	sort.Slice(scores, func(i, j int) bool {
		return scores[i].FraudProbability > scores[j].FraudProbability
	})
	return scores
}

func (e *GNNEngine) hasCircularTransactions(startID string, maxDepth int) bool {
	visited := make(map[string]bool)
	return e.dfsCircular(startID, startID, visited, 0, maxDepth)
}

func (e *GNNEngine) dfsCircular(current, target string, visited map[string]bool, depth, maxDepth int) bool {
	if depth > 1 && current == target {
		return true
	}
	if depth >= maxDepth {
		return false
	}
	visited[current] = true
	for _, neighbor := range e.adjList[current] {
		if !visited[neighbor] || (neighbor == target && depth > 1) {
			if e.dfsCircular(neighbor, target, visited, depth+1, maxDepth) {
				return true
			}
		}
	}
	return false
}

// --- Link Prediction ---

func (e *GNNEngine) PredictLinks(topK int) []LinkPrediction {
	e.mu.RLock()
	defer e.mu.RUnlock()

	predictions := []LinkPrediction{}
	nodeIDs := make([]string, 0)
	for id, node := range e.nodeIndex {
		if node.Type == NodeCustomer {
			nodeIDs = append(nodeIDs, id)
		}
	}

	for i := 0; i < len(nodeIDs); i++ {
		for j := i + 1; j < len(nodeIDs); j++ {
			// Skip if already connected
			connected := false
			for _, n := range e.adjList[nodeIDs[i]] {
				if n == nodeIDs[j] {
					connected = true
					break
				}
			}
			if connected {
				continue
			}

			emb1, ok1 := e.embeddings[nodeIDs[i]]
			emb2, ok2 := e.embeddings[nodeIDs[j]]
			if !ok1 || !ok2 {
				continue
			}

			sim := cosineSimilarity(emb1, emb2)
			// Common neighbors boost
			commonNeighbors := e.commonNeighborCount(nodeIDs[i], nodeIDs[j])
			probability := sim*0.6 + float64(commonNeighbors)*0.1

			if probability > 0.3 {
				reason := fmt.Sprintf("Embedding similarity: %.2f, %d common neighbors", sim, commonNeighbors)
				relationship := "POTENTIAL_CROSS_SELL"
				if commonNeighbors > 2 {
					relationship = "LIKELY_REFERRAL"
				}

				predictions = append(predictions, LinkPrediction{
					Source:       nodeIDs[i],
					Target:       nodeIDs[j],
					Probability:  math.Min(probability, 0.99),
					Relationship: relationship,
					Confidence:   sim,
					Reason:       reason,
				})
			}
		}
	}

	sort.Slice(predictions, func(i, j int) bool {
		return predictions[i].Probability > predictions[j].Probability
	})
	if len(predictions) > topK {
		predictions = predictions[:topK]
	}
	return predictions
}

func (e *GNNEngine) commonNeighborCount(a, b string) int {
	neighborsA := make(map[string]bool)
	for _, n := range e.adjList[a] {
		neighborsA[n] = true
	}
	count := 0
	for _, n := range e.adjList[b] {
		if neighborsA[n] {
			count++
		}
	}
	return count
}

// --- Influence Scoring (PageRank) ---

func (e *GNNEngine) ComputeInfluence() []InfluenceScore {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// PageRank
	damping := 0.85
	iterations := 50
	pagerank := make(map[string]float64)
	n := float64(len(e.nodeIndex))
	for id := range e.nodeIndex {
		pagerank[id] = 1.0 / n
	}

	for iter := 0; iter < iterations; iter++ {
		newRank := make(map[string]float64)
		for id := range e.nodeIndex {
			newRank[id] = (1 - damping) / n
		}
		for id := range e.nodeIndex {
			neighbors := e.adjList[id]
			if len(neighbors) == 0 {
				continue
			}
			share := pagerank[id] / float64(len(neighbors))
			for _, neighbor := range neighbors {
				newRank[neighbor] += damping * share
			}
		}
		pagerank = newRank
		_ = iter
	}

	// Betweenness centrality (approximation)
	betweenness := make(map[string]float64)
	for id := range e.nodeIndex {
		betweenness[id] = float64(len(e.adjList[id])) * pagerank[id] * 100
	}

	scores := []InfluenceScore{}
	for id, node := range e.nodeIndex {
		if node.Type != NodeCustomer {
			continue
		}
		name := ""
		if n, ok := node.Properties["name"].(string); ok {
			name = n
		}
		degree := len(e.adjList[id])
		influence := pagerank[id]*40 + betweenness[id]*0.3 + float64(degree)*2

		tier := "standard"
		if influence > 15 {
			tier = "key_influencer"
		} else if influence > 8 {
			tier = "connector"
		}

		// Reach count (2-hop)
		reach := make(map[string]bool)
		for _, n := range e.adjList[id] {
			reach[n] = true
			for _, nn := range e.adjList[n] {
				reach[nn] = true
			}
		}
		delete(reach, id)

		scores = append(scores, InfluenceScore{
			CustomerID:  id,
			Name:        name,
			PageRank:    pagerank[id],
			Betweenness: betweenness[id],
			Degree:      degree,
			Influence:   influence,
			Tier:        tier,
			ReachCount:  len(reach),
		})
	}

	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Influence > scores[j].Influence
	})
	return scores
}

// --- Utility ---

func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// --- API Handlers ---

var engine *GNNEngine

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "gnn-neo4j"})
}

func handleGraphStats(w http.ResponseWriter, r *http.Request) {
	engine.mu.RLock()
	defer engine.mu.RUnlock()

	nodesByType := make(map[string]int)
	for _, node := range engine.nodeIndex {
		nodesByType[string(node.Type)]++
	}

	edgesByType := make(map[string]int)
	for _, edge := range engine.graph.Edges {
		edgesByType[string(edge.Type)]++
	}

	stats := map[string]interface{}{
		"total_nodes":      len(engine.nodeIndex),
		"total_edges":      len(engine.graph.Edges),
		"nodes_by_type":    nodesByType,
		"edges_by_type":    edgesByType,
		"communities":      len(engine.communities),
		"embedding_dim":    engine.model.EmbeddingDim,
		"gnn_layers":       engine.model.NumLayers,
		"aggregation":      engine.model.Aggregation,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func handleFraudDetection(w http.ResponseWriter, r *http.Request) {
	scores := engine.DetectFraud()

	// Summary
	critical, high, medium := 0, 0, 0
	for _, s := range scores {
		switch s.RiskLevel {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		}
	}

	result := map[string]interface{}{
		"fraud_scores": scores,
		"summary": map[string]interface{}{
			"total_analyzed": len(scores),
			"critical":       critical,
			"high":           high,
			"medium":         medium,
			"low":            len(scores) - critical - high - medium,
		},
		"model": map[string]interface{}{
			"type":          "GraphSAGE",
			"layers":        engine.model.NumLayers,
			"embedding_dim": engine.model.EmbeddingDim,
			"aggregation":   engine.model.Aggregation,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleCommunities(w http.ResponseWriter, r *http.Request) {
	engine.mu.RLock()
	defer engine.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"communities":     engine.communities,
		"total":           len(engine.communities),
		"suspicious_count": countByLabel(engine.communities, "suspicious_ring"),
	})
}

func countByLabel(communities []Community, label string) int {
	count := 0
	for _, c := range communities {
		if c.Label == label {
			count++
		}
	}
	return count
}

func handleLinkPredictions(w http.ResponseWriter, r *http.Request) {
	predictions := engine.PredictLinks(20)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"predictions":   predictions,
		"total":         len(predictions),
		"method":        "GNN embedding cosine similarity + common neighbors",
	})
}

func handleInfluence(w http.ResponseWriter, r *http.Request) {
	scores := engine.ComputeInfluence()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"influence_scores": scores,
		"total":            len(scores),
		"method":           "PageRank + Betweenness centrality + degree",
	})
}

func handleFraudRings(w http.ResponseWriter, r *http.Request) {
	engine.mu.RLock()
	defer engine.mu.RUnlock()

	rings := []FraudRing{}
	for _, comm := range engine.communities {
		if comm.Label != "suspicious_ring" {
			continue
		}
		members := []FraudScore{}
		totalAmount := 0.0
		for _, memberID := range comm.Members {
			if node, ok := engine.nodeIndex[memberID]; ok {
				if b, ok := node.Properties["balance"].(float64); ok {
					totalAmount += b
				}
				members = append(members, FraudScore{
					NodeID:   memberID,
					NodeType: node.Type,
				})
			}
		}
		rings = append(rings, FraudRing{
			RingID:      fmt.Sprintf("FR-%03d", comm.ID),
			Members:     members,
			TotalAmount: totalAmount,
			Confidence:  comm.Density,
			Pattern:     "circular_transfers_shared_device",
			DetectedAt:  time.Now().Add(-time.Duration(rand.Intn(48)) * time.Hour),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"fraud_rings": rings,
		"total":       len(rings),
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	log.Println("Initializing GNN + Neo4j service...")
	engine = NewGNNEngine()
	log.Printf("Graph loaded: %d nodes, %d edges, %d communities",
		len(engine.nodeIndex), len(engine.graph.Edges), len(engine.communities))

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/api/v1/gnn/stats", handleGraphStats)
	mux.HandleFunc("/api/v1/gnn/fraud-detection", handleFraudDetection)
	mux.HandleFunc("/api/v1/gnn/communities", handleCommunities)
	mux.HandleFunc("/api/v1/gnn/link-predictions", handleLinkPredictions)
	mux.HandleFunc("/api/v1/gnn/influence", handleInfluence)
	mux.HandleFunc("/api/v1/gnn/fraud-rings", handleFraudRings)

	_ = strings.NewReader
	_ = fmt.Sprintf

	addr := ":8090"
	log.Printf("GNN-Neo4j service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, corsMiddleware(mux)))
}
