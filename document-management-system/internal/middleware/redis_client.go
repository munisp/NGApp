package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

const (
	DocumentCachePrefix    = "doc:"
	DocumentMetaPrefix     = "doc:meta:"
	DocumentOCRPrefix      = "doc:ocr:"
	DocumentSearchPrefix   = "doc:search:"
	DocumentLockPrefix     = "doc:lock:"
	DocumentAccessPrefix   = "doc:access:"
	DocumentStatsPrefix    = "doc:stats:"
	FolderCachePrefix      = "folder:"
	UserDocumentsPrefix    = "user:docs:"
)

type CachedDocument struct {
	ID           string                 `json:"id"`
	FileName     string                 `json:"file_name"`
	DocumentType string                 `json:"document_type"`
	MimeType     string                 `json:"mime_type"`
	FileSize     int64                  `json:"file_size"`
	FilePath     string                 `json:"file_path"`
	FolderID     string                 `json:"folder_id"`
	UploadedBy   string                 `json:"uploaded_by"`
	Version      int                    `json:"version"`
	OCRStatus    string                 `json:"ocr_status"`
	Metadata     map[string]interface{} `json:"metadata"`
	CachedAt     time.Time              `json:"cached_at"`
}

type CachedOCRResult struct {
	DocumentID      string                 `json:"document_id"`
	Text            string                 `json:"text"`
	Confidence      float64                `json:"confidence"`
	Provider        string                 `json:"provider"`
	ExtractedFields map[string]interface{} `json:"extracted_fields"`
	ProcessedAt     time.Time              `json:"processed_at"`
}

func NewRedisClient(addr, password string, db int) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{client: client}, nil
}

func (r *RedisClient) CacheDocument(ctx context.Context, doc *CachedDocument, ttl time.Duration) error {
	doc.CachedAt = time.Now()
	data, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, DocumentCachePrefix+doc.ID, data, ttl).Err()
}

func (r *RedisClient) GetCachedDocument(ctx context.Context, docID string) (*CachedDocument, error) {
	data, err := r.client.Get(ctx, DocumentCachePrefix+docID).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var doc CachedDocument
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}

	return &doc, nil
}

func (r *RedisClient) InvalidateDocumentCache(ctx context.Context, docID string) error {
	keys := []string{
		DocumentCachePrefix + docID,
		DocumentMetaPrefix + docID,
		DocumentOCRPrefix + docID,
	}
	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisClient) CacheOCRResult(ctx context.Context, result *CachedOCRResult, ttl time.Duration) error {
	result.ProcessedAt = time.Now()
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, DocumentOCRPrefix+result.DocumentID, data, ttl).Err()
}

func (r *RedisClient) GetCachedOCRResult(ctx context.Context, docID string) (*CachedOCRResult, error) {
	data, err := r.client.Get(ctx, DocumentOCRPrefix+docID).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var result CachedOCRResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (r *RedisClient) AcquireDocumentLock(ctx context.Context, docID string, ttl time.Duration) (bool, error) {
	return r.client.SetNX(ctx, DocumentLockPrefix+docID, time.Now().Unix(), ttl).Result()
}

func (r *RedisClient) ReleaseDocumentLock(ctx context.Context, docID string) error {
	return r.client.Del(ctx, DocumentLockPrefix+docID).Err()
}

func (r *RedisClient) LogDocumentAccess(ctx context.Context, docID, userID, action string) error {
	accessLog := map[string]interface{}{
		"document_id": docID,
		"user_id":     userID,
		"action":      action,
		"timestamp":   time.Now().Unix(),
	}

	data, err := json.Marshal(accessLog)
	if err != nil {
		return err
	}

	return r.client.LPush(ctx, DocumentAccessPrefix+docID, data).Err()
}

func (r *RedisClient) GetDocumentAccessLog(ctx context.Context, docID string, limit int64) ([]map[string]interface{}, error) {
	data, err := r.client.LRange(ctx, DocumentAccessPrefix+docID, 0, limit-1).Result()
	if err != nil {
		return nil, err
	}

	var logs []map[string]interface{}
	for _, item := range data {
		var log map[string]interface{}
		if err := json.Unmarshal([]byte(item), &log); err != nil {
			continue
		}
		logs = append(logs, log)
	}

	return logs, nil
}

func (r *RedisClient) IncrementDocumentStats(ctx context.Context, statType string) error {
	key := DocumentStatsPrefix + statType + ":" + time.Now().Format("2006-01-02")
	return r.client.Incr(ctx, key).Err()
}

func (r *RedisClient) GetDocumentStats(ctx context.Context, statType string, days int) (map[string]int64, error) {
	stats := make(map[string]int64)

	for i := 0; i < days; i++ {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		key := DocumentStatsPrefix + statType + ":" + date
		val, err := r.client.Get(ctx, key).Int64()
		if err == nil {
			stats[date] = val
		}
	}

	return stats, nil
}

func (r *RedisClient) AddUserDocument(ctx context.Context, userID, docID string) error {
	return r.client.SAdd(ctx, UserDocumentsPrefix+userID, docID).Err()
}

func (r *RedisClient) GetUserDocuments(ctx context.Context, userID string) ([]string, error) {
	return r.client.SMembers(ctx, UserDocumentsPrefix+userID).Result()
}

func (r *RedisClient) RemoveUserDocument(ctx context.Context, userID, docID string) error {
	return r.client.SRem(ctx, UserDocumentsPrefix+userID, docID).Err()
}

func (r *RedisClient) CacheSearchResults(ctx context.Context, query string, results []string, ttl time.Duration) error {
	data, err := json.Marshal(results)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, DocumentSearchPrefix+query, data, ttl).Err()
}

func (r *RedisClient) GetCachedSearchResults(ctx context.Context, query string) ([]string, error) {
	data, err := r.client.Get(ctx, DocumentSearchPrefix+query).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var results []string
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (r *RedisClient) PublishDocumentUpdate(ctx context.Context, docID string, updateType string) error {
	message := map[string]interface{}{
		"document_id": docID,
		"update_type": updateType,
		"timestamp":   time.Now().Unix(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return r.client.Publish(ctx, "document:updates", data).Err()
}

func (r *RedisClient) SubscribeToDocumentUpdates(ctx context.Context, handler func(docID, updateType string)) error {
	pubsub := r.client.Subscribe(ctx, "document:updates")
	defer pubsub.Close()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			msg, err := pubsub.ReceiveMessage(ctx)
			if err != nil {
				continue
			}

			var message map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
				continue
			}

			docID, _ := message["document_id"].(string)
			updateType, _ := message["update_type"].(string)
			handler(docID, updateType)
		}
	}
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}
