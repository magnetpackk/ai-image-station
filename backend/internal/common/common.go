package common

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"
)

// SessionClaims represents the payload of a session token.
type SessionClaims struct {
	Subject   string    `json:"sub"`
	IssuedAt  time.Time `json:"iat"`
	ExpiresAt time.Time `json:"exp"`
}

type contextKey string

const claimsKey contextKey = "session-claims"

// WithClaims stores session claims in the request context.
func WithClaims(r *http.Request, claims *SessionClaims) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), claimsKey, claims))
}

// GetClaimsFromContext extracts session claims from the request context.
func GetClaimsFromContext(r *http.Request) *SessionClaims {
	claims, ok := r.Context().Value(claimsKey).(*SessionClaims)
	if !ok {
		return nil
	}
	return claims
}

// GetClientIP extracts the client IP from the request.
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// Fall back to remote address
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// WriteSuccess writes a standardized success JSON response.
func WriteSuccess(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

// WriteError writes a standardized error JSON response.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
