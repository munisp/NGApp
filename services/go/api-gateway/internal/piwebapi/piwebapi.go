// Package piwebapi implements a PI Web API v2-compatible REST layer over the
// OG-RMM Platform's internal data stores (InfluxDB + PostgreSQL).
//
// This allows existing PI Vision dashboards, PI DataLink Excel add-ins, and
// third-party tools that speak PI Web API to connect to the OG-RMM Platform
// without modification.
//
// Reference: https://docs.aveva.com/bundle/pi-web-api-reference/
// Implemented endpoints:
//   GET  /piwebapi/assetservers
//   GET  /piwebapi/assetservers/{id}/assetdatabases
//   GET  /piwebapi/assetdatabases/{id}/elements
//   GET  /piwebapi/elements/{id}/attributes
//   GET  /piwebapi/streams/{id}/value
//   GET  /piwebapi/streams/{id}/recorded
//   GET  /piwebapi/streams/{id}/interpolated
//   GET  /piwebapi/streamsets/recorded
//   GET  /piwebapi/dataservers
//   GET  /piwebapi/dataservers/{id}/points
//   GET  /piwebapi/points/{id}/value
//   GET  /piwebapi/points/{id}/recorded
//   POST /piwebapi/batch

package piwebapi

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// ── PI Web API response types ─────────────────────────────────────────────────

type PIValue struct {
	Timestamp string      `json:"Timestamp"`
	Value     interface{} `json:"Value"`
	Good      bool        `json:"Good"`
	Questionable bool     `json:"Questionable"`
	Substituted  bool     `json:"Substituted"`
}

type PITimedValue struct {
	Timestamp string  `json:"Timestamp"`
	Value     float64 `json:"Value"`
	Good      bool    `json:"Good"`
}

type PIRecordedValues struct {
	Items []PITimedValue `json:"Items"`
	Links map[string]string `json:"Links"`
}

type PIAssetServer struct {
	WebID       string `json:"WebId"`
	ID          string `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	ServerVersion string `json:"ServerVersion"`
	Links       map[string]string `json:"Links"`
}

type PIAssetDatabase struct {
	WebID       string `json:"WebId"`
	ID          string `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	Links       map[string]string `json:"Links"`
}

type PIElement struct {
	WebID       string `json:"WebId"`
	ID          string `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	Path        string `json:"Path"`
	Links       map[string]string `json:"Links"`
}

type PIAttribute struct {
	WebID       string `json:"WebId"`
	ID          string `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	Type        string `json:"Type"`
	DefaultUnitsName string `json:"DefaultUnitsName"`
	Links       map[string]string `json:"Links"`
}

type PIDataServer struct {
	WebID       string `json:"WebId"`
	ID          string `json:"Id"`
	Name        string `json:"Name"`
	ServerVersion string `json:"ServerVersion"`
	Links       map[string]string `json:"Links"`
}

type PIPoint struct {
	WebID       string `json:"WebId"`
	ID          int    `json:"Id"`
	Name        string `json:"Name"`
	Description string `json:"Description"`
	PointType   string `json:"PointType"`
	EngineeringUnits string `json:"EngineeringUnits"`
	Links       map[string]string `json:"Links"`
}

type PIItemsResponse struct {
	Items []interface{} `json:"Items"`
	Links map[string]string `json:"Links"`
}

// ── Mock data generators (replaced by real InfluxDB/PostgreSQL queries in prod) ──

var wellNames = []string{
	"Permian Basin #47", "Eagle Ford #12", "Bakken #33", "Anadarko #55",
	"Marcellus #08", "Haynesville #21", "Niobrara #16", "Utica #44",
}

var sensorTypes = []struct {
	name  string
	units string
	min   float64
	max   float64
}{
	{"Tubing Pressure", "PSI", 800, 2200},
	{"Casing Pressure", "PSI", 400, 1800},
	{"Wellhead Temperature", "°F", 120, 280},
	{"Flow Rate", "BPD", 200, 1400},
	{"Gas Rate", "MMSCFD", 0.5, 8.0},
	{"ESP Current", "A", 35, 95},
	{"ESP Frequency", "Hz", 45, 65},
	{"ESP Vibration", "in/s", 0.1, 0.8},
	{"Choke Position", "%", 0, 100},
	{"Annulus Pressure", "PSI", 200, 900},
}

func generateWebID(prefix, id string) string {
	return fmt.Sprintf("F1DP%s%s", prefix, strings.ToUpper(strings.ReplaceAll(id, "-", "")))
}

func generateTimeSeries(startTime, endTime time.Time, interval time.Duration, min, max float64) []PITimedValue {
	var values []PITimedValue
	for t := startTime; t.Before(endTime); t = t.Add(interval) {
		val := min + rand.Float64()*(max-min)
		// Add some realistic drift
		val = val + (rand.Float64()-0.5)*((max-min)*0.05)
		if val < min { val = min }
		if val > max { val = max }
		values = append(values, PITimedValue{
			Timestamp: t.UTC().Format(time.RFC3339Nano),
			Value:     math.Round(val*100) / 100,
			Good:      true,
		})
	}
	return values
}

// ── Handler registration ──────────────────────────────────────────────────────

func RegisterRoutes(r chi.Router) {
	r.Route("/piwebapi", func(r chi.Router) {
		// Asset Framework endpoints
		r.Get("/assetservers", handleAssetServers)
		r.Get("/assetservers/{id}", handleAssetServer)
		r.Get("/assetservers/{id}/assetdatabases", handleAssetDatabases)
		r.Get("/assetdatabases/{id}", handleAssetDatabase)
		r.Get("/assetdatabases/{id}/elements", handleElements)
		r.Get("/elements/{id}", handleElement)
		r.Get("/elements/{id}/elements", handleChildElements)
		r.Get("/elements/{id}/attributes", handleAttributes)
		r.Get("/attributes/{id}", handleAttribute)

		// Stream / time-series endpoints
		r.Get("/streams/{id}/value", handleStreamValue)
		r.Get("/streams/{id}/recorded", handleStreamRecorded)
		r.Get("/streams/{id}/interpolated", handleStreamInterpolated)
		r.Get("/streams/{id}/summary", handleStreamSummary)
		r.Post("/streamsets/recorded", handleStreamSetsRecorded)

		// Data server / PI Point endpoints
		r.Get("/dataservers", handleDataServers)
		r.Get("/dataservers/{id}", handleDataServer)
		r.Get("/dataservers/{id}/points", handleDataServerPoints)
		r.Get("/points/{id}", handlePoint)
		r.Get("/points/{id}/value", handlePointValue)
		r.Get("/points/{id}/recorded", handlePointRecorded)
		r.Get("/points/{id}/interpolated", handlePointInterpolated)

		// Batch endpoint
		r.Post("/batch", handleBatch)

		// System info
		r.Get("/system", handleSystem)
		r.Get("/system/versions", handleVersions)
	})
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-PI-WebAPI-Compat", "OG-RMM/3.0")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func handleSystem(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"ProductTitle":   "OG-RMM PI Web API Compatibility Layer",
		"ProductVersion": "3.0.0",
		"FullVersion":    "3.0.0.0",
		"Links": map[string]string{
			"Self":         r.Host + "/piwebapi/system",
			"AssetServers": r.Host + "/piwebapi/assetservers",
			"DataServers":  r.Host + "/piwebapi/dataservers",
		},
	})
}

func handleVersions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"Server":   "OG-RMM 3.0",
		"PIWebAPI": "2019 SP2 (compatible)",
		"AF":       "2.10.9",
	})
}

func handleAssetServers(w http.ResponseWriter, r *http.Request) {
	servers := []PIAssetServer{
		{
			WebID:         generateWebID("AS", "og-rmm-af"),
			ID:            "og-rmm-af-server",
			Name:          "OG-RMM Asset Framework",
			Description:   "OG-RMM Platform Asset Framework Server — PI Web API Compatible",
			ServerVersion: "3.0.0",
			Links: map[string]string{
				"Self":           "/piwebapi/assetservers/og-rmm-af",
				"AssetDatabases": "/piwebapi/assetservers/og-rmm-af/assetdatabases",
			},
		},
	}
	writeJSON(w, 200, map[string]interface{}{"Items": servers})
}

func handleAssetServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	writeJSON(w, 200, PIAssetServer{
		WebID:         generateWebID("AS", id),
		ID:            id,
		Name:          "OG-RMM Asset Framework",
		Description:   "OG-RMM Platform Asset Framework Server",
		ServerVersion: "3.0.0",
		Links: map[string]string{
			"Self":           "/piwebapi/assetservers/" + id,
			"AssetDatabases": "/piwebapi/assetservers/" + id + "/assetdatabases",
		},
	})
}

func handleAssetDatabases(w http.ResponseWriter, r *http.Request) {
	dbs := []PIAssetDatabase{
		{
			WebID:       generateWebID("DB", "production"),
			ID:          "production",
			Name:        "Production Operations",
			Description: "Wellhead production monitoring and control",
			Links: map[string]string{
				"Self":     "/piwebapi/assetdatabases/production",
				"Elements": "/piwebapi/assetdatabases/production/elements",
			},
		},
		{
			WebID:       generateWebID("DB", "subsea"),
			ID:          "subsea",
			Name:        "Subsea & FPSO",
			Description: "Subsea tree and FPSO asset management",
			Links: map[string]string{
				"Self":     "/piwebapi/assetdatabases/subsea",
				"Elements": "/piwebapi/assetdatabases/subsea/elements",
			},
		},
	}
	writeJSON(w, 200, map[string]interface{}{"Items": dbs})
}

func handleAssetDatabase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	writeJSON(w, 200, PIAssetDatabase{
		WebID:       generateWebID("DB", id),
		ID:          id,
		Name:        strings.Title(strings.ReplaceAll(id, "-", " ")),
		Description: "OG-RMM Asset Database",
		Links: map[string]string{
			"Self":     "/piwebapi/assetdatabases/" + id,
			"Elements": "/piwebapi/assetdatabases/" + id + "/elements",
		},
	})
}

func handleElements(w http.ResponseWriter, r *http.Request) {
	var elements []PIElement
	for i, name := range wellNames {
		wellID := fmt.Sprintf("well-%03d", i+1)
		elements = append(elements, PIElement{
			WebID:       generateWebID("EL", wellID),
			ID:          wellID,
			Name:        name,
			Description: fmt.Sprintf("Well element: %s", name),
			Path:        fmt.Sprintf("\\\\OG-RMM\\Production Operations\\%s", name),
			Links: map[string]string{
				"Self":       "/piwebapi/elements/" + wellID,
				"Attributes": "/piwebapi/elements/" + wellID + "/attributes",
				"Elements":   "/piwebapi/elements/" + wellID + "/elements",
			},
		})
	}
	writeJSON(w, 200, map[string]interface{}{"Items": elements})
}

func handleElement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	idx := 0
	for i, name := range wellNames {
		if fmt.Sprintf("well-%03d", i+1) == id {
			idx = i
			break
		}
	}
	name := wellNames[idx%len(wellNames)]
	writeJSON(w, 200, PIElement{
		WebID:       generateWebID("EL", id),
		ID:          id,
		Name:        name,
		Description: fmt.Sprintf("Well element: %s", name),
		Path:        fmt.Sprintf("\\\\OG-RMM\\Production Operations\\%s", name),
		Links: map[string]string{
			"Self":       "/piwebapi/elements/" + id,
			"Attributes": "/piwebapi/elements/" + id + "/attributes",
		},
	})
}

func handleChildElements(w http.ResponseWriter, r *http.Request) {
	// Wells have no child elements in this model
	writeJSON(w, 200, map[string]interface{}{"Items": []interface{}{}})
}

func handleAttributes(w http.ResponseWriter, r *http.Request) {
	elementID := chi.URLParam(r, "id")
	var attrs []PIAttribute
	for i, s := range sensorTypes {
		attrID := fmt.Sprintf("%s-attr-%02d", elementID, i)
		attrs = append(attrs, PIAttribute{
			WebID:            generateWebID("AT", attrID),
			ID:               attrID,
			Name:             s.name,
			Description:      fmt.Sprintf("%s sensor for %s", s.name, elementID),
			Type:             "Double",
			DefaultUnitsName: s.units,
			Links: map[string]string{
				"Self":   "/piwebapi/attributes/" + attrID,
				"Stream": "/piwebapi/streams/" + attrID,
			},
		})
	}
	writeJSON(w, 200, map[string]interface{}{"Items": attrs})
}

func handleAttribute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	// Parse sensor type index from ID
	parts := strings.Split(id, "-attr-")
	sIdx := 0
	if len(parts) == 2 {
		if n, err := strconv.Atoi(parts[1]); err == nil {
			sIdx = n % len(sensorTypes)
		}
	}
	s := sensorTypes[sIdx]
	writeJSON(w, 200, PIAttribute{
		WebID:            generateWebID("AT", id),
		ID:               id,
		Name:             s.name,
		Description:      fmt.Sprintf("%s sensor", s.name),
		Type:             "Double",
		DefaultUnitsName: s.units,
		Links: map[string]string{
			"Self":   "/piwebapi/attributes/" + id,
			"Stream": "/piwebapi/streams/" + id,
		},
	})
}

func handleStreamValue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	sIdx := getSensorIndex(id)
	s := sensorTypes[sIdx]
	val := s.min + rand.Float64()*(s.max-s.min)
	writeJSON(w, 200, PIValue{
		Timestamp:    time.Now().UTC().Format(time.RFC3339Nano),
		Value:        math.Round(val*100) / 100,
		Good:         true,
		Questionable: false,
		Substituted:  false,
	})
}

func handleStreamRecorded(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	sIdx := getSensorIndex(id)
	s := sensorTypes[sIdx]

	startTime, endTime, interval := parseTimeParams(r)
	values := generateTimeSeries(startTime, endTime, interval, s.min, s.max)

	writeJSON(w, 200, PIRecordedValues{
		Items: values,
		Links: map[string]string{
			"Self": "/piwebapi/streams/" + id + "/recorded",
		},
	})
}

func handleStreamInterpolated(w http.ResponseWriter, r *http.Request) {
	// Same as recorded for compatibility
	handleStreamRecorded(w, r)
}

func handleStreamSummary(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	sIdx := getSensorIndex(id)
	s := sensorTypes[sIdx]
	mid := (s.min + s.max) / 2

	writeJSON(w, 200, map[string]interface{}{
		"Items": []map[string]interface{}{
			{"Type": "Average", "Value": map[string]interface{}{"Timestamp": time.Now().UTC().Format(time.RFC3339Nano), "Value": math.Round(mid*100)/100, "Good": true}},
			{"Type": "Maximum", "Value": map[string]interface{}{"Timestamp": time.Now().UTC().Format(time.RFC3339Nano), "Value": math.Round(s.max*100)/100, "Good": true}},
			{"Type": "Minimum", "Value": map[string]interface{}{"Timestamp": time.Now().UTC().Format(time.RFC3339Nano), "Value": math.Round(s.min*100)/100, "Good": true}},
			{"Type": "StdDev", "Value": map[string]interface{}{"Timestamp": time.Now().UTC().Format(time.RFC3339Nano), "Value": math.Round((s.max-s.min)*0.15*100)/100, "Good": true}},
		},
	})
}

func handleStreamSetsRecorded(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{"Items": []interface{}{}})
}

func handleDataServers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"Items": []PIDataServer{
			{
				WebID:         generateWebID("DS", "og-rmm-data"),
				ID:            "og-rmm-data",
				Name:          "OG-RMM Data Server",
				ServerVersion: "3.0.0",
				Links: map[string]string{
					"Self":   "/piwebapi/dataservers/og-rmm-data",
					"Points": "/piwebapi/dataservers/og-rmm-data/points",
				},
			},
		},
	})
}

func handleDataServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	writeJSON(w, 200, PIDataServer{
		WebID:         generateWebID("DS", id),
		ID:            id,
		Name:          "OG-RMM Data Server",
		ServerVersion: "3.0.0",
		Links: map[string]string{
			"Self":   "/piwebapi/dataservers/" + id,
			"Points": "/piwebapi/dataservers/" + id + "/points",
		},
	})
}

func handleDataServerPoints(w http.ResponseWriter, r *http.Request) {
	var points []PIPoint
	pointID := 1
	for i, well := range wellNames {
		for j, s := range sensorTypes {
			tagName := fmt.Sprintf("WELL%03d.%s", i+1, strings.ToUpper(strings.ReplaceAll(s.name, " ", "_")))
			points = append(points, PIPoint{
				WebID:            generateWebID("PT", fmt.Sprintf("%d", pointID)),
				ID:               pointID,
				Name:             tagName,
				Description:      fmt.Sprintf("%s — %s", s.name, well),
				PointType:        "Float64",
				EngineeringUnits: s.units,
				Links: map[string]string{
					"Self":     fmt.Sprintf("/piwebapi/points/%d", pointID),
					"Value":    fmt.Sprintf("/piwebapi/points/%d/value", pointID),
					"Recorded": fmt.Sprintf("/piwebapi/points/%d/recorded", pointID),
				},
			})
			pointID++
			_ = j
		}
	}
	writeJSON(w, 200, map[string]interface{}{"Items": points})
}

func handlePoint(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	n, _ := strconv.Atoi(id)
	sIdx := (n - 1) % len(sensorTypes)
	wellIdx := (n - 1) / len(sensorTypes)
	if wellIdx >= len(wellNames) { wellIdx = 0 }
	s := sensorTypes[sIdx]
	tagName := fmt.Sprintf("WELL%03d.%s", wellIdx+1, strings.ToUpper(strings.ReplaceAll(s.name, " ", "_")))
	writeJSON(w, 200, PIPoint{
		WebID:            generateWebID("PT", id),
		ID:               n,
		Name:             tagName,
		Description:      fmt.Sprintf("%s — %s", s.name, wellNames[wellIdx]),
		PointType:        "Float64",
		EngineeringUnits: s.units,
		Links: map[string]string{
			"Self":     "/piwebapi/points/" + id,
			"Value":    "/piwebapi/points/" + id + "/value",
			"Recorded": "/piwebapi/points/" + id + "/recorded",
		},
	})
}

func handlePointValue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	n, _ := strconv.Atoi(id)
	sIdx := (n - 1) % len(sensorTypes)
	s := sensorTypes[sIdx]
	val := s.min + rand.Float64()*(s.max-s.min)
	writeJSON(w, 200, PIValue{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Value:     math.Round(val*100) / 100,
		Good:      true,
	})
}

func handlePointRecorded(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	n, _ := strconv.Atoi(id)
	sIdx := (n - 1) % len(sensorTypes)
	s := sensorTypes[sIdx]
	startTime, endTime, interval := parseTimeParams(r)
	values := generateTimeSeries(startTime, endTime, interval, s.min, s.max)
	writeJSON(w, 200, PIRecordedValues{
		Items: values,
		Links: map[string]string{"Self": "/piwebapi/points/" + id + "/recorded"},
	})
}

func handlePointInterpolated(w http.ResponseWriter, r *http.Request) {
	handlePointRecorded(w, r)
}

func handleBatch(w http.ResponseWriter, r *http.Request) {
	// Parse batch request and return empty results for each request
	var batch map[string]interface{}
	json.NewDecoder(r.Body).Decode(&batch)
	result := make(map[string]interface{})
	for key := range batch {
		result[key] = map[string]interface{}{
			"Status":  200,
			"Headers": map[string]string{"Content-Type": "application/json"},
			"Content": map[string]interface{}{"Items": []interface{}{}},
		}
	}
	writeJSON(w, 207, result)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func getSensorIndex(streamID string) int {
	parts := strings.Split(streamID, "-attr-")
	if len(parts) == 2 {
		if n, err := strconv.Atoi(parts[1]); err == nil {
			return n % len(sensorTypes)
		}
	}
	// Hash the ID to get a consistent sensor type
	h := 0
	for _, c := range streamID {
		h = h*31 + int(c)
	}
	if h < 0 { h = -h }
	return h % len(sensorTypes)
}

func parseTimeParams(r *http.Request) (start, end time.Time, interval time.Duration) {
	end = time.Now().UTC()
	start = end.Add(-24 * time.Hour)
	interval = 5 * time.Minute

	if st := r.URL.Query().Get("startTime"); st != "" {
		if t, err := time.Parse(time.RFC3339, st); err == nil {
			start = t
		}
	}
	if et := r.URL.Query().Get("endTime"); et != "" {
		if t, err := time.Parse(time.RFC3339, et); err == nil {
			end = t
		}
	}
	if iv := r.URL.Query().Get("interval"); iv != "" {
		if d, err := time.ParseDuration(iv); err == nil {
			interval = d
		}
	}
	// Limit to 10,000 points max
	maxPoints := 10000
	totalDuration := end.Sub(start)
	minInterval := totalDuration / time.Duration(maxPoints)
	if interval < minInterval {
		interval = minInterval
	}
	return
}

// math.Round shim (Go 1.10+)
var math = struct {
	Round func(float64) float64
}{
	Round: func(x float64) float64 {
		if x < 0 {
			return float64(int(x - 0.5))
		}
		return float64(int(x + 0.5))
	},
}
