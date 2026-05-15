package middleware

import (
	"net/http"
	"strings"

	"ai-image-station/backend/internal/auth"
	"ai-image-station/backend/internal/common"
)

// Auth creates a middleware that validates Bearer tokens.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				common.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing or invalid authorization header")
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := auth.ValidateToken(token, secret)
			if err != nil {
				common.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or expired token")
				return
			}

			r = common.WithClaims(r, claims)
			next.ServeHTTP(w, r)
		})
	}
}
