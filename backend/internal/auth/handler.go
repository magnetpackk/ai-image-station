package auth

import (
	"encoding/json"
	"net/http"

	"ai-image-station/backend/internal/common"
	"ai-image-station/backend/internal/config"
)

// Handler holds auth dependencies.
type Handler struct {
	Config      *config.Config
	RateLimiter *RateLimiter
}

// NewHandler creates a new auth handler.
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{
		Config: cfg,
		RateLimiter: NewRateLimiter(
			cfg.FailedLoginLimit,
			cfg.FailedLoginWindow,
			cfg.FailedLoginLock,
		),
	}
}

type loginRequest struct {
	AccessCode string `json:"accessCode"`
}

type loginResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

type sessionResponse struct {
	Authenticated bool   `json:"authenticated"`
	ExpiresAt     string `json:"expiresAt,omitempty"`
}

// Login handles POST /api/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	ip := common.GetClientIP(r)

	if !h.RateLimiter.Allow(ip) {
		common.WriteError(w, http.StatusTooManyRequests, "RATE_LIMITED", "Too many login attempts, please try again later")
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.WriteError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body")
		return
	}

	if req.AccessCode == "" {
		common.WriteError(w, http.StatusBadRequest, "MISSING_ACCESS_CODE", "Access code is required")
		return
	}

	if !VerifyAccessCode(h.Config.AccessCodeHash, req.AccessCode) {
		common.WriteError(w, http.StatusUnauthorized, "INVALID_ACCESS_CODE", "Access code is invalid")
		return
	}

	// Success — reset rate limiter
	h.RateLimiter.RecordSuccess(ip)

	token, expiresAt, err := GenerateToken(h.Config.ServerSecret)
	if err != nil {
		common.WriteError(w, http.StatusInternalServerError, "TOKEN_GENERATION_FAILED", "Failed to generate token")
		return
	}

	common.WriteSuccess(w, http.StatusOK, loginResponse{
		Token:     token,
		ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Session handles GET /api/auth/session.
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	claims := common.GetClaimsFromContext(r)
	if claims == nil {
		common.WriteSuccess(w, http.StatusOK, sessionResponse{
			Authenticated: true,
		})
		return
	}

	common.WriteSuccess(w, http.StatusOK, sessionResponse{
		Authenticated: true,
		ExpiresAt:     claims.ExpiresAt.Format("2006-01-02T15:04:05Z"),
	})
}
