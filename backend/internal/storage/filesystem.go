package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ImageMeta represents the metadata for a stored image.
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

// SavedImage contains the result of saving an image.
type SavedImage struct {
	ID       string
	Filename string
	Size     int64
	MimeType string
	SHA256   string
}

// FileSystemStorage implements file-based storage for images and metadata.
type FileSystemStorage struct {
	imageDir string
	metaDir  string
	tmpDir   string
	baseURL  string
}

// NewFileSystemStorage creates a new filesystem storage.
func NewFileSystemStorage(imageDir, metaDir, tmpDir, baseURL string) (*FileSystemStorage, error) {
	// Ensure directories exist
	for _, dir := range []string{imageDir, metaDir, tmpDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}
	return &FileSystemStorage{
		imageDir: imageDir,
		metaDir:  metaDir,
		tmpDir:   tmpDir,
		baseURL:  baseURL,
	}, nil
}

// SaveImage saves an uploaded image file to disk.
func (fs *FileSystemStorage) SaveImage(id string, file multipart.File, mimeType string) (*SavedImage, error) {
	ext := mimeToExt(mimeType)
	filename := id + ext

	// Validate filename safety
	safeFilename := filepath.Base(filename)
	if safeFilename != filename {
		return nil, fmt.Errorf("invalid filename")
	}

	// Write to temp file first, then atomically rename
	tmpPath := filepath.Join(fs.tmpDir, id+".tmp")
	imagePath := filepath.Join(fs.imageDir, safeFilename)

	// Validate no path traversal
	if !strings.HasPrefix(filepath.Clean(imagePath), filepath.Clean(fs.imageDir)+string(os.PathSeparator)) {
		return nil, fmt.Errorf("path traversal detected")
	}

	f, err := os.Create(tmpPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	hasher := sha256.New()
	tee := io.TeeReader(file, hasher)

	size, err := io.Copy(f, tee)
	if err != nil {
		f.Close()
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}

	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to sync temp file: %w", err)
	}
	f.Close()

	if err := os.Rename(tmpPath, imagePath); err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to move file: %w", err)
	}

	sha256Hash := hex.EncodeToString(hasher.Sum(nil))

	return &SavedImage{
		ID:       id,
		Filename: safeFilename,
		Size:     size,
		MimeType: mimeType,
		SHA256:   sha256Hash,
	}, nil
}

// SaveImageFromPath moves a file from a temp path to the image directory.
func (fs *FileSystemStorage) SaveImageFromPath(id string, srcPath string, mimeType string) (*SavedImage, error) {
	ext := mimeToExt(mimeType)
	filename := id + ext

	safeFilename := filepath.Base(filename)
	if safeFilename != filename {
		return nil, fmt.Errorf("invalid filename")
	}

	imagePath := filepath.Join(fs.imageDir, safeFilename)

	if !strings.HasPrefix(filepath.Clean(imagePath), filepath.Clean(fs.imageDir)+string(os.PathSeparator)) {
		return nil, fmt.Errorf("path traversal detected")
	}

	// Get file info for size
	fi, err := os.Stat(srcPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat source file: %w", err)
	}
	size := fi.Size()

	// Compute SHA256
	f, err := os.Open(srcPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open source file: %w", err)
	}
	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		f.Close()
		return nil, fmt.Errorf("failed to hash file: %w", err)
	}
	f.Close()

	sha256Hash := hex.EncodeToString(hasher.Sum(nil))

	// Atomic rename
	if err := os.Rename(srcPath, imagePath); err != nil {
		return nil, fmt.Errorf("failed to move file: %w", err)
	}

	return &SavedImage{
		ID:       id,
		Filename: safeFilename,
		Size:     size,
		MimeType: mimeType,
		SHA256:   sha256Hash,
	}, nil
}

// SaveMeta writes image metadata to a JSON file.
func (fs *FileSystemStorage) SaveMeta(meta *ImageMeta) error {
	tmpPath := filepath.Join(fs.metaDir, meta.ID+".json.tmp")
	metaPath := filepath.Join(fs.metaDir, meta.ID+".json")

	// Validate path safety
	if !strings.HasPrefix(filepath.Clean(metaPath), filepath.Clean(fs.metaDir)+string(os.PathSeparator)) {
		return fmt.Errorf("path traversal detected")
	}

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temp metadata: %w", err)
	}

	if err := os.Rename(tmpPath, metaPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to move metadata: %w", err)
	}

	return nil
}

// GetMeta reads a single image's metadata.
func (fs *FileSystemStorage) GetMeta(id string) (*ImageMeta, error) {
	metaPath := filepath.Join(fs.metaDir, id+".json")

	if !strings.HasPrefix(filepath.Clean(metaPath), filepath.Clean(fs.metaDir)+string(os.PathSeparator)) {
		return nil, fmt.Errorf("not found")
	}

	data, err := os.ReadFile(metaPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("not found")
		}
		return nil, fmt.Errorf("failed to read metadata: %w", err)
	}

	var meta ImageMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	// Populate URL
	meta.URL = fs.buildURL(meta.Filename)

	return &meta, nil
}

// ListMeta reads all image metadata files and returns them sorted by creation time.
func (fs *FileSystemStorage) ListMeta() ([]*ImageMeta, error) {
	entries, err := os.ReadDir(fs.metaDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*ImageMeta{}, nil
		}
		return nil, fmt.Errorf("failed to read meta directory: %w", err)
	}

	var metas []*ImageMeta
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		metaPath := filepath.Join(fs.metaDir, entry.Name())
		data, err := os.ReadFile(metaPath)
		if err != nil {
			continue
		}

		var meta ImageMeta
		if err := json.Unmarshal(data, &meta); err != nil {
			continue
		}

		meta.URL = fs.buildURL(meta.Filename)
		metas = append(metas, &meta)
	}

	return metas, nil
}

// DeleteImage removes both the image file and its metadata.
func (fs *FileSystemStorage) DeleteImage(id string) error {
	// Get metadata to find the filename
	meta, err := fs.GetMeta(id)
	if err != nil {
		return fmt.Errorf("not found")
	}

	// Delete image file
	imagePath := filepath.Join(fs.imageDir, meta.Filename)
	if err := os.Remove(imagePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete image: %w", err)
	}

	// Delete metadata
	metaPath := filepath.Join(fs.metaDir, id+".json")
	if err := os.Remove(metaPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete metadata: %w", err)
	}

	return nil
}

// ImagePath returns the full filesystem path for an image filename.
func (fs *FileSystemStorage) ImagePath(filename string) (string, error) {
	safeFilename := filepath.Base(filename)
	imagePath := filepath.Join(fs.imageDir, safeFilename)

	if !strings.HasPrefix(filepath.Clean(imagePath), filepath.Clean(fs.imageDir)+string(os.PathSeparator)) {
		return "", fmt.Errorf("path traversal detected")
	}

	return imagePath, nil
}

// buildURL constructs the public URL for an image.
func (fs *FileSystemStorage) buildURL(filename string) string {
	if fs.baseURL == "" {
		return "/images/" + filename
	}
	return fs.baseURL + "/images/" + filename
}

// mimeToExt converts a MIME type to a file extension.
func mimeToExt(mimeType string) string {
	switch mimeType {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}
