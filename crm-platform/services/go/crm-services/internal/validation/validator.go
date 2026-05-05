package validation

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors []ValidationError

func (ve ValidationErrors) Error() string {
	msgs := make([]string, len(ve))
	for i, e := range ve {
		msgs[i] = fmt.Sprintf("%s: %s", e.Field, e.Message)
	}
	return strings.Join(msgs, "; ")
}

func (ve ValidationErrors) HasErrors() bool {
	return len(ve) > 0
}

type CreateCustomerRequest struct {
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	DateOfBirth string `json:"date_of_birth"`
	Gender      string `json:"gender"`
	City        string `json:"city"`
	State       string `json:"state"`
	Country     string `json:"country"`
	Segment     string `json:"segment"`
}

func (r *CreateCustomerRequest) Validate() ValidationErrors {
	var errs ValidationErrors

	r.FirstName = sanitize(r.FirstName)
	r.LastName = sanitize(r.LastName)
	r.Email = strings.TrimSpace(strings.ToLower(r.Email))
	r.Phone = strings.TrimSpace(r.Phone)

	if r.FirstName == "" {
		errs = append(errs, ValidationError{"first_name", "is required"})
	} else if utf8.RuneCountInString(r.FirstName) > 100 {
		errs = append(errs, ValidationError{"first_name", "must be 100 characters or less"})
	}

	if r.LastName == "" {
		errs = append(errs, ValidationError{"last_name", "is required"})
	} else if utf8.RuneCountInString(r.LastName) > 100 {
		errs = append(errs, ValidationError{"last_name", "must be 100 characters or less"})
	}

	if r.Email != "" {
		if _, err := mail.ParseAddress(r.Email); err != nil {
			errs = append(errs, ValidationError{"email", "is not a valid email address"})
		}
	}

	if r.Phone != "" && !isValidPhone(r.Phone) {
		errs = append(errs, ValidationError{"phone", "is not a valid phone number"})
	}

	validSegments := map[string]bool{"vip": true, "premium": true, "standard": true, "basic": true, "dormant": true}
	if r.Segment != "" && !validSegments[r.Segment] {
		errs = append(errs, ValidationError{"segment", "must be one of: vip, premium, standard, basic, dormant"})
	}

	validGenders := map[string]bool{"male": true, "female": true, "other": true, "": true}
	if !validGenders[r.Gender] {
		errs = append(errs, ValidationError{"gender", "must be one of: male, female, other"})
	}

	return errs
}

type CreateCampaignRequest struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	Type           string  `json:"type"`
	TargetSegment  string  `json:"target_segment"`
	BudgetAmount   float64 `json:"budget_amount"`
	BudgetCurrency string  `json:"budget_currency"`
}

func (r *CreateCampaignRequest) Validate() ValidationErrors {
	var errs ValidationErrors

	r.Name = sanitize(r.Name)

	if r.Name == "" {
		errs = append(errs, ValidationError{"name", "is required"})
	} else if utf8.RuneCountInString(r.Name) > 255 {
		errs = append(errs, ValidationError{"name", "must be 255 characters or less"})
	}

	validTypes := map[string]bool{"email": true, "sms": true, "push": true, "whatsapp": true, "in_app": true, "multi_channel": true}
	if r.Type != "" && !validTypes[r.Type] {
		errs = append(errs, ValidationError{"type", "must be one of: email, sms, push, whatsapp, in_app, multi_channel"})
	}

	if r.BudgetAmount < 0 {
		errs = append(errs, ValidationError{"budget_amount", "must be non-negative"})
	}

	return errs
}

type PaginationParams struct {
	Page     int    `form:"page" json:"page"`
	PageSize int    `form:"page_size" json:"page_size"`
	SortBy   string `form:"sort_by" json:"sort_by"`
	SortDir  string `form:"sort_dir" json:"sort_dir"`
}

func (p *PaginationParams) Normalize() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 25
	}
	if p.SortDir != "asc" && p.SortDir != "desc" {
		p.SortDir = "desc"
	}
	allowedSorts := map[string]bool{
		"created_at": true, "updated_at": true, "first_name": true,
		"last_name": true, "email": true, "status": true, "lifetime_value": true,
	}
	if !allowedSorts[p.SortBy] {
		p.SortBy = "created_at"
	}
}

var phoneRegex = regexp.MustCompile(`^\+?[0-9\s\-()]{7,20}$`)

func isValidPhone(phone string) bool {
	return phoneRegex.MatchString(phone)
}

var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)

func sanitize(s string) string {
	s = strings.TrimSpace(s)
	s = htmlTagRegex.ReplaceAllString(s, "")
	return s
}
