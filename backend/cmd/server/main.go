package main

import (
	"log"
	"net/http"

	"ai-image-station/backend/internal/auth"
	"ai-image-station/backend/internal/config"
	"ai-image-station/backend/internal/gallery"
	"ai-image-station/backend/internal/image"
	"ai-image-station/backend/internal/server"
	"ai-image-station/backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	store, err := storage.NewFileSystemStorage(cfg.ImageDir, cfg.MetaDir, cfg.TmpDir, cfg.PublicBaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	imageSvc := image.NewService(cfg, store)
	authHandler := auth.NewHandler(cfg)
	galleryHandler := gallery.NewHandler(imageSvc)

	r := server.New(cfg, authHandler, galleryHandler)

	log.Printf("Starting server on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
