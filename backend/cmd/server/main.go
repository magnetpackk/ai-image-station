package main

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"ai-image-station/backend/internal/server"
)

func main() {
	cfg := server.Config{
		Addr:           env("ADDR", ":8080"),
		DataDir:        env("DATA_DIR", "/data"),
		StaticDir:      env("STATIC_DIR", ""),
		PublicBaseURL:  env("PUBLIC_BASE_URL", "http://localhost:8080"),
		AccessCode:     os.Getenv("ACCESS_CODE"),
		AccessCodeHash: os.Getenv("ACCESS_CODE_HASH"),
		ServerSecret:   os.Getenv("SERVER_SECRET"),
		TokenTTL:       durationHours("TOKEN_TTL_HOURS", 24),
		MaxUploadSize:  int64Env("MAX_UPLOAD_SIZE", 10<<20),
	}
	if cfg.AccessCodeHash == "" && cfg.AccessCode != "" {
		sum := sha256.Sum256([]byte(cfg.AccessCode))
		log.Printf("using ACCESS_CODE sha256=%s", hex.EncodeToString(sum[:]))
	}
	s, err := server.New(cfg)
	if err != nil {
		log.Fatalf("init server: %v", err)
	}
	log.Printf("AI Image Station backend listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, s.Routes()); err != nil {
		log.Fatal(err)
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func int64Env(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return def
}

func durationHours(key string, def int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Hour
		}
	}
	return time.Duration(def) * time.Hour
}
