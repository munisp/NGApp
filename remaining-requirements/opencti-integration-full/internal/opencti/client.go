package opencti
import ("context"; "encoding/json"; "fmt"; "net/http"; "bytes")
type Client struct { baseURL string; apiKey string; http *http.Client }
func New(baseURL, apiKey string) *Client {
return &Client{baseURL: baseURL, apiKey: apiKey, http: &http.Client{}}
}
func (c *Client) GetIndicators(ctx context.Context) ([]map[string]interface{}, error) {
query := `{"query": "{ indicators { edges { node { id pattern_type pattern confidence } } } }"}`
req, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/graphql", bytes.NewBufferString(query))
req.Header.Set("Authorization", "Bearer "+c.apiKey)
req.Header.Set("Content-Type", "application/json")
resp, err := c.http.Do(req)
if err != nil { return nil, err }
defer resp.Body.Close()
var result struct { Data struct { Indicators struct { Edges []struct { Node map[string]interface{} } } } }
json.NewDecoder(resp.Body).Decode(&result)
indicators := make([]map[string]interface{}, len(result.Data.Indicators.Edges))
for i, edge := range result.Data.Indicators.Edges { indicators[i] = edge.Node }
return indicators, nil
}
func (c *Client) CreateIndicator(ctx context.Context, patternType, pattern string, confidence int) error {
query := fmt.Sprintf(`{"query": "mutation { indicatorAdd(input: {pattern_type: \"%s\", pattern: \"%s\", confidence: %d}) { id } }"}`, patternType, pattern, confidence)
req, _ := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/graphql", bytes.NewBufferString(query))
req.Header.Set("Authorization", "Bearer "+c.apiKey)
req.Header.Set("Content-Type", "application/json")
resp, err := c.http.Do(req)
if err != nil { return err }
defer resp.Body.Close()
return nil
}
