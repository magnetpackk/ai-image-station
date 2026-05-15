package server

import (
	"net/http"
	"time"

	"ai-image-station/backend/internal/auth"
	"ai-image-station/backend/internal/config"
	"ai-image-station/backend/internal/gallery"
	"ai-image-station/backend/internal/middleware"

	"github.com/go-chi/chi/v5"
)

// New creates and configures the HTTP router with all routes and middleware.
func New(cfg *config.Config, authHandler *auth.Handler, galleryHandler *gallery.Handler) http.Handler {
	r := chi.NewRouter()

	// Global middleware (applied to all routes)
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.Logging)

	// Public routes (no authentication required)
	r.Post("/api/auth/login", authHandler.Login)

	// Protected routes (authentication required)
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(cfg.ServerSecret))

		r.Get("/api/auth/session", authHandler.Session)

		// Upload rate limiter: 30 uploads per minute per IP
		uploadLimiter := middleware.NewUploadRateLimiter(30, time.Minute)

		// Image gallery routes
		r.Get("/api/images", galleryHandler.List)
		r.Get("/api/images/stats", galleryHandler.Stats)
		r.Get("/api/images/{id}", galleryHandler.Get)
		r.Delete("/api/images/{id}", galleryHandler.Delete)
		r.Get("/api/images/{id}/copy", galleryHandler.Copy)

		// Upload route with rate limiting
		r.With(middleware.UploadRateLimitMiddleware(uploadLimiter)).Post("/api/images", galleryHandler.Upload)
	})

	// Static file serving — uploaded images (public, no auth)
	r.Handle("/images/*", http.StripPrefix("/images/", http.FileServer(http.Dir(cfg.ImageDir))))

	// Frontend static assets (public, no auth)
	r.Handle("/*", http.FileServer(http.Dir("static")))

	return r
}
