package server

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestServer(t *testing.T) (*Server, string) {
	t.Helper()
	dataDir := t.TempDir()
	cfg := Config{
		Addr:          ":0",
		DataDir:       dataDir,
		PublicBaseURL: "https://example.com",
		AccessCode:    "test-access-code",
		ServerSecret:  "test-secret",
		TokenTTL:      24 * time.Hour,
		MaxUploadSize: 10 << 20,
	}
	s, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return s, dataDir
}

func decodeResp(t *testing.T, rr *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var got map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not json: %v body=%s", err, rr.Body.String())
	}
	return got
}

func loginToken(t *testing.T, h http.Handler) string {
	t.Helper()
	body := strings.NewReader(`{"accessCode":"test-access-code"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("login status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeResp(t, rr)
	data := got["data"].(map[string]interface{})
	return data["token"].(string)
}

func TestHealthzReturnsVersion(t *testing.T) {
	s, _ := newTestServer(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	s.Routes().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeResp(t, rr)
	if got["success"] != true {
		t.Fatalf("success=%v", got["success"])
	}
	data := got["data"].(map[string]interface{})
	if data["status"] != "ok" || data["version"] == "" {
		t.Fatalf("unexpected data=%v", data)
	}
}

func TestAuthLoginAndMe(t *testing.T) {
	s, _ := newTestServer(t)
	h := s.Routes()
	token := loginToken(t, h)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeResp(t, rr)
	data := got["data"].(map[string]interface{})
	if data["authenticated"] != true || data["expiresAt"] == "" {
		t.Fatalf("unexpected me data=%v", data)
	}
}

func TestInvalidAccessCodeIsRejected(t *testing.T) {
	s, _ := newTestServer(t)
	body := strings.NewReader(`{"accessCode":"wrong"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	s.Routes().ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeResp(t, rr)
	if got["success"] != false {
		t.Fatalf("success=%v", got["success"])
	}
}

func TestLoginRateLimitUsesRemoteAddrNotForwardedFor(t *testing.T) {
	s, _ := newTestServer(t)
	h := s.Routes()

	for i := 0; i < 5; i++ {
		body := strings.NewReader(`{"accessCode":"wrong"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
		req.RemoteAddr = "198.51.100.10:12345"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", "203.0.113.1")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d status=%d body=%s", i+1, rr.Code, rr.Body.String())
		}
	}

	body := strings.NewReader(`{"accessCode":"test-access-code"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.RemoteAddr = "198.51.100.10:54321"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestProtectedEndpointsRequireBearerToken(t *testing.T) {
	s, _ := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/images", nil)
	rr := httptest.NewRecorder()
	s.Routes().ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func uploadImage(t *testing.T, h http.Handler, token string) map[string]interface{} {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", "cat.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(pngBytes(t)); err != nil {
		t.Fatal(err)
	}
	_ = mw.WriteField("prompt", "a cute cat sitting on the moon")
	_ = mw.WriteField("negativePrompt", "blurry")
	_ = mw.WriteField("model", "dall-e-3")
	_ = mw.WriteField("provider", "openai")
	_ = mw.WriteField("width", "1024")
	_ = mw.WriteField("height", "1024")
	_ = mw.WriteField("source", "text-to-image")
	_ = mw.WriteField("generationParams", `{"quality":"standard"}`)
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/images", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("upload status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeResp(t, rr)
	return got["data"].(map[string]interface{})
}

func TestUploadImagePersistsFileAndMetadata(t *testing.T) {
	s, dataDir := newTestServer(t)
	h := s.Routes()
	token := loginToken(t, h)
	data := uploadImage(t, h, token)

	id := data["id"].(string)
	filename := data["filename"].(string)
	if !strings.HasPrefix(id, "img_") || !strings.HasSuffix(filename, ".png") {
		t.Fatalf("unexpected id/filename: %s %s", id, filename)
	}
	if !staticImageNameRE.MatchString(filename) {
		t.Fatalf("filename does not match static image allowlist: %s", filename)
	}
	if data["url"] != "https://example.com/images/"+filename {
		t.Fatalf("unexpected url=%v", data["url"])
	}
	if _, err := os.Stat(filepath.Join(dataDir, "images", filename)); err != nil {
		t.Fatalf("image not saved: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dataDir, "meta", id+".json")); err != nil {
		t.Fatalf("metadata not saved: %v", err)
	}
}

func TestListDetailStaticAndDeleteImage(t *testing.T) {
	s, _ := newTestServer(t)
	h := s.Routes()
	token := loginToken(t, h)
	uploaded := uploadImage(t, h, token)
	id := uploaded["id"].(string)
	filename := uploaded["filename"].(string)

	req := httptest.NewRequest(http.MethodGet, "/api/images?page=1&pageSize=30&sort=createdAt_desc&keyword=cat", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", rr.Code, rr.Body.String())
	}
	list := decodeResp(t, rr)["data"].(map[string]interface{})
	items := list["items"].([]interface{})
	if len(items) != 1 {
		t.Fatalf("items len=%d", len(items))
	}

	req = httptest.NewRequest(http.MethodGet, "/api/images/"+id, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("detail status=%d body=%s", rr.Code, rr.Body.String())
	}
	detail := decodeResp(t, rr)["data"].(map[string]interface{})
	if detail["prompt"] != "a cute cat sitting on the moon" {
		t.Fatalf("detail=%v", detail)
	}

	req = httptest.NewRequest(http.MethodGet, "/images/"+filename, nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("static status=%d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type=%s", ct)
	}
	if cc := rr.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Fatalf("cache-control=%s", cc)
	}

	invalidStaticNames := []string{
		"../" + filename,
		"img_bad.jpg",
		"evil.png",
		"img_bad.svg",
		"img_bad.png/extra",
	}
	for _, name := range invalidStaticNames {
		req = httptest.NewRequest(http.MethodGet, "/images/"+name, nil)
		rr = httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code == http.StatusOK {
			t.Fatalf("static name %q unexpectedly served with status=%d", name, rr.Code)
		}
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/images/"+id, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", rr.Code, rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/images/"+id, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("detail after delete status=%d", rr.Code)
	}
}

func TestUploadRejectsSVG(t *testing.T) {
	s, _ := newTestServer(t)
	h := s.Routes()
	token := loginToken(t, h)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", "bad.svg")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write([]byte(`<svg><script>alert(1)</script></svg>`))
	_ = mw.WriteField("prompt", "bad")
	_ = mw.WriteField("model", "x")
	_ = mw.WriteField("provider", "x")
	_ = mw.WriteField("source", "manual-upload")
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/images", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestStatsReturnsStorageUsage(t *testing.T) {
	s, _ := newTestServer(t)
	h := s.Routes()
	token := loginToken(t, h)
	_ = uploadImage(t, h, token)

	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	data := decodeResp(t, rr)["data"].(map[string]interface{})
	if data["imageCount"].(float64) != 1 || data["totalSize"].(float64) <= 0 || data["totalSizeHuman"] == "" {
		t.Fatalf("unexpected stats=%v", data)
	}
}
