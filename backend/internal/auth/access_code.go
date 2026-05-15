package auth

import (
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// RateLimiter tracks failed login attempts per IP.
type RateLimiter struct {
	mu       sync.Mutex
	attempts map[string]*ipState
	limit    int
	window   time.Duration
	lockDur  time.Duration
}

type ipState struct {
	count     int
	firstSeen time.Time
	lockedAt  time.Time
}

// NewRateLimiter creates a new rate limiter.
func NewRateLimiter(limit int, window, lockDur time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts: make(map[string]*ipState),
		limit:    limit,
		window:   window,
		lockDur:  lockDur,
	}
	// Background cleanup goroutine
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, state := range rl.attempts {
			if now.Sub(state.firstSeen) > rl.window && now.Sub(state.lockedAt) > rl.lockDur {
				delete(rl.attempts, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if the IP is allowed to attempt login.
// Returns true if allowed, false if rate limited.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	state, exists := rl.attempts[ip]

	if !exists {
		rl.attempts[ip] = &ipState{count: 1, firstSeen: now}
		return true
	}

	// Check if locked
	if !state.lockedAt.IsZero() {
		if now.Sub(state.lockedAt) < rl.lockDur {
			return false
		}
		// Lock expired, reset
		state.count = 0
		state.lockedAt = time.Time{}
		state.firstSeen = now
	}

	// Reset window if expired
	if now.Sub(state.firstSeen) > rl.window {
		state.count = 0
		state.firstSeen = now
	}

	state.count++

	if state.count > rl.limit {
		state.lockedAt = now
		return false
	}

	return true
}

// RecordSuccess clears the rate limit state for an IP on successful login.
func (rl *RateLimiter) RecordSuccess(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.attempts, ip)
}

// VerifyAccessCode compares a plaintext code against the stored bcrypt hash.
func VerifyAccessCode(hash, code string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(code))
	return err == nil
}
