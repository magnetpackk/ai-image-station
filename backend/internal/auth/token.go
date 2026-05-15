package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ai-image-station/backend/internal/common"
)

const tokenDuration = 24 * time.Hour

// GenerateToken creates a signed session token.
func GenerateToken(secret string) (string, time.Time, error) {
	now := time.Now().UTC()
	expires := now.Add(tokenDuration)

	claims := common.SessionClaims{
		Subject:   "authenticated-user",
		IssuedAt:  now,
		ExpiresAt: expires,
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", time.Time{}, err
	}

	payloadB64 := base64.RawURLEncoding.EncodeToString(payload)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payloadB64))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	token := fmt.Sprintf("%s.%s", payloadB64, sig)
	return token, expires, nil
}

// ValidateToken verifies a session token and returns the claims.
func ValidateToken(token string, secret string) (*common.SessionClaims, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}

	payloadB64, sig := parts[0], parts[1]

	// Verify signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payloadB64))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid token signature")
	}

	// Decode payload
	payload, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, fmt.Errorf("invalid token payload encoding")
	}

	var claims common.SessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("invalid token payload")
	}

	// Check expiration
	if time.Now().UTC().After(claims.ExpiresAt) {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}
