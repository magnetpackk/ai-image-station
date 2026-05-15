package image

import (
	"time"
)

// ImageSource represents how the image was generated.
type ImageSource string

const (
	SourceTextToImage  ImageSource = "text-to-image"
	SourceImageToImage ImageSource = "image-to-image"
	SourceManualUpload ImageSource = "manual-upload"
)

// Meta represents the full metadata for an image (API response model).
type Meta struct {
	ID               string                 `json:"id"`
	URL              string                 `json:"url"`
	Filename         string                 `json:"filename"`
	Prompt           string                 `json:"prompt"`
	NegativePrompt   string                 `json:"negativePrompt,omitempty"`
	Model            string                 `json:"model"`
	Provider         string                 `json:"provider"`
	Width            int                    `json:"width,omitempty"`
	Height           int                    `json:"height,omitempty"`
	Size             int64                  `json:"size"`
	MimeType         string                 `json:"mimeType"`
	Source           string                 `json:"source"`
	Seed             int64                  `json:"seed,omitempty"`
	GenerationParams map[string]interface{} `json:"generationParams,omitempty"`
	CreatedAt        string                 `json:"createdAt"`
}

// UploadResponse is the response for a successful image upload.
type UploadResponse struct {
	ID        string `json:"id"`
	Filename  string `json:"filename"`
	URL       string `json:"url"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mimeType"`
	CreatedAt string `json:"createdAt"`
}

// ListResponse is the paginated response for image listing.
type ListResponse struct {
	Items      []*Meta    `json:"items"`
	Pagination Pagination `json:"pagination"`
}

// Pagination holds pagination metadata.
type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// DeleteResponse is the response for a successful deletion.
type DeleteResponse struct {
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// CopyResponse is the response for copying a direct link.
type CopyResponse struct {
	URL string `json:"url"`
}

// StatsResponse holds storage statistics.
type StatsResponse struct {
	ImageCount     int    `json:"imageCount"`
	TotalSize      int64  `json:"totalSize"`
	TotalSizeHuman string `json:"totalSizeHuman"`
}

// FormatTime formats a time.Time as ISO8601.
func FormatTime(t time.Time) string {
	return t.Format("2006-01-02T15:04:05Z")
}
