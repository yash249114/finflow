// api/internal/aiops/copilot.go
package aiops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"
)

// ChatRequest is the inbound copilot message.
type ChatRequest struct {
	Message string `json:"message"`
	Plan    string `json:"plan"` // free | pro | max
	UserID  string `json:"user_id"`
	History []ChatTurn `json:"history,omitempty"`
}

// ChatTurn is a prior exchange.
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse is the copilot reply.
type ChatResponse struct {
	Reply               string  `json:"reply"`
	Confidence          float64 `json:"confidence"` // 0-1
	Provider            string  `json:"provider"`   // free | openai | anthropic | gemini
	NeedsTicket         bool    `json:"needs_ticket"`
	TicketReason        string  `json:"ticket_reason,omitempty"`
}

// Copilot routes chat by plan tier to the appropriate model.
type Copilot struct {
	openAIKey    string
	anthropicKey string
	geminiKey    string
}

// NewCopilot builds a tiered copilot router.
func NewCopilot(openAIKey, anthropicKey, geminiKey string) *Copilot {
	return &Copilot{openAIKey: openAIKey, anthropicKey: anthropicKey, geminiKey: geminiKey}
}

// Respond handles a chat turn, applying the tier routing and confidence scoring.
func (c *Copilot) Respond(ctx context.Context, req ChatRequest) ChatResponse {
	plan := strings.ToLower(strings.TrimSpace(req.Plan))
	if plan == "" {
		plan = "free"
	}

	switch plan {
	case "max":
		if r := c.tryMax(ctx, req); r != nil {
			return *r
		}
	case "pro":
		if c.openAIKey != "" {
			if r, err := c.callOpenAI(ctx, req, "You are FinFlow's financial copilot (Pro)."); err == nil {
				return c.finalize(r, "openai", req)
			}
		}
	}

	// Free tier + fallback: deterministic, offline financial assistant.
	return c.freeTier(req)
}

// tryMax attempts Gemini -> Claude -> OpenAI and returns the first successful reply.
func (c *Copilot) tryMax(ctx context.Context, req ChatRequest) *ChatResponse {
	if c.geminiKey != "" {
		if r, err := c.callGemini(ctx, req); err == nil {
			out := c.finalize(r, "gemini", req)
			return &out
		}
	}
	if c.anthropicKey != "" {
		if r, err := c.callClaude(ctx, req); err == nil {
			out := c.finalize(r, "anthropic", req)
			return &out
		}
	}
	if c.openAIKey != "" {
		if r, err := c.callOpenAI(ctx, req, "You are FinFlow MAX, the most capable financial copilot."); err == nil {
			out := c.finalize(r, "openai", req)
			return &out
		}
	}
	return nil
}

func (c *Copilot) finalize(reply, provider string, req ChatRequest) ChatResponse {
	conf := estimateConfidence(reply, req.Message)
	needs := conf < 0.4 || isUnresolved(reply)
	r := ChatResponse{
		Reply:       reply,
		Confidence:  conf,
		Provider:    provider,
		NeedsTicket: needs,
	}
	if needs {
		r.TicketReason = "Low confidence or unresolved query from Max/Pro tier."
	}
	return r
}

// freeTier provides deterministic, offline financial guidance.
func (c *Copilot) freeTier(req ChatRequest) ChatResponse {
	msg := strings.ToLower(req.Message)
	reply := "I'm FinFlow's free copilot. I can summarize basics: upload transactions to get AI categorization, and check the forecast page for cash-flow projections. Upgrade to Pro for deeper insights."
	conf := 0.6

	switch {
	case strings.Contains(msg, "runway"):
		reply = "Runway is your cash balance divided by average monthly net burn. Connect more transactions to improve its accuracy. Pro tier computes this automatically."
	case strings.Contains(msg, "anomal"):
		reply = "Spending anomalies are flagged when a transaction deviates from your history. Use the dashboard's anomaly view after uploading data."
	case strings.Contains(msg, "forecast") || strings.Contains(msg, "cash flow"):
		reply = "Forecasts use your historical cash flow with seasonality. See /forecast. Pro/Max tiers add confidence intervals and drift monitoring."
	case strings.Contains(msg, "refund") || strings.Contains(msg, "human") || strings.Contains(msg, "talk to"):
		conf = 0.2
	}

	needs := conf < 0.4 || strings.Contains(msg, "human") || strings.Contains(msg, "talk to")
	r := ChatResponse{Reply: reply, Confidence: conf, Provider: "free", NeedsTicket: needs}
	if needs {
		r.TicketReason = "User requested human help or free-tier could not resolve."
	}
	return r
}

func estimateConfidence(reply, prompt string) float64 {
	base := 0.75
	if len(reply) < 40 {
		base -= 0.2
	}
	if strings.Contains(strings.ToLower(reply), "i cannot") || strings.Contains(strings.ToLower(reply), "i can't") {
		base -= 0.4
	}
	if len(prompt) < 8 {
		base -= 0.1
	}
	if base < 0.05 {
		base = 0.05
	}
	if base > 0.98 {
		base = 0.98
	}
	return base
}

func isUnresolved(reply string) bool {
	low := strings.ToLower(reply)
	return strings.Contains(low, "cannot help") || strings.Contains(low, "contact support") || strings.Contains(low, "escalate")
}

// ---- External provider clients (minimal, stdlib) ----

func (c *Copilot) callOpenAI(ctx context.Context, req ChatRequest, system string) (string, error) {
	messages := []map[string]string{{"role": "system", "content": system}}
	for _, h := range req.History {
		messages = append(messages, map[string]string{"role": h.Role, "content": h.Content})
	}
	messages = append(messages, map[string]string{"role": "user", "content": req.Message})

	body, _ := json.Marshal(map[string]interface{}{
		"model":    "gpt-4o-mini",
		"messages": messages,
	})
	return postJSON(ctx, "https://api.openai.com/v1/chat/completions", map[string]string{
		"Authorization": "Bearer " + c.openAIKey,
		"Content-Type":  "application/json",
	}, body, func(b []byte) (string, error) {
		var r struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal(b, &r); err != nil {
			return "", err
		}
		if len(r.Choices) == 0 {
			return "", fmt.Errorf("no choices")
		}
		return r.Choices[0].Message.Content, nil
	})
}

func (c *Copilot) callClaude(ctx context.Context, req ChatRequest) (string, error) {
	messages := []map[string]string{}
	for _, h := range req.History {
		messages = append(messages, map[string]string{"role": h.Role, "content": h.Content})
	}
	messages = append(messages, map[string]string{"role": "user", "content": req.Message})

	body, _ := json.Marshal(map[string]interface{}{
		"model":      "claude-3-5-haiku-latest",
		"max_tokens": 512,
		"messages":   messages,
	})
	return postJSON(ctx, "https://api.anthropic.com/v1/messages", map[string]string{
		"x-api-key":         c.anthropicKey,
		"anthropic-version": "2023-06-01",
		"Content-Type":      "application/json",
	}, body, func(b []byte) (string, error) {
		var r struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(b, &r); err != nil {
			return "", err
		}
		if len(r.Content) == 0 {
			return "", fmt.Errorf("no content")
		}
		return r.Content[0].Text, nil
	})
}

func (c *Copilot) callGemini(ctx context.Context, req ChatRequest) (string, error) {
	parts := []map[string]string{{"text": req.Message}}
	body, _ := json.Marshal(map[string]interface{}{
		"contents": []map[string]interface{}{
			{"role": "user", "parts": parts},
		},
	})
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
	return postJSON(ctx, url, map[string]string{
		"Content-Type":  "application/json",
		"X-Goog-Api-Key": c.geminiKey,
	}, body, func(b []byte) (string, error) {
		var r struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal(b, &r); err != nil {
			return "", err
		}
		if len(r.Candidates) == 0 {
			return "", fmt.Errorf("no candidates")
		}
		if len(r.Candidates[0].Content.Parts) == 0 {
			return "", fmt.Errorf("no parts")
		}
		return r.Candidates[0].Content.Parts[0].Text, nil
	})
}

func postJSON(ctx context.Context, url string, headers map[string]string, body []byte, extract func([]byte) (string, error)) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("provider error: %s", resp.Status)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return "", err
	}
	return extract(buf.Bytes())
}

// jitter avoids deterministic confidence collisions in tests.
var jitter = func() float64 { return rand.Float64() * 0.05 }
