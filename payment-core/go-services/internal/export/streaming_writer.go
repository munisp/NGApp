// Package export provides streaming export generation for large datasets.
// Generates CSV, Excel, and PDF without loading entire datasets into memory.
package export

import (
	"bufio"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"sync/atomic"
	"time"
)

// ExportFormat represents the output format
type ExportFormat int

const (
	FormatCSV ExportFormat = iota
	FormatExcel
	FormatPDF
	FormatJSON
)

// ExportConfig configures the export job
type ExportConfig struct {
	Format     ExportFormat
	OutputPath string
	BatchSize  int
	MaxRows    int64
	Columns    []ColumnDef
	Filters    map[string]string
	DateRange  *DateRange
	Timezone   string
}

// ColumnDef defines an export column
type ColumnDef struct {
	Name   string
	Header string
	Type   string // string, number, date, currency
	Format string // date format, number format
	Width  int    // column width for Excel
}

// DateRange for filtering
type DateRange struct {
	Start time.Time
	End   time.Time
}

// DataSource provides paginated data access
type DataSource interface {
	FetchPage(ctx context.Context, offset int64, limit int) ([]map[string]interface{}, error)
	TotalCount(ctx context.Context) (int64, error)
}

// ExportResult contains the outcome of an export job
type ExportResult struct {
	FilePath   string
	FileSize   int64
	TotalRows  int64
	Duration   time.Duration
	RowsPerSec float64
	Format     ExportFormat
	Error      string
}

// StreamingExporter generates exports with constant memory usage
type StreamingExporter struct {
	config      ExportConfig
	source      DataSource
	rowsWritten int64
}

// NewStreamingExporter creates a new exporter
func NewStreamingExporter(config ExportConfig, source DataSource) *StreamingExporter {
	if config.BatchSize == 0 {
		config.BatchSize = 5000
	}
	return &StreamingExporter{
		config: config,
		source: source,
	}
}

// Export runs the streaming export
func (e *StreamingExporter) Export(ctx context.Context) (*ExportResult, error) {
	start := time.Now()
	result := &ExportResult{
		FilePath: e.config.OutputPath,
		Format:   e.config.Format,
	}

	switch e.config.Format {
	case FormatCSV:
		err := e.exportCSV(ctx)
		if err != nil {
			result.Error = err.Error()
			return result, err
		}
	case FormatJSON:
		err := e.exportJSON(ctx)
		if err != nil {
			result.Error = err.Error()
			return result, err
		}
	default:
		return nil, fmt.Errorf("unsupported format: %d", e.config.Format)
	}

	// Get file size
	if info, err := os.Stat(e.config.OutputPath); err == nil {
		result.FileSize = info.Size()
	}

	result.TotalRows = atomic.LoadInt64(&e.rowsWritten)
	result.Duration = time.Since(start)
	if result.Duration.Seconds() > 0 {
		result.RowsPerSec = float64(result.TotalRows) / result.Duration.Seconds()
	}

	return result, nil
}

// exportCSV streams records to CSV format
func (e *StreamingExporter) exportCSV(ctx context.Context) error {
	file, err := os.Create(e.config.OutputPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()

	// Use buffered writer for performance (64KB buffer)
	bw := bufio.NewWriterSize(file, 65536)
	defer bw.Flush()

	writer := csv.NewWriter(bw)
	defer writer.Flush()

	// Write header row
	headers := make([]string, len(e.config.Columns))
	for i, col := range e.config.Columns {
		headers[i] = col.Header
	}
	if err := writer.Write(headers); err != nil {
		return fmt.Errorf("write header: %w", err)
	}

	// Stream data in batches
	var offset int64
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Check row limit
		if e.config.MaxRows > 0 && atomic.LoadInt64(&e.rowsWritten) >= e.config.MaxRows {
			break
		}

		// Fetch next batch
		rows, err := e.source.FetchPage(ctx, offset, e.config.BatchSize)
		if err != nil {
			return fmt.Errorf("fetch page at offset %d: %w", offset, err)
		}
		if len(rows) == 0 {
			break
		}

		// Write batch
		for _, row := range rows {
			record := make([]string, len(e.config.Columns))
			for i, col := range e.config.Columns {
				record[i] = e.formatValue(row[col.Name], col)
			}
			if err := writer.Write(record); err != nil {
				return fmt.Errorf("write row: %w", err)
			}
			atomic.AddInt64(&e.rowsWritten, 1)
		}

		// Flush periodically to avoid memory buildup
		writer.Flush()
		if err := writer.Error(); err != nil {
			return fmt.Errorf("csv flush: %w", err)
		}

		offset += int64(len(rows))
	}

	return nil
}

// exportJSON streams records to JSON Lines format
func (e *StreamingExporter) exportJSON(ctx context.Context) error {
	file, err := os.Create(e.config.OutputPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()

	bw := bufio.NewWriterSize(file, 65536)
	defer bw.Flush()

	var offset int64
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if e.config.MaxRows > 0 && atomic.LoadInt64(&e.rowsWritten) >= e.config.MaxRows {
			break
		}

		rows, err := e.source.FetchPage(ctx, offset, e.config.BatchSize)
		if err != nil {
			return fmt.Errorf("fetch page at offset %d: %w", offset, err)
		}
		if len(rows) == 0 {
			break
		}

		for _, row := range rows {
			line := e.rowToJSON(row)
			bw.WriteString(line)
			bw.WriteByte('\n')
			atomic.AddInt64(&e.rowsWritten, 1)
		}

		offset += int64(len(rows))
	}

	return nil
}

// formatValue converts a value to string based on column type
func (e *StreamingExporter) formatValue(val interface{}, col ColumnDef) string {
	if val == nil {
		return ""
	}

	switch col.Type {
	case "number":
		switch v := val.(type) {
		case float64:
			return strconv.FormatFloat(v, 'f', 2, 64)
		case int64:
			return strconv.FormatInt(v, 10)
		case int:
			return strconv.Itoa(v)
		default:
			return fmt.Sprintf("%v", val)
		}
	case "currency":
		switch v := val.(type) {
		case float64:
			return strconv.FormatFloat(v/100, 'f', 2, 64) // Convert from smallest unit
		case int64:
			return strconv.FormatFloat(float64(v)/100, 'f', 2, 64)
		default:
			return fmt.Sprintf("%v", val)
		}
	case "date":
		switch v := val.(type) {
		case time.Time:
			format := col.Format
			if format == "" {
				format = "2006-01-02 15:04:05"
			}
			return v.Format(format)
		case string:
			return v
		default:
			return fmt.Sprintf("%v", val)
		}
	default:
		return fmt.Sprintf("%v", val)
	}
}

// rowToJSON serializes a row to minimal JSON (avoids encoding/json overhead)
func (e *StreamingExporter) rowToJSON(row map[string]interface{}) string {
	// Manual JSON construction for performance
	buf := make([]byte, 0, 512)
	buf = append(buf, '{')
	first := true
	for _, col := range e.config.Columns {
		val := row[col.Name]
		if val == nil {
			continue
		}
		if !first {
			buf = append(buf, ',')
		}
		first = false
		buf = append(buf, '"')
		buf = append(buf, col.Name...)
		buf = append(buf, '"', ':')
		buf = appendJSONValue(buf, val)
	}
	buf = append(buf, '}')
	return string(buf)
}

func appendJSONValue(buf []byte, val interface{}) []byte {
	switch v := val.(type) {
	case string:
		buf = append(buf, '"')
		buf = appendEscapedString(buf, v)
		buf = append(buf, '"')
	case float64:
		buf = strconv.AppendFloat(buf, v, 'f', -1, 64)
	case int64:
		buf = strconv.AppendInt(buf, v, 10)
	case int:
		buf = strconv.AppendInt(buf, int64(v), 10)
	case bool:
		buf = strconv.AppendBool(buf, v)
	default:
		buf = append(buf, '"')
		buf = append(buf, fmt.Sprintf("%v", val)...)
		buf = append(buf, '"')
	}
	return buf
}

func appendEscapedString(buf []byte, s string) []byte {
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '"':
			buf = append(buf, '\\', '"')
		case '\\':
			buf = append(buf, '\\', '\\')
		case '\n':
			buf = append(buf, '\\', 'n')
		case '\r':
			buf = append(buf, '\\', 'r')
		case '\t':
			buf = append(buf, '\\', 't')
		default:
			buf = append(buf, s[i])
		}
	}
	return buf
}

// ProgressCallback reports export progress
type ProgressCallback func(written int64, total int64)

// StreamCopy is a utility for streaming large file copies with progress
func StreamCopy(ctx context.Context, dst io.Writer, src io.Reader, bufSize int, progress ProgressCallback) (int64, error) {
	buf := make([]byte, bufSize)
	var total int64

	for {
		select {
		case <-ctx.Done():
			return total, ctx.Err()
		default:
		}

		n, err := src.Read(buf)
		if n > 0 {
			written, werr := dst.Write(buf[:n])
			total += int64(written)
			if progress != nil {
				progress(total, -1)
			}
			if werr != nil {
				return total, werr
			}
		}
		if err == io.EOF {
			return total, nil
		}
		if err != nil {
			return total, err
		}
	}
}
