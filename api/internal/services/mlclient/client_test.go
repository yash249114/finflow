package mlclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finflow/api/internal/models"
)

func TestNewClient(t *testing.T) {
	c := NewClient("http://localhost:8001", "secret-key")
	if c.baseURL != "http://localhost:8001" {
		t.Errorf("expected baseURL http://localhost:8001, got %s", c.baseURL)
	}
	if c.apiKey != "secret-key" {
		t.Errorf("expected apiKey secret-key, got %s", c.apiKey)
	}
	if c.httpClient == nil {
		t.Error("expected httpClient to be non-nil")
	}
}

func TestAuthHeaders_WithKey(t *testing.T) {
	c := NewClient("http://localhost", "my-key")
	h := c.authHeaders()
	if h.Get("Authorization") != "Bearer my-key" {
		t.Errorf("expected Bearer my-key, got %s", h.Get("Authorization"))
	}
	if h.Get("Content-Type") != "application/json" {
		t.Errorf("expected application/json, got %s", h.Get("Content-Type"))
	}
}

func TestAuthHeaders_WithoutKey(t *testing.T) {
	c := NewClient("http://localhost", "")
	h := c.authHeaders()
	if h.Get("Authorization") != "" {
		t.Errorf("expected empty Authorization, got %s", h.Get("Authorization"))
	}
}

func TestClassify_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/classify" {
			t.Errorf("expected /classify, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("expected Bearer test-key, got %s", r.Header.Get("Authorization"))
		}

		var req models.ClassifyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		if len(req.Descriptions) != 2 {
			t.Fatalf("expected 2 descriptions, got %d", len(req.Descriptions))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.ClassifyResponse{
			Categories: []string{"Infrastructure", "Marketing"},
		})
	}))
	defer server.Close()

	c := NewClient(server.URL, "test-key")
	cats, err := c.Classify(context.Background(), []string{"AWS Bill", "Facebook Ads"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cats) != 2 {
		t.Fatalf("expected 2 categories, got %d", len(cats))
	}
	if cats[0] != "Infrastructure" {
		t.Errorf("expected Infrastructure, got %s", cats[0])
	}
	if cats[1] != "Marketing" {
		t.Errorf("expected Marketing, got %s", cats[1])
	}
}

func TestClassify_EmptyDescriptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.ClassifyResponse{Categories: []string{}})
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	cats, err := c.Classify(context.Background(), []string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cats) != 0 {
		t.Errorf("expected 0 categories, got %d", len(cats))
	}
}

func TestClassify_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("model not loaded"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	_, err := c.Classify(context.Background(), []string{"test"})
	if err == nil {
		t.Fatal("expected error for server error response")
	}
}

func TestClassify_403Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("Invalid API key"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "wrong-key")
	_, err := c.Classify(context.Background(), []string{"test"})
	if err == nil {
		t.Fatal("expected error for 403 response")
	}
}

func TestClassify_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	_, err := c.Classify(context.Background(), []string{"test"})
	if err == nil {
		t.Fatal("expected error for invalid JSON response")
	}
}

func TestForecast_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/forecast" {
			t.Errorf("expected /forecast, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.ForecastResponse{
			Forecast: []models.ForecastPoint{
				{Date: "2026-02-01", Predicted: 5000, Lower: 4000, Upper: 6000},
			},
			Summary: models.ForecastSummary{
				ExpectedNet: 5000,
				Trend:       "up",
				Confidence:  "high",
			},
		})
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	txs := []models.ForecastTransaction{
		{Date: "2026-01-01", Amount: 5000},
	}
	resp, err := c.Forecast(context.Background(), txs, 30)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Forecast) != 1 {
		t.Fatalf("expected 1 forecast point, got %d", len(resp.Forecast))
	}
	if resp.Forecast[0].Predicted != 5000 {
		t.Errorf("expected predicted 5000, got %f", resp.Forecast[0].Predicted)
	}
	if resp.Summary.Trend != "up" {
		t.Errorf("expected trend up, got %s", resp.Summary.Trend)
	}
}

func TestForecast_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("forecast failed"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	_, err := c.Forecast(context.Background(), []models.ForecastTransaction{{Date: "2026-01-01", Amount: 100}}, 30)
	if err == nil {
		t.Fatal("expected error for server error")
	}
}

func TestForecast_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{broken"))
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	_, err := c.Forecast(context.Background(), []models.ForecastTransaction{{Date: "2026-01-01", Amount: 100}}, 30)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestHealth_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("expected /health, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestHealth_Unhealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	c := NewClient(server.URL, "key")
	err := c.Health(context.Background())
	if err == nil {
		t.Fatal("expected error for unhealthy response")
	}
}

func TestHealth_ConnectionRefused(t *testing.T) {
	c := NewClient("http://localhost:1", "key")
	err := c.Health(context.Background())
	if err == nil {
		t.Fatal("expected error for connection refused")
	}
}
