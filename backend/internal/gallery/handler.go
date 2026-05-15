package gallery

import (
	"log"
	"net/http"
	"strconv"

	"ai-image-station/backend/internal/common"
	"ai-image-station/backend/internal/image"

	"github.com/go-chi/chi/v5"
)

// Handler holds the image service dependency for HTTP handlers.
type Handler struct {
	service *image.Service
}

// NewHandler creates a new gallery handler.
func NewHandler(service *image.Service) *Handler {
	return &Handler{service: service}
}

// Upload handles POST /api/images — accepts multipart file upload.
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.Upload(r)
	if err != nil {
		log.Printf("Upload failed: %v", err)
		common.WriteError(w, http.StatusBadRequest, "UPLOAD_FAILED", err.Error())
		return
	}

	common.WriteSuccess(w, http.StatusCreated, image.UploadResponse{
		ID:        result.Meta.ID,
		Filename:  result.Meta.Filename,
		URL:       result.Meta.URL,
		Size:      result.Meta.Size,
		MimeType:  result.Meta.MimeType,
		CreatedAt: image.FormatTime(result.Meta.CreatedAt),
	})
}

// List handles GET /api/images — paginated, filtered, sorted listing.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	sortOrder := r.URL.Query().Get("sortOrder")
	source := r.URL.Query().Get("source")
	keyword := r.URL.Query().Get("keyword")

	resp, err := h.service.List(page, pageSize, sortOrder, source, keyword)
	if err != nil {
		common.WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	common.WriteSuccess(w, http.StatusOK, resp)
}

// Stats handles GET /api/images/stats — returns storage statistics.
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.Stats()
	if err != nil {
		common.WriteError(w, http.StatusInternalServerError, "STATS_FAILED", err.Error())
		return
	}

	common.WriteSuccess(w, http.StatusOK, resp)
}

// Get handles GET /api/images/{id} — returns a single image metadata.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	resp, err := h.service.Get(id)
	if err != nil {
		common.WriteError(w, http.StatusNotFound, "NOT_FOUND", "Image not found")
		return
	}

	common.WriteSuccess(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/images/{id} — removes an image and its metadata.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.service.Delete(id); err != nil {
		common.WriteError(w, http.StatusNotFound, "NOT_FOUND", "Image not found")
		return
	}

	common.WriteSuccess(w, http.StatusOK, image.DeleteResponse{
		ID:      id,
		Deleted: true,
	})
}

// Copy handles GET /api/images/{id}/copy — returns the public URL for an image.
func (h *Handler) Copy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	resp, err := h.service.GetCopyURL(id)
	if err != nil {
		common.WriteError(w, http.StatusNotFound, "NOT_FOUND", "Image not found")
		return
	}

	common.WriteSuccess(w, http.StatusOK, resp)
}
