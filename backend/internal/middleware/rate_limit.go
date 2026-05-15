package middleware

import (
	"net/http"
	"sync"
	"time"

	"ai-image-station/backend/internal/common"
)

// UploadRateLimiter limits uploads per IP.
type UploadRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]*uploadWindow
	limit    int
	window   time.Duration
}

type uploadWindow struct {
	count     int
	firstSeen time.Time
}

// NewUploadRateLimiter creates a rate limiter for uploads.
func NewUploadRateLimiter(limit int, window time.Duration) *UploadRateLimiter {
	rl := &UploadRateLimiter{
		attempts: make(map[string]*uploadWindow),
		limit:    limit,
		window:   window,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *UploadRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, state := range rl.attempts {
			if now.Sub(state.firstSeen) > rl.window {
				delete(rl.attempts, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if the IP is within the rate limit.
func (rl *UploadRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	state, exists := rl.attempts[ip]

	if !exists {
		rl.attempts[ip] = &uploadWindow{count: 1, firstSeen: now}
		return true
	}

	if now.Sub(state.firstSeen) > rl.window {
		state.count = 0
		state.firstSeen = now
	}

	state.count++

	return state.count <= rl.limit
}

// UploadRateLimitMiddleware wraps the upload rate limiter as HTTP middleware.
func UploadRateLimitMiddleware(limiter *UploadRateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := common.GetClientIP(r)
			if !limiter.Allow(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"success":false,"error":{"code":"RATE_LIMITED","message":"Too many uploads, please try again later"}}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
