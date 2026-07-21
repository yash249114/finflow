// api/internal/aiops/alerting.go
package aiops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"text/template"
	"time"

	"github.com/redis/go-redis/v9"
)

// Alerter dispatches incident notifications via email, GitHub draft issues,
// Web3Forms support tickets, and a self-reporting Redis stream.
type Alerter struct {
	cfg          AlertConfig
	redis        *redis.Client
	reportStream string
	httpClient   *http.Client
}

// AlertConfig carries alert destinations.
type AlertConfig struct {
	EmailFrom    string
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPass     string
	EmailTo      string
	GitHubToken  string
	GitHubOwner  string
	GitHubRepo   string
	OwnerEmail   string
	Web3FormsKey string // Web3Forms access key for support tickets
}

// SupportTicket represents a user-facing support request.
type SupportTicket struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	Plan      string    `json:"plan"`
	Priority  string    `json:"priority"` // low | medium | high
	Status    string    `json:"status"`   // open | in_progress | resolved
	CreatedAt time.Time `json:"created_at"`
}

// NewAlerter builds an Alerter.
func NewAlerter(cfg AlertConfig, redis *redis.Client, reportStream string) *Alerter {
	return &Alerter{
		cfg:          cfg,
		redis:        redis,
		reportStream: reportStream,
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

const emailTmpl = `Subject: [FinFlow AIOps] {{.Severity}}: {{.Title}}

Service:   {{.Service}}
Severity:  {{.Severity}}
Time:      {{.CreatedAt}}

Root cause:
{{.RootCause}}

Evidence:
{{range .Evidence}}  - {{.}}
{{end}}

Self-healing: FinFlow AIOps is attempting automatic mitigation.
If unresolved, a GitHub issue has been drafted and the owner notified.
`

// SendEmail delivers an incident email via SMTP (best-effort).
func (a *Alerter) SendEmail(inc Incident) error {
	if a.cfg.SMTPHost == "" || a.cfg.EmailTo == "" {
		return nil // not configured; skip silently
	}
	var buf bytes.Buffer
	t := template.Must(template.New("email").Parse(emailTmpl))
	if err := t.Execute(&buf, inc); err != nil {
		return err
	}
	addr := fmt.Sprintf("%s:%d", a.cfg.SMTPHost, a.cfg.SMTPPort)
	auth := smtp.PlainAuth(a.cfg.SMTPUser, a.cfg.SMTPUser, a.cfg.SMTPPass, a.cfg.SMTPHost)
	to := []string{a.cfg.EmailTo}
	if a.cfg.OwnerEmail != "" {
		to = append(to, a.cfg.OwnerEmail)
	}
	return smtp.SendMail(addr, auth, a.cfg.EmailFrom, to, buf.Bytes())
}

// DraftGitHubIssue creates a GitHub issue and returns its URL (best-effort).
// It uses the GitHub REST API; only runs when a token is configured.
func (a *Alerter) DraftGitHubIssue(ctx context.Context, inc Incident) (string, error) {
	if a.cfg.GitHubToken == "" {
		return "", nil
	}
	body := fmt.Sprintf("## Incident (auto-drafted by AIOps)\n\n**Severity:** %s\n**Service:** %s\n\n**Root cause:**\n%s\n\n**Evidence:**\n", inc.Severity, inc.Service, inc.RootCause)
	for _, e := range inc.Evidence {
		body += "- " + e + "\n"
	}
	url, err := createGitHubIssue(ctx, a.cfg, inc.Title, body)
	if err != nil {
		return "", err
	}
	return url, nil
}

// Report writes a self-report event to the Redis stream.
func (a *Alerter) Report(ctx context.Context, inc Incident, issueURL string) {
	if a.redis == nil {
		return
	}
	_ = a.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: a.reportStream,
		Values: map[string]interface{}{
			"type":       "incident_report",
			"service":    inc.Service,
			"severity":   inc.Severity,
			"title":      inc.Title,
			"root_cause": inc.RootCause,
			"issue_url":  issueURL,
			"at":         time.Now().UTC().Format(time.RFC3339),
		},
	})
}

// Notify handles the full alert pipeline for an incident.
func (a *Alerter) Notify(ctx context.Context, inc Incident) {
	_ = a.SendEmail(inc)
	issueURL, _ := a.DraftGitHubIssue(ctx, inc)
	a.Report(ctx, inc, issueURL)
}

// CreateSupportTicket creates a support ticket via Web3Forms and notifies the owner.
func (a *Alerter) CreateSupportTicket(ctx context.Context, ticket SupportTicket) error {
	if a.cfg.Web3FormsKey == "" {
		return nil // not configured; skip silently
	}

	// Build Web3Forms payload
	payload := map[string]interface{}{
		"access_key": a.cfg.Web3FormsKey,
		"subject":    fmt.Sprintf("[FinFlow Support] %s - %s", ticket.Priority, ticket.Subject),
		"from_name":  "FinFlow Support System",
		"to_email":   a.cfg.EmailTo,
		"message": fmt.Sprintf(
			"Support Ticket: %s\n"+
				"User: %s\n"+
				"Email: %s\n"+
				"Plan: %s\n"+
				"Priority: %s\n"+
				"Status: %s\n"+
				"Created: %s\n\n"+
				"Message:\n%s",
			ticket.ID, ticket.UserID, ticket.Email, ticket.Plan,
			ticket.Priority, ticket.Status, ticket.CreatedAt.Format(time.RFC3339),
			ticket.Message,
		),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.web3forms.com/submit", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("web3forms error: %s", resp.Status)
	}

	// Also report to Redis stream for tracking
	a.reportTicket(ctx, ticket)

	return nil
}

// reportTicket writes a support ticket event to the Redis stream.
func (a *Alerter) reportTicket(ctx context.Context, ticket SupportTicket) {
	if a.redis == nil {
		return
	}
	_ = a.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: a.reportStream,
		Values: map[string]interface{}{
			"type":       "support_ticket",
			"ticket_id":  ticket.ID,
			"user_id":    ticket.UserID,
			"email":      ticket.Email,
			"subject":    ticket.Subject,
			"plan":       ticket.Plan,
			"priority":   ticket.Priority,
			"status":     ticket.Status,
			"created_at": ticket.CreatedAt.Format(time.RFC3339),
		},
	})
}
