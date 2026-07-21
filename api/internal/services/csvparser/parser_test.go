package csvparser

import (
	"strings"
	"testing"
)

func TestParse_ValidCSV(t *testing.T) {
	csv := `date,description,amount,category
2024-01-15,Client Payment,5000.00,Revenue
2024-01-16,Office Supplies,-125.50,Office
2024-01-17,Payroll,-4200.00,Payroll`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("expected 3 rows, got %d", len(result.Rows))
	}
	if len(result.Errors) != 0 {
		t.Fatalf("expected 0 errors, got %d", len(result.Errors))
	}
	if result.Rows[0].Description != "Client Payment" {
		t.Errorf("description = %q", result.Rows[0].Description)
	}
	if result.Rows[0].Amount != 5000.00 {
		t.Errorf("amount = %f, want 5000.00", result.Rows[0].Amount)
	}
	if result.Rows[0].Category == nil || *result.Rows[0].Category != "Revenue" {
		t.Errorf("category = %v, want Revenue", result.Rows[0].Category)
	}
}

func TestParse_MissingRequiredColumn(t *testing.T) {
	csv := `date,amount
2024-01-15,5000.00`

	_, err := Parse(strings.NewReader(csv))
	if err == nil {
		t.Fatal("expected error for missing description column")
	}
	if !strings.Contains(err.Error(), "missing required column") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestParse_EmptyFile(t *testing.T) {
	_, err := Parse(strings.NewReader(""))
	if err == nil {
		t.Fatal("expected error for empty file")
	}
}

func TestParse_InvalidDate(t *testing.T) {
	csv := `date,description,amount
not-a-date,Test,-100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Errors) == 0 {
		t.Fatal("expected error for invalid date")
	}
	if len(result.Rows) != 0 {
		t.Fatal("expected 0 parsed rows")
	}
}

func TestParse_EmptyDescription(t *testing.T) {
	csv := `date,description,amount
2024-01-15,,-100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Errors) == 0 {
		t.Fatal("expected error for empty description")
	}
}

func TestParse_InvalidAmount(t *testing.T) {
	csv := `date,description,amount
2024-01-15,Test,not-a-number`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Errors) == 0 {
		t.Fatal("expected error for invalid amount")
	}
}

func TestParse_DollarSignAmount(t *testing.T) {
	csv := `date,description,amount
2024-01-15,Revenue,"$5,000.00"`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
	if result.Rows[0].Amount != 5000.00 {
		t.Errorf("amount = %f, want 5000.00", result.Rows[0].Amount)
	}
}

func TestParse_USDateFormat(t *testing.T) {
	csv := `date,description,amount
01/15/2024,Test,-100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
	if result.Rows[0].Date != "2024-01-15" {
		t.Errorf("date = %q, want 2024-01-15", result.Rows[0].Date)
	}
}

func TestParse_CaseInsensitiveHeaders(t *testing.T) {
	csv := `DATE,DESCRIPTION,AMOUNT
2024-01-15,Test,-100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
}

func TestParse_NoCategoryColumn(t *testing.T) {
	csv := `date,description,amount
2024-01-15,Test,-100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
	if result.Rows[0].Category != nil {
		t.Errorf("expected nil category, got %v", result.Rows[0].Category)
	}
}

func TestParse_MixedValidAndInvalid(t *testing.T) {
	csv := `date,description,amount
2024-01-15,Good Row,-100.00
bad-date,Bad Row,-200.00
2024-01-17,Another Good,-300.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Errorf("expected 2 valid rows, got %d", len(result.Rows))
	}
	if len(result.Errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(result.Errors))
	}
}

func TestParse_SourceField(t *testing.T) {
	csv := `date,description,amount
2024-01-15,Payment,100.00`

	result, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Rows[0].Source != "csv" {
		t.Errorf("source = %q, want csv", result.Rows[0].Source)
	}
}

func TestParse_LazyQuotes(t *testing.T) {
	csv := `date,description,amount
2024-01-15,"Description with ""quotes""",-100.00`

	_, err := Parse(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
