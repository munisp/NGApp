package validation

import (
	"testing"
)

func TestCreateCustomerRequest_Validate(t *testing.T) {
	tests := []struct {
		name       string
		req        CreateCustomerRequest
		wantErrors int
		wantFields []string
	}{
		{
			name:       "valid minimal request",
			req:        CreateCustomerRequest{FirstName: "Chinedu", LastName: "Okafor"},
			wantErrors: 0,
		},
		{
			name:       "valid full request",
			req:        CreateCustomerRequest{FirstName: "Amina", LastName: "Ibrahim", Email: "amina@bank.com", Phone: "+2348012345678", Segment: "vip"},
			wantErrors: 0,
		},
		{
			name:       "missing first name",
			req:        CreateCustomerRequest{LastName: "Okafor"},
			wantErrors: 1,
			wantFields: []string{"first_name"},
		},
		{
			name:       "missing both names",
			req:        CreateCustomerRequest{},
			wantErrors: 2,
			wantFields: []string{"first_name", "last_name"},
		},
		{
			name:       "invalid email",
			req:        CreateCustomerRequest{FirstName: "Test", LastName: "User", Email: "not-an-email"},
			wantErrors: 1,
			wantFields: []string{"email"},
		},
		{
			name:       "invalid phone",
			req:        CreateCustomerRequest{FirstName: "Test", LastName: "User", Phone: "abc"},
			wantErrors: 1,
			wantFields: []string{"phone"},
		},
		{
			name:       "invalid segment",
			req:        CreateCustomerRequest{FirstName: "Test", LastName: "User", Segment: "invalid"},
			wantErrors: 1,
			wantFields: []string{"segment"},
		},
		{
			name:       "strips HTML tags",
			req:        CreateCustomerRequest{FirstName: "<script>alert('xss')</script>John", LastName: "Doe"},
			wantErrors: 0,
		},
		{
			name:       "valid Nigerian phone",
			req:        CreateCustomerRequest{FirstName: "Test", LastName: "User", Phone: "+234 801 234 5678"},
			wantErrors: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := tt.req.Validate()
			if len(errs) != tt.wantErrors {
				t.Errorf("got %d errors, want %d: %v", len(errs), tt.wantErrors, errs)
			}
			for _, field := range tt.wantFields {
				found := false
				for _, e := range errs {
					if e.Field == field {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected error on field %q, not found in: %v", field, errs)
				}
			}
		})
	}
}

func TestCreateCampaignRequest_Validate(t *testing.T) {
	tests := []struct {
		name       string
		req        CreateCampaignRequest
		wantErrors int
	}{
		{
			name:       "valid campaign",
			req:        CreateCampaignRequest{Name: "Q4 Push", Type: "email", BudgetAmount: 1000000},
			wantErrors: 0,
		},
		{
			name:       "missing name",
			req:        CreateCampaignRequest{Type: "sms"},
			wantErrors: 1,
		},
		{
			name:       "invalid type",
			req:        CreateCampaignRequest{Name: "Test", Type: "fax"},
			wantErrors: 1,
		},
		{
			name:       "negative budget",
			req:        CreateCampaignRequest{Name: "Test", BudgetAmount: -500},
			wantErrors: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := tt.req.Validate()
			if len(errs) != tt.wantErrors {
				t.Errorf("got %d errors, want %d: %v", len(errs), tt.wantErrors, errs)
			}
		})
	}
}

func TestPaginationParams_Normalize(t *testing.T) {
	tests := []struct {
		name    string
		input   PaginationParams
		want    PaginationParams
	}{
		{
			name:  "defaults",
			input: PaginationParams{},
			want:  PaginationParams{Page: 1, PageSize: 25, SortBy: "created_at", SortDir: "desc"},
		},
		{
			name:  "valid values preserved",
			input: PaginationParams{Page: 3, PageSize: 50, SortBy: "email", SortDir: "asc"},
			want:  PaginationParams{Page: 3, PageSize: 50, SortBy: "email", SortDir: "asc"},
		},
		{
			name:  "negative page",
			input: PaginationParams{Page: -1, PageSize: 10},
			want:  PaginationParams{Page: 1, PageSize: 10, SortBy: "created_at", SortDir: "desc"},
		},
		{
			name:  "oversized page size",
			input: PaginationParams{Page: 1, PageSize: 500},
			want:  PaginationParams{Page: 1, PageSize: 25, SortBy: "created_at", SortDir: "desc"},
		},
		{
			name:  "invalid sort column",
			input: PaginationParams{Page: 1, PageSize: 10, SortBy: "drop_table"},
			want:  PaginationParams{Page: 1, PageSize: 10, SortBy: "created_at", SortDir: "desc"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.input.Normalize()
			if tt.input.Page != tt.want.Page || tt.input.PageSize != tt.want.PageSize ||
				tt.input.SortBy != tt.want.SortBy || tt.input.SortDir != tt.want.SortDir {
				t.Errorf("got %+v, want %+v", tt.input, tt.want)
			}
		})
	}
}

func TestSanitize(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"  hello  ", "hello"},
		{"<script>alert('xss')</script>John", "alert('xss')John"},
		{"<b>bold</b> text", "bold text"},
		{"normal text", "normal text"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := sanitize(tt.input)
			if got != tt.want {
				t.Errorf("sanitize(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
