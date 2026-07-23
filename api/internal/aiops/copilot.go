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
	Message string     `json:"message"`
	Plan    string     `json:"plan"` // free | pro | max
	UserID  string     `json:"user_id"`
	History []ChatTurn `json:"history,omitempty"`
}

// ChatTurn is a prior exchange.
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse is the copilot reply.
type ChatResponse struct {
	Reply        string  `json:"reply"`
	Text         string  `json:"text"`       // alias for Reply (frontend expects "text")
	Confidence   float64 `json:"confidence"` // 0-1
	Provider     string  `json:"provider"`   // free | openai | anthropic | gemini
	NeedsTicket  bool    `json:"needs_ticket"`
	TicketReason string  `json:"ticket_reason,omitempty"`
	LimitReached bool    `json:"limit_reached,omitempty"`
}

// Copilot routes chat by plan tier to the appropriate model.
type Copilot struct {
	openAIKey    string
	anthropicKey string
	geminiKey    string
	httpClient   *http.Client
}

// NewCopilot builds a tiered copilot router.
func NewCopilot(openAIKey, anthropicKey, geminiKey string) *Copilot {
	return &Copilot{
		openAIKey:    openAIKey,
		anthropicKey: anthropicKey,
		geminiKey:    geminiKey,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
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
		Text:        reply,
		Confidence:  conf,
		Provider:    provider,
		NeedsTicket: needs,
	}
	if needs {
		r.TicketReason = "Low confidence or unresolved query from Max/Pro tier."
	}
	return r
}

// freeTier provides deterministic, offline financial guidance with knowledge base.
func (c *Copilot) freeTier(req ChatRequest) ChatResponse {
	msg := strings.ToLower(req.Message)
	reply := "I'm FinFlow's free copilot. I can summarize basics: upload transactions to get AI categorization, and check the forecast page for cash-flow projections. Upgrade to Pro for deeper insights."
	conf := 0.6

	// Knowledge base: pattern-matched financial guidance
	kb := []struct {
		patterns []string
		response string
		conf     float64
	}{
		// Runway & Cash Management
		{[]string{"runway", "how long", "cash last"}, "Runway is your cash balance divided by average monthly net burn. Formula: Runway = Current Cash / |Net Monthly Burn|. A healthy runway is 12-18 months. Connect more transactions to improve accuracy. Pro tier computes this automatically with projections.", 0.75},
		{[]string{"cash flow", "cashflow", "money in", "money out"}, "Cash flow tracks money moving in and out. Positive cash flow means you're spending less than you earn. Negative means you're burning reserves. Upload your CSV to see your net cash flow breakdown by category.", 0.7},
		{[]string{"burn rate", "burn", "monthly spend"}, "Burn rate is your average monthly spending minus income. There are two types: Gross burn (total expenses) and Net burn (expenses minus revenue). Track this weekly to catch spending spikes early.", 0.7},

		// Forecasting & Projections
		{[]string{"forecast", "predict", "projection", "future"}, "Forecasts use your historical cash flow with seasonality analysis. See /forecast for visual projections. Pro/Max tiers add confidence intervals and drift monitoring. Free tier provides basic trend extrapolation.", 0.65},
		{[]string{"seasonality", "seasonal", "quarterly"}, "Seasonal patterns affect cash flow: Q4 often has higher expenses (bonuses, taxes), Q1 may see slower revenue. Upload 6+ months of data for accurate seasonal detection.", 0.7},

		// Anomaly Detection
		{[]string{"anomal", "unusual", "spike", "outlier", "weird"}, "Spending anomalies are flagged when a transaction deviates from your historical mean by 2+ standard deviations. Use the dashboard's anomaly view after uploading data. Pro tier provides real-time alerts.", 0.7},
		{[]string{"fraud", "suspicious", "unauthorized"}, "If you suspect fraud: 1) Flag the transaction in the dashboard, 2) Contact your bank immediately, 3) Export the flagged transaction report for your records. FinFlow detects unusual patterns but cannot prevent unauthorized transactions.", 0.6},

		// Budgeting & Planning
		{[]string{"budget", "plan", "allocation"}, "Effective budgeting follows the 50/30/20 rule: 50% needs, 30% wants, 20% savings. For startups, aim for 40-50% on growth, 20-30% on operations, 10-20% on runway reserve. Upload transactions to see your actual allocation.", 0.7},
		{[]string{"cut cost", "reduce spend", "save money", "trim"}, "Top cost optimization levers: 1) Review recurring subscriptions, 2) Negotiate annual contracts vs monthly, 3) Audit contractor vs full-time costs, 4) Check cloud infrastructure rightsizing. Use the copilot with specific transaction data for personalized recommendations.", 0.7},

		// Financial Metrics
		{[]string{"mrr", "monthly recurring", "recurring revenue"}, "MRR is your predictable monthly revenue from subscriptions. Calculate: MRR = sum of all active subscription values. Track MRR growth rate: 10-15% monthly is healthy for early stage, 5-10% for growth stage.", 0.75},
		{[]string{"ltv", "lifetime value", "customer value"}, "Customer LTV = Average Revenue per User × Average Customer Lifespan. A healthy LTV:CAC ratio is 3:1 or higher. If below 1:1, you're losing money on each customer acquired.", 0.7},
		{[]string{"cac", "acquisition cost", "cost to acquire"}, "CAC = Total Sales & Marketing Spend / Number of New Customers. Compare to LTV: if CAC > LTV, you have a unit economics problem. Aim for CAC payback period under 12 months.", 0.7},

		// Taxes & Accounting
		{[]string{"tax", "taxes", "quarterly", "irs"}, "Quarterly tax estimates are due: April 15, June 15, September 15, January 15. Set aside 25-30% of profit for federal taxes. Track deductible expenses (home office, equipment, software) separately.", 0.65},
		{[]string{"bookkeep", "accounting", "ledger", "reconcil"}, "Good bookkeeping: 1) Categorize transactions weekly, 2) Reconcile bank statements monthly, 3) Keep receipts for expenses over $75, 4) Separate business and personal accounts. FinFlow auto-categorizes when you upload CSVs.", 0.7},

		// Funding & Investment
		{[]string{"raise", "fundraise", "investor", "venture", "series"}, "Fundraising readiness checklist: 1) 6+ months of clean financials, 2) Clear unit economics (LTV/CAC), 3) Demonstrated growth trajectory, 4) Defined use of funds. Pro tier generates investor-ready financial reports.", 0.65},
		{[]string{"valuation", "worth", "company value"}, "Startup valuation methods: 1) Revenue multiple (3-10x ARR for SaaS), 2) Comparable transactions, 3) Discounted cash flow (DCF). Early stage often uses post-money SAFE notes. Upload financials for a data-driven estimate.", 0.6},

		// Operational Finance
		{[]string{"invoice", "receivable", "ar", "accounts receivable"}, "Accounts Receivable (AR) is money owed to you. Track aging: 0-30 days (current), 31-60 days (attention), 61-90 days (collections), 90+ days (risk). Aim for DSO (Days Sales Outstanding) under 45 days.", 0.7},
		{[]string{"payable", "ap", "accounts payable"}, "Accounts Payable (AP) is money you owe. Manage by: 1) Negotiating payment terms (Net 30/60/90), 2) Taking early payment discounts (2/10 Net 30), 3) Prioritizing high-interest debts first.", 0.7},
		{[]string{"payroll", "salary", "wages", "compensation"}, "Payroll typically represents 40-60% of startup expenses. Track: 1) Fully loaded cost (salary × 1.25-1.4 for benefits/taxes), 2) Runway impact per hire, 3) Equity vs cash compensation mix.", 0.7},

		// Help & Support
		{[]string{"help", "how to", "guide", "tutorial"}, "FinFlow Quick Guide: 1) Upload CSV → Auto-categorize transactions, 2) Dashboard → View cash flow & health score, 3) Forecast → See projections (Pro), 4) Copilot → Ask financial questions. For detailed help, visit docs.finflow.io", 0.8},
		{[]string{"upgrade", "pro", "max", "plan", "pricing"}, "Plan comparison: Free (3 queries, basic analytics), Pro (unlimited, forecasting, anomaly alerts), Max (multi-model AI, priority support, custom reports). Upgrade at /settings/billing", 0.85},
		{[]string{"human", "talk to", "support", "agent", "person"}, "I'll connect you with a support specialist. They can help with complex financial analysis, custom reports, and account-specific questions. Response time: within 6 hours for Pro, 24 hours for Free.", 0.3},
	}

	// Match against knowledge base
	for _, entry := range kb {
		for _, pattern := range entry.patterns {
			if strings.Contains(msg, pattern) {
				reply = entry.response
				conf = entry.conf
				goto matched
			}
		}
	}

matched:
	needs := conf < 0.4 || strings.Contains(msg, "human") || strings.Contains(msg, "talk to")
	r := ChatResponse{Reply: reply, Text: reply, Confidence: conf, Provider: "free", NeedsTicket: needs}
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
	return c.postJSON(ctx, "https://api.openai.com/v1/chat/completions", map[string]string{
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
	return c.postJSON(ctx, "https://api.anthropic.com/v1/messages", map[string]string{
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
	return c.postJSON(ctx, url, map[string]string{
		"Content-Type":   "application/json",
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

func (c *Copilot) postJSON(ctx context.Context, url string, headers map[string]string, body []byte, extract func([]byte) (string, error)) (string, error) {
	var lastErr error
	for attempt := 0; attempt <= 2; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * 500 * time.Millisecond
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("provider error: %s", resp.Status)
			continue
		}
		if resp.StatusCode >= 300 {
			return "", fmt.Errorf("provider error: %s", resp.Status)
		}
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(resp.Body); err != nil {
			return "", err
		}
		return extract(buf.Bytes())
	}
	return "", fmt.Errorf("provider after retries: %w", lastErr)
}

// jitter avoids deterministic confidence collisions in tests.
var jitter = func() float64 { return rand.Float64() * 0.05 }
