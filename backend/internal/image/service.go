package image

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"ai-image-station/backend/internal/config"
	"ai-image-station/backend/internal/storage"
)

// Service handles image business logic.
type Service struct {
	cfg     *config.Config
	storage *storage.FileSystemStorage
}

// NewService creates a new image service.
func NewService(cfg *config.Config, store *storage.FileSystemStorage) *Service {
	return &Service{
		cfg:     cfg,
		storage: store,
	}
}

// UploadResult contains the result of an upload operation.
type UploadResult struct {
	Meta *storage.ImageMeta
}

// Upload handles multipart file upload.
func (s *Service) Upload(r *http.Request) (*UploadResult, error) {
	if err := r.ParseMultipartForm(s.cfg.MaxUploadSize); err != nil {
		return nil, fmt.Errorf("file too large or invalid form data")
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		return nil, fmt.Errorf("missing file field")
	}
	defer file.Close()

	// Read first 512 bytes for MIME detection
	buf := make([]byte, 512)
	n, _ := io.ReadFull(file, buf)
	if n == 0 {
		return nil, fmt.Errorf("empty file")
	}

	detectedMime := http.DetectContentType(buf[:n])
	if !isAllowedMime(detectedMime, s.cfg.AllowedMimeTypes) {
		return nil, fmt.Errorf("unsupported file type: %s", detectedMime)
	}

	// Check size
	if header.Size > s.cfg.MaxUploadSize {
		return nil, fmt.Errorf("file exceeds maximum size of %d bytes", s.cfg.MaxUploadSize)
	}

	// Generate ID
	id, err := generateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate ID: %w", err)
	}

	// Read form fields before re-parsing
	prompt := r.FormValue("prompt")
	negativePrompt := r.FormValue("negativePrompt")
	model := r.FormValue("model")
	provider := r.FormValue("provider")
	source := r.FormValue("source")
	widthStr := r.FormValue("width")
	heightStr := r.FormValue("height")
	genParamsStr := r.FormValue("generationParams")
	seedStr := r.FormValue("seed")

	if source == "" {
		source = "manual-upload"
	}

	var width, height int
	if widthStr != "" {
		width, _ = strconv.Atoi(widthStr)
	}
	if heightStr != "" {
		height, _ = strconv.Atoi(heightStr)
	}

	var seed int64
	if seedStr != "" {
		seed, _ = strconv.ParseInt(seedStr, 10, 64)
	}

	var generationParams map[string]interface{}
	if genParamsStr != "" {
		json.Unmarshal([]byte(genParamsStr), &generationParams)
	}

	// DON'T close the file here — we still need to read the rest.
	// The defer file.Close() on line 49 will handle cleanup.
	// Don't close r.Body either — the multipart parser needs it.

	// Save to temp, then move to final location.
	tmpPath := s.cfg.TmpDir + "/" + id + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	// The file reader is already partially consumed (512 bytes). 
	// We need to write those 512 bytes first, then copy the rest.
	if _, err := f.Write(buf[:n]); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write: %w", err)
	}

	if _, err := io.Copy(f, file); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write: %w", err)
	}
	f.Close()
	log.Printf("Upload: saved %d bytes to %s (detected MIME: %s)", header.Size, tmpPath, detectedMime)

	// Now use the storage layer's atomic rename
	saved, err := s.storage.SaveImageFromPath(id, tmpPath, detectedMime)
	if err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to save image: %w", err)
	}

	// Create metadata
	now := time.Now().UTC()
	meta := &storage.ImageMeta{
		ID:               id,
		Filename:         saved.Filename,
		Prompt:           prompt,
		NegativePrompt:   negativePrompt,
		Model:            model,
		Provider:         provider,
		Source:           source,
		Width:            width,
		Height:           height,
		Size:             saved.Size,
		MimeType:         saved.MimeType,
		SHA256:           saved.SHA256,
		GenerationParams: generationParams,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if seed != 0 {
		if meta.GenerationParams == nil {
			meta.GenerationParams = make(map[string]interface{})
		}
		meta.GenerationParams["seed"] = seed
	}

	if err := s.storage.SaveMeta(meta); err != nil {
		// Clean up the saved image
		os.Remove(s.cfg.ImageDir + "/" + saved.Filename)
		return nil, fmt.Errorf("failed to save metadata: %w", err)
	}

	return &UploadResult{Meta: meta}, nil
}

// List returns a paginated, filtered, sorted list of images.
func (s *Service) List(page, pageSize int, sortOrder, source, keyword string) (*ListResponse, error) {
	all, err := s.storage.ListMeta()
	if err != nil {
		return nil, err
	}

	// Filter by source
	var filtered []*storage.ImageMeta
	if source != "" {
		for _, m := range all {
			if m.Source == source {
				filtered = append(filtered, m)
			}
		}
	} else {
		filtered = all
	}

	// Filter by keyword (search in prompt)
	if keyword != "" {
		kw := strings.ToLower(keyword)
		var keywordFiltered []*storage.ImageMeta
		for _, m := range filtered {
			if strings.Contains(strings.ToLower(m.Prompt), kw) {
				keywordFiltered = append(keywordFiltered, m)
			}
		}
		filtered = keywordFiltered
	}

	// Sort
	switch sortOrder {
	case "createdAt_asc":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].CreatedAt.Before(filtered[j].CreatedAt)
		})
	case "createdAt_desc", "":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].CreatedAt.After(filtered[j].CreatedAt)
		})
	case "size_desc":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].Size > filtered[j].Size
		})
	case "size_asc":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].Size < filtered[j].Size
		})
	}

	// Paginate
	total := len(filtered)
	if pageSize < 1 {
		pageSize = 30
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if page < 1 {
		page = 1
	}

	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	// Handle empty case
	var paged []*storage.ImageMeta
	if start < total {
		paged = filtered[start:end]
	}

	// Convert to API model
	items := make([]*Meta, len(paged))
	for i, m := range paged {
		items[i] = storageToMeta(m)
	}

	return &ListResponse{
		Items: items,
		Pagination: Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

// Get returns a single image's metadata.
func (s *Service) Get(id string) (*Meta, error) {
	meta, err := s.storage.GetMeta(id)
	if err != nil {
		return nil, err
	}
	return storageToMeta(meta), nil
}

// Delete removes an image and its metadata.
func (s *Service) Delete(id string) error {
	return s.storage.DeleteImage(id)
}

// GetCopyURL returns the public URL for an image.
func (s *Service) GetCopyURL(id string) (*CopyResponse, error) {
	meta, err := s.storage.GetMeta(id)
	if err != nil {
		return nil, err
	}
	return &CopyResponse{URL: meta.URL}, nil
}

// Stats returns storage statistics.
func (s *Service) Stats() (*StatsResponse, error) {
	all, err := s.storage.ListMeta()
	if err != nil {
		return nil, err
	}

	var totalSize int64
	for _, m := range all {
		totalSize += m.Size
	}

	return &StatsResponse{
		ImageCount:     len(all),
		TotalSize:      totalSize,
		TotalSizeHuman: formatBytes(totalSize),
	}, nil
}

// storageToMeta converts a storage ImageMeta to an API Meta.
func storageToMeta(m *storage.ImageMeta) *Meta {
	return &Meta{
		ID:               m.ID,
		URL:              m.URL,
		Filename:         m.Filename,
		Prompt:           m.Prompt,
		NegativePrompt:   m.NegativePrompt,
		Model:            m.Model,
		Provider:         m.Provider,
		Width:            m.Width,
		Height:           m.Height,
		Size:             m.Size,
		MimeType:         m.MimeType,
		Source:           m.Source,
		GenerationParams: m.GenerationParams,
		CreatedAt:        FormatTime(m.CreatedAt),
	}
}

// Helper functions

func isAllowedMime(mime string, allowed []string) bool {
	for _, a := range allowed {
		if mime == a {
			return true
		}
	}
	return false
}

func generateID() (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	const length = 24
	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		result[i] = charset[n.Int64()]
	}
	return "img_" + string(result), nil
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
