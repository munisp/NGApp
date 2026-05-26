package export

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

type ExportColumn struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Width int    `json:"width,omitempty"`
}

type ExportOptions struct {
	Filename string                   `json:"filename"`
	Columns  []ExportColumn           `json:"columns"`
	Data     []map[string]interface{} `json:"data"`
	Title    string                   `json:"title,omitempty"`
	Subtitle string                   `json:"subtitle,omitempty"`
}

type ExportService struct{}

func NewExportService() *ExportService {
	return &ExportService{}
}

func (s *ExportService) ExportToCSV(options *ExportOptions) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := make([]string, len(options.Columns))
	for i, col := range options.Columns {
		headers[i] = col.Label
	}
	if err := writer.Write(headers); err != nil {
		return nil, fmt.Errorf("failed to write headers: %w", err)
	}

	for _, row := range options.Data {
		record := make([]string, len(options.Columns))
		for i, col := range options.Columns {
			record[i] = s.formatValue(row[col.Key])
		}
		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("csv writer error: %w", err)
	}

	return buf.Bytes(), nil
}

func (s *ExportService) ExportToJSON(options *ExportOptions) ([]byte, error) {
	exportData := struct {
		Title     string                   `json:"title,omitempty"`
		Subtitle  string                   `json:"subtitle,omitempty"`
		Generated string                   `json:"generated"`
		Count     int                      `json:"count"`
		Columns   []ExportColumn           `json:"columns"`
		Data      []map[string]interface{} `json:"data"`
	}{
		Title:     options.Title,
		Subtitle:  options.Subtitle,
		Generated: time.Now().Format(time.RFC3339),
		Count:     len(options.Data),
		Columns:   options.Columns,
		Data:      options.Data,
	}

	return json.MarshalIndent(exportData, "", "  ")
}

func (s *ExportService) ExportToTSV(options *ExportOptions) ([]byte, error) {
	var buf bytes.Buffer

	headers := make([]string, len(options.Columns))
	for i, col := range options.Columns {
		headers[i] = col.Label
	}
	buf.WriteString(strings.Join(headers, "\t") + "\n")

	for _, row := range options.Data {
		values := make([]string, len(options.Columns))
		for i, col := range options.Columns {
			values[i] = s.formatValue(row[col.Key])
		}
		buf.WriteString(strings.Join(values, "\t") + "\n")
	}

	return buf.Bytes(), nil
}

func (s *ExportService) formatValue(value interface{}) string {
	if value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return v
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		return strconv.FormatFloat(v, 'f', 2, 64)
	case bool:
		if v {
			return "Yes"
		}
		return "No"
	case time.Time:
		return v.Format("2006-01-02 15:04:05")
	default:
		jsonBytes, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(jsonBytes)
	}
}

func GetRemittanceExportColumns() []ExportColumn {
	return []ExportColumn{
		{Key: "id", Label: "Transaction ID", Width: 20},
		{Key: "status", Label: "Status", Width: 15},
		{Key: "fromCurrency", Label: "From Currency", Width: 12},
		{Key: "fromAmount", Label: "From Amount", Width: 15},
		{Key: "toCurrency", Label: "To Currency", Width: 12},
		{Key: "toAmount", Label: "To Amount", Width: 15},
		{Key: "exchangeRate", Label: "Exchange Rate", Width: 15},
		{Key: "fee", Label: "Fee", Width: 12},
		{Key: "deliveryMethod", Label: "Delivery Method", Width: 18},
		{Key: "recipientName", Label: "Recipient Name", Width: 20},
		{Key: "recipientPhone", Label: "Recipient Phone", Width: 18},
		{Key: "createdAt", Label: "Created At", Width: 20},
		{Key: "completedAt", Label: "Completed At", Width: 20},
	}
}

func GetRateAlertExportColumns() []ExportColumn {
	return []ExportColumn{
		{Key: "id", Label: "Alert ID", Width: 15},
		{Key: "fromCurrency", Label: "From Currency", Width: 12},
		{Key: "toCurrency", Label: "To Currency", Width: 12},
		{Key: "targetRate", Label: "Target Rate", Width: 15},
		{Key: "condition", Label: "Condition", Width: 12},
		{Key: "status", Label: "Status", Width: 12},
		{Key: "isActive", Label: "Active", Width: 10},
		{Key: "notifyEmail", Label: "Email", Width: 10},
		{Key: "notifySms", Label: "SMS", Width: 10},
		{Key: "notifyPush", Label: "Push", Width: 10},
		{Key: "triggeredAt", Label: "Triggered At", Width: 20},
		{Key: "triggeredRate", Label: "Triggered Rate", Width: 15},
		{Key: "createdAt", Label: "Created At", Width: 20},
	}
}

func FormatRemittanceForExport(remittances []map[string]interface{}) []map[string]interface{} {
	result := make([]map[string]interface{}, len(remittances))
	for i, r := range remittances {
		result[i] = map[string]interface{}{
			"id":             r["id"],
			"status":         r["status"],
			"fromCurrency":   r["fromCurrency"],
			"fromAmount":     r["fromAmount"],
			"toCurrency":     r["toCurrency"],
			"toAmount":       r["toAmount"],
			"exchangeRate":   r["exchangeRate"],
			"fee":            r["fee"],
			"deliveryMethod": r["deliveryMethod"],
			"recipientName":  r["recipientName"],
			"recipientPhone": r["recipientPhone"],
			"createdAt":      r["createdAt"],
			"completedAt":    r["completedAt"],
		}
	}
	return result
}

func FormatRateAlertsForExport(alerts []map[string]interface{}) []map[string]interface{} {
	result := make([]map[string]interface{}, len(alerts))
	for i, a := range alerts {
		isActive := "No"
		if active, ok := a["isActive"].(bool); ok && active {
			isActive = "Yes"
		}
		notifyEmail := "No"
		if email, ok := a["notifyEmail"].(bool); ok && email {
			notifyEmail = "Yes"
		}
		notifySms := "No"
		if sms, ok := a["notifySms"].(bool); ok && sms {
			notifySms = "Yes"
		}
		notifyPush := "No"
		if push, ok := a["notifyPush"].(bool); ok && push {
			notifyPush = "Yes"
		}

		result[i] = map[string]interface{}{
			"id":            a["id"],
			"fromCurrency":  a["fromCurrency"],
			"toCurrency":    a["toCurrency"],
			"targetRate":    a["targetRate"],
			"condition":     a["condition"],
			"status":        a["status"],
			"isActive":      isActive,
			"notifyEmail":   notifyEmail,
			"notifySms":     notifySms,
			"notifyPush":    notifyPush,
			"triggeredAt":   a["triggeredAt"],
			"triggeredRate": a["triggeredRate"],
			"createdAt":     a["createdAt"],
		}
	}
	return result
}

func GetTransactionExportColumns() []ExportColumn {
	return []ExportColumn{
		{Key: "id", Label: "Transaction ID", Width: 20},
		{Key: "type", Label: "Type", Width: 15},
		{Key: "status", Label: "Status", Width: 12},
		{Key: "amount", Label: "Amount", Width: 15},
		{Key: "currency", Label: "Currency", Width: 10},
		{Key: "fee", Label: "Fee", Width: 12},
		{Key: "description", Label: "Description", Width: 30},
		{Key: "createdAt", Label: "Created At", Width: 20},
	}
}

func GetAccountExportColumns() []ExportColumn {
	return []ExportColumn{
		{Key: "id", Label: "Account ID", Width: 15},
		{Key: "name", Label: "Account Name", Width: 25},
		{Key: "type", Label: "Type", Width: 15},
		{Key: "balance", Label: "Balance", Width: 15},
		{Key: "currency", Label: "Currency", Width: 10},
		{Key: "status", Label: "Status", Width: 12},
		{Key: "createdAt", Label: "Created At", Width: 20},
	}
}
