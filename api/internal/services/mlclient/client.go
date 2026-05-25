// api/internal/services/mlclient/client.go
package mlclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finflow/api/internal/models"
)

// Client communicates with the Python ML service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new ML service client.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Classify sends transaction descriptions to the ML service for categorization.
func (c *Client) Classify(ctx context.Context, descriptions []string) ([]string, error) {
	reqBody := models.ClassifyRequest{Descriptions: descriptions}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling classify request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/classify", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("creating classify request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling ml-service /classify: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ml-service /classify returned %d: %s", resp.StatusCode, string(body))
	}

	var result models.ClassifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding classify response: %w", err)
	}

	return result.Categories, nil
}

// Forecast sends transaction data to the ML service for cash flow forecasting.
func (c *Client) Forecast(ctx context.Context, transactions []models.ForecastTransaction, horizonDays int) (*models.ForecastResponse, error) {
	reqBody := models.ForecastRequest{
		Transactions: transactions,
		HorizonDays:  horizonDays,
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling forecast request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/forecast", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("creating forecast request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling ml-service /forecast: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ml-service /forecast returned %d: %s", resp.StatusCode, string(body))
	}

	var result models.ForecastResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding forecast response: %w", err)
	}

	return &result, nil
}

// Health checks if the ML service is alive.
func (c *Client) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("creating health request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling ml-service /health: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ml-service unhealthy: status %d", resp.StatusCode)
	}
	return nil
}
