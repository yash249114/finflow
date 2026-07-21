// api/internal/handlers/ai_chat.go
package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/finflow/api/internal/aiops"
	"github.com/gin-gonic/gin"
)

// AIChatHandler serves the tiered FinFlow copilot and auto-ticketing.
type AIChatHandler struct {
	copilot *aiops.Copilot
	alerter *aiops.Alerter
}

// NewAIChatHandler builds the copilot handler.
func NewAIChatHandler(copilot *aiops.Copilot, alerter *aiops.Alerter) *AIChatHandler {
	return &AIChatHandler{copilot: copilot, alerter: alerter}
}

// Chat handles POST /api/ai/chat
//
//	{
//	  "message": "...",
//	  "history": [ {"role":"user","content":"..."}, ... ]
//	}
func (h *AIChatHandler) Chat(c *gin.Context) {
	var req aiops.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Tier + identity come from the authenticated context (set by auth middleware).
	plan, _ := c.Get("plan")
	userID, _ := c.Get("user_id")
	email, _ := c.Get("email")
	if p, ok := plan.(string); ok && p != "" {
		req.Plan = p
	}
	if u, ok := userID.(string); ok {
		req.UserID = u
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	resp := h.copilot.Respond(ctx, req)

	// Self-reporting + auto-ticket when the copilot cannot resolve the issue.
	if resp.NeedsTicket {
		// Create incident for internal tracking
		inc := aiops.Incident{
			ID:        "ticket-" + req.UserID + "-" + time.Now().UTC().Format("20060102150405"),
			Title:     "Copilot escalation: " + truncate(req.Message, 60),
			Severity:  "low",
			Service:   "copilot",
			RootCause: resp.TicketReason,
			Evidence:  []string{"user=" + toString(email), "query=" + truncate(req.Message, 120)},
			CreatedAt: time.Now().UTC(),
		}
		h.alerter.Notify(c.Request.Context(), inc)

		// Create support ticket via Web3Forms for user-facing resolution
		ticket := aiops.SupportTicket{
			ID:        inc.ID,
			UserID:    req.UserID,
			Email:     toString(email),
			Subject:   truncate(req.Message, 80),
			Message:   req.Message,
			Plan:      req.Plan,
			Priority:  "medium",
			Status:    "open",
			CreatedAt: time.Now().UTC(),
		}
		if err := h.alerter.CreateSupportTicket(c.Request.Context(), ticket); err != nil {
			// Log but don't fail the request
			_ = err
		}

		resp.TicketReason = inc.RootCause + " (ticket drafted)"
	}

	c.JSON(http.StatusOK, resp)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func toString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
