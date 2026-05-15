package server

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const Version = "0.1.0"

type Config struct {
	Addr           string
	DataDir        string
	StaticDir      string
	PublicBaseURL  string
	AccessCode     string
	AccessCodeHash string
	ServerSecret   string
	TokenTTL       time.Duration
	MaxUploadSize  int64
}

type Server struct {
	cfg            Config
	accessCodeHash [32]byte
	failMu         sync.Mutex
	failures       map[string]*loginFailure
}

type loginFailure struct {
	Count       int
	LockedUntil time.Time
	WindowStart time.Time
}

type ImageMeta struct {
	ID               string                 `json:"id"`
	Filename         string                 `json:"filename"`
	URL              string                 `json:"url"`
	Prompt           string                 `json:"prompt"`
	NegativePrompt   string                 `json:"negativePrompt,omitempty"`
	Provider         string                 `json:"provider"`
	Model            string                 `json:"model"`
	Source           string                 `json:"source"`
	Width            int                    `json:"width,omitempty"`
	Height           int                    `json:"height,omitempty"`
	Size             int64                  `json:"size"`
	MimeType         string                 `json:"mimeType"`
	SHA256           string                 `json:"sha256"`
	GenerationParams map[string]interface{} `json:"generationParams,omitempty"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

type response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *apiError   `json:"error,omitempty"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type SessionClaims struct {
	Subject   string    `json:"sub"`
	IssuedAt  time.Time `json:"iat"`
	ExpiresAt time.Time `json:"exp"`
}

func New(cfg Config) (*Server, error) {
	if cfg.DataDir == "" {
		cfg.DataDir = "./data"
	}
	if cfg.PublicBaseURL == "" {
		cfg.PublicBaseURL = "http://localhost:8080"
	}
	cfg.PublicBaseURL = strings.TrimRight(cfg.PublicBaseURL, "/")
	if cfg.TokenTTL == 0 {
		cfg.TokenTTL = 24 * time.Hour
	}
	if cfg.MaxUploadSize == 0 {
		cfg.MaxUploadSize = 10 << 20
	}
	if cfg.ServerSecret == "" {
		return nil, errors.New("SERVER_SECRET is required")
	}
	if cfg.AccessCode == "" && cfg.AccessCodeHash == "" {
		return nil, errors.New("ACCESS_CODE or ACCESS_CODE_HASH is required")
	}
	for _, dir := range []string{cfg.DataDir, filepath.Join(cfg.DataDir, "images"), filepath.Join(cfg.DataDir, "meta"), filepath.Join(cfg.DataDir, "tmp")} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, err
		}
	}
	s := &Server{cfg: cfg, failures: make(map[string]*loginFailure)}
	if cfg.AccessCodeHash != "" {
		decoded, err := hex.DecodeString(cfg.AccessCodeHash)
		if err != nil || len(decoded) != sha256.Size {
			return nil, errors.New("ACCESS_CODE_HASH must be sha256 hex")
		}
		copy(s.accessCodeHash[:], decoded)
	} else {
		s.accessCodeHash = sha256.Sum256([]byte(cfg.AccessCode))
	}
	return s, nil
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/images/", s.handleStaticImage)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/auth/me", s.withAuth(s.handleMe))
	mux.HandleFunc("/api/images", s.withAuth(s.handleImages))
	mux.HandleFunc("/api/images/", s.withAuth(s.handleImageByID))
	mux.HandleFunc("/api/stats", s.withAuth(s.handleStats))
	if s.cfg.StaticDir != "" {
		mux.HandleFunc("/", s.serveFrontend)
	}
	return logMiddleware(securityHeaders(mux))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

type logResponseWriter struct {
	http.ResponseWriter
	status int
	size   int
}

func (lrw *logResponseWriter) WriteHeader(code int) {
	lrw.status = code
	lrw.ResponseWriter.WriteHeader(code)
}

func (lrw *logResponseWriter) Write(b []byte) (int, error) {
	n, err := lrw.ResponseWriter.Write(b)
	lrw.size += n
	return n, err
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lrw := &logResponseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(lrw, r)
		log.Printf("[REQ] %s %s -> %d (%d bytes) ua=%q", r.Method, r.URL.Path, lrw.status, lrw.size, r.UserAgent())
	})
}

func writeJSON(w http.ResponseWriter, status int, payload response) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func ok(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusOK, response{Success: true, Data: data})
}
func fail(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, response{Success: false, Error: &apiError{Code: code, Message: msg}})
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	ok(w, map[string]string{"status": "ok", "version": Version})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	ip := clientIP(r)
	if s.isLocked(ip) {
		fail(w, http.StatusTooManyRequests, "LOGIN_LOCKED", "too many failed attempts")
		return
	}
	var req struct {
		AccessCode string `json:"accessCode"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_JSON", "invalid json")
		return
	}
	sum := sha256.Sum256([]byte(req.AccessCode))
	if subtle.ConstantTimeCompare(sum[:], s.accessCodeHash[:]) != 1 {
		s.recordFailure(ip)
		fail(w, http.StatusUnauthorized, "INVALID_ACCESS_CODE", "Access code is invalid")
		return
	}
	s.clearFailure(ip)
	now := time.Now().UTC()
	claims := SessionClaims{Subject: "user", IssuedAt: now, ExpiresAt: now.Add(s.cfg.TokenTTL)}
	token, err := s.signToken(claims)
	if err != nil {
		fail(w, http.StatusInternalServerError, "TOKEN_ERROR", "could not create token")
		return
	}
	ok(w, map[string]interface{}{"token": token, "expiresAt": claims.ExpiresAt})
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func (s *Server) isLocked(ip string) bool {
	s.failMu.Lock()
	defer s.failMu.Unlock()
	f := s.failures[ip]
	return f != nil && time.Now().Before(f.LockedUntil)
}
func (s *Server) recordFailure(ip string) {
	s.failMu.Lock()
	defer s.failMu.Unlock()
	now := time.Now()
	f := s.failures[ip]
	if f == nil || now.Sub(f.WindowStart) > time.Minute {
		f = &loginFailure{WindowStart: now}
		s.failures[ip] = f
	}
	f.Count++
	if f.Count >= 5 {
		f.LockedUntil = now.Add(10 * time.Minute)
	}
}
func (s *Server) clearFailure(ip string) { s.failMu.Lock(); delete(s.failures, ip); s.failMu.Unlock() }

func (s *Server) signToken(claims SessionClaims) (string, error) {
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload64 := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(s.cfg.ServerSecret))
	mac.Write([]byte(payload64))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload64 + "." + sig, nil
}

func (s *Server) verifyToken(token string) (*SessionClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errors.New("bad token")
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.ServerSecret))
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expected), []byte(parts[1])) != 1 {
		return nil, errors.New("bad signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	var claims SessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}
	if time.Now().UTC().After(claims.ExpiresAt) {
		return nil, errors.New("expired")
	}
	return &claims, nil
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing bearer token")
			return
		}
		if _, err := s.verifyToken(strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))); err != nil {
			fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid bearer token")
			return
		}
		next(w, r)
	}
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	claims, _ := s.verifyToken(strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")))
	ok(w, map[string]interface{}{"authenticated": true, "expiresAt": claims.ExpiresAt})
}

func (s *Server) handleImages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListImages(w, r)
	case http.MethodPost:
		s.handleUploadImage(w, r)
	default:
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (s *Server) handleUploadImage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadSize+1024*1024)
	if err := r.ParseMultipartForm(s.cfg.MaxUploadSize + 1024*1024); err != nil {
		fail(w, http.StatusBadRequest, "UPLOAD_TOO_LARGE", "invalid multipart form or file too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		fail(w, http.StatusBadRequest, "FILE_REQUIRED", "file is required")
		return
	}
	defer file.Close()

	buf, size, sha, mime, err := readAndValidateImage(file, s.cfg.MaxUploadSize)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_IMAGE", err.Error())
		return
	}
	ext, allowed := mimeExtensions[mime]
	if !allowed {
		fail(w, http.StatusBadRequest, "UNSUPPORTED_MIME", "unsupported image mime type")
		return
	}
	_ = header
	prompt := strings.TrimSpace(r.FormValue("prompt"))
	provider := strings.TrimSpace(r.FormValue("provider"))
	model := strings.TrimSpace(r.FormValue("model"))
	source := strings.TrimSpace(r.FormValue("source"))
	if prompt == "" || provider == "" || model == "" || !validSource(source) {
		fail(w, http.StatusBadRequest, "INVALID_METADATA", "prompt, provider, model and source are required")
		return
	}
	id, err := randomID()
	if err != nil {
		fail(w, http.StatusInternalServerError, "ID_ERROR", "could not create id")
		return
	}
	filename := id + ext
	imgPath := filepath.Join(s.cfg.DataDir, "images", filename)
	if err := os.WriteFile(imgPath, buf, 0644); err != nil {
		fail(w, http.StatusInternalServerError, "SAVE_IMAGE_FAILED", "could not save image")
		return
	}
	now := time.Now().UTC()
	meta := ImageMeta{
		ID: id, Filename: filename, URL: s.cfg.PublicBaseURL + "/images/" + filename,
		Prompt: prompt, NegativePrompt: r.FormValue("negativePrompt"), Provider: provider, Model: model, Source: source,
		Width: atoi(r.FormValue("width")), Height: atoi(r.FormValue("height")), Size: size, MimeType: mime, SHA256: sha,
		CreatedAt: now, UpdatedAt: now,
	}
	if gp := strings.TrimSpace(r.FormValue("generationParams")); gp != "" {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(gp), &m); err != nil {
			fail(w, http.StatusBadRequest, "INVALID_GENERATION_PARAMS", "generationParams must be JSON object")
			return
		}
		meta.GenerationParams = m
	}
	if err := s.writeMeta(meta); err != nil {
		_ = os.Remove(imgPath)
		fail(w, http.StatusInternalServerError, "SAVE_META_FAILED", "could not save metadata")
		return
	}
	ok(w, map[string]interface{}{"id": meta.ID, "filename": meta.Filename, "url": meta.URL, "thumbnailUrl": meta.URL, "size": meta.Size, "mimeType": meta.MimeType, "createdAt": meta.CreatedAt})
}

var mimeExtensions = map[string]string{"image/png": ".png", "image/jpeg": ".jpeg", "image/webp": ".webp", "image/gif": ".gif"}

var staticImageNameRE = regexp.MustCompile(`^img_[A-Za-z0-9]+\.(png|jpeg|webp|gif)$`)

func validSource(s string) bool {
	return s == "text-to-image" || s == "image-to-image" || s == "manual-upload"
}
func atoi(s string) int { n, _ := strconv.Atoi(s); return n }

func readAndValidateImage(file multipart.File, max int64) ([]byte, int64, string, string, error) {
	var buf strings.Builder
	// strings.Builder is not for bytes; keep simple using byte slice with LimitReader.
	_ = buf
	data, err := io.ReadAll(io.LimitReader(file, max+1))
	if err != nil {
		return nil, 0, "", "", err
	}
	if int64(len(data)) > max {
		return nil, 0, "", "", errors.New("file too large")
	}
	mime := http.DetectContentType(data)
	if _, ok := mimeExtensions[mime]; !ok {
		return nil, 0, "", "", fmt.Errorf("unsupported image mime type: %s", mime)
	}
	shaBytes := sha256.Sum256(data)
	return data, int64(len(data)), hex.EncodeToString(shaBytes[:]), mime, nil
}

func randomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "img_" + hex.EncodeToString(b), nil
}

func (s *Server) writeMeta(meta ImageMeta) error {
	b, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.cfg.DataDir, "meta", meta.ID+".json"), b, 0644)
}

func (s *Server) readMeta(id string) (*ImageMeta, error) {
	if !safeID(id) {
		return nil, os.ErrNotExist
	}
	b, err := os.ReadFile(filepath.Join(s.cfg.DataDir, "meta", id+".json"))
	if err != nil {
		return nil, err
	}
	var meta ImageMeta
	if err := json.Unmarshal(b, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}
func safeID(id string) bool { return strings.HasPrefix(id, "img_") && !strings.ContainsAny(id, `/\.`) }

func (s *Server) scanMetas() ([]ImageMeta, error) {
	entries, err := os.ReadDir(filepath.Join(s.cfg.DataDir, "meta"))
	if err != nil {
		return nil, err
	}
	items := make([]ImageMeta, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(s.cfg.DataDir, "meta", e.Name()))
		if err != nil {
			continue
		}
		var m ImageMeta
		if json.Unmarshal(b, &m) == nil {
			items = append(items, m)
		}
	}
	return items, nil
}

func (s *Server) handleListImages(w http.ResponseWriter, r *http.Request) {
	items, err := s.scanMetas()
	if err != nil {
		fail(w, http.StatusInternalServerError, "LIST_FAILED", "could not list images")
		return
	}
	q := r.URL.Query()
	source := q.Get("source")
	keyword := strings.ToLower(q.Get("keyword"))
	filtered := items[:0]
	for _, m := range items {
		if source != "" && m.Source != source {
			continue
		}
		if keyword != "" && !strings.Contains(strings.ToLower(m.Prompt), keyword) {
			continue
		}
		filtered = append(filtered, m)
	}
	sortImages(filtered, q.Get("sort"))
	page := atoiDefault(q.Get("page"), 1)
	if page < 1 {
		page = 1
	}
	pageSize := atoiDefault(q.Get("pageSize"), 30)
	if pageSize < 1 {
		pageSize = 30
	}
	if pageSize > 100 {
		pageSize = 100
	}
	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	totalPages := (total + pageSize - 1) / pageSize
	ok(w, map[string]interface{}{"items": filtered[start:end], "pagination": map[string]int{"page": page, "pageSize": pageSize, "total": total, "totalPages": totalPages}})
}

func atoiDefault(s string, d int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return d
	}
	return n
}
func sortImages(items []ImageMeta, sortParam string) {
	switch sortParam {
	case "createdAt_asc":
		sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
	case "size_desc":
		sort.Slice(items, func(i, j int) bool { return items[i].Size > items[j].Size })
	case "size_asc":
		sort.Slice(items, func(i, j int) bool { return items[i].Size < items[j].Size })
	default:
		sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	}
}

func (s *Server) handleImageByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/images/")
	if id == "" || strings.Contains(id, "/") {
		fail(w, http.StatusNotFound, "NOT_FOUND", "image not found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		meta, err := s.readMeta(id)
		if err != nil {
			fail(w, http.StatusNotFound, "NOT_FOUND", "image not found")
			return
		}
		ok(w, meta)
	case http.MethodDelete:
		meta, err := s.readMeta(id)
		if err != nil {
			fail(w, http.StatusNotFound, "NOT_FOUND", "image not found")
			return
		}
		_ = os.Remove(filepath.Join(s.cfg.DataDir, "images", filepath.Base(meta.Filename)))
		_ = os.Remove(filepath.Join(s.cfg.DataDir, "meta", id+".json"))
		ok(w, map[string]interface{}{"id": id, "deleted": true})
	default:
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (s *Server) handleStaticImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/images/")
	if !staticImageNameRE.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(s.cfg.DataDir, "images", name)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	if ct := mimeByExt(filepath.Ext(name)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}
func mimeByExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return ""
	}
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	items, err := s.scanMetas()
	if err != nil {
		fail(w, http.StatusInternalServerError, "STATS_FAILED", "could not read stats")
		return
	}
	var total int64
	for _, m := range items {
		total += m.Size
	}
	var stat syscall.Statfs_t
	_ = syscall.Statfs(s.cfg.DataDir, &stat)
	diskFree := int64(stat.Bavail) * int64(stat.Bsize)
	ok(w, map[string]interface{}{"imageCount": len(items), "totalSize": total, "totalSizeHuman": humanBytes(total), "diskFree": diskFree, "diskFreeHuman": humanBytes(diskFree)})
}

func humanBytes(n int64) string {
	units := []string{"B", "KB", "MB", "GB", "TB"}
	v := float64(n)
	i := 0
	for v >= 1024 && i < len(units)-1 {
		v /= 1024
		i++
	}
	if i == 0 {
		return fmt.Sprintf("%d B", n)
	}
	return fmt.Sprintf("%.1f %s", v, units[i])
}

func (s *Server) serveFrontend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	// Clean the path
	upath := r.URL.Path
	if upath == "/" {
		upath = "/index.html"
	}
	// Try to serve the static file
	fpath := filepath.Join(s.cfg.StaticDir, filepath.Clean(upath))
	// Security: ensure the resolved path is within StaticDir
	if !strings.HasPrefix(filepath.Clean(fpath), filepath.Clean(s.cfg.StaticDir)) {
		http.NotFound(w, r)
		return
	}
	if fi, err := os.Stat(fpath); err == nil && !fi.IsDir() {
		// Hashed assets get immutable cache
		if strings.HasPrefix(upath, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		http.ServeFile(w, r, fpath)
		return
	}
	// SPA fallback: serve index.html for all non-file routes
	indexPath := filepath.Join(s.cfg.StaticDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, indexPath)
}
