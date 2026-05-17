package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

type ElasticsearchClient struct {
	client *elasticsearch.Client
	index  string
}

type ElasticsearchConfig struct {
	Addresses []string
	Username  string
	Password  string
	Index     string
}

type DocumentIndex struct {
	ID           string                 `json:"id"`
	FileName     string                 `json:"file_name"`
	DocumentType string                 `json:"document_type"`
	MimeType     string                 `json:"mime_type"`
	FolderID     string                 `json:"folder_id,omitempty"`
	FolderPath   string                 `json:"folder_path,omitempty"`
	UploadedBy   string                 `json:"uploaded_by"`
	UploadedAt   time.Time              `json:"uploaded_at"`
	OCRText      string                 `json:"ocr_text,omitempty"`
	Tags         []string               `json:"tags,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	EntityType   string                 `json:"entity_type,omitempty"`
	EntityID     string                 `json:"entity_id,omitempty"`
	Status       string                 `json:"status"`
}

type SearchQuery struct {
	Query       string            `json:"query"`
	Filters     map[string]string `json:"filters,omitempty"`
	DateFrom    *time.Time        `json:"date_from,omitempty"`
	DateTo      *time.Time        `json:"date_to,omitempty"`
	FolderID    string            `json:"folder_id,omitempty"`
	UploadedBy  string            `json:"uploaded_by,omitempty"`
	DocumentType string           `json:"document_type,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Page        int               `json:"page"`
	PageSize    int               `json:"page_size"`
	SortBy      string            `json:"sort_by,omitempty"`
	SortOrder   string            `json:"sort_order,omitempty"`
}

type SearchResult struct {
	Total      int64           `json:"total"`
	Documents  []DocumentIndex `json:"documents"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
	TotalPages int             `json:"total_pages"`
	Took       int64           `json:"took_ms"`
}

func NewElasticsearchClient(cfg *ElasticsearchConfig) (*ElasticsearchClient, error) {
	esCfg := elasticsearch.Config{
		Addresses: cfg.Addresses,
		Username:  cfg.Username,
		Password:  cfg.Password,
	}

	client, err := elasticsearch.NewClient(esCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Elasticsearch client: %w", err)
	}

	return &ElasticsearchClient{
		client: client,
		index:  cfg.Index,
	}, nil
}

func (e *ElasticsearchClient) CreateIndex(ctx context.Context) error {
	mapping := `{
		"settings": {
			"number_of_shards": 3,
			"number_of_replicas": 1,
			"analysis": {
				"analyzer": {
					"document_analyzer": {
						"type": "custom",
						"tokenizer": "standard",
						"filter": ["lowercase", "asciifolding", "porter_stem"]
					}
				}
			}
		},
		"mappings": {
			"properties": {
				"id": {"type": "keyword"},
				"file_name": {"type": "text", "analyzer": "document_analyzer", "fields": {"keyword": {"type": "keyword"}}},
				"document_type": {"type": "keyword"},
				"mime_type": {"type": "keyword"},
				"folder_id": {"type": "keyword"},
				"folder_path": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
				"uploaded_by": {"type": "keyword"},
				"uploaded_at": {"type": "date"},
				"ocr_text": {"type": "text", "analyzer": "document_analyzer"},
				"tags": {"type": "keyword"},
				"metadata": {"type": "object", "enabled": true},
				"entity_type": {"type": "keyword"},
				"entity_id": {"type": "keyword"},
				"status": {"type": "keyword"}
			}
		}
	}`

	req := esapi.IndicesCreateRequest{
		Index: e.index,
		Body:  strings.NewReader(mapping),
	}

	res, err := req.Do(ctx, e.client)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() && res.StatusCode != 400 {
		return fmt.Errorf("failed to create index: %s", res.String())
	}

	return nil
}

func (e *ElasticsearchClient) IndexDocument(ctx context.Context, doc *DocumentIndex) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to marshal document: %w", err)
	}

	req := esapi.IndexRequest{
		Index:      e.index,
		DocumentID: doc.ID,
		Body:       bytes.NewReader(data),
		Refresh:    "true",
	}

	res, err := req.Do(ctx, e.client)
	if err != nil {
		return fmt.Errorf("failed to index document: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("failed to index document: %s", res.String())
	}

	return nil
}

func (e *ElasticsearchClient) UpdateDocument(ctx context.Context, docID string, updates map[string]interface{}) error {
	doc := map[string]interface{}{
		"doc": updates,
	}

	data, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to marshal updates: %w", err)
	}

	req := esapi.UpdateRequest{
		Index:      e.index,
		DocumentID: docID,
		Body:       bytes.NewReader(data),
		Refresh:    "true",
	}

	res, err := req.Do(ctx, e.client)
	if err != nil {
		return fmt.Errorf("failed to update document: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("failed to update document: %s", res.String())
	}

	return nil
}

func (e *ElasticsearchClient) DeleteDocument(ctx context.Context, docID string) error {
	req := esapi.DeleteRequest{
		Index:      e.index,
		DocumentID: docID,
		Refresh:    "true",
	}

	res, err := req.Do(ctx, e.client)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	defer res.Body.Close()

	return nil
}

func (e *ElasticsearchClient) Search(ctx context.Context, query *SearchQuery) (*SearchResult, error) {
	esQuery := e.buildSearchQuery(query)

	data, err := json.Marshal(esQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	res, err := e.client.Search(
		e.client.Search.WithContext(ctx),
		e.client.Search.WithIndex(e.index),
		e.client.Search.WithBody(bytes.NewReader(data)),
		e.client.Search.WithTrackTotalHits(true),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search failed: %s", res.String())
	}

	var response struct {
		Took int64 `json:"took"`
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source DocumentIndex `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var documents []DocumentIndex
	for _, hit := range response.Hits.Hits {
		documents = append(documents, hit.Source)
	}

	pageSize := query.PageSize
	if pageSize == 0 {
		pageSize = 20
	}

	totalPages := int(response.Hits.Total.Value) / pageSize
	if int(response.Hits.Total.Value)%pageSize > 0 {
		totalPages++
	}

	return &SearchResult{
		Total:      response.Hits.Total.Value,
		Documents:  documents,
		Page:       query.Page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		Took:       response.Took,
	}, nil
}

func (e *ElasticsearchClient) buildSearchQuery(query *SearchQuery) map[string]interface{} {
	must := []map[string]interface{}{}
	filter := []map[string]interface{}{}

	if query.Query != "" {
		must = append(must, map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  query.Query,
				"fields": []string{"file_name^3", "ocr_text^2", "tags^2", "folder_path"},
				"type":   "best_fields",
				"fuzziness": "AUTO",
			},
		})
	}

	if query.DocumentType != "" {
		filter = append(filter, map[string]interface{}{
			"term": map[string]interface{}{
				"document_type": query.DocumentType,
			},
		})
	}

	if query.FolderID != "" {
		filter = append(filter, map[string]interface{}{
			"term": map[string]interface{}{
				"folder_id": query.FolderID,
			},
		})
	}

	if query.UploadedBy != "" {
		filter = append(filter, map[string]interface{}{
			"term": map[string]interface{}{
				"uploaded_by": query.UploadedBy,
			},
		})
	}

	if len(query.Tags) > 0 {
		filter = append(filter, map[string]interface{}{
			"terms": map[string]interface{}{
				"tags": query.Tags,
			},
		})
	}

	if query.DateFrom != nil || query.DateTo != nil {
		dateRange := map[string]interface{}{}
		if query.DateFrom != nil {
			dateRange["gte"] = query.DateFrom.Format(time.RFC3339)
		}
		if query.DateTo != nil {
			dateRange["lte"] = query.DateTo.Format(time.RFC3339)
		}
		filter = append(filter, map[string]interface{}{
			"range": map[string]interface{}{
				"uploaded_at": dateRange,
			},
		})
	}

	for key, value := range query.Filters {
		filter = append(filter, map[string]interface{}{
			"term": map[string]interface{}{
				key: value,
			},
		})
	}

	boolQuery := map[string]interface{}{}
	if len(must) > 0 {
		boolQuery["must"] = must
	} else {
		boolQuery["must"] = []map[string]interface{}{
			{"match_all": map[string]interface{}{}},
		}
	}
	if len(filter) > 0 {
		boolQuery["filter"] = filter
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize == 0 {
		pageSize = 20
	}
	from := (page - 1) * pageSize

	sortBy := query.SortBy
	if sortBy == "" {
		sortBy = "uploaded_at"
	}
	sortOrder := query.SortOrder
	if sortOrder == "" {
		sortOrder = "desc"
	}

	return map[string]interface{}{
		"query": map[string]interface{}{
			"bool": boolQuery,
		},
		"from": from,
		"size": pageSize,
		"sort": []map[string]interface{}{
			{sortBy: map[string]interface{}{"order": sortOrder}},
		},
		"highlight": map[string]interface{}{
			"fields": map[string]interface{}{
				"ocr_text":  map[string]interface{}{},
				"file_name": map[string]interface{}{},
			},
		},
	}
}

func (e *ElasticsearchClient) Suggest(ctx context.Context, prefix string, field string, size int) ([]string, error) {
	query := map[string]interface{}{
		"suggest": map[string]interface{}{
			"document-suggest": map[string]interface{}{
				"prefix": prefix,
				"completion": map[string]interface{}{
					"field": field,
					"size":  size,
				},
			},
		},
	}

	data, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	res, err := e.client.Search(
		e.client.Search.WithContext(ctx),
		e.client.Search.WithIndex(e.index),
		e.client.Search.WithBody(bytes.NewReader(data)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to execute suggest: %w", err)
	}
	defer res.Body.Close()

	var response struct {
		Suggest map[string][]struct {
			Options []struct {
				Text string `json:"text"`
			} `json:"options"`
		} `json:"suggest"`
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var suggestions []string
	if suggest, ok := response.Suggest["document-suggest"]; ok && len(suggest) > 0 {
		for _, option := range suggest[0].Options {
			suggestions = append(suggestions, option.Text)
		}
	}

	return suggestions, nil
}

func (e *ElasticsearchClient) GetDocumentsByEntity(ctx context.Context, entityType, entityID string) ([]DocumentIndex, error) {
	result, err := e.Search(ctx, &SearchQuery{
		Filters: map[string]string{
			"entity_type": entityType,
			"entity_id":   entityID,
		},
		PageSize: 100,
	})
	if err != nil {
		return nil, err
	}

	return result.Documents, nil
}

func (e *ElasticsearchClient) Close() error {
	return nil
}
