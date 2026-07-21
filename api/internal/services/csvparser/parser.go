// api/internal/services/csvparser/parser.go
package csvparser

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/finflow/api/internal/db"
	"github.com/finflow/api/internal/models"
)

// dateFormats lists supported date formats for CSV parsing.
var dateFormats = []string{
	"2006-01-02", // YYYY-MM-DD
	"01/02/2006", // MM/DD/YYYY
	"1/2/2006",   // M/D/YYYY
	"02-01-2006", // DD-MM-YYYY
}

// ParseResult contains the outcome of parsing a CSV file.
type ParseResult struct {
	Rows   []db.ParsedRow
	Errors []models.UploadError
}

// Parse reads a CSV file and returns parsed rows and any row-level errors.
// It never panics on bad data — malformed rows are collected as errors.
func Parse(reader io.Reader) (*ParseResult, error) {
	csvReader := csv.NewReader(reader)
	csvReader.TrimLeadingSpace = true
	csvReader.LazyQuotes = true

	// Read header row
	header, err := csvReader.Read()
	if err != nil {
		return nil, fmt.Errorf("reading CSV header: %w", err)
	}

	// Map column names to indices (case-insensitive, order-independent)
	colMap := make(map[string]int)
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	// Validate required columns
	for _, required := range []string{"date", "description", "amount"} {
		if _, ok := colMap[required]; !ok {
			return nil, fmt.Errorf("missing required column: %s", required)
		}
	}

	dateIdx := colMap["date"]
	descIdx := colMap["description"]
	amountIdx := colMap["amount"]
	catIdx, hasCat := colMap["category"]

	result := &ParseResult{}
	rowNum := 1 // 1-indexed (header is row 0)

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		rowNum++

		if err != nil {
			result.Errors = append(result.Errors, models.UploadError{
				Row:    rowNum,
				Reason: fmt.Sprintf("malformed CSV row: %v", err),
			})
			continue
		}

		// Validate date
		dateStr := strings.TrimSpace(record[dateIdx])
		parsedDate, err := parseDate(dateStr)
		if err != nil {
			result.Errors = append(result.Errors, models.UploadError{
				Row:    rowNum,
				Reason: fmt.Sprintf("invalid date: %q", dateStr),
			})
			continue
		}

		// Validate description
		desc := strings.TrimSpace(record[descIdx])
		if desc == "" {
			result.Errors = append(result.Errors, models.UploadError{
				Row:    rowNum,
				Reason: "description is empty",
			})
			continue
		}

		// Validate amount
		amountStr := strings.TrimSpace(record[amountIdx])
		amount, err := parseAmount(amountStr)
		if err != nil {
			result.Errors = append(result.Errors, models.UploadError{
				Row:    rowNum,
				Reason: fmt.Sprintf("invalid amount: %q", amountStr),
			})
			continue
		}

		// Optional category
		var category *string
		if hasCat && catIdx < len(record) {
			cat := strings.TrimSpace(record[catIdx])
			if cat != "" {
				category = &cat
			}
		}

		result.Rows = append(result.Rows, db.ParsedRow{
			Date:        parsedDate,
			Description: desc,
			Amount:      amount,
			Category:    category,
			Source:      "csv",
		})
	}

	return result, nil
}

// parseDate tries all supported formats and returns YYYY-MM-DD string.
func parseDate(s string) (string, error) {
	for _, format := range dateFormats {
		t, err := time.Parse(format, s)
		if err == nil {
			return t.Format("2006-01-02"), nil
		}
	}
	return "", fmt.Errorf("unrecognized date format")
}

// parseAmount strips currency symbols and commas, then parses as float64.
func parseAmount(s string) (float64, error) {
	if s == "" {
		return 0, fmt.Errorf("empty amount")
	}

	// Strip $, commas, spaces
	cleaned := strings.NewReplacer("$", "", ",", "", " ", "").Replace(s)

	amount, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing float: %w", err)
	}

	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return 0, fmt.Errorf("invalid numeric value")
	}

	return amount, nil
}
