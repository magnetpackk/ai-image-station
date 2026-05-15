package middleware

import (
	"net/http"
)

// SecurityHeaders adds security-related HTTP headers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		// CSP: allow images from self + data/blob/https, connect-src for AI APIs
		csp := "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob: https:; connect-src 'self' https:; " +
			"font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
		w.Header().Set("Content-Security-Policy", csp)

		next.ServeHTTP(w, r)
	})
}
