// Package pagination provides pagination and filtering functionality
// Recommendation #11: Pagination & Indexing for high-volume tables
package pagination

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

// PageRequest represents a pagination request
type PageRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	SortBy   string `json:"sort_by"`
	SortDir  string `json:"sort_dir"`
	Cursor   string `json:"cursor,omitempty"`
}

// PageResponse represents a paginated response
type PageResponse struct {
	Data       interface{} `json:"data"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalItems int64       `json:"total_items"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
	NextCursor string      `json:"next_cursor,omitempty"`
	PrevCursor string      `json:"prev_cursor,omitempty"`
}

// FilterOperator represents a filter operation
type FilterOperator string

const (
	OpEqual          FilterOperator = "eq"
	OpNotEqual       FilterOperator = "ne"
	OpGreaterThan    FilterOperator = "gt"
	OpGreaterOrEqual FilterOperator = "gte"
	OpLessThan       FilterOperator = "lt"
	OpLessOrEqual    FilterOperator = "lte"
	OpIn             FilterOperator = "in"
	OpNotIn          FilterOperator = "nin"
	OpContains       FilterOperator = "contains"
	OpStartsWith     FilterOperator = "starts"
	OpEndsWith       FilterOperator = "ends"
	OpBetween        FilterOperator = "between"
	OpIsNull         FilterOperator = "null"
	OpIsNotNull      FilterOperator = "notnull"
)

// Filter represents a single filter condition
type Filter struct {
	Field    string         `json:"field"`
	Operator FilterOperator `json:"operator"`
	Value    interface{}    `json:"value"`
}

// FilterGroup represents a group of filters with AND/OR logic
type FilterGroup struct {
	Logic   string        `json:"logic"` // "and" or "or"
	Filters []Filter      `json:"filters"`
	Groups  []FilterGroup `json:"groups,omitempty"`
}

// QueryParams holds all query parameters for pagination and filtering
type QueryParams struct {
	PageRequest
	Filters     []Filter     `json:"filters"`
	FilterGroup *FilterGroup `json:"filter_group,omitempty"`
	Search      string       `json:"search,omitempty"`
	SearchFields []string    `json:"search_fields,omitempty"`
}

// DefaultPageSize is the default number of items per page
const DefaultPageSize = 20

// MaxPageSize is the maximum allowed page size
const MaxPageSize = 100

// DefaultQueryParams returns default query parameters
func DefaultQueryParams() *QueryParams {
	return &QueryParams{
		PageRequest: PageRequest{
			Page:     1,
			PageSize: DefaultPageSize,
			SortDir:  "desc",
		},
		Filters: make([]Filter, 0),
	}
}

// ParseFromRequest parses pagination and filter parameters from HTTP request
func ParseFromRequest(r *http.Request) (*QueryParams, error) {
	params := DefaultQueryParams()
	query := r.URL.Query()

	// Parse page
	if pageStr := query.Get("page"); pageStr != "" {
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			return nil, fmt.Errorf("invalid page parameter")
		}
		params.Page = page
	}

	// Parse page size
	if sizeStr := query.Get("page_size"); sizeStr != "" {
		size, err := strconv.Atoi(sizeStr)
		if err != nil || size < 1 {
			return nil, fmt.Errorf("invalid page_size parameter")
		}
		if size > MaxPageSize {
			size = MaxPageSize
		}
		params.PageSize = size
	}

	// Parse sort
	if sortBy := query.Get("sort_by"); sortBy != "" {
		params.SortBy = sortBy
	}
	if sortDir := query.Get("sort_dir"); sortDir != "" {
		sortDir = strings.ToLower(sortDir)
		if sortDir != "asc" && sortDir != "desc" {
			return nil, fmt.Errorf("invalid sort_dir parameter: must be 'asc' or 'desc'")
		}
		params.SortDir = sortDir
	}

	// Parse cursor for cursor-based pagination
	if cursor := query.Get("cursor"); cursor != "" {
		params.Cursor = cursor
	}

	// Parse search
	if search := query.Get("search"); search != "" {
		params.Search = search
	}
	if searchFields := query.Get("search_fields"); searchFields != "" {
		params.SearchFields = strings.Split(searchFields, ",")
	}

	// Parse filters (format: filter[field][operator]=value)
	for key, values := range query {
		if strings.HasPrefix(key, "filter[") && strings.HasSuffix(key, "]") {
			// Parse filter[field][operator] format
			inner := key[7 : len(key)-1]
			parts := strings.Split(inner, "][")
			if len(parts) == 2 {
				field := parts[0]
				operator := FilterOperator(parts[1])
				for _, value := range values {
					params.Filters = append(params.Filters, Filter{
						Field:    field,
						Operator: operator,
						Value:    value,
					})
				}
			} else if len(parts) == 1 {
				// Simple filter[field]=value (defaults to eq)
				field := parts[0]
				for _, value := range values {
					params.Filters = append(params.Filters, Filter{
						Field:    field,
						Operator: OpEqual,
						Value:    value,
					})
				}
			}
		}
	}

	return params, nil
}

// Offset calculates the offset for SQL queries
func (p *PageRequest) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// Limit returns the limit for SQL queries
func (p *PageRequest) Limit() int {
	return p.PageSize
}

// NewPageResponse creates a new paginated response
func NewPageResponse(data interface{}, page, pageSize int, totalItems int64) *PageResponse {
	totalPages := int(totalItems) / pageSize
	if int(totalItems)%pageSize > 0 {
		totalPages++
	}

	return &PageResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}

// SQLBuilder helps build SQL queries with pagination and filtering
type SQLBuilder struct {
	baseQuery    string
	countQuery   string
	whereClause  []string
	args         []interface{}
	orderBy      string
	limit        int
	offset       int
	argIndex     int
}

// NewSQLBuilder creates a new SQL builder
func NewSQLBuilder(baseQuery, countQuery string) *SQLBuilder {
	return &SQLBuilder{
		baseQuery:   baseQuery,
		countQuery:  countQuery,
		whereClause: make([]string, 0),
		args:        make([]interface{}, 0),
		argIndex:    1,
	}
}

// AddFilter adds a filter condition
func (b *SQLBuilder) AddFilter(filter Filter, allowedFields map[string]string) error {
	// Validate field is allowed
	dbField, ok := allowedFields[filter.Field]
	if !ok {
		return fmt.Errorf("invalid filter field: %s", filter.Field)
	}

	var condition string
	switch filter.Operator {
	case OpEqual:
		condition = fmt.Sprintf("%s = $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpNotEqual:
		condition = fmt.Sprintf("%s != $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpGreaterThan:
		condition = fmt.Sprintf("%s > $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpGreaterOrEqual:
		condition = fmt.Sprintf("%s >= $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpLessThan:
		condition = fmt.Sprintf("%s < $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpLessOrEqual:
		condition = fmt.Sprintf("%s <= $%d", dbField, b.argIndex)
		b.args = append(b.args, filter.Value)
		b.argIndex++
	case OpContains:
		condition = fmt.Sprintf("%s ILIKE $%d", dbField, b.argIndex)
		b.args = append(b.args, "%"+fmt.Sprint(filter.Value)+"%")
		b.argIndex++
	case OpStartsWith:
		condition = fmt.Sprintf("%s ILIKE $%d", dbField, b.argIndex)
		b.args = append(b.args, fmt.Sprint(filter.Value)+"%")
		b.argIndex++
	case OpEndsWith:
		condition = fmt.Sprintf("%s ILIKE $%d", dbField, b.argIndex)
		b.args = append(b.args, "%"+fmt.Sprint(filter.Value))
		b.argIndex++
	case OpIsNull:
		condition = fmt.Sprintf("%s IS NULL", dbField)
	case OpIsNotNull:
		condition = fmt.Sprintf("%s IS NOT NULL", dbField)
	case OpIn:
		// Handle array values
		if values, ok := filter.Value.([]interface{}); ok {
			placeholders := make([]string, len(values))
			for i, v := range values {
				placeholders[i] = fmt.Sprintf("$%d", b.argIndex)
				b.args = append(b.args, v)
				b.argIndex++
			}
			condition = fmt.Sprintf("%s IN (%s)", dbField, strings.Join(placeholders, ", "))
		} else {
			return fmt.Errorf("IN operator requires array value")
		}
	default:
		return fmt.Errorf("unsupported operator: %s", filter.Operator)
	}

	b.whereClause = append(b.whereClause, condition)
	return nil
}

// AddSearch adds a search condition across multiple fields
func (b *SQLBuilder) AddSearch(search string, searchFields []string, allowedFields map[string]string) {
	if search == "" || len(searchFields) == 0 {
		return
	}

	conditions := make([]string, 0)
	for _, field := range searchFields {
		if dbField, ok := allowedFields[field]; ok {
			conditions = append(conditions, fmt.Sprintf("%s ILIKE $%d", dbField, b.argIndex))
		}
	}

	if len(conditions) > 0 {
		b.whereClause = append(b.whereClause, "("+strings.Join(conditions, " OR ")+")")
		b.args = append(b.args, "%"+search+"%")
		b.argIndex++
	}
}

// SetPagination sets pagination parameters
func (b *SQLBuilder) SetPagination(page, pageSize int) {
	b.limit = pageSize
	b.offset = (page - 1) * pageSize
}

// SetSort sets the sort order
func (b *SQLBuilder) SetSort(sortBy, sortDir string, allowedFields map[string]string) error {
	if sortBy == "" {
		return nil
	}

	dbField, ok := allowedFields[sortBy]
	if !ok {
		return fmt.Errorf("invalid sort field: %s", sortBy)
	}

	dir := "DESC"
	if strings.ToLower(sortDir) == "asc" {
		dir = "ASC"
	}

	b.orderBy = fmt.Sprintf("%s %s", dbField, dir)
	return nil
}

// BuildQuery builds the final SQL query
func (b *SQLBuilder) BuildQuery() (string, []interface{}) {
	query := b.baseQuery

	if len(b.whereClause) > 0 {
		query += " WHERE " + strings.Join(b.whereClause, " AND ")
	}

	if b.orderBy != "" {
		query += " ORDER BY " + b.orderBy
	}

	if b.limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", b.limit)
	}

	if b.offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", b.offset)
	}

	return query, b.args
}

// BuildCountQuery builds the count query
func (b *SQLBuilder) BuildCountQuery() (string, []interface{}) {
	query := b.countQuery

	if len(b.whereClause) > 0 {
		query += " WHERE " + strings.Join(b.whereClause, " AND ")
	}

	return query, b.args
}

// CursorPagination provides cursor-based pagination
type CursorPagination struct {
	Cursor    string
	Limit     int
	Direction string // "next" or "prev"
}

// EncodeCursor encodes pagination cursor
func EncodeCursor(id string, timestamp int64) string {
	return fmt.Sprintf("%s_%d", id, timestamp)
}

// DecodeCursor decodes pagination cursor
func DecodeCursor(cursor string) (id string, timestamp int64, err error) {
	parts := strings.Split(cursor, "_")
	if len(parts) != 2 {
		return "", 0, fmt.Errorf("invalid cursor format")
	}
	id = parts[0]
	timestamp, err = strconv.ParseInt(parts[1], 10, 64)
	return
}

// IndexRecommendation represents a database index recommendation
type IndexRecommendation struct {
	Table       string   `json:"table"`
	Columns     []string `json:"columns"`
	IndexType   string   `json:"index_type"`
	Reason      string   `json:"reason"`
	CreateSQL   string   `json:"create_sql"`
}

// GetRecommendedIndexes returns recommended indexes for common queries
func GetRecommendedIndexes() []IndexRecommendation {
	return []IndexRecommendation{
		{
			Table:     "transactions",
			Columns:   []string{"created_at"},
			IndexType: "btree",
			Reason:    "Frequently sorted and filtered by creation date",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);",
		},
		{
			Table:     "transactions",
			Columns:   []string{"status", "created_at"},
			IndexType: "btree",
			Reason:    "Common filter combination for transaction lists",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);",
		},
		{
			Table:     "transactions",
			Columns:   []string{"sender_id", "created_at"},
			IndexType: "btree",
			Reason:    "Lookup transactions by sender",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_sender ON transactions(sender_id, created_at DESC);",
		},
		{
			Table:     "transactions",
			Columns:   []string{"recipient_id", "created_at"},
			IndexType: "btree",
			Reason:    "Lookup transactions by recipient",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_recipient ON transactions(recipient_id, created_at DESC);",
		},
		{
			Table:     "participants",
			Columns:   []string{"status", "created_at"},
			IndexType: "btree",
			Reason:    "Filter participants by status",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_status ON participants(status, created_at DESC);",
		},
		{
			Table:     "participants",
			Columns:   []string{"kyb_status"},
			IndexType: "btree",
			Reason:    "Filter by KYB status for compliance",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_kyb ON participants(kyb_status);",
		},
		{
			Table:     "audit_logs",
			Columns:   []string{"user_id", "created_at"},
			IndexType: "btree",
			Reason:    "Lookup audit logs by user",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);",
		},
		{
			Table:     "audit_logs",
			Columns:   []string{"action", "created_at"},
			IndexType: "btree",
			Reason:    "Filter audit logs by action type",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);",
		},
		{
			Table:     "audit_logs",
			Columns:   []string{"correlation_id"},
			IndexType: "btree",
			Reason:    "Trace related audit events",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);",
		},
		{
			Table:     "kyc_cases",
			Columns:   []string{"status", "created_at"},
			IndexType: "btree",
			Reason:    "Filter KYC cases by status",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_status ON kyc_cases(status, created_at DESC);",
		},
		{
			Table:     "kyb_cases",
			Columns:   []string{"status", "created_at"},
			IndexType: "btree",
			Reason:    "Filter KYB cases by status",
			CreateSQL: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyb_status ON kyb_cases(status, created_at DESC);",
		},
	}
}
