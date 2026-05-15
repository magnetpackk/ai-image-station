package middleware

import (
	"log"
	"net/http"
	"time"

	"ai-image-station/backend/internal/common"
)

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Logging creates a request logging middleware.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		ip := common.GetClientIP(r)

		log.Printf("[%s] %s %s %d %s",
			ip,
			r.Method,
			r.URL.Path,
			rw.status,
			duration.Round(time.Millisecond),
		)
	})
}
