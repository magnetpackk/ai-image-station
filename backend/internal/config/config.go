package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Config holds all application configuration.
type Config struct {
	Port          string
	PublicBaseURL string

	DataDir  string
	ImageDir string
	MetaDir  string
	TmpDir   string

	AccessCodeHash string
	ServerSecret   string

	MaxUploadSize    int64
	AllowedMimeTypes []string

	FailedLoginLimit  int
	FailedLoginWindow time.Duration
	FailedLoginLock   time.Duration

	AllowedOrigins []string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Port:          envOrDefault("PORT", "8080"),
		PublicBaseURL: strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/"),

		DataDir: envOrDefault("DATA_DIR", "/data"),

		ServerSecret: os.Getenv("SERVER_SECRET"),

		MaxUploadSize:    int64(envIntOrDefault("MAX_UPLOAD_SIZE_MB", 20)) * 1024 * 1024,
		AllowedMimeTypes: []string{"image/png", "image/jpeg", "image/webp", "image/gif"},

		FailedLoginLimit:  envIntOrDefault("FAILED_LOGIN_LIMIT", 5),
		FailedLoginWindow: time.Duration(envIntOrDefault("FAILED_LOGIN_WINDOW_SECONDS", 60)) * time.Second,
		FailedLoginLock:   time.Duration(envIntOrDefault("FAILED_LOGIN_LOCK_SECONDS", 600)) * time.Second,
	}

	cfg.ImageDir = cfg.DataDir + "/images"
	cfg.MetaDir = cfg.DataDir + "/meta"
	cfg.TmpDir = cfg.DataDir + "/tmp"

	// Parse allowed origins
	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		cfg.AllowedOrigins = strings.Split(origins, ",")
		for i := range cfg.AllowedOrigins {
			cfg.AllowedOrigins[i] = strings.TrimSpace(cfg.AllowedOrigins[i])
		}
	}

	// Read ACCESS_CODE from env, bcrypt hash it, and store the hash.
	accessCode := os.Getenv("ACCESS_CODE")
	if accessCode == "" {
		// In development, use a default. In production this must be set.
		accessCode = "dev-access-code-change-me"
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(accessCode), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	cfg.AccessCodeHash = string(hash)

	// SERVER_SECRET is required for token signing.
	if cfg.ServerSecret == "" {
		cfg.ServerSecret = "dev-server-secret-change-me"
	}

	return cfg, nil
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func envIntOrDefault(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
